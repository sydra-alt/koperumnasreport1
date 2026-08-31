-- Toni ditugaskan manager_resto SEMENTARA untuk Indokopi Lite Kemayoran
-- SAJA (outlet baru, manager sungguhan belum ada). Dea (Cempaka) dan Erry
-- (Jatinegara) TETAP manager_resto masing-masing outlet mereka -- TIDAK
-- disentuh, TIDAK diduakan. Dikonfirmasi eksplisit oleh CEO (31 Agustus
-- 2026, lewat AskUserQuestion) setelah migrasi 0043 menahan bagian ini
-- karena "Toni sudah pegang Cempaka Putih & Jatinegara" tadinya bisa
-- dibaca sebagai klaim manager_resto ganda -- CEO mengonfirmasi itu cuma
-- soal titik absen fisik (sudah diterapkan 0043), BUKAN manager_resto.
insert into public.role (user_id, role)
select id, 'manager_resto' from public.profile where nama = 'Toni'
on conflict (user_id, role) do nothing;

insert into public.assignment (user_id, form_key, outlet_id)
select p.id, 'manager_resto', o.id
from public.profile p, public.outlet o
where p.nama = 'Toni' and o.slug = 'indokopi_lite_kemayoran';
