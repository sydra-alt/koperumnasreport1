-- ─── ATURAN BISNIS (03-CALC-SPEC.md §1) ───────────────────────────────
insert into public.policy (key, value) values
  ('pte_bonus_amount',   '500000'),
  ('pte_bonus_rule',     '"no_gap"'),
  ('pte_konten_minimal', '3'),
  ('closing_target',     '2'),
  ('closing_penalty',    '300000'),
  ('invite_target',      '20'),
  ('workdays',           '[1,2,3,4,5,6]'),
  ('timezone',           '"Asia/Jakarta"'),
  ('deadline_default',   '"18:00"'),
  ('deadline_by_form',   '{
      "manager_resto": "23:00",
      "ita":           "22:00",
      "accounting":    "20:00",
      "security":      "per_shift",
      "pusat":         "21:00"
   }'),
  ('shift_deadline',     '{"pagi":"14:30","siang":"22:30","malam":"07:30"}'),
  ('lampiran_max_mb',    '50'),
  ('gambar_max_px',      '1600')
on conflict (key) do nothing;

-- ─── LOKASI & OUTLET NYATA (DATA-KARYAWAN.md §5) ───────────────────────
-- BUKAN Ciwidey/Pangalengan/Soreang -- itu data contoh dari asumsi A5 yang
-- sudah digantikan data nyata CEO. Rukost sengaja belum dimasukkan (masih
-- menunggu jawaban CEO, lihat DATA-KARYAWAN.md §2 nomor 4).
insert into public.lokasi (nama) values
  ('Tajur'),
  ('Bekasi'),
  ('DTI')
on conflict (nama) do nothing;

insert into public.outlet (nama) values
  ('Indosteak'),
  ('Indokopi')
on conflict (nama) do nothing;

-- ─── ASSIGNMENT: siapa mengisi form apa ────────────────────────────────
insert into public.assignment (user_id, form_key, lokasi_id, shift)
select u.id, v.form_key, l.id, v.shift
from (values
  ('dadang@koperumnas.local',  'pic_lokasi', 'Tajur',  null),
  ('kasam@koperumnas.local',   'security',   'DTI',    'pagi')
) as v(email, form_key, lokasi, shift)
join auth.users u on u.email = v.email
join public.lokasi l on l.nama = v.lokasi
on conflict do nothing;

insert into public.assignment (user_id, form_key)
select u.id, v.form_key
from (values
  ('sabrina@koperumnas.local',    'pusat'),
  ('sabrina@koperumnas.local',    'hrd'),
  ('accounting@koperumnas.local', 'accounting')
) as v(email, form_key)
join auth.users u on u.email = v.email
on conflict do nothing;
