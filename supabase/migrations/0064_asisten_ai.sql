-- Asisten AI fase 1 -- chat & analisis (28 September 2026). Lihat
-- docs/RENCANA-REVISI-24-SEPTEMBER-2026.md §12.
--
-- Prinsip (§10 dokumen itu): Gemini TIDAK PERNAH menulis SQL dan TIDAK PERNAH
-- memegang service-role key. Ia cuma memilih salah satu alat tetap
-- (lib/ai/alat.ts); alat lokal memanggil fungsi di bawah LEWAT SESI USER yang
-- bertanya, jadi RLS yang sama persis dengan layar biasa berlaku.
--
-- Isi:
-- 1. Dua kunci policy: batas pesan harian per orang, dan peran yang boleh
--    memakai asisten. Angka/daftar di tabel policy, bukan di kode (CLAUDE.md #4).
-- 2. ai_percakapan + ai_pesan: riwayat chat PRIBADI (tiap orang cuma melihat
--    miliknya, CEO pun tidak).
-- 3. ai_panggilan_alat: log setiap alat yang dipanggil -- siapa, alat apa,
--    argumen apa, berapa baris kembali. Satu-satunya catatan apa yang
--    sungguhan DIBACA AI (§4 dokumen: histori AI). Pemilik + CEO bisa membaca.
-- 4. Tiga fungsi baca rentang tanggal untuk alat lokal, SECURITY INVOKER
--    (bawaan) -- tunduk RLS pemanggil, agregasi di Postgres (CLAUDE.md #7).

begin;

-- ─── 1. Pengaturan ─────────────────────────────────────────────────────────
insert into public.policy (key, value) values
  ('ai_batas_pesan_harian', '30'),
  ('ai_peran_boleh', '["ceo","kadiv","manager_resto"]')
on conflict (key) do nothing;

-- Gerbang MASUK asisten. Baca daftar peran dari policy; profil nonaktif
-- tidak pernah boleh. security definer supaya bisa dipakai di policy RLS
-- tanpa bergantung hak baca tabel role milik pemanggil.
create or replace function public.boleh_pakai_ai()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.role r
    join public.profile p on p.id = r.user_id and p.aktif
    where r.user_id = auth.uid()
      and r.role in (
        select jsonb_array_elements_text(
          coalesce((select value from public.policy where key = 'ai_peran_boleh'), '[]'::jsonb)
        )
      )
  );
$$;

-- ─── 2. Riwayat chat ──────────────────────────────────────────────────────
create table public.ai_percakapan (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profile(id) on delete cascade,
  judul       text not null check (char_length(judul) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index ai_percakapan_user_updated_idx on public.ai_percakapan (user_id, updated_at desc);

create table public.ai_pesan (
  id             uuid primary key default gen_random_uuid(),
  percakapan_id  uuid not null references public.ai_percakapan(id) on delete cascade,
  user_id        uuid not null default auth.uid() references public.profile(id) on delete cascade,
  peran          text not null check (peran in ('user', 'model')),
  isi            text not null check (char_length(isi) between 1 and 8000),
  tabel          jsonb,  -- tabel hasil alat yang ditampilkan bersama jawaban (snapshot)
  created_at     timestamptz not null default now()
);
create index ai_pesan_percakapan_idx on public.ai_pesan (percakapan_id, created_at);
create index ai_pesan_user_created_idx on public.ai_pesan (user_id, created_at);

-- ─── 3. Log panggilan alat ────────────────────────────────────────────────
create table public.ai_panggilan_alat (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profile(id) on delete cascade,
  percakapan_id  uuid not null references public.ai_percakapan(id) on delete cascade,
  alat           text not null,
  argumen        jsonb not null default '{}'::jsonb,
  sumber         text not null check (sumber in ('lokal', 'pos')),
  -- ok | kosong | tanpa_akses_pos | ditolak | argumen_salah | galat
  status         text not null,
  jumlah_baris   integer,
  created_at     timestamptz not null default now()
);
create index ai_panggilan_alat_user_created_idx on public.ai_panggilan_alat (user_id, created_at desc);
create index ai_panggilan_alat_created_idx on public.ai_panggilan_alat (created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.ai_percakapan enable row level security;
alter table public.ai_pesan enable row level security;
alter table public.ai_panggilan_alat enable row level security;

create policy ai_percakapan_select on public.ai_percakapan for select
  using (user_id = auth.uid());
create policy ai_percakapan_insert on public.ai_percakapan for insert
  with check (user_id = auth.uid() and public.boleh_pakai_ai());
create policy ai_percakapan_update on public.ai_percakapan for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Append-only: tidak ada update/delete -- juga yang membuat batas harian
-- tidak bisa diakali dengan menghapus pesan lama.
create policy ai_pesan_select on public.ai_pesan for select
  using (user_id = auth.uid());
create policy ai_pesan_insert on public.ai_pesan for insert
  with check (
    user_id = auth.uid()
    and public.boleh_pakai_ai()
    and exists (select 1 from public.ai_percakapan c where c.id = percakapan_id and c.user_id = auth.uid())
  );

-- Log: pemilik + CEO (pemantauan biaya & penyalahgunaan). Append-only.
create policy ai_panggilan_alat_select on public.ai_panggilan_alat for select
  using (user_id = auth.uid() or public.has_role('ceo'));
create policy ai_panggilan_alat_insert on public.ai_panggilan_alat for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.ai_percakapan c where c.id = percakapan_id and c.user_id = auth.uid())
  );

revoke all on public.ai_percakapan, public.ai_pesan, public.ai_panggilan_alat from anon, authenticated;
grant select, insert on public.ai_percakapan, public.ai_pesan, public.ai_panggilan_alat to authenticated;
grant update (judul, updated_at) on public.ai_percakapan to authenticated;

-- ─── Status asisten + batas pesan harian (ditegakkan DI DATABASE) ────────
-- "Hari" = hari kalender Asia/Jakarta.
--
-- DUA keadaan yang SENGAJA dibedakan (instruksi CEO, 28 September 2026):
-- - `aktif = false`: asisten BELUM DIAKTIFKAN untuk bisnis ini -- kunci
--   policy `ai_peran_boleh` hilang/kosong, atau `ai_batas_pesan_harian`
--   hilang/0. Pesannya "belum diaktifkan", BUKAN "batas tercapai" (supaya
--   tidak dikira rusak).
-- - `terpakai >= batas` dengan batas > 0: jatah hari ini habis.
-- Tidak ada angka cadangan di kode: kunci hilang = tidak aktif.
create or replace function public.ai_status()
returns table (aktif boolean, boleh boolean, batas int, terpakai int)
language sql stable security definer set search_path = public as $$
  with p as (
    select
      coalesce((select (value #>> '{}')::int from public.policy where key = 'ai_batas_pesan_harian'), 0) as batas,
      coalesce((select jsonb_array_length(value) from public.policy
                where key = 'ai_peran_boleh' and jsonb_typeof(value) = 'array'), 0) as jumlah_peran
  )
  select
    p.batas > 0 and p.jumlah_peran > 0,
    public.boleh_pakai_ai(),
    p.batas,
    (select count(*)::int from public.ai_pesan
      where user_id = auth.uid() and peran = 'user'
        and created_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'))
  from p;
$$;

create or replace function public.ai_jaga_batas_pesan()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_batas int;
  v_terpakai int;
begin
  if new.peran <> 'user' then
    return new;
  end if;
  -- Kunci per orang: dua kiriman bersamaan tidak bisa sama-sama lolos di angka terakhir.
  perform pg_advisory_xact_lock(hashtext('ai_batas_pesan:' || new.user_id::text));
  v_batas := coalesce((select (value #>> '{}')::int from public.policy where key = 'ai_batas_pesan_harian'), 0);
  if v_batas <= 0 then
    raise exception 'AI_TIDAK_AKTIF' using errcode = 'P0001';
  end if;
  select count(*) into v_terpakai from public.ai_pesan
    where user_id = new.user_id and peran = 'user'
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta');
  if v_terpakai >= v_batas then
    raise exception 'BATAS_PESAN_AI:%', v_batas using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger ai_pesan_jaga_batas before insert on public.ai_pesan
  for each row execute function public.ai_jaga_batas_pesan();

-- Percakapan naik ke atas daftar setiap ada pesan baru.
create or replace function public.ai_sentuh_percakapan()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.ai_percakapan set updated_at = now() where id = new.percakapan_id;
  return new;
end $$;

create trigger ai_pesan_sentuh_percakapan after insert on public.ai_pesan
  for each row execute function public.ai_sentuh_percakapan();

-- ─── Cakupan hak baca pemanggil ──────────────────────────────────────────
-- Dipakai alat lokal supaya jawaban yang kosong/sebagian SELALU menyebut
-- batas hak -- "tidak ada data" hanya boleh dipakai kalau pemanggil memang
-- melihat semuanya. Cermin persis aturan RLS masing-masing tabel:
--   laporan  -> can_see_report(): hanya CEO yang melihat semua form
--   presensi -> absensi_select: CEO, pusat, kadiv HRD melihat semua orang
--   omzet    -> omzet_pos_harian_select: CEO & accounting
create or replace function public.ai_cakupan()
returns table (laporan_semua boolean, presensi_semua boolean, omzet_pos boolean)
language sql stable security definer set search_path = public as $$
  select
    public.has_role('ceo'),
    public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv(),
    public.has_role('ceo') or public.has_role('accounting');
$$;

-- ─── 4. Fungsi baca untuk alat lokal (SECURITY INVOKER -- RLS pemanggil) ──
-- Status laporan per orang per form dalam satu rentang, di atas
-- papan_untuk_tanggal() yang sama dengan Papan Kontrol. Maks 31 hari.
create or replace function public.ai_status_laporan(p_dari date, p_sampai date)
returns table (
  pic_nama text, form_key text, lingkup text,
  hari_wajib int, hari_terkirim int, hari_terlambat int, hari_belum int,
  tanggal_belum date[]
)
language plpgsql stable as $$
begin
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai - p_dari > 30 then
    raise exception 'Rentang tanggal tidak valid (maksimal 31 hari).';
  end if;
  return query
    select p.pic_nama, p.form_key, p.scope_nama,
           count(*)::int,
           count(*) filter (where p.report_id is not null)::int,
           count(*) filter (where p.status = 'terlambat')::int,
           count(*) filter (where p.report_id is null)::int,
           coalesce(array_agg(d.tanggal::date order by d.tanggal) filter (where p.report_id is null), '{}')
    from generate_series(p_dari, p_sampai, interval '1 day') as d(tanggal)
    cross join lateral public.papan_untuk_tanggal(d.tanggal::date) p
    join public.assignment a on a.id = p.assignment_id
    -- HANYA penugasan yang laporannya boleh dilihat pemanggil. Tanpa ini,
    -- penugasan yang terlihat tapi laporannya tersembunyi RLS akan terbaca
    -- "belum lapor" -- angka palsu, bukan sekadar data kosong.
    where public.can_see_report(p.form_key, a.user_id)
    group by p.pic_nama, p.form_key, p.scope_nama
    order by count(*) filter (where p.report_id is null) desc, p.pic_nama, p.form_key;
end $$;

-- Ringkasan presensi per orang, di atas presensi_untuk_tanggal(). Orang tanpa
-- hak tinjau cuma melihat dirinya. Maks 31 hari.
-- hari_tanpa_absen_masuk TERMASUK hari libur/ di luar jadwal -- fungsi dasar
-- tidak tahu jadwal kerja per orang.
create or replace function public.ai_presensi(p_dari date, p_sampai date)
returns table (
  nama text, titik text,
  hari_absen_masuk int, hari_terlambat int, total_menit_terlambat int,
  hari_tanpa_absen_masuk int
)
language plpgsql stable as $$
begin
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai - p_dari > 30 then
    raise exception 'Rentang tanggal tidak valid (maksimal 31 hari).';
  end if;
  return query
    select x.nama, max(x.titik_nama),
           count(x.masuk_id)::int,
           count(*) filter (where coalesce(x.terlambat_menit, 0) > 0)::int,
           coalesce(sum(x.terlambat_menit) filter (where x.terlambat_menit > 0), 0)::int,
           count(*) filter (where x.masuk_id is null)::int
    from generate_series(p_dari, p_sampai, interval '1 day') as d(tanggal)
    cross join lateral public.presensi_untuk_tanggal(d.tanggal::date) x
    -- Cermin persis policy absensi_select: orang yang absensinya tidak boleh
    -- dilihat pemanggil TIDAK ikut (kalau ikut, tampil "tidak pernah absen"
    -- -- angka palsu).
    where x.user_id = auth.uid() or public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv()
    group by x.user_id, x.nama
    order by count(*) filter (where coalesce(x.terlambat_menit, 0) > 0) desc, x.nama;
end $$;

-- Omzet POS harian (hasil sinkron pos-fnb) per outlet + total, satu kali
-- jalan lewat grouping sets. Hanya CEO & accounting (peran lain DITOLAK
-- eksplisit). p_outlet = potongan nama outlet (opsional).
-- Maks 92 hari.
create or replace function public.ai_omzet_pos(p_dari date, p_sampai date, p_outlet text default null)
returns table (
  tingkat text, outlet text, tanggal date,
  jumlah_order bigint, penjualan_bersih bigint, uang_diterima bigint, refund bigint
)
language plpgsql stable as $$
begin
  -- Di luar hak = DITOLAK dengan jelas, bukan nol baris (nol baris terbaca
  -- "omzetnya nol"). Cermin policy omzet_pos_harian_select.
  if not (public.has_role('ceo') or public.has_role('accounting')) then
    raise exception 'TIDAK_BERHAK' using errcode = '42501';
  end if;
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai - p_dari > 91 then
    raise exception 'Rentang tanggal tidak valid (maksimal 92 hari).';
  end if;
  return query
    select
      case when grouping(o.nama) = 1 then 'total' when grouping(h.tanggal) = 1 then 'outlet' else 'hari' end,
      o.nama, h.tanggal,
      sum(h.jumlah_order)::bigint, sum(h.penjualan_bersih)::bigint, sum(h.uang_diterima)::bigint, sum(h.refund)::bigint
    from public.omzet_pos_harian h
    join public.outlet o on o.id = h.outlet_id
    where h.tanggal between p_dari and p_sampai
      and (p_outlet is null or p_outlet = '' or o.nama ilike '%' || p_outlet || '%')
    group by grouping sets ((o.nama, h.tanggal), (o.nama), ())
    having count(*) > 0
    order by grouping(o.nama), o.nama, grouping(h.tanggal) desc, h.tanggal;
end $$;

revoke all on function public.ai_status_laporan(date, date), public.ai_presensi(date, date),
  public.ai_omzet_pos(date, date, text), public.ai_status(), public.ai_cakupan(), public.boleh_pakai_ai() from public, anon;
grant execute on function public.ai_status_laporan(date, date), public.ai_presensi(date, date),
  public.ai_omzet_pos(date, date, text), public.ai_status(), public.ai_cakupan(), public.boleh_pakai_ai() to authenticated;

commit;
