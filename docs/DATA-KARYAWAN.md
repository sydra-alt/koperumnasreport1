# DATA KARYAWAN & PEMETAAN PERAN

Sumber: daftar karyawan dari CEO, per 21 Agustus 2026.
Menggantikan data contoh (Ciwidey/Pangalengan/Soreang) di `docs/00-SETUP-MANUAL.md` M8.

---

## §1 · Peta karyawan → peran & form

| Nama | Divisi | Form yang diisi | Role sistem |
|---|---|---|---|
| **Putri** | Direksi | — (dashboard) | `ceo` |
| **Sabrina** | HRD + Pusat Pelaporan | `pusat`, `hrd` | `pusat`, `kadiv`, `karyawan` |
| Didik | HRD | `hrd` | `kadiv`, `karyawan` |
| Avril | CS | `cs` | `kadiv`, `karyawan` |
| Anne | CS | `cs` | `karyawan` |
| Fur | CS | `cs` | `karyawan` |
| **Fauzy** | Marketing | — (dashboard kontrol) | `kontrol_marketing`, `karyawan` |
| **Dea** | Marketing | — (dashboard kontrol) | `kontrol_marketing`, `karyawan` |
| Makruf | Perizinan | `perizinan` | `kadiv`, `karyawan` |
| Tasya | Perizinan | `perizinan` | `karyawan` |
| Diki | IT | `it` | `kadiv`, `karyawan` |
| Ibnu | IT | `it` | `karyawan` |
| Ery | IT | `it` | `karyawan` |
| Fauzan | Inservice | ⚠️ belum ada | `karyawan` |
| Cahya | Inservice | ⚠️ belum ada | `karyawan` |
| Dedi | Inservice | ⚠️ belum ada | `karyawan` |
| Yundi | Inservice | ⚠️ belum ada | `karyawan` |
| Masudin | Inservice | ⚠️ belum ada | `karyawan` |
| Ronald | Teknik | `pembangunan` | `kadiv`, `karyawan` |
| Wandi | Teknik | `pembangunan` | `karyawan` |
| Seno | DTI | `dti` | `kadiv`, `karyawan` |
| Erry | DTI | `dti` | `karyawan` |
| Kasam | Security DTI | `security` (lokasi DTI) | `karyawan` |
| Syahbudin | Security DTI | `security` (lokasi DTI) | `karyawan` |
| **Dadang** | Humas Tajur | `pic_lokasi` (Tajur) | `pic_lokasi`, `karyawan` |
| **Jery** | Humas Bekasi | `pic_lokasi` (Bekasi) | `pic_lokasi`, `karyawan` |
| Toyib | Rukost | ⚠️ belum ada | `karyawan` |
| Ryan | Indosteak | `manager_resto` ⚠️ | `manager_resto`, `karyawan` |
| Qasim, Bagus, Ahmad, Cuko, Elsa, Lusy | Indosteak | — | `karyawan` |
| Toni | Indokopi | `manager_resto` ⚠️ | `manager_resto`, `karyawan` |
| Fikri, Fadil | Indokopi | — | `karyawan` |

Total: **36 orang**.

⚠️ **Putri (CEO) SENGAJA tidak diberi role `karyawan`** (diperbaiki 24 Agustus 2026, ditemukan lewat pemakaian Beranda sungguhan). `BLUEPRINT.md` §4 ("semua user punya role `karyawan` tanpa kecuali") dimaksudkan untuk seluruh STAF, bukan pemilik perusahaan -- kewajiban laporan `personal_marketing` melekat ke role `karyawan`, dan Putri tidak seharusnya diminta mengisi laporan PTE marketing pribadinya sendiri. **35 orang lain tetap wajib role `karyawan` seperti biasa** -- ini pengecualian untuk SATU orang, bukan perubahan aturan umum.

---

## §2 · Yang harus ditanyakan ke CEO

### 🔴 Memblokir — tanyakan sekarang

**1. Siapa Accounting?** Tidak ada di daftar. Padahal:
- Form `accounting` adalah satu-satunya laporan rahasia, inti dari seluruh desain hak akses
- Uji nomor 1 di matriks Checkpoint 2 tidak bisa dijalankan tanpa akun ini
- Di format laporan asli disebut **Bu Sabita** — apakah beliau ada dan hanya belum masuk daftar?

**2. Siapa manager Indosteak dan Indokopi?** Sementara saya tebak Ryan dan Toni karena disebut pertama. Kalau salah, laporan resto akan diisi orang yang tidak berwenang. Ini keliru yang mudah diperbaiki sekarang, sulit setelah jalan.

### 🟡 Tidak memblokir, tapi perlu jawaban minggu ini

**3. "Inservice" itu apa persis?** Lima orang, jumlah terbesar kedua setelah Indosteak — jelas divisi penting, tapi belum punya form. Dugaan saya: menangani rumah STK, serah terima, dan maintenance rumah yang sudah ditempati. Kalau benar, bagian 9 laporan Sabrina ("STK & rumah tidak ditempati") sebenarnya milik mereka, bukan PIC lokasi.

**4. "Rukost" itu unit usaha?** Toyib sendirian. Kalau ini bisnis kos-kosan, dia butuh form sendiri seperti Indosteak/Indokopi.

**5. Lokasi perumahan yang mana saja?** Dari daftar hanya terbaca **Tajur** dan **Bekasi**. Tapi laporan Sabrina bagian 8 bilang "untuk setiap lokasi wajib ada update". Apakah cuma dua, atau ada lokasi lain yang PIC-nya belum tercatat?

**6. Divisi yang formnya sudah dibuat tapi tidak ada orangnya:**

| Form | Siapa yang mengisi? |
|---|---|
| `accounting` | ❓ |
| `kendaraan` (driver) | ❓ |
| `ga` (operasional kantor) | ❓ |
| `ita` (thrifting & kontrol F&B) | ❓ Ita tidak ada di daftar |

Kalau memang tidak ada divisinya, formnya dicoret saja — lebih baik daripada jadi kartu "belum lapor" abadi di Papan Kontrol.

### ⚪ Kemungkinan salah tulis

- **Ery** (IT) dan **Erry** (DTI) — orang yang sama atau dua orang berbeda?
- **Avril** muncul di CS dan di DTI — satu orang merangkap, atau dua orang?
- **"Fur"** — nama lengkapnya apa?

---

## §3 · Akun tahap pertama — 7 akun untuk Checkpoint 2

Jangan buat 36 akun sekarang. Pembuatan massal ada di Task 23 lewat Edge Function. Untuk sekarang cukup 7 orang yang sekaligus jadi persona uji RLS:

| Email | Nama | Role | Untuk uji nomor |
|---|---|---|---|
| `putri@koperumnas.local` | Putri | `ceo` | 2, 9 |
| `sabrina@koperumnas.local` | Sabrina | `pusat`, `kadiv`, `karyawan` | 1, 3, 8 |
| `accounting@koperumnas.local` | ❓ (isi nama asli) | `accounting`, `karyawan` | 1, 2, 3 |
| `dadang@koperumnas.local` | Dadang | `pic_lokasi`, `karyawan` | 6, 7 |
| `fauzy@koperumnas.local` | Fauzy | `kontrol_marketing`, `karyawan` | 13 |
| `toyib@koperumnas.local` | Toyib | `karyawan` | 4, 5, 10, 11 |
| `kasam@koperumnas.local` | Kasam | `karyawan` | 12 (shift security) |

**Cara buat:** Supabase → Authentication → Users → Add user → Create new user.
Password sementara bebas, **Auto Confirm User: ON**.

---

## §4 · SQL — isi profile & role

Jalankan **setelah** ketujuh akun dibuat. Tidak perlu menyalin UUID satu per satu; skrip ini mencocokkan lewat email.

```sql
-- PROFILE
insert into public.profile (id, nama, jabatan, divisi)
select u.id, v.nama, v.jabatan, v.divisi
from (values
  ('putri@koperumnas.local',      'Putri',    'CEO',                'Direksi'),
  ('sabrina@koperumnas.local',    'Sabrina',  'Pusat Pelaporan',    'HRD'),
  ('accounting@koperumnas.local', 'GANTI',    'Accounting',         'Keuangan'),
  ('dadang@koperumnas.local',     'Dadang',   'Humas / PIC Lokasi', 'Tajur'),
  ('fauzy@koperumnas.local',      'Fauzy',    'Kontrol Marketing',  'Marketing'),
  ('toyib@koperumnas.local',      'Toyib',    'Staf',               'Rukost'),
  ('kasam@koperumnas.local',      'Kasam',    'Security',           'DTI')
) as v(email, nama, jabatan, divisi)
join auth.users u on u.email = v.email
on conflict (id) do update
  set nama = excluded.nama, jabatan = excluded.jabatan, divisi = excluded.divisi;

-- ROLE
insert into public.role (user_id, role)
select u.id, v.role
from (values
  ('putri@koperumnas.local',      'ceo'),
  ('sabrina@koperumnas.local',    'pusat'),
  ('sabrina@koperumnas.local',    'kadiv'),
  ('sabrina@koperumnas.local',    'karyawan'),
  ('accounting@koperumnas.local', 'accounting'),
  ('accounting@koperumnas.local', 'karyawan'),
  ('dadang@koperumnas.local',     'pic_lokasi'),
  ('dadang@koperumnas.local',     'karyawan'),
  ('fauzy@koperumnas.local',      'kontrol_marketing'),
  ('fauzy@koperumnas.local',      'karyawan'),
  ('toyib@koperumnas.local',      'karyawan'),
  ('kasam@koperumnas.local',      'karyawan')
) as v(email, role)
join auth.users u on u.email = v.email
on conflict do nothing;

-- CEK
select p.nama, p.divisi, array_agg(r.role order by r.role) as peran
from public.profile p
left join public.role r on r.user_id = p.id
group by p.nama, p.divisi
order by p.nama;
```

Hasil `CEK` harus menampilkan 7 baris dengan peran sesuai tabel §3. Tempel hasilnya ke agent.

---

## §5 · Ganti seed lokasi & outlet

Data contoh di Task 05 harus diganti dengan yang nyata:

```sql
-- BATAL: Ciwidey, Pangalengan, Soreang — itu data contoh
insert into public.lokasi (nama) values
  ('Tajur'),
  ('Bekasi'),
  ('DTI')          -- area produksi, dipakai scope laporan security
on conflict (nama) do nothing;

insert into public.outlet (nama) values
  ('Indosteak'),
  ('Indokopi')
on conflict (nama) do nothing;

-- ASSIGNMENT: siapa mengisi form apa
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
```

⚠️ `Rukost` sengaja belum dimasukkan sebagai lokasi maupun outlet sampai pertanyaan §2 nomor 4 terjawab.
