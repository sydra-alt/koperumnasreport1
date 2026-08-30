-- Ditemukan sendiri sambil menyapu referensi 'ita' yang tersisa setelah
-- migrasi 0036 (pemecahan form ita) -- can_see_report() (migrasi 0002,
-- fungsi INTI yang menentukan seluruh visibilitas laporan di sistem ini)
-- MASIH mengizinkan role `accounting` membaca form_key='ita' secara
-- hardcode. Form itu sudah tidak pernah ada lagi -- tanpa perbaikan ini,
-- Shabita (accounting) diam-diam kehilangan akses ke `thrifting` MAUPUN
-- `kontrol_fnb` (0 baris, TANPA error apa pun -- persis pola jebakan #3 di
-- 04-CATATAN-TEKNIS.md §7, "kunci tidak sinkron, hasilnya nol tanpa error").
--
-- Cakupan akses accounting DIPERTAHANKAN PERSIS SAMA seperti sebelum
-- pemecahan (dulu satu form 'ita' mencakup keduanya) -- ditambah
-- 'thrifting', bukan cuma 'kontrol_fnb', supaya tidak diam-diam menyempit.
create or replace function public.can_see_report(f text, author uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
       author = auth.uid()
    or public.has_role('ceo')
    or (public.has_role('pusat')             and f <> 'accounting')
    or (public.has_role('kontrol_marketing') and f =  'personal_marketing')
    or (public.has_role('accounting')        and f in ('accounting','manager_resto','thrifting','kontrol_fnb'))
    or (public.has_role('manager_resto')     and f =  'personal_marketing');
$$;
