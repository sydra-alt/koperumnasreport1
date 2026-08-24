-- Papan Kontrol dan Laporan Terpusat cuma pernah bisa menampilkan HARI INI --
-- setiap view "..._hari_ini" mengunci tanggalnya sendiri lewat
-- `(now() at time zone 'Asia/Jakarta')::date` di dalam definisinya, bukan
-- kolom yang bisa disaring dari luar. PostgREST tidak bisa "menimpa" tanggal
-- yang sudah dikunci di dalam view seperti itu.
--
-- Diperbaiki dengan mengubah TUJUH view ini jadi FUNGSI yang menerima
-- parameter tanggal (default hari ini kalau tidak diisi -- pemanggil lama
-- yang belum diubah, mis. rollup di dalam form `pembangunan` sendiri, tetap
-- dapat perilaku persis sama seperti sebelumnya tanpa perlu ikut berubah).
-- BUKAN `security definer` -- fungsi biasa `language sql` berjalan dengan
-- hak PEMANGGIL untuk RLS, perilakunya sama dengan `security_invoker = on`
-- di view yang lama. `v_keuangan_rekap` TIDAK diubah -- itu satu-satunya
-- yang sudah mengekspos kolom `tanggal` sejak awal (§4.3), klien tinggal
-- `.eq('tanggal', tanggalPilihan)`.

drop view if exists public.v_papan_hari_ini;
create or replace function public.papan_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  assignment_id uuid, form_key text, lokasi_id uuid, outlet_id uuid,
  scope_nama text, pic_nama text, report_id uuid, status report_status,
  warna warna, submitted_at timestamptz, nudged_at timestamptz
)
language sql stable as $$
  select
    a.id, a.form_key, a.lokasi_id, a.outlet_id,
    coalesce(l.nama, o.nama, a.form_key), pr.nama,
    r.id, r.status, r.warna, r.submitted_at, rn.nudged_at
  from public.assignment a
  join public.profile pr on pr.id = a.user_id and pr.aktif
  left join public.lokasi l on l.id = a.lokasi_id
  left join public.outlet o on o.id = a.outlet_id
  left join public.report r
         on r.form_key = a.form_key
        and r.author_id = a.user_id
        and r.tanggal  = p_tanggal
        and coalesce(r.lokasi_id, r.outlet_id) is not distinct from coalesce(a.lokasi_id, a.outlet_id)
        and r.status <> 'draft'
  left join public.report rn
         on rn.form_key = a.form_key
        and rn.author_id = a.user_id
        and rn.tanggal  = p_tanggal
        and coalesce(rn.lokasi_id, rn.outlet_id) is not distinct from coalesce(a.lokasi_id, a.outlet_id);
$$;

drop view if exists public.v_security_hari_ini;
create or replace function public.security_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (satpam_hadir bigint, tamu_datang bigint, konsumen_datang bigint, jumlah_kejadian bigint)
language sql stable as $$
  select
    sum((data->>'satpam_hadir')::int),
    sum((data->>'tamu_datang')::int),
    sum((data->>'konsumen_datang')::int),
    count(*) filter (where (data->>'ada_kejadian') = 'ya')
  from public.report
  where form_key = 'security' and tanggal = p_tanggal and status <> 'draft';
$$;

drop view if exists public.v_stk_hari_ini;
create or replace function public.stk_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (stk_total bigint, sudah_ditempati bigint, belum_ditempati bigint, rumah_kosong bigint, perlu_maintenance bigint)
language sql stable as $$
  select
    sum((data->>'stk_total')::int), sum((data->>'stk_sudah_ditempati')::int),
    sum((data->>'stk_belum_ditempati')::int), sum((data->>'stk_rumah_kosong')::int),
    sum((data->>'stk_perlu_maintenance')::int)
  from public.report
  where form_key = 'pic_lokasi' and tanggal = p_tanggal and status <> 'draft';
$$;

drop view if exists public.v_marketing_hari_ini;
create or replace function public.marketing_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (total_karyawan bigint, sudah_lapor_hari_ini bigint, undangan_hari_ini bigint, closing_hari_ini bigint)
language sql stable as $$
  select
    (select count(*) from public.profile p join public.role r on r.user_id = p.id
       where r.role = 'karyawan' and p.aktif),
    (select count(*) from public.report
       where form_key = 'personal_marketing' and tanggal = p_tanggal and status <> 'draft'),
    (select coalesce(sum(undang_jumlah), 0) from public.pte_daily where tanggal = p_tanggal),
    (select count(*) from public.closing where tanggal = p_tanggal and status <> 'batal');
$$;

drop view if exists public.v_pembangunan_hari_ini;
create or replace function public.pembangunan_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (sedang_dibangun bigint, finishing bigint, selesai_hari_ini bigint, belum_mulai bigint)
language sql stable as $$
  select
    sum((data->>'unit_dibangun')::int), sum((data->>'unit_finishing')::int),
    sum((data->>'unit_selesai')::int), sum((data->>'unit_belum_mulai')::int)
  from public.report
  where form_key = 'pic_lokasi' and tanggal = p_tanggal and status <> 'draft';
$$;

drop view if exists public.v_pembangunan_per_lokasi;
create or replace function public.pembangunan_per_lokasi_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  lokasi text, target bigint, sedang_dibangun bigint, finishing bigint, selesai_hari_ini bigint,
  belum_mulai bigint, material_cukup boolean, material_kurang jsonb, kiriman_precast_jumlah bigint,
  jalan_status text, listrik_status text, air_status text,
  drainase_baik boolean, penerangan_baik boolean, gerbang_baik boolean
)
language sql stable as $$
  select
    l.nama,
    sum((r.data->>'target_unit')::int),
    sum((r.data->>'unit_dibangun')::int),
    sum((r.data->>'unit_finishing')::int),
    sum((r.data->>'unit_selesai')::int),
    sum((r.data->>'unit_belum_mulai')::int),
    bool_or((r.data->>'material_cukup') = 'ya'),
    (max((
      select coalesce(jsonb_agg(jsonb_build_object(
               'material', e.value->>'material', 'kebutuhan', e.value->>'kebutuhan',
               'untuk_unit', e.value->>'untuk_unit', 'dibutuhkan_tanggal', e.value->>'dibutuhkan_tanggal'
             )), '[]'::jsonb)
      from jsonb_array_elements(
             case when jsonb_typeof(r.data->'material_kurang') = 'array' then r.data->'material_kurang' else '[]'::jsonb end
           ) e(value)
    )::text))::jsonb,
    sum((r.data->>'kiriman_precast_jumlah')::int),
    max(r.data->>'jalan_status'), max(r.data->>'listrik_status'), max(r.data->>'air_status'),
    bool_or((r.data->>'drainase_baik') = 'ya'),
    bool_or((r.data->>'penerangan_baik') = 'ya'),
    bool_or((r.data->>'gerbang_baik') = 'ya')
  from public.report r
  join public.lokasi l on l.id = r.lokasi_id
  where r.form_key = 'pic_lokasi' and r.tanggal = p_tanggal and r.status <> 'draft'
    and public.boleh_lihat_rekap('pembangunan')
  group by l.nama;
$$;

drop view if exists public.v_selisih_resto;
create or replace function public.selisih_resto_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (outlet text, versi_manager bigint, versi_ita bigint, selisih bigint)
language sql stable as $$
  select
    o.nama,
    (mr.data->>'total_omzet')::bigint,
    (it.data->>('omzet_' || lower(o.nama)))::bigint,
    (mr.data->>'total_omzet')::bigint - (it.data->>('omzet_' || lower(o.nama)))::bigint
  from public.outlet o
  join public.report mr on mr.form_key = 'manager_resto' and mr.outlet_id = o.id
                        and mr.tanggal = p_tanggal and mr.status <> 'draft'
  join public.report it on it.form_key = 'ita' and it.tanggal = p_tanggal and it.status <> 'draft';
$$;

-- Kunci JSON dan kontrak per fungsi TIDAK berubah dari view lama masing-masing
-- (lihat 04-CATATAN-TEKNIS.md §4 / migrasi 0015/0018/0019 untuk komentar
-- kontrak aslinya) -- ini murni perubahan cara panggil (RPC dgn parameter
-- tanggal), bukan perubahan makna kolom apa pun.
