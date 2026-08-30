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
| Ery / Erry | IT + DTI + Manager Indokopi Jatinegara | `it`, `dti`, `manager_resto` (outlet Indokopi Jatinegara) | `manager_resto`, `karyawan` |
| Fauzan | GA | `ga`, `cs` | `karyawan` |
| Cahya | Security + GA | `security` (lokasi report ❓ -- lihat catatan), `ga`, `cs` -- absen di 2 titik (Kantor Pusat + Indokopi Jatinegara) | `karyawan` |
| Dedi | Security | `security` (lokasi report ❓ -- lihat catatan), `cs` -- absen di 2 titik (Kantor Pusat + Indokopi Jatinegara) | `karyawan` |
| Yundi | Security | `security` (lokasi report ❓ -- lihat catatan), `cs` -- absen di 2 titik (Kantor Pusat + Indokopi Jatinegara) | `karyawan` |
| Masudin | Security/CS fleksibel | `cs`, `security` (lokasi report ❓) | `karyawan` |
| Ronald | Teknik | `pembangunan` | `kadiv`, `karyawan` |
| Wandi | Teknik | `pembangunan` | `karyawan` |
| Seno | DTI | `dti` | `kadiv`, `karyawan` |
| Kasam | Security DTI | `security` (lokasi DTI) | `karyawan` |
| Syahbudin | Security DTI | `security` (lokasi DTI, shift normal -- sama pola Kasam) | `karyawan` |
| Ita | Thrifting & Kontrol F&B | `ita` (penjualan thrifting + kontrol stok ketiga outlet) | `karyawan` |
| **Dadang** | Humas Tajur | `pic_lokasi` (Tajur) | `pic_lokasi`, `karyawan` |
| **Jery** | Humas Bekasi | `pic_lokasi` (Bekasi) | `pic_lokasi`, `karyawan` |
| Toyib | Rukost | ⚠️ belum ada form -- karyawan biasa penjaga kost, tetap wajib PTE seperti yang lain | `karyawan` |
| Dea | Marketing + Manager Indosteak Cempaka | `manager_resto` (outlet Indosteak Cempaka) -- juga `kontrol_marketing` | `manager_resto`, `kontrol_marketing`, `karyawan` |
| Cuko | Manager Indosteak Pekansari | `manager_resto` (outlet Indosteak Pekansari) | `manager_resto`, `karyawan` |
| Ryan, Toni | Indosteak/Indokopi | — (BUKAN manager, tebakan dicabut 30 Agustus 2026) | `karyawan` |
| Qasim, Bagus, Ahmad, Elsa, Lusy | Indosteak (Cempaka/Pekansari -- belum jelas siapa di titik mana) | — | `karyawan` |
| Fikri, Fadil | Indokopi Jatinegara | — | `karyawan` |
| **Shabita** | Accounting (Keuangan) | `accounting` | `accounting`, `karyawan` |

Total: **37 orang** (dikoreksi 30 Agustus 2026 -- Ery & Erry SATU orang kerja rangkap, sebelumnya dihitung dua baris; Shabita orang ke-37, TIDAK menggantikan siapa pun -- CEO menegaskan eksplisit).

⚠️ **Indosteak sekarang DUA outlet** (Cempaka & Pekansari, bukan satu), CEO menjawab 30 Agustus 2026 -- lihat migrasi `0031_indosteak_dua_outlet.sql`. Qasim/Bagus/Ahmad/Elsa/Lusy sudah dikonfirmasi kerja di "Indosteak" sebelum pemisahan ini diketahui -- BELUM jelas siapa di Cempaka dan siapa di Pekansari, jangan ditebak.

⚠️ **Lokasi report `security` Cahya/Dedi/Yundi/Masudin MASIH TERBUKA.** CEO menjawab titik ABSEN mereka (Kantor Pusat + Indokopi Jatinegara, lewat `penugasan_absen` -- itu presensi, tabel `lokasi_absen`), TAPI form `security` (laporan tugas jaga) di-scope ke tabel `lokasi` yang beda (`lokasi` cuma berisi Tajur/Bekasi/DTI, TIDAK ada "Kantor Pusat"). Presensi dan scope laporan adalah dua hal berbeda -- jawaban CEO menutup yang pertama, bukan yang kedua. Kalau laporan `security` mereka memang dari Kantor Pusat, `lokasi` butuh baris baru "Kantor Pusat" -- BELUM ditambahkan, menunggu konfirmasi eksplisit supaya tidak ditebak.

⚠️ **`lokasi_absen` "Indosteak" (existing, 1 titik) juga ambigu sekarang** -- koordinat itu direkam SEBELUM pemisahan Cempaka/Pekansari diketahui. Belum jelas titik itu punya Cempaka atau Pekansari. Belum diubah/dipecah, menunggu konfirmasi.

⚠️ **Putri (CEO) SENGAJA tidak diberi role `karyawan`** (diperbaiki 24 Agustus 2026, ditemukan lewat pemakaian Beranda sungguhan). `BLUEPRINT.md` §4 ("semua user punya role `karyawan` tanpa kecuali") dimaksudkan untuk seluruh STAF, bukan pemilik perusahaan -- kewajiban laporan `personal_marketing` melekat ke role `karyawan`, dan Putri tidak seharusnya diminta mengisi laporan PTE marketing pribadinya sendiri. **35 orang lain tetap wajib role `karyawan` seperti biasa** -- ini pengecualian untuk SATU orang, bukan perubahan aturan umum.

---

## §2 · Yang harus ditanyakan ke CEO

### 🔴 Memblokir — tanyakan sekarang

**1. ✅ TERJAWAB (30 Agustus 2026) — Siapa Accounting?** **Shabita.** Akun uji `accounting@koperumnas.local` (`profile.nama`) sudah diperbarui dari placeholder `"GANTI"` ke nama asli ini, baik di database produksi maupun `scripts/akun.json` (sumber seed untuk 36 akun asli nanti).

**2. ✅ TERJAWAB (30 Agustus 2026) — Siapa manager tiap outlet?** Ryan dan Toni BUKAN manager -- tebakan awal dicabut CEO sendiri. Manager sungguhan (dan Indosteak ternyata DUA outlet, bukan satu -- lihat §1 di atas):
- Erry → Indokopi Jatinegara
- Dea → Indosteak Cempaka
- Cuko → Indosteak Pekansari

### 🟡 Tidak memblokir, tapi perlu jawaban minggu ini

**3. ✅ TERJAWAB (30 Agustus 2026) — "Inservice" itu apa persis?** BUKAN divisi tersendiri -- dugaan saya (STK/serah terima) SALAH. CEO: Dedi & Yundi satpam biasa (`security`), Fauzan OB (`ga`), Cahya serabutan OB+satpam (`security` DAN `ga`, dua-duanya). Masudin masih belum jelas, sengaja ditunda -- **jangan ditebak**, tetap `karyawan` saja sampai CEO menjelaskan. Ini SEKALIGUS menjawab §2 nomor 6 baris `ga` -- form itu sekarang punya pengisi (Fauzan, Cahya), tidak perlu dicoret.

CEO lalu melengkapi (masih 30 Agustus 2026): "Mereka inservice satpam dan general affair, tugas mereka juga CS kalau ada konsumen datang." Jadi Dedi, Yundi, Fauzan, Cahya juga dapat assignment `cs` (empat orang baru, di atas Avril/Anne/Fur yang sudah ada -- total 7 pengisi `cs`). Karena `cs` itu `scope:'global'` dan sebelumnya diasumsikan cuma satu pengisi per hari, sudah diperiksa dulu ke pemilik proyek sebelum diterapkan (menyentuh bentuk data) -- diputuskan: TETAP satu form `cs` untuk semua, dan kode rollup Terpusat (`lib/api/terpusat.ts` -- `useLaporanCsHariIni`, `app/terpusat/page.tsx` Bagian 2) diperbaiki supaya bisa menjumlahkan beberapa pengisi per hari alih-alih berasumsi satu baris. Papan Kontrol tidak perlu diubah -- sudah benar per-assignment lewat `author_id`.

**4. ✅ TERJAWAB (30 Agustus 2026) — "Rukost" itu unit usaha?** Toyib karyawan biasa penjaga kost, TIDAK butuh form sendiri. Tetap wajib `personal_marketing`/PTE seperti karyawan lain -- tidak ada pengecualian.

**5. Lokasi perumahan yang mana saja?** Dari daftar hanya terbaca **Tajur** dan **Bekasi**. Tapi laporan Sabrina bagian 8 bilang "untuk setiap lokasi wajib ada update". Apakah cuma dua, atau ada lokasi lain yang PIC-nya belum tercatat?

**6. Divisi yang formnya sudah dibuat tapi tidak ada orangnya:**

| Form | Siapa yang mengisi? |
|---|---|
| `accounting` | ✅ Shabita (terjawab 30 Agustus 2026, §1 di atas) |
| `kendaraan` (driver) | ❓ |
| `ga` (operasional kantor) | ✅ Fauzan & Cahya (terjawab 30 Agustus 2026, lihat nomor 3 di atas) |
| `ita` (thrifting & kontrol F&B) | ✅ Ita -- akun sungguhan (bukan cuma nama form), terjawab 30 Agustus 2026 |

Kalau memang tidak ada divisinya, formnya dicoret saja — lebih baik daripada jadi kartu "belum lapor" abadi di Papan Kontrol.

### ⚪ Kemungkinan salah tulis

- ✅ **TERJAWAB (30 Agustus 2026) — Ery/Erry?** SATU orang, kerja rangkap (`it` + `dti` + `manager_resto` Indokopi Jatinegara).
- **Avril** muncul di CS dan di DTI — satu orang merangkap, atau dua orang? *(Catatan: §1 saat ini cuma menampilkan Avril di CS -- baris "DTI" yang disebut di sini tidak lagi ada di tabel; kemungkinan sudah basi/salah catat dari draf sebelumnya. Diperiksa ulang kalau muncul lagi.)*
- **"Fur"** — nama lengkapnya apa?

---

## §3 · Akun tahap pertama — 7 akun untuk Checkpoint 2

Jangan buat 36 akun sekarang. Pembuatan massal ada di Task 23 lewat Edge Function. Untuk sekarang cukup 7 orang yang sekaligus jadi persona uji RLS:

| Email | Nama | Role | Untuk uji nomor |
|---|---|---|---|
| `putri@koperumnas.local` | Putri | `ceo` | 2, 9 |
| `sabrina@koperumnas.local` | Sabrina | `pusat`, `kadiv`, `karyawan` | 1, 3, 8 |
| `accounting@koperumnas.local` | Shabita | `accounting`, `karyawan` | 1, 2, 3 |
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
  ('accounting@koperumnas.local', 'Shabita',  'Accounting',         'Keuangan'),
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

-- BASI sejak 30 Agustus 2026 -- Indosteak sekarang DUA outlet, kolom `slug`
-- wajib diisi (lihat migrasi 0031_indosteak_dua_outlet.sql, SUDAH dijalankan
-- di database sungguhan). Dipertahankan di sini cuma sebagai riwayat/contoh
-- bentuk lama -- JANGAN dijalankan ulang seperti ini di database yang sudah
-- bermigrasi.
insert into public.outlet (nama, slug) values
  ('Indokopi Jatinegara', 'indokopi_jatinegara'),
  ('Indosteak Cempaka', 'indosteak_cempaka'),
  ('Indosteak Pekansari', 'indosteak_pekansari')
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

✅ **`Rukost` TIDAK PERNAH akan jadi lokasi/outlet** (terjawab §2 nomor 4, 30 Agustus 2026) -- Toyib karyawan biasa, bukan unit usaha dengan laporan sendiri. Baris ini dipertahankan sebagai riwayat kenapa `Rukost` sengaja tidak ada di seed manapun.

---

## §6 · Titik absen UJI (30 Agustus 2026)

Bukan lokasi perusahaan sungguhan -- koordinat CEO sendiri, supaya beliau bisa mencoba absen dari HP-nya. Sudah dijalankan lewat migrasi `0032_lokasi_absen_uji.sql`:

```sql
insert into public.lokasi_absen (nama, lokasi_id, latitude, longitude, radius_meter, aktif)
values ('Lokasi Uji -- BUKAN kantor perusahaan, cuma untuk coba dari HP', null, -6.982980702734919, 107.63522500320248, 200, true);

insert into public.penugasan_absen (user_id, lokasi_absen_id)
select u.id, la.id from auth.users u, public.lokasi_absen la
where u.email in ('putri@koperumnas.local', 'dadang@koperumnas.local')
  and la.nama = 'Lokasi Uji -- BUKAN kantor perusahaan, cuma untuk coba dari HP';
```

Ditugaskan ke `putri@koperumnas.local` dan `dadang@koperumnas.local` saja, sesuai instruksi. DTI tetap ditahan, tidak disentuh.
