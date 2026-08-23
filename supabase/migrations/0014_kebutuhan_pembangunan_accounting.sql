-- Task 17: Accounting §8 "Kebutuhan Pembangunan" dan §10 "Kontraktor/
-- Supplier/DTI" butuh angka pengajuan dari Kepala Pembangunan (material
-- borongan, rencana infrastruktur) dan DTI (belanja RAB) -- role `accounting`
-- TIDAK punya can_see_report() ke form_key='pembangunan'/'dti' sama sekali
-- (cuma 'accounting'/'manager_resto'/'ita'). Pola §3.4b, penjaga
-- boleh_lihat_rekap('accounting').
--
-- Daftar putih per field (§3.4b syarat #1): material_borongan dan
-- infrastruktur_rencana_kerja SUDAH tabel terstruktur di form pembangunan
-- (bukan teks bebas) -- direkonstruksi ulang di sini dengan whitelist kunci,
-- bukan diteruskan mentah.
--
-- ⚠️ form_key='accounting' TIDAK PERNAH jadi sumber view ini -- ini view
-- YANG DIBACA accounting, bukan yang MEMBACA accounting. Syarat #3 §3.4b.
create view public.v_kebutuhan_pembangunan_accounting
with (security_invoker = off) as        -- SENGAJA off: lihat penjaga di WHERE
with pembangunan_hari_ini as (
  select data from report
  where form_key = 'pembangunan'
    and tanggal = (now() at time zone 'Asia/Jakarta')::date
    and status <> 'draft'
  limit 1
),
material_items as (
  select
    jsonb_build_object(
      'material', e->>'material',
      'kebutuhan', e->>'kebutuhan',
      'estimasi_biaya', e->>'estimasi_biaya',
      'dibutuhkan_tanggal', e->>'dibutuhkan_tanggal'
    ) as item,
    (e->>'estimasi_biaya')::bigint as biaya
  from pembangunan_hari_ini,
       jsonb_array_elements(
         case when jsonb_typeof(data->'material_borongan') = 'array'
              then data->'material_borongan' else '[]'::jsonb end
       ) as e
),
infra_items as (
  select
    jsonb_build_object(
      'lokasi', e->>'lokasi',
      'pekerjaan', e->>'pekerjaan',
      'kontraktor', e->>'kontraktor',
      'anggaran', e->>'anggaran',
      'target_selesai', e->>'target_selesai'
    ) as item,
    (e->>'anggaran')::bigint as anggaran
  from pembangunan_hari_ini,
       jsonb_array_elements(
         case when jsonb_typeof(data->'infrastruktur_rencana_kerja') = 'array'
              then data->'infrastruktur_rencana_kerja' else '[]'::jsonb end
       ) as e
),
dti_hari_ini as (
  select (data->>'belanja_rab')::bigint as belanja_rab
  from report
  where form_key = 'dti'
    and tanggal = (now() at time zone 'Asia/Jakarta')::date
    and status <> 'draft'
  limit 1
)
select
  coalesce((select jsonb_agg(item) from material_items), '[]'::jsonb)  as material_borongan,
  coalesce((select sum(biaya) from material_items), 0)                 as total_material,
  coalesce((select jsonb_agg(item) from infra_items), '[]'::jsonb)     as infrastruktur_rencana,
  coalesce((select sum(anggaran) from infra_items), 0)                 as total_infrastruktur,
  coalesce((select belanja_rab from dti_hari_ini), 0)                  as precast_dti
where public.boleh_lihat_rekap('accounting');                          -- PENJAGA

-- Kunci JSON (material_borongan{material,kebutuhan,estimasi_biaya,
-- dibutuhkan_tanggal}, infrastruktur_rencana_kerja{lokasi,pekerjaan,
-- kontraktor,anggaran,target_selesai}, dti.belanja_rab) adalah KONTRAK
-- dengan forms/f15-pembangunan.ts dan forms/f15-dti.ts.
