# UI audit — report app (3 October 2026)

Audit only. Nothing was fixed, deployed, submitted or confirmed. pos-fnb has its own file: `pos-fnb/docs/AUDIT-UI-2026-10.md`. The **Top 10**, **remove/merge/hide**, **help-text** and **Go-live checklist** sections are the same in both files.

## How this was checked

- **Production** (https://koperumnasreport.vercel.app), at 360, 390 and 768 px.
- **Roles:**
  - CEO (uji-ceo)
  - Manager Resto / outlet manager (uji1)
  - Kontrol F&B (uji3)
  - Karyawan Resto / cashier-level employee (uji2)
  - Ita's thrifting form was opened as these roles; no uji account has the thrifting assignment.
- **Pages:**
  - 15 main routes per role (60 visits).
  - All 17 `/lapor/<form>` pages per role (68 visits), opened only. No draft or submission was made.
  - `/masuk` (including one wrong-password attempt).
  - The first-login `/ganti-password` screen, viewed only; the password was not changed.
- **Test-account flags** were set temporarily and restored after every run, confirmed in the run logs.
- **Screenshots:** OS temp folder only. None are in the repo.
- **Not tested** (would write production data): submitting any form, absen with GPS, cuti submission, the cleanliness photos.

Severity: **blocker** = the first real day cannot run; **high** = someone gets stuck or the data goes wrong; **medium** = confusing or slow but workable; **low** = polish.

## Findings

12 findings: 1 high, 7 medium, 4 low. (pos-fnb: 30 findings: 3 blocker, 6 high, 14 medium, 7 low.)

| ID | Page | Role | Severity | Type | What is wrong | Suggested fix | Effort |
|---|---|---|---|---|---|---|---|
| R01 | `/lapor/hrd`, `perizinan`, `it`, `pembangunan`, `dti`, `kendaraan`, `cs`, `ga`, `thrifting`, **`accounting`**, `pusat` | Any employee (seen as Karyawan Resto) | high | bug | Every logged-in employee can open these division forms without an assignment. Only the scoped forms (`pic_lokasi`, `security`, `manager_resto`, `kontrol_fnb`) show "Anda tidak punya penugasan untuk laporan ini". The save path (`lib/api/report.ts`, insert into `report`) and RLS `report_insert` (`0002_rls.sql`) check only `author_id = auth.uid()`. Accounting has a one-per-day unique index (`report_accounting_singleton`), so one stray accounting submission by anyone would block the real accounting report that day. Checked by opening the forms and reading the code; **not** checked by submitting, because that is production. | UI: show the "tidak punya penugasan" state for division forms too, by role or division. DB: a `security definer` check in `report_insert` that the author holds the role or assignment for `form_key`. That is a migration, so it needs approval. | M |
| R02 | `/masuk` | Everyone | medium | missing-state | There is no "Lupa kata sandi?" path. An employee who forgets the password on day one has no instruction. | Add a line such as "Lupa kata sandi? Hubungi admin: …" (contact from `policy`), or a reset flow. | S |
| R03 | `/cuti` | All roles | medium | ui | At 360 px the "Tanggal selesai" field runs 24 px off screen. The attachment uses the browser's native file input, which shows "Choose File / No file chosen" in English. | Stack the two date fields under 400 px. Use the "Lampirkan" pill button from the design tokens (radius 999px) with Indonesian text. | S |
| R04 | `/marketing` | CEO | medium | ui | The table is wider than a phone. The title "Dashboard Kontrol Marketing" contains an English word. | Use a card per marketer under 640 px, and title it "Kontrol Marketing". | M |
| R05 | All pages | All | medium | bug | Loads take 2.1–4 s at 360 px. `/akun` took 6.0 s and `/` 4.0 s for the CEO. Several are over the 3 s target. | Profile `/akun` and `/` (parallelise queries, avoid repeated session lookups). | M |
| R06 | `/` and Laporan Manager Resto | Marketing staff, managers | medium | unclear | "PTE hari ini: 0 / 80 poin · Closing bulan ini: 0 / 2" is unexplained jargon. | Add help text (see the terms section). The numbers keep coming from `policy`. | S |
| R07 | `/terpusat` | CEO | medium | ui | One page about 6,900 px long at 360 px: 17 sections, then the "Laporan Terpusat" form below them. Hard to use on a phone. | Collapse each section to a summary row, like the form accordions, and link to the form instead of appending it. | M |
| R08 | `/` tasks, nav "Lapor" | Restaurant staff (Karyawan Resto, Manager Resto) | medium | unclear | Restaurant staff get "Laporan Personal Marketing" (19 fields) as a daily task, and the "Lapor" menu opens it directly. Nothing tells F&B staff why. | Confirm with the CEO that every employee reports personal marketing. If yes, add a one-line reason on the form; if not, assign it per division. | S |
| R09 | `/masuk` vs `/ganti-password`, `/admin` | Everyone | low | language | "Kata sandi" on the login page, "Password" on the change-password page. | Pick one term ("Kata sandi") everywhere. | S |
| R10 | `/papan`, `/terpusat`, `/absen/tinjau`, `/kebersihan/tinjau` | CEO, reviewers | low | ui | The ←/→ day arrows are 43×44 px, just under the 44 px minimum. | 44×44 or larger. | S |
| R11 | Form and section titles | All | low | language | Individual people's names are written into labels: "Laporan Harian Thrifting (Ita)", "Verifikasi dengan Bu Sabita" (Kontrol F&B), "Kesimpulan Sabrina Hari Ini" (Pusat), "Marketing -- Kontrol Pak Fauzi & Pak Dea" (/terpusat). They go stale when staff change. | Use role names, or read the name from the assignment. | S |
| R12 | Several forms and pages | All | low | language | English left in the UI: "Manager" (role names, nav), "Unit", "Update", "Login" and "Refund" in the IT and CS forms, "Dashboard" (/marketing), "Choose File" (/cuti). | Translate: Manajer, Unit rumah, Perbarui, Masuk, Pengembalian dana. | S |

What works well:
- Every forbidden route shows a clear "Tidak punya akses" page.
- `/asisten` shows "Belum diaktifkan untuk akun Anda" for people without access.
- The login error is clear ("Email atau kata sandi salah.").
- `/masuk` and `/ganti-password` have 44–48 px targets and a show-password button.
- No console errors or failed requests on any of the 128 report-app visits.
- The form accordions show progress per section ("14 isian", "Belum diisi").

## Top 10 for the first real day at an outlet (both apps)

1. **P01** POS Worker hits the CPU limit and returns 503 after a few pages. Nothing else matters until this is solved.
2. **P03** Tunai (cash) payment method is inactive in production.
3. **P02** Thrift cashier is never sent to the prepare report, so every thrift sale fails at "Konfirmasi Bayar".
4. **Go-live data**: no cashier device registered at Kemayoran or Cempaka Putih, no cashier employee at Pekansari, and opening stock counts missing for Kemayoran and Pekansari (see Go-live checklist).
5. **P04** No way back from the receipt page to the sales screen after payment.
6. **P08** "Wajib opname shift" is on but 0 ingredients are marked Hitung Tiap Shift, so shift counts are skipped silently.
7. **P07** Cashier buttons are 28–36 px (payment chips, Bayar, Konfirmasi Bayar, Close, Ya/Tidak).
8. **R01** (report) Any employee can open, and by the code also submit, division forms they are not assigned to, including **accounting**. Accounting allows one report per day, so one stray submission blocks the real one for that day.
9. **P09** The cart is lost on reload.
10. **P05** `/price-tiers` shows a 500 error page to the CEO, Kontrol and Ita.

## Features to remove, merge or hide

| Feature | Decision | Why |
|---|---|---|
| Dashboard card "Laba Kotor & Laba Bersih — Menyusul (Fase 2/3)" | **Hide** | Placeholder in developer wording; no data. |
| "Tingkat Harga" (`/price-tiers`) menu item for the manager role | **Hide** for roles without `price.manage` | Leads to a 500 error (P05). |
| "Buka Kasir" in the dashboard header | **Hide** on devices that are not paired as cashiers | Invites pairing a personal phone as a till (P27). |
| "Nama Pelayan" on Buka Shift | **Hide until needed** (shared account only) | Confuses cashiers with a personal code (P20). |
| Opname shift setting vs. Hitung Tiap Shift flag | **Merge the warning** | The two settings only work together, but they live on different pages (outlet form and ingredients); the outlet page should show how many items are flagged. |
| Inactive DEMO outlets | **Keep archived, rename** | Names collide with real outlets (P30). |
| `/stock-opnames` picker showing the thrifting outlet | **Hide** thrifting outlets | They have no ingredient stock (P18). |
| "Refund" and "Void" on Transaksi Hari Ini | **Keep, rename and explain** | Both needed; the English words are unclear to cashiers (see help text). |
| Report app: unassigned division forms (`/lapor/hrd`, `/lapor/accounting`, …) | **Hide** behind the same "tidak punya penugasan" state as scoped forms | Everyone can open them today (R01). |
| Report app: `/terpusat` page plus the "Laporan Terpusat" form under it | **Merge** into collapsible sections | About 6,900 px of scrolling at 360 px (R07). |
| Report app: "Laporan Personal Marketing" as a daily task for restaurant staff | **Confirm with the CEO**, then keep it with an explanation or hide it for outlet staff | Unclear to F&B staff why they report house sales (R08). |

## Terms that need help text

Proposed one-line explanations in Indonesian, to show as a hint under the label or behind an (i) icon.

| Term | Where | Proposed help line |
|---|---|---|
| Opname | Stock opname, dashboard, shift | "Opname = menghitung stok fisik di outlet lalu mencatat jumlahnya, supaya stok di sistem sama dengan yang ada di rak." |
| Jenis ukuran | Ingredients, measure review | "Jenis ukuran = cara bahan ini diukur: berat (gram), isi (ml), atau jumlah (biji/pcs)." |
| Lacak stok | Ingredient form/table | "Lacak stok = stok bahan ini dipotong otomatis setiap ada penjualan dan ikut dihitung saat opname. Matikan untuk bahan yang dipakai kira-kira (biaya saja)." |
| Harga rata-rata | Ingredients, purchases | "Harga rata-rata = modal per satuan bahan, dihitung dari semua pembelian yang masih ada di stok. Dipakai untuk menghitung HPP." |
| Hitung Tiap Shift | Ingredients | "Hitung Tiap Shift = bahan ini wajib dihitung kasir saat buka dan tutup shift (untuk bahan mahal atau rawan selisih)." |
| Bahan biaya saja | Ingredient form | "Biaya saja = bahan tidak dipotong stok; modalnya memakai harga terakhir yang diisi manajer." |
| Harga terakhir | Ingredients, purchases | "Harga terakhir = harga beli paling baru; dipakai untuk bahan biaya saja." |
| HPP | Reports, recipes | "HPP = modal bahan untuk membuat satu porsi, dihitung dari resep × harga rata-rata." |
| Selisih opname | Opname, audit | "Selisih = jumlah hasil hitung dikurangi jumlah menurut sistem; minus berarti stok hilang atau terpakai tanpa tercatat." |
| Tingkat harga | Price tiers, POS | "Tingkat harga = daftar harga berbeda untuk saluran berbeda (mis. makan di tempat vs. ojek online)." |
| Modifier / pilihan tambahan | Products | "Pilihan tambahan = opsi yang bisa dipilih pelanggan untuk satu menu (mis. level gula, ekstra shot) dan bisa mengubah harga." |
| Pindah stok (transfer) | Stock transfers | "Pindah stok = mengirim bahan dari satu outlet/gudang ke outlet lain; stok berkurang di asal dan bertambah di tujuan setelah diterima." |
| Satuan beli & faktor | Ingredient form | "Satuan beli = satuan saat membeli (mis. liter); faktor = isinya dalam satuan dasar (1 liter = 1000 ml)." |
| Modal awal | Buka shift | "Modal awal = uang tunai di laci kasir saat shift dibuka (uang kembalian)." |
| Laporan persiapan | Prepare | "Laporan persiapan = foto kondisi outlet dan info event hari ini, wajib diisi sebelum mulai jualan." |
| Batas hari bisnis | Outlet form | "Batas hari bisnis = jam pergantian hari untuk laporan; transaksi sebelum jam ini dihitung ke hari sebelumnya." |
| Refund / Void | Transaksi Hari Ini | "Batalkan (void) = transaksi dibatalkan seluruhnya; Pengembalian dana (refund) = sebagian/seluruh uang dikembalikan setelah dibayar." |
| Barang titipan / pemilik titipan | Thrift | "Barang titipan = barang milik orang lain yang dijual toko; hasil penjualan dibagi sesuai persentase bagi hasil pemilik." |
| Siap jual | Thrift barang | "Siap jual = barang sudah diberi label dan boleh dipindai di kasir." |
| Bagi hasil | Thrift report | "Bagi hasil = bagian uang penjualan untuk pemilik titipan dan bagian untuk toko." |
| Dapur pusat / gudang | Outlet form | "Dapur pusat = tempat bahan disimpan atau diolah lalu dikirim ke outlet; tidak berjualan langsung." |
| PTE (report app) | Home, Manager Resto, Personal Marketing | "PTE = poin aktivitas pemasaran harian (target {target} poin per hari); dihitung otomatis dari laporan Personal Marketing." (target read from `policy`, not hard-coded) |
| Closing (report app) | Home, Personal Marketing | "Closing = konsumen yang sudah jadi membeli rumah (akad/booking) bulan ini." |
| Penugasan (report app) | Forms, Admin | "Penugasan = laporan apa yang wajib Anda isi, untuk lokasi/outlet dan shift mana; diatur oleh admin." |
| Tinjau (absen/kebersihan) (report app) | Kadiv/manager pages | "Tinjau = periksa kiriman tim lalu setujui atau beri catatan." |

## Go-live checklist (consolidated, both apps)

State read on **3 October 2026**, read-only. No values were changed.

**Accounts and secrets**
- [ ] Initial password (the constant `PASSWORD_AWAL` in `lib/passwordAwal.ts`, report repo) is still the shared first-login password, which is the CEO's decision for the development period. Before real use, switch to a per-person temporary password or reset link.
- [ ] **8 privileged report accounts are still on the initial password:**
  - admin: 2 people;
  - accounting: 1;
  - kadiv: 6 accounts, 5 people beyond the admins (one person is both admin and kadiv).
  - Names are in the admin page, not here.
  - 30 regular employee accounts are flagged "must change password". The 6 test accounts are already rotated to random passwords in the local credentials file outside the repos.
- [ ] **7 cashier PINs are still the seed-demo default.** Give each cashier a unique PIN via Karyawan → Reset PIN before any real sale. The 2 manager PINs are already rotated.
- [ ] **Password-login rate limit / CAPTCHA:** check it in the Supabase dashboard (Auth → Rate Limits and Attack Protection) for both projects. The report app relies only on Supabase's per-IP limit. POS PIN entry has its own lockout (5 wrong → 15 minutes).

**Platform**
- [ ] **Cloudflare Workers plan / CPU limit for pos-fnb** (P01). Until this is solved, the POS cannot be used for a full day.

**POS configuration**
- [ ] **Tunai (CASH) payment method is inactive.** Active methods: QRIS, Transfer (P03).
- [ ] **Cashier devices:**
  - Jatinegara: 1 active device.
  - Pekansari: 1.
  - Bestie Thrift: 2.
  - **Kemayoran: 0.**
  - **Cempaka Putih: 0.**
- [ ] **Cashier employees:**
  - Jatinegara: 3 cashiers.
  - Kemayoran: 2 cashiers.
  - Cempaka Putih: 1 cashier.
  - Bestie Thrift: 1 cashier + 1 manager.
  - **Pekansari: 0 cashiers, 1 manager only.**
- [ ] Tax per outlet:
  - Jatinegara and Kemayoran: 10%.
  - Cempaka Putih and Pekansari: 15%.
  - Bestie Thrift: 0%.
  - Confirm with the CEO that 15% is intended for the Indosteak outlets.

**Data blockers (current, read-only)**

| Outlet | Wajib opname shift | Confirmed opnames | Stock rows | Stock rows with no average price | Ingredients marked Hitung Tiap Shift | Products without a recipe |
|---|---|---|---|---|---|---|
| Bestie Thrift (thrifting) | no | 0 | 0 | 0 | 0 | 0 of 0 (sells barang; 4 ready to sell) |
| Indokopi Jatinegara | yes | 1 | 65 | 0 | **0** | **95 of 100** |
| Indokopi Lite Kemayoran | yes | **0** | **0** | 0 | **0** | **12 of 16** |
| Indosteak Cempaka Putih | yes | 2 | 51 | **51** | **0** | **44 of 51** |
| Indosteak Pekansari | yes | **0** | **0** | 0 | **0** | **44 of 51** |

Business-wide:
- 225 active ingredients, of which 212 are used in no recipe.
- 0 cost-only ingredients.
- 0 marked Hitung Tiap Shift.
- Jenis ukuran unset: 0.

- [ ] **Recipe coverage:** most products have no recipe, so their sales do not reduce stock and their HPP is unknown. The minimum before day one is the best sellers of each outlet.
- [ ] **First opname:** Kemayoran and Pekansari have no confirmed opname and no stock rows. Do a first full count before opening.
- [ ] **Hitung Tiap Shift:** mark the expensive or loss-prone items for each F&B outlet. With 0 marked, the required shift counts are skipped (P08).
- [ ] **Zero / missing prices:** Cempaka Putih has 51 of 51 stock rows with no average price, so its HPP and opname value will show Rp0. Enter purchases (or prices) first. The other outlets with stock have none missing.
