# REFERENSI FORMAT LAPORAN

Indeks 15 form dan spesifikasi field-nya.

⚠️ **Koreksi 22 Agustus 2026.** Versi sebelumnya file ini keliru — isinya hanya salinan `02-FORMAT-LAPORAN-DIVISI-BARU.md`. Versi ini yang benar.

---

## §1 · Indeks 15 form dan letak spesifikasinya

| form_key | Nama | Spesifikasi ada di |
|---|---|---|
| `personal_marketing` | Laporan Personal Marketing | **§2 file ini** |
| `pusat` | Laporan Terpusat Sabrina | `FORMAT-ASLI-02-PUSAT.md` |
| `accounting` | Laporan Accounting (rahasia) | `FORMAT-ASLI-03-ACCOUNTING.md` |
| `it` | Laporan IT | `FORMAT-ASLI-04-IT.md` |
| `manager_resto` | Laporan Manager Resto | `FORMAT-ASLI-05-MANAGER-RESTO.md` |
| `ita` ⚠️ | Thrifting & Kontrol F&B | `FORMAT-ASLI-06-ITA.md` -- **diimplementasikan sebagai DUA form_key sejak 30 Agustus 2026** (`thrifting` + `kontrol_fnb`, migrasi `0036_pecah_ita.sql`), bukan lagi satu `ita`. Spesifikasi klien di file ini TIDAK berubah -- lihat `forms/f16-thrifting.ts`/`forms/f16-kontrol-fnb.ts` untuk pemetaan bagian mana masuk form mana. |
| `hrd` | Laporan HRD | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `security` | Laporan Security | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `perizinan` | Laporan Perizinan | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `pembangunan` | Laporan Pembangunan | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `dti` | Laporan DTI / Precast | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `kendaraan` | Laporan Kendaraan & Driver | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `pic_lokasi` | Laporan PIC Lokasi | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `cs` | Laporan Customer Service | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |
| `ga` | Operasional Kantor | `02-FORMAT-LAPORAN-DIVISI-BARU.md` |

Berkas `FORMAT-ASLI-*.md` adalah format yang sudah berjalan di perusahaan, disalin apa adanya dari dokumen klien. Belum semuanya masuk repo — lihat §4.

---

## §2 · `personal_marketing` — spesifikasi lengkap

Wajib seluruh karyawan tanpa kecuali, setiap hari. Kontrol: Pak Fauzy & Pak Dea.

Kolom **Kunci** di bawah adalah `Field.key` di `forms/f01-personal-marketing.ts`, dan sekaligus kunci JSON di `report.data`. Harus sama persis dengan yang dipakai `sinkronPteDaily()` dan view agregasi — beda satu huruf, hasilnya diam-diam nol tanpa error.

### Blok 1 · Identitas

Terisi otomatis dari `profile`, hanya baca, tidak perlu field.

Nama · Divisi/Jobdesk · PIC Lokasi · Tanggal (WIB)

### Blok 2 · Target closing pribadi

Target: minimal `policy.closing_target` konsumen closing per bulan.

| Kunci | Label | Tipe | Catatan |
|---|---|---|---|
| — | Closing bulan ini | *dihitung* | `___ / 2` dari view, **bukan diketik** |
| `closing_list` | Konsumen closing | `tabel` | baris bisa ditambah |

Kolom tabel `closing_list`: `nama_konsumen` (teks, wajib) · `lokasi` (pilih dari tabel `lokasi`) · `status` (pilih: booking / akad / batal)

Setiap baris menghasilkan satu baris di tabel `closing`.

> Teks yang ditampilkan di bawah blok ini:
> ✅ Jika target minimal 2 closing terpenuhi: Rp300.000 tidak dipotong.
> ❌ Jika tidak terpenuhi: mengikuti ketentuan perusahaan terkait potongan Rp300.000.
>
> Nominal diambil dari `policy.closing_penalty`, jangan ditulis di kode. Selama `policy.pte_mulai_berlaku` masih `null`, ganti seluruh kalimat ini dengan **"Ketentuan belum berlaku."**

### Blok 3 · Target undangan konsumen baru

Target: minimal `policy.invite_target` orang baru per bulan.

| Kunci | Label | Tipe |
|---|---|---|
| `undang_jumlah` | Undangan baru hari ini (orang) | `angka` |
| — | Akumulasi bulan ini | *dihitung* `___ / 20` |
| `undang_merespons` | Yang merespons | `angka` |
| `undang_mau_presentasi` | Yang mau presentasi | `angka` |
| `undang_jadi_prospek` | Yang menjadi prospek | `angka` |

### Blok 4 · PTE hari ini — enam kewajiban

Semua ber-`buktiWajib: true`. Dicentang tanpa lampiran → submit ditolak.

| Kunci | Label | Tipe | `buktiKunci` | Bukti yang diminta |
|---|---|---|---|---|
| `live` | Live | `ya_tidak` | `live` | Screenshot live |
| `live_platform` | Platform | `teks` | — | muncul kalau `live` = ya |
| `undang_jumlah` | Undang konsumen baru | `angka` | `undang` | Bukti undangan / follow-up |
| `kesaksian_jumlah` | Kesaksian / testimoni | `angka` | `kesaksian` | Video atau foto |
| `review_jumlah` | Google Review | `angka` | `review` | Link atau screenshot |
| `konten_jumlah` | VT / konten medsos | `angka` | `konten` | Link minimal 3 konten |
| `konten_1` `konten_2` `konten_3` | Konten 1, 2, 3 | `teks` | — | judul atau tautan |
| `mentahan_jumlah` | Video mentahan | `angka` | `mentahan` | File video |

`undang_jumlah` muncul di Blok 3 dan Blok 4 — **satu field yang sama**, jangan dibuat dua. Tampilkan di salah satu blok saja, rujuk di blok lainnya.

Ambang `konten_jumlah` dari `policy.pte_konten_minimal` (nilai 3).

> Aturan yang wajib ditegakkan sistem, kutipan dari format asli:
> **"Tidak cukup hanya menulis 'sudah'. Harus ada bukti."**

### Blok 5 · Status PTE Rp500.000

Seluruhnya dihitung sistem. Tidak ada field.

Tampilkan enam kewajiban dengan ✅/❌, lalu status **LENGKAP / TIDAK LENGKAP**.

Aturan bonus mengikuti `policy.pte_bonus_rule`, nominal dari `policy.pte_bonus_amount`. Selama `pte_mulai_berlaku` masih `null`, tampilkan **"Belum berlaku"** — bukan angka, bukan status hangus.

### Blok 6 · Funnel marketing pribadi

| Kunci | Label | Tipe | Catatan |
|---|---|---|---|
| — | Undangan bulan ini | *dihitung* | `___ / 20` |
| `funnel_prospek_aktif` | Prospek aktif | `angka` | |
| `funnel_presentasi` | Presentasi | `angka` | |
| `funnel_survey` | Survey lokasi | `angka` | |
| `funnel_booking` | Booking | `angka` | |
| — | Closing | *dihitung* | `___ / 2` |

### Blok 7 · Target besok

| Kunci | Label | Tipe |
|---|---|---|
| `besok_undangan` | Undangan baru (orang) | `angka` |
| `besok_followup` | Follow-up (orang) | `angka` |
| `besok_live` | Live | `teks` |
| `besok_konten` | 3 konten | `teks` |
| `besok_prospek` | Prospek yang dikejar | `teks` |
| `besok_closing` | Target closing | `teks` |

### Blok 8 · Status personal marketing

Dihitung sistem, tidak ada field. Tiga baris status:

- **Closing** — 🟢 tercapai / 🟡 proses / 🔴 belum ada
- **Undangan 20 orang** — 🟢 tercapai / 🟡 proses / 🔴 tertinggal
- **PTE** — 🟢 lengkap / 🔴 tidak lengkap

Ambang di `03-CALC-SPEC.md` §3.

### Blok 9 · Pernyataan karyawan

| Kunci | Label | Tipe | Catatan |
|---|---|---|---|
| `pernyataan` | Pernyataan | `ya_tidak` | **wajib**, tidak bisa submit tanpa dicentang |

Teks yang ditampilkan di sebelah centang:

> Saya memastikan laporan di atas sesuai aktivitas yang benar-benar saya kerjakan dan bukti telah saya lampirkan.

Simpan `pernyataan_at` (timestamp) dan nama pengisi bersama laporan.

---

## §3 · Prinsip yang ditampilkan di kaki form

> **SEMUA KARYAWAN = MARKETING.**
> Jobdesk utama wajib selesai. PIC lokasi wajib dikontrol. Marketing pribadi wajib berjalan. PTE wajib dilakukan setiap hari.
>
> Target bulanan: minimal 20 undangan konsumen baru, minimal 2 konsumen closing.

---

## §4 · Yang belum masuk repo

Lima format berikut ada di dokumen asli klien tapi belum tersalin ke `docs/`:

- `FORMAT-ASLI-02-PUSAT.md` — Laporan Harian Terpusat, 17 bagian
- `FORMAT-ASLI-03-ACCOUNTING.md` — 18 bagian, rahasia
- `FORMAT-ASLI-04-IT.md` — 15 bagian
- `FORMAT-ASLI-05-MANAGER-RESTO.md` — 14 bagian, termasuk 10 video kontrol wajib
- `FORMAT-ASLI-06-ITA.md` — 12 bagian + blok stock opname khusus Senin

**Dibutuhkan sebelum:** Task 14 (`it`), Task 16 (`manager_resto`, `ita`), Task 17 (`accounting`), Task 21 (`pusat`).

Tidak menghambat Task 12 maupun Task 13.
