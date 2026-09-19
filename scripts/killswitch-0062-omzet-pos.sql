-- ============================================================================
-- KILL-SWITCH: batalkan migrasi 0062 (omzet POS di Silang-Cek Omzet Resto)
-- -- kembalikan database ke keadaan SEBELUM 0062 (19 September 2026).
-- ============================================================================
--
-- KAPAN DIPAKAI:
-- Kalau, SETELAH 0062 diterapkan, ada yang salah di sisi database: hak akses
-- terlalu longgar/sempit, fungsi menghasilkan angka keliru, atau tabel salinan
-- POS mengganggu. File ini MENGHAPUS semua yang dibuat 0062 dan tidak menyentuh
-- apa pun yang sudah ada sebelumnya.
--
-- YANG DIHAPUS (semuanya baru dibuat 0062, tidak ada objek lama):
--   fungsi : omzet_tiga_sumber_untuk_tanggal(date), status_sinkron_pos(),
--            terapkan_sinkron_pos(uuid, jsonb)
--   tabel  : omzet_pos_harian, sinkron_pos_log, outlet_pos_map (beserta indeks
--            dan policy RLS-nya)
--   policy : baris kunci `pos_sinkron_maks_umur_jam` di tabel `policy`
-- YANG TIDAK DISENTUH: selisih_resto_untuk_tanggal() dan semua tabel/fungsi/policy
-- lain. Fungsi lama itu tetap ada dan tetap jalan.
--
-- AKIBAT KE APLIKASI (baca sebelum menjalankan):
-- Kode aplikasi yang sudah ter-deploy MEMANGGIL fungsi baru itu. Setelah file ini
-- dijalankan, blok Silang-Cek Omzet Resto (Beranda CEO dan halaman Terpusat)
-- menampilkan "Gagal memuat" sampai 0062 diterapkan lagi ATAU kode lamanya
-- di-deploy ulang. Kill-switch ini memulihkan DATABASE, bukan tampilan.
--
-- PENGAMAN DATA:
-- Tabel omzet_pos_harian dan sinkron_pos_log berisi SALINAN dari POS (bukan data
-- asli -- bisa ditarik ulang dari pos-fnb), tapi tetap hilang permanen. Kalau salah
-- satunya sudah berisi baris, file ini BERHENTI dengan pesan jelas. Untuk tetap
-- menghapusnya, hapus tanda komentar pada baris `set_config` di bawah, lalu jalankan
-- ulang. outlet_pos_map (pemetaan yang dibuat manual) ikut terhapus -- catat isinya
-- dulu kalau masih dibutuhkan:
--     select * from public.outlet_pos_map;
--
-- CARA PAKAI:
-- 1. Buka Supabase Dashboard proyek ini -> SQL Editor.
-- 2. Tempel ISI FILE INI APA ADANYA, jalankan (Run). Tidak butuh service_role key.
-- 3. Seluruh isi berjalan dalam SATU transaksi: gagal di tengah = tidak ada yang berubah.
-- 4. Aman dijalankan berulang, dan aman dijalankan di database yang belum pernah
--    bermigrasi 0062 (semuanya "if exists").
--
-- Diverifikasi di database (transaksi yang di-ROLLBACK) SEBELUM 0062 diterapkan:
-- scripts/uji-killswitch-0062.mjs. JANGAN ubah teks di bawah tanpa menguji ulang.
-- ============================================================================

begin;

-- Hapus tanda komentar baris di bawah HANYA kalau memang rela kehilangan isi tabel salinan:
-- select set_config('app.killswitch_0062_hapus_data', 'ya', true);

do $$
declare
  v_omzet int := 0;
  v_log   int := 0;
begin
  if to_regclass('public.omzet_pos_harian') is not null then
    execute 'select count(*) from public.omzet_pos_harian' into v_omzet;
  end if;
  if to_regclass('public.sinkron_pos_log') is not null then
    execute 'select count(*) from public.sinkron_pos_log' into v_log;
  end if;
  if (v_omzet > 0 or v_log > 0) and coalesce(current_setting('app.killswitch_0062_hapus_data', true), '') <> 'ya' then
    raise exception 'KILL-SWITCH 0062 DIBATALKAN: omzet_pos_harian berisi % baris dan sinkron_pos_log % baris. Hapus tanda komentar pada baris set_config di atas kalau data salinan itu memang boleh hilang.', v_omzet, v_log;
  end if;
end $$;

drop function if exists public.omzet_tiga_sumber_untuk_tanggal(date);
drop function if exists public.status_sinkron_pos();
drop function if exists public.terapkan_sinkron_pos(uuid, jsonb);

drop table if exists public.omzet_pos_harian;
drop table if exists public.sinkron_pos_log;
drop table if exists public.outlet_pos_map;

delete from public.policy where key = 'pos_sinkron_maks_umur_jam';

commit;
