-- Omzet POS (mesin) masuk ke Silang-Cek Omzet Resto -- TIGA angka untuk outlet
-- dan tanggal yang sama (19 September 2026, keputusan CEO):
--   Manager Resto (ketikan) | Kontrol F&B/Ita (ketikan) | POS (mesin) + selisih.
-- Pendekatan disetujui: TARIKAN (bukan dorongan). Laporan menarik ringkasan
-- dari endpoint baca-saja pos-fnb (`GET /api/integrasi/omzet-harian`) lewat
-- Route Handler /api/sinkron/pos, lalu MENYALIN agregat harian ke tabel di
-- bawah. Tidak ada koneksi database lintas proyek, tidak ada kredensial
-- database yang menyeberang.
--
-- ATURAN YANG DIJAGA DI SINI (bukan di React -- CLAUDE.md #7):
--   * Angka POS SELALU dari tabel salinan, TIDAK PERNAH diketik siapa pun:
--     klien (authenticated) tidak punya hak tulis apa pun ke tiga tabel di
--     bawah. Satu-satunya pintu tulis = terapkan_sinkron_pos(), hanya untuk
--     service_role, dipanggil Route Handler.
--   * BASI disembunyikan: umur sinkron berhasil terakhir > policy
--     `pos_sinkron_maks_umur_jam` (bawaan 30) -> angka POS NULL + status 'basi'.
--     Dihitung di SERVER database (now()), bukan jam browser.
--   * Nol transaksi BUKAN Rp 0: status 'tanpa_transaksi' (baris tidak ada di
--     salinan padahal tanggalnya tercakup sinkron berhasil). Beda dengan
--     'belum_ada_data_pos' (tidak tercakup sinkron) dan 'belum_dipetakan'.
--   * Selisih hanya dihitung kalau KEDUA angka ada, dan selisih terhadap POS
--     hanya untuk hari bisnis yang SUDAH TUTUP ('final') -- angka hari
--     berjalan bersifat sementara.
--   * Definisi hari: `tanggal` di omzet_pos_harian = HARI BISNIS POS
--     (orders.business_date, batas hari per outlet, saat ini 04:00), disamakan
--     dengan `report.tanggal`. Batas hari dan hari bisnis berjalan tiap outlet
--     disalin dari POS pada tiap sinkron (kolom di outlet_pos_map) -- tidak
--     ditebak di sisi laporan.
--   * Pemetaan outlet EKSPLISIT (outlet_pos_map), bukan cocok-nama: nama outlet
--     di POS tidak persis sama (mis. "Indosteak Cempaka Putih" vs "Indosteak
--     Cempaka").
-- Angka utama = uang_diterima (setara "cash + QRIS + bank" pengisian Ita);
-- penjualan_bersih (sebelum pajak & service, dikurangi refund) angka kedua.

begin;

-- Batas umur data POS (jam). Kunci baru, aturan angka dari policy (CLAUDE.md #4).
insert into public.policy (key, value) values ('pos_sinkron_maks_umur_jam', '30')
on conflict (key) do nothing;

-- ─── Pemetaan outlet POS -> outlet laporan ─────────────────────────────────
create table public.outlet_pos_map (
  pos_outlet_id            uuid primary key,
  outlet_id                uuid unique references public.outlet(id),
  diabaikan                boolean not null default false,  -- outlet POS yang sengaja tidak dipetakan (mis. thrifting)
  catatan                  text,
  -- Disalin dari POS pada tiap sinkron (diisi terapkan_sinkron_pos, bukan manual):
  nama_pos                 text,
  batas_hari               text,
  batas_hari_terkonfirmasi boolean,
  hari_bisnis_berjalan     date,
  disinkron_pada           timestamptz,
  dibuat_pada              timestamptz not null default now(),
  -- tepat SATU: terpetakan ke outlet laporan ATAU diabaikan
  constraint outlet_pos_map_terpetakan_xor_diabaikan check ((outlet_id is not null) <> diabaikan)
);

-- ─── Salinan agregat harian ────────────────────────────────────────────────
create table public.omzet_pos_harian (
  outlet_id        uuid not null references public.outlet(id),
  tanggal          date not null,                     -- HARI BISNIS POS
  jumlah_order     integer not null check (jumlah_order >= 0),
  uang_diterima    bigint not null,                   -- rupiah penuh
  penjualan_bersih bigint not null,
  refund           bigint not null,
  ditarik_pada     timestamptz not null default now(),
  primary key (outlet_id, tanggal)
);

-- ─── Jejak sinkron ─────────────────────────────────────────────────────────
create table public.sinkron_pos_log (
  id                    uuid primary key default gen_random_uuid(),
  mulai                 timestamptz not null default now(),
  selesai               timestamptz,
  status                text not null default 'berjalan' check (status in ('berjalan', 'berhasil', 'gagal')),
  rentang_dari          date,
  rentang_sampai        date,
  jumlah_baris          integer,
  outlet_tak_terpetakan jsonb,                        -- [{pos_outlet_id, nama, aktif, punya_data}]
  dihitung_pada_pos     timestamptz,
  galat                 text
);
create index sinkron_pos_log_selesai_idx on public.sinkron_pos_log (selesai desc) where status in ('berhasil', 'gagal');

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- BACA: CEO dan accounting (pemetaan/log juga admin). TULIS: tidak ada policy
-- untuk klien -- hanya service_role (melewati RLS) lewat terapkan_sinkron_pos().
-- Pemetaan boleh dikelola CEO/admin (dipakai nanti dari Admin / SQL).
alter table public.outlet_pos_map enable row level security;
alter table public.omzet_pos_harian enable row level security;
alter table public.sinkron_pos_log enable row level security;

create policy outlet_pos_map_select on public.outlet_pos_map for select
  using (public.has_role('ceo') or public.has_role('accounting') or public.is_admin());
create policy outlet_pos_map_kelola on public.outlet_pos_map for all
  using (public.has_role('ceo') or public.is_admin())
  with check (public.has_role('ceo') or public.is_admin());
create policy omzet_pos_harian_select on public.omzet_pos_harian for select
  using (public.has_role('ceo') or public.has_role('accounting'));
create policy sinkron_pos_log_select on public.sinkron_pos_log for select
  using (public.has_role('ceo') or public.has_role('accounting') or public.is_admin());

-- Hak tabel: klien hanya SELECT (dan pemetaan untuk CEO/admin lewat policy di atas).
revoke insert, update, delete, truncate on public.omzet_pos_harian from anon, authenticated;
revoke insert, update, delete, truncate on public.sinkron_pos_log from anon, authenticated;
revoke truncate on public.outlet_pos_map from anon, authenticated;

-- ─── Satu-satunya pintu tulis: terapkan_sinkron_pos ─────────────────────────
-- Semua dalam SATU transaksi (badan fungsi): payload buruk / baris buruk =
-- exception = tidak ada yang berubah; Route Handler lalu mencatat log 'gagal'.
-- Payload = respons endpoint pos-fnb versi 1 (lihat pos-fnb
-- src/lib/integrasi/omzet-harian.ts). Validasi ketat di sini karena data ini
-- jadi dasar kontrol silang.
create or replace function public.terapkan_sinkron_pos(p_log_id uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dari        date;
  v_sampai      date;
  v_dihitung    timestamptz;
  v_outlet      jsonb;
  v_hari        jsonb;
  v_pos_id      uuid;
  v_peta        public.outlet_pos_map%rowtype;
  v_tanggal     date;
  v_baris       int := 0;
  v_terpetakan  int := 0;
  v_tak         jsonb := '[]'::jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload POS bukan objek JSON.';
  end if;
  if (p_payload->>'versi') is distinct from '1' then
    raise exception 'Versi kontrak POS tidak dikenal: %', coalesce(p_payload->>'versi', '(kosong)');
  end if;
  if jsonb_typeof(p_payload->'outlet') <> 'array' then
    raise exception 'Payload POS tidak memuat daftar outlet.';
  end if;
  v_dari := (p_payload->>'dari')::date;
  v_sampai := (p_payload->>'sampai')::date;
  v_dihitung := (p_payload->>'dihitung_pada')::timestamptz;
  if v_dari is null or v_sampai is null or v_dari > v_sampai or v_dihitung is null then
    raise exception 'Rentang atau stempel waktu payload POS tidak valid.';
  end if;

  for v_outlet in select * from jsonb_array_elements(p_payload->'outlet') loop
    v_pos_id := (v_outlet->>'outlet_id')::uuid;
    if v_pos_id is null then
      raise exception 'Outlet POS tanpa outlet_id.';
    end if;
    if jsonb_typeof(v_outlet->'hari') <> 'array' then
      raise exception 'Outlet POS % tanpa daftar hari.', v_pos_id;
    end if;

    select * into v_peta from public.outlet_pos_map where pos_outlet_id = v_pos_id;

    if not found then
      -- Belum dipetakan: dicatat supaya muncul sebagai peringatan, TIDAK diam-diam dibuang.
      v_tak := v_tak || jsonb_build_array(jsonb_build_object(
        'pos_outlet_id', v_pos_id,
        'nama', v_outlet->>'nama',
        'aktif', (v_outlet->>'aktif')::boolean,
        'punya_data', jsonb_array_length(v_outlet->'hari') > 0
      ));
      continue;
    end if;
    if v_peta.diabaikan then
      continue;
    end if;

    if (v_outlet->>'batas_hari') is null or (v_outlet->>'batas_hari') !~ '^[0-2][0-9]:[0-5][0-9]$' then
      raise exception 'Batas hari outlet POS % tidak valid: %', v_pos_id, coalesce(v_outlet->>'batas_hari', '(kosong)');
    end if;
    if (v_outlet->>'hari_bisnis_berjalan') is null then
      raise exception 'Outlet POS % tanpa hari_bisnis_berjalan.', v_pos_id;
    end if;
    -- Setiap hari WAJIB bertanggal: "not in (... null ...)" di bawah akan menghapus NOL baris kalau ada tanggal kosong.
    if exists (select 1 from jsonb_array_elements(v_outlet->'hari') h where (h->>'tanggal') is null) then
      raise exception 'Outlet POS % memuat baris hari tanpa tanggal.', v_pos_id;
    end if;

    update public.outlet_pos_map set
      nama_pos = v_outlet->>'nama',
      batas_hari = v_outlet->>'batas_hari',
      batas_hari_terkonfirmasi = (v_outlet->>'batas_hari_terkonfirmasi')::boolean,
      hari_bisnis_berjalan = (v_outlet->>'hari_bisnis_berjalan')::date,
      disinkron_pada = now()
    where pos_outlet_id = v_pos_id;

    -- Hari yang HILANG dari payload di dalam rentang (mis. semua order hari itu
    -- ternyata void/refund) dihapus -- kalau tidak, angka lama tertinggal.
    delete from public.omzet_pos_harian d
    where d.outlet_id = v_peta.outlet_id
      and d.tanggal between v_dari and v_sampai
      and d.tanggal not in (
        select (h->>'tanggal')::date from jsonb_array_elements(v_outlet->'hari') h
      );

    for v_hari in select * from jsonb_array_elements(v_outlet->'hari') loop
      v_tanggal := (v_hari->>'tanggal')::date;
      if v_tanggal < v_dari or v_tanggal > v_sampai then
        raise exception 'Tanggal % di luar rentang payload POS.', v_tanggal;
      end if;
      insert into public.omzet_pos_harian (outlet_id, tanggal, jumlah_order, uang_diterima, penjualan_bersih, refund, ditarik_pada)
      values (
        v_peta.outlet_id, v_tanggal,
        (v_hari->>'jumlah_order')::int,
        (v_hari->>'uang_diterima')::bigint,
        (v_hari->>'penjualan_bersih')::bigint,
        (v_hari->>'refund')::bigint,
        now()
      )
      on conflict (outlet_id, tanggal) do update set
        jumlah_order = excluded.jumlah_order,
        uang_diterima = excluded.uang_diterima,
        penjualan_bersih = excluded.penjualan_bersih,
        refund = excluded.refund,
        ditarik_pada = excluded.ditarik_pada;
      v_baris := v_baris + 1;
    end loop;
    v_terpetakan := v_terpetakan + 1;
  end loop;

  update public.sinkron_pos_log set
    status = 'berhasil', selesai = now(), galat = null,
    rentang_dari = v_dari, rentang_sampai = v_sampai,
    jumlah_baris = v_baris, outlet_tak_terpetakan = v_tak, dihitung_pada_pos = v_dihitung
  where id = p_log_id;

  return jsonb_build_object('jumlah_baris', v_baris, 'outlet_terpetakan', v_terpetakan, 'tak_terpetakan', v_tak);
end $$;

revoke all on function public.terapkan_sinkron_pos(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.terapkan_sinkron_pos(uuid, jsonb) to service_role;

-- ─── Status sinkron (satu baris) ───────────────────────────────────────────
-- Invoker biasa: RLS sinkron_pos_log (CEO/accounting/admin) berlaku.
create or replace function public.status_sinkron_pos()
returns table (
  pernah_berhasil        boolean,
  data_per               timestamptz,   -- selesai sinkron BERHASIL terakhir
  umur_jam               numeric,
  maks_umur_jam          integer,
  basi                   boolean,       -- belum pernah berhasil ATAU lebih tua dari batas
  percobaan_terakhir     timestamptz,   -- percobaan selesai terakhir (berhasil/gagal)
  percobaan_status       text,
  percobaan_galat        text,
  rentang_dari           date,
  rentang_sampai         date,
  jumlah_belum_dipetakan integer
)
language sql stable as $$
  with s as (
    select * from public.sinkron_pos_log where status = 'berhasil' order by selesai desc limit 1
  ), l as (
    select * from public.sinkron_pos_log where status in ('berhasil', 'gagal') order by selesai desc limit 1
  ), p as (
    select coalesce((select (value #>> '{}')::int from public.policy where key = 'pos_sinkron_maks_umur_jam'), 30) as maks
  )
  select
    s.id is not null,
    s.selesai,
    extract(epoch from (now() - s.selesai)) / 3600.0,
    p.maks,
    (s.id is null or now() - s.selesai > make_interval(hours => p.maks)),
    l.selesai,
    l.status,
    l.galat,
    s.rentang_dari,
    s.rentang_sampai,
    coalesce(jsonb_array_length(s.outlet_tak_terpetakan), 0)
  from p left join s on true left join l on true;
$$;

-- ─── Tiga sumber omzet, per outlet, untuk SATU tanggal ─────────────────────
-- Menggantikan selisih_resto_untuk_tanggal() di layar (fungsi lama TIDAK
-- diubah/dihapus). Beda dengan fungsi lama: SEMUA outlet aktif muncul, dengan
-- angka yang belum ada = NULL (bukan baris hilang) supaya layar bisa
-- mengatakan "belum ada laporan" per kolom. Selisih hanya kalau kedua angka ada.
--   selisih = ketikan - pembanding (positif = ketikan LEBIH TINGGI).
-- security invoker (default fungsi SQL): RLS report/omzet_pos_harian pemanggil
-- berlaku -- selain CEO/accounting, kolom POS selalu 'belum_dipetakan'.
create or replace function public.omzet_tiga_sumber_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  outlet_id                uuid,
  outlet                   text,
  manager                  bigint,
  kontrol_fnb              bigint,
  pos_status               text,
  pos_uang_diterima        bigint,
  pos_penjualan_bersih     bigint,
  pos_jumlah_order         integer,
  pos_batas_hari           text,
  pos_batas_terkonfirmasi  boolean,
  selisih_manager_kontrol  bigint,
  selisih_manager_pos      bigint,
  selisih_kontrol_pos      bigint
)
language sql stable as $$
  with st as (select * from public.status_sinkron_pos()),
  dasar as (
    select
      o.id as id_outlet,
      o.nama as nama_outlet,
      (select nullif(r.data->>'total_omzet', '')::bigint from public.report r
        where r.form_key = 'manager_resto' and r.outlet_id = o.id and r.tanggal = p_tanggal and r.status <> 'draft'
        order by r.updated_at desc limit 1) as manager,
      (select nullif(r.data->>'omzet_sistem', '')::bigint from public.report r
        where r.form_key = 'kontrol_fnb' and r.outlet_id = o.id and r.tanggal = p_tanggal and r.status <> 'draft'
        order by r.updated_at desc limit 1) as kontrol
    from public.outlet o
    where o.aktif
  ),
  gabung as (
    select
      d.*,
      m.pos_outlet_id, m.batas_hari, m.batas_hari_terkonfirmasi, m.hari_bisnis_berjalan,
      x.jumlah_order, x.uang_diterima, x.penjualan_bersih,
      case
        when m.pos_outlet_id is null then 'belum_dipetakan'
        when st.pernah_berhasil is not true then 'belum_pernah_sinkron'
        when st.basi then 'basi'
        when m.hari_bisnis_berjalan is null then 'belum_ada_data_pos'
        when p_tanggal > m.hari_bisnis_berjalan then 'belum_dimulai'
        when x.outlet_id is not null then case when p_tanggal = m.hari_bisnis_berjalan then 'berjalan' else 'final' end
        when p_tanggal between st.rentang_dari and st.rentang_sampai then 'tanpa_transaksi'
        else 'belum_ada_data_pos'
      end as status
    from dasar d
    cross join st
    left join public.outlet_pos_map m on m.outlet_id = d.id_outlet and not m.diabaikan
    left join public.omzet_pos_harian x on x.outlet_id = d.id_outlet and x.tanggal = p_tanggal
  )
  select
    g.id_outlet,
    g.nama_outlet,
    g.manager,
    g.kontrol,
    g.status,
    case when g.status in ('final', 'berjalan') then g.uang_diterima end,
    case when g.status in ('final', 'berjalan') then g.penjualan_bersih end,
    case when g.status in ('final', 'berjalan') then g.jumlah_order end,
    case when g.status in ('final', 'berjalan', 'tanpa_transaksi', 'belum_dimulai') then g.batas_hari end,
    case when g.status in ('final', 'berjalan', 'tanpa_transaksi', 'belum_dimulai') then g.batas_hari_terkonfirmasi end,
    g.manager - g.kontrol,
    case when g.status = 'final' then g.manager - g.uang_diterima end,
    case when g.status = 'final' then g.kontrol - g.uang_diterima end
  from gabung g
  order by g.nama_outlet;
$$;

commit;
