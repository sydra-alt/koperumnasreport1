-- PTE Harian versi poin (17-18 September 2026, instruksi CEO) --
-- MENGGANTIKAN skema lama "Enam Kewajiban" (pte_daily, migrasi 0001) untuk
-- pencatatan HARIAN. pte_daily TIDAK DIHAPUS (dinonaktifkan, bukan
-- dihapus, sesuai instruksi eksplisit) -- kode lama (lib/api/pte.ts,
-- hitungKelayakanBonus/hitungPotongan) tetap ada tapi tidak lagi dipanggil
-- dari LaporForm.tsx setelah migrasi ini. Bonus Rp500rb/potongan Rp300rb
-- SENGAJA TIDAK dibangun ulang untuk skema poin ini -- 6 pertanyaan aturan
-- bonus/potongan masih terbuka, CEO kirim menyusul. pte_mulai_berlaku
-- TETAP null, tidak disentuh migrasi ini.
--
-- Cakupan CUMA Indosteak & Indokopi (instruksi eksplisit, koreksi CEO
-- 18 September 2026) -- Koperumnas/DTI-Precast/Rukost diabaikan (nol orang
-- ditugaskan ke sana sejak pivot 2 September, lihat docs/SISA-PEKERJAAN.md),
-- tapi TETAP diberi baris di unit_bisnis (label_undangan null) supaya
-- "unit lain tinggal diisi kalau suatu saat dipakai lagi" -- bukan
-- diberi kode cabang baru kalau nanti dipakai, cukup isi kolom lewat Admin.
-- Thrifting SENGAJA dikosongkan juga -- belum ada aturan PTE-nya sama
-- sekali, jangan ditebak.

-- ═══ UNIT BISNIS (label per unit, bukan switch di kode) ═══════════════
create table public.unit_bisnis (
  kode           text primary key,
  nama           text not null,
  -- null = unit ini belum punya aturan PTE (Koperumnas/DTI-Precast/Rukost/
  -- Thrifting sekarang) -- UI harus menampilkan "belum ada aturan PTE
  -- untuk unit ini", BUKAN menebak/menyembunyikan begitu saja.
  label_undangan text,
  created_at     timestamptz not null default now()
);

insert into public.unit_bisnis (kode, nama, label_undangan) values
  ('koperumnas',  'Koperumnas',     null),
  ('dti_precast', 'DTI / Precast',  null),
  ('rukost',      'Rukost',         null),
  ('thrifting',   'Thrifting',      null),
  ('indokopi',    'Indokopi',       'Undangan Customer Datang'),
  ('indosteak',   'Indosteak',      'Undangan Customer Makan')
on conflict (kode) do nothing;

alter table public.unit_bisnis enable row level security;
-- Pola SAMA PERSIS `outlet_admin`/`outlet_select` (migrasi awal, direplikasi
-- lagi di 0055) -- admin (CEO) kelola penuh lewat Admin tanpa deploy, semua
-- yang login boleh membaca (dipakai form personal_marketing utk resolusi label).
create policy unit_bisnis_admin on public.unit_bisnis for all
  using (public.is_admin()) with check (public.is_admin());
create policy unit_bisnis_select on public.unit_bisnis for select to authenticated
  using (auth.uid() is not null);

-- outlet.unit_kode -- Indokopi Jatinegara/Lite Kemayoran & Indosteak
-- Cempaka/Pekansari (4 outlet aktif sekarang) ditautkan lewat prefix nama
-- (satu-satunya sinyal yang ada, tidak ada kolom brand terpisah) --
-- kalau outlet baru ditambah dengan nama yang tidak diawali "Indokopi"/
-- "Indosteak", unit_kode-nya harus diisi manual (tidak otomatis).
alter table public.outlet add column unit_kode text references public.unit_bisnis(kode);
update public.outlet set unit_kode = 'indokopi'  where nama ilike 'Indokopi%';
update public.outlet set unit_kode = 'indosteak' where nama ilike 'Indosteak%';

-- ═══ POLICY -- poin PTE, bukan angka mati di kode (CLAUDE.md #4) ══════
insert into public.policy (key, value) values
  ('pte_poin_digital_per_platform', '10'),
  ('pte_poin_undangan_per_orang',   '10'),
  ('pte_poin_undangan_target',      '2'),
  ('pte_poin_review_lengkap',       '10'),
  ('pte_poin_review_target',        '2'),
  ('pte_poin_kesaksian_lengkap',    '20'),
  ('pte_poin_kesaksian_target',     '2')
on conflict (key) do nothing;

-- ═══ PTE HARIAN (poin) ═════════════════════════════════════════════════
-- Poin DIHITUNG lewat kode (lib/api/pteHarian.ts) dari isian+bukti sungguhan
-- di tabel attachment SAAT KIRIM, lalu DISIMPAN di sini (snapshot) -- BUKAN
-- generated column (butuh hitungan dari pte_harian_item, tabel lain, tidak
-- bisa direferensikan generated column Postgres) dan BUKAN dihitung ulang
-- tiap dibaca dari view (kalau policy.pte_poin_* berubah bulan depan,
-- angka bulan lalu TIDAK BOLEH ikut berubah -- sama prinsipnya dengan
-- unitCogs di pos-fnb: nilai dikunci di titik hitung, bukan dihitung ulang
-- selamanya). Field digital (tiktok/ig/threads) kolom TETAP (instruksi
-- eksplisit CEO) -- BUKAN tabel anak, karena jumlahnya memang tetap tiga.
create table public.pte_harian (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profile(id) on delete cascade,
  tanggal        date not null,
  tiktok_tautan  text,
  ig_tautan      text,
  threads_tautan text,
  poin_digital   int not null default 0,
  poin_undangan  int not null default 0,
  poin_review    int not null default 0,
  poin_kesaksian int not null default 0,
  poin_total     int not null default 0,
  report_id      uuid references public.report(id) on delete set null,
  updated_at     timestamptz not null default now(),
  unique (user_id, tanggal)
);
create trigger pte_harian_updated before update on public.pte_harian
  for each row execute function public.set_updated_at();

-- Tabel anak (bukan slot tetap, instruksi eksplisit CEO 18 September 2026)
-- -- undangan/review/kesaksian sama-sama isian berulang per orang/per
-- item, jumlah baris tidak dibatasi di form (poin tetap mentok di target
-- kebijakan, lihat lib/api/pteHarian.ts). Kolom type-specific dibiarkan
-- nullable (bukan tabel terpisah per jenis) -- tiga jenis ini kecil dan
-- terkait erat (semuanya "bukti kegiatan personal marketing harian"),
-- memisahkannya jadi 3 tabel cuma menambah join tanpa manfaat nyata.
create table public.pte_harian_item (
  id                uuid primary key default gen_random_uuid(),
  pte_harian_id     uuid not null references public.pte_harian(id) on delete cascade,
  jenis             text not null check (jenis in ('undangan', 'review', 'kesaksian')),
  urutan            int not null,
  nama              text not null,
  kontak            text,        -- undangan saja
  tanggal_review    date,        -- review saja
  setuju_publikasi  boolean,     -- kesaksian saja
  created_at        timestamptz not null default now(),
  unique (pte_harian_id, jenis, urutan)
);
create index pte_harian_item_parent_idx on public.pte_harian_item (pte_harian_id);

-- ─── RLS -- pola SAMA PERSIS pte_daily (migrasi 0002): milik sendiri +
-- pengawas marketing boleh baca ────────────────────────────────────────
alter table public.pte_harian      enable row level security;
alter table public.pte_harian_item enable row level security;

create policy pte_harian_select on public.pte_harian for select using (
  user_id = auth.uid() or public.has_role('ceo')
  or public.has_role('pusat') or public.has_role('kontrol_marketing')
  or public.has_role('manager_resto') or public.is_hrd_kadiv()
);
create policy pte_harian_write on public.pte_harian for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy pte_harian_item_select on public.pte_harian_item for select using (
  exists (
    select 1 from public.pte_harian ph where ph.id = pte_harian_id and (
      ph.user_id = auth.uid() or public.has_role('ceo')
      or public.has_role('pusat') or public.has_role('kontrol_marketing')
      or public.has_role('manager_resto') or public.is_hrd_kadiv()
    )
  )
);
create policy pte_harian_item_write on public.pte_harian_item for all
  using (exists (select 1 from public.pte_harian ph where ph.id = pte_harian_id and ph.user_id = auth.uid()))
  with check (exists (select 1 from public.pte_harian ph where ph.id = pte_harian_id and ph.user_id = auth.uid()));

-- ─── WRITE-ONCE setelah lewat hari (instruksi eksplisit CEO, pola
-- "countedCash" pos-fnb) -- RLS di atas mengatur SIAPA boleh menulis
-- datanya sendiri, trigger di bawah mengatur KAPAN (tidak lagi setelah
-- tanggal baris itu berlalu di WIB), independen dari role apa pun.
-- Koreksi HANYA lewat koreksi_pte_harian() (security definer) di bawah,
-- yang membuka jalur ini sesaat lewat session flag lalu menutupnya lagi. ──
create or replace function public.jaga_pte_harian_write_once()
returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.izinkan_koreksi_pte', true), 'false') = 'true' then
    return new;
  end if;
  if old.tanggal < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Isian PTE tanggal % sudah lewat hari, tidak bisa diubah langsung -- ajukan koreksi ke atasan (CEO/HRD kadiv).', old.tanggal;
  end if;
  return new;
end $$;

create trigger pte_harian_write_once before update on public.pte_harian
  for each row execute function public.jaga_pte_harian_write_once();

create or replace function public.jaga_pte_harian_item_write_once()
returns trigger
language plpgsql as $$
declare
  v_tanggal date;
begin
  if coalesce(current_setting('app.izinkan_koreksi_pte', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  select tanggal into v_tanggal from public.pte_harian where id = coalesce(new.pte_harian_id, old.pte_harian_id);
  if v_tanggal is not null and v_tanggal < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Isian PTE tanggal % sudah lewat hari, tidak bisa diubah langsung -- ajukan koreksi ke atasan (CEO/HRD kadiv).', v_tanggal;
  end if;
  return coalesce(new, old);
end $$;

create trigger pte_harian_item_write_once before insert or update or delete on public.pte_harian_item
  for each row execute function public.jaga_pte_harian_item_write_once();

-- ─── Koreksi atasan (siapa, kapan, dari apa ke apa) -- pola SAMA PERSIS
-- pte_pengecualian_log (migrasi 0035), gerbang atasan SAMA PERSIS
-- putuskan_cuti (migrasi 0025: ceo ATAU is_hrd_kadiv(), bukan gerbang
-- baru) ──────────────────────────────────────────────────────────────
create table public.pte_koreksi_log (
  id            uuid primary key default gen_random_uuid(),
  pte_harian_id uuid not null references public.pte_harian(id) on delete cascade,
  actor_id      uuid references public.profile(id),
  alasan        text not null,
  sebelum       jsonb not null,
  sesudah       jsonb not null,
  created_at    timestamptz not null default now()
);
alter table public.pte_koreksi_log enable row level security;
-- Tidak ada policy insert untuk klien -- HANYA koreksi_pte_harian()
-- (security definer) yang menulis, pola sama pte_pengecualian_log.
create policy pte_koreksi_log_select on public.pte_koreksi_log for select using (
  public.has_role('ceo') or public.is_hrd_kadiv()
);

-- Kolom yang boleh dikoreksi lewat fungsi ini dibatasi whitelist eksplisit
-- (bukan UPDATE dinamis dari jsonb apa pun) -- mencegah p_perubahan diam-diam
-- menimpa kolom lain (mis. user_id/tanggal) lewat argumen yang tidak terduga.
-- Koreksi baris pte_harian_item (nama/kontak per orang) BELUM ada RPC-nya --
-- utang, dicatat di laporan, bukan ditebak bentuknya di sini.
create or replace function public.koreksi_pte_harian(
  p_pte_harian_id uuid,
  p_perubahan jsonb,
  p_alasan text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sebelum jsonb;
  v_sesudah jsonb;
  v_kunci text;
  v_izin text[] := array['tiktok_tautan', 'ig_tautan', 'threads_tautan',
                          'poin_digital', 'poin_undangan', 'poin_review', 'poin_kesaksian', 'poin_total'];
begin
  if not (public.has_role('ceo') or public.is_hrd_kadiv()) then
    raise exception 'Tidak berhak mengoreksi isian PTE.';
  end if;
  if p_alasan is null or length(trim(p_alasan)) = 0 then
    raise exception 'Alasan koreksi wajib diisi.';
  end if;

  for v_kunci in select jsonb_object_keys(p_perubahan) loop
    if not (v_kunci = any(v_izin)) then
      raise exception 'Kolom % tidak boleh dikoreksi lewat fungsi ini.', v_kunci;
    end if;
  end loop;

  select to_jsonb(ph) into v_sebelum from public.pte_harian ph where id = p_pte_harian_id;
  if v_sebelum is null then
    raise exception 'Baris PTE harian tidak ditemukan.';
  end if;

  perform set_config('app.izinkan_koreksi_pte', 'true', true);

  update public.pte_harian set
    tiktok_tautan  = coalesce(p_perubahan->>'tiktok_tautan', tiktok_tautan),
    ig_tautan      = coalesce(p_perubahan->>'ig_tautan', ig_tautan),
    threads_tautan = coalesce(p_perubahan->>'threads_tautan', threads_tautan),
    poin_digital   = coalesce((p_perubahan->>'poin_digital')::int, poin_digital),
    poin_undangan  = coalesce((p_perubahan->>'poin_undangan')::int, poin_undangan),
    poin_review    = coalesce((p_perubahan->>'poin_review')::int, poin_review),
    poin_kesaksian = coalesce((p_perubahan->>'poin_kesaksian')::int, poin_kesaksian),
    poin_total     = coalesce((p_perubahan->>'poin_total')::int, poin_total)
  where id = p_pte_harian_id;

  select to_jsonb(ph) into v_sesudah from public.pte_harian ph where id = p_pte_harian_id;

  insert into public.pte_koreksi_log (pte_harian_id, actor_id, alasan, sebelum, sesudah)
  values (p_pte_harian_id, auth.uid(), p_alasan, v_sebelum, v_sesudah);
end $$;
