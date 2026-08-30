# 03 — CALC SPEC

> Rumus perhitungan. Harus persis. Kalau agent ragu tentang angka, jawabannya ada di sini —
> bukan ditebak, dan bukan ditulis langsung di kode React.

---

## §1 · Tabel `policy` — seluruh nilai aturan bisnis

Semua nilai ini disimpan di tabel `policy` sebagai JSONB, dibaca lewat `usePolicy()`.
**Tidak boleh ada satu pun dari angka ini tertulis di file `.tsx`.**

```sql
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
  ('pte_mulai_berlaku',  'null'),
  ('gambar_max_px',      '1600')
on conflict (key) do nothing;
```

**`workdays`** memakai penomoran ISO: 1 = Senin … 7 = Minggu. Nilai `[1,2,3,4,5,6]` berarti Minggu libur.

**`pte_bonus_rule`** punya dua kemungkinan nilai:
- `"no_gap"` — bonus hangus kalau ada satu hari wajib yang tidak lengkap *(asumsi sementara)*
- `"per_day"` — bonus dibayar proporsional per hari lengkap

Kedua-duanya harus didukung kode sejak awal, karena klien belum memastikan yang mana.

---

## §2 · PTE harian

### Enam kewajiban

| Kunci | Terpenuhi kalau |
|---|---|
| `live` | dicentang **dan** ada ≥1 lampiran |
| `undang` | `undang_jumlah > 0` **dan** ada ≥1 lampiran |
| `kesaksian` | `kesaksian_jumlah > 0` **dan** ada ≥1 lampiran |
| `review` | `review_jumlah > 0` **dan** ada ≥1 lampiran |
| `konten` | `konten_jumlah >= policy.pte_konten_minimal` **dan** ada ≥1 lampiran |
| `mentahan` | `mentahan_jumlah > 0` **dan** ada ≥1 lampiran |

### Lengkap

```
lengkap = live ∧ undang ∧ kesaksian ∧ review ∧ konten ∧ mentahan
```

Enam-enamnya. Lima dari enam **bukan** lengkap.

### Sinkronisasi saat laporan dikirim

```ts
// pseudocode — dijalankan saat form personal_marketing di-submit
const jumlahLampiran = (fieldKey: string) =>
  attachments.filter(a => a.field_key === fieldKey).length;

await supabase.from('pte_daily').upsert({
  user_id:          session.user.id,
  tanggal:          tanggalWIB(),          // TANGGAL WIB, bukan UTC
  live:             data.live       && jumlahLampiran('live')      > 0,
  undang_jumlah:    jumlahLampiran('undang')    > 0 ? data.undang_jumlah    : 0,
  kesaksian_jumlah: jumlahLampiran('kesaksian') > 0 ? data.kesaksian_jumlah : 0,
  review_jumlah:    jumlahLampiran('review')    > 0 ? data.review_jumlah    : 0,
  konten_jumlah:    jumlahLampiran('konten')    > 0 ? data.konten_jumlah    : 0,
  mentahan_jumlah:  jumlahLampiran('mentahan')  > 0 ? data.mentahan_jumlah  : 0,
  report_id:        report.id,
}, { onConflict: 'user_id,tanggal' });
```

Perhatikan polanya: **kalau bukti tidak ada, jumlahnya dianggap nol** — bukan diterima lalu ditandai bermasalah. Tidak ada bukti berarti tidak dikerjakan.

Kolom `lengkap` adalah generated column di Postgres, tidak dihitung di frontend.

---

## §3 · Rekap bulanan per karyawan

### Definisi

| Besaran | Rumus |
|---|---|
| `hari_wajib` | Jumlah tanggal yang hari-ISO-nya ada di `policy.workdays`, dihitung dari **tanggal mulai** sampai **hari ini** |

**Tanggal mulai** adalah yang paling akhir di antara tiga ini:

1. Tanggal 1 bulan berjalan
2. `policy.pte_mulai_berlaku` — tanggal sistem resmi diberlakukan. Selama masih `null`, kewajiban PTE belum berjalan dan `hari_wajib` = 0
3. `profile.mulai_kerja` — tanggal karyawan mulai bekerja

⚠️ **Kenapa ini penting.** Tanpa tanggal mulai, hari yang tidak punya data sama sekali ikut dihitung bolong. Di bulan pertama peluncuran, seluruh karyawan akan tampak bolong belasan hari dan kehilangan bonus Rp500.000 — bukan karena lalai, tapi karena sistemnya baru menyala. Hal yang sama menimpa karyawan yang baru masuk pertengahan bulan.

Ditemukan saat pengujian Checkpoint 3, 22 Agustus 2026: karyawan yang bekerja 5 hari dan menyelesaikan 3 tercatat bolong 16 hari.

**Hari cuti, sakit, dan izin yang disetujui juga tidak boleh dihitung bolong.** Datanya ada di laporan HRD, tapi form itu baru dibangun di Task 14. Sampai saat itu, hari cuti masih terhitung bolong — catat sebagai utang dan selesaikan sebelum sistem dipakai menghitung gaji sungguhan.
| `hari_lengkap` | `count(pte_daily where lengkap = true)` di bulan itu |
| `hari_bolong` | `hari_wajib − hari_lengkap` |
| `undangan` | `sum(pte_daily.undang_jumlah)` di bulan itu |
| `closing` | `count(closing where status <> 'batal')` di bulan itu |

`hari_wajib` dihitung sampai **hari ini**, bukan sampai akhir bulan. Kalau tidak, semua orang terlihat gagal di tanggal 3.

### Status

```
status_undangan = undangan >= policy.invite_target        ? 'hijau'
                : undangan >= policy.invite_target * 0.6   ? 'kuning'
                :                                            'merah'

status_closing  = closing  >= policy.closing_target        ? 'hijau'
                : closing  >= 1                            ? 'kuning'
                :                                            'merah'
```

### Kelayakan PTE Rp500.000

```
if policy.pte_bonus_rule == 'no_gap':
    layak     = (hari_bolong == 0)
    nominal   = layak ? policy.pte_bonus_amount : 0

if policy.pte_bonus_rule == 'per_day':
    layak     = (hari_lengkap > 0)
    nominal   = round(policy.pte_bonus_amount * hari_lengkap / hari_wajib)
```

### Potongan Rp300.000

```
potongan = (closing < policy.closing_target) ? policy.closing_penalty : 0
```

⚠️ Sebelum tanggal terakhir bulan berjalan, potongan ditampilkan sebagai **proyeksi**, bukan keputusan. Beri label `proyeksi` di antarmuka. Ini menyangkut gaji orang — jangan tampilkan angka final di tanggal 5.

⚠️ **Selama `policy.pte_mulai_berlaku` masih `null`**, seluruh antarmuka menampilkan status bonus dan potongan sebagai `belum berlaku`, bukan angka. Sistem tidak boleh menghitung konsekuensi gaji sebelum aturannya resmi diumumkan ke karyawan.

### View

```sql
create or replace view public.v_marketing_bulanan as
with p as (
  select
    (select value from policy where key = 'workdays')                       as workdays,
    (select nullif(value #>> '{}', '')::date
       from policy where key = 'pte_mulai_berlaku')                         as mulai_berlaku
),
hi as (select (now() at time zone 'Asia/Jakarta')::date as d)
select
  pr.id                                as user_id,
  pr.nama,
  pr.divisi,
  date_trunc('month', hi.d)::date      as bulan,
  (p.mulai_berlaku is not null)        as pte_berlaku,
  hw.hari_wajib,
  coalesce(pd.hari_lengkap, 0)         as hari_lengkap,
  greatest(hw.hari_wajib - coalesce(pd.hari_lengkap, 0), 0) as hari_bolong,
  coalesce(pd.undangan, 0)             as undangan,
  coalesce(cl.closing, 0)              as closing
from profile pr
cross join p
cross join hi
-- hari_wajib dihitung PER KARYAWAN, karena mulai_kerja bisa berbeda-beda
left join lateral (
  select count(*)::int as hari_wajib
  from generate_series(
         greatest(date_trunc('month', hi.d)::date, p.mulai_berlaku, pr.mulai_kerja),
         hi.d,
         interval '1 day') g
  where p.mulai_berlaku is not null                     -- null = kewajiban belum berjalan
    and to_jsonb(extract(isodow from g)::int) <@ p.workdays
) hw on true
left join lateral (
  select count(*) filter (where lengkap) as hari_lengkap,
         sum(undang_jumlah)              as undangan
  from pte_daily
  where user_id = pr.id
    and tanggal >= date_trunc('month', hi.d)::date
) pd on true
left join lateral (
  select count(*) as closing
  from closing
  where user_id = pr.id
    and status <> 'batal'
    and tanggal >= date_trunc('month', hi.d)::date
) cl on true
where pr.aktif;
```

`greatest()` di Postgres mengabaikan NULL, jadi karyawan tanpa `mulai_kerja` otomatis memakai tanggal 1 bulan berjalan atau `pte_mulai_berlaku`, mana pun yang lebih akhir. Saat `pte_mulai_berlaku` masih `null`, `hari_wajib` bernilai 0 untuk semua orang — itu memang yang diinginkan sebelum aturan diumumkan.

Perhitungan `layak` dan `potongan` dilakukan di frontend dari view ini plus `policy`, karena aturannya bisa berganti.

---

## §4 · Agregasi untuk Laporan Terpusat & dashboard

### 4.1 Kepatuhan lapor hari ini

```sql
create or replace view public.v_papan_hari_ini as
select
  a.id                as assignment_id,
  a.form_key,
  a.lokasi_id, a.outlet_id,
  coalesce(l.nama, o.nama, a.form_key) as scope_nama,
  pr.nama             as pic_nama,
  r.id                as report_id,
  r.status,
  r.warna,
  r.submitted_at
from assignment a
join profile pr on pr.id = a.user_id and pr.aktif
left join lokasi l on l.id = a.lokasi_id
left join outlet o on o.id = a.outlet_id
left join report r
       on r.form_key = a.form_key
      and r.author_id = a.user_id
      and r.tanggal  = (now() at time zone 'Asia/Jakarta')::date
      and coalesce(r.lokasi_id, r.outlet_id) is not distinct from coalesce(a.lokasi_id, a.outlet_id)
      and r.status <> 'draft';
```

`report_id IS NULL` berarti **belum lapor**.

### 4.2 Pembangunan seluruh lokasi

Dijumlahkan dari `report.data` milik `pic_lokasi` hari ini:

```sql
create or replace view public.v_pembangunan_hari_ini as
select
  sum((data->>'unit_dibangun')::int)    as sedang_dibangun,
  sum((data->>'unit_finishing')::int)   as finishing,
  sum((data->>'unit_selesai')::int)     as selesai_hari_ini,
  sum((data->>'unit_belum_mulai')::int) as belum_mulai
from report
where form_key = 'pic_lokasi'
  and tanggal = (now() at time zone 'Asia/Jakarta')::date
  and status <> 'draft';
```

Kunci JSON di atas (`unit_dibangun`, dst.) **wajib** sama persis dengan `key` field di `f13-pic-lokasi.ts`. Kalau berbeda, hasilnya diam-diam nol — tidak akan ada error. Ini sumber bug paling licin di proyek ini; kunci JSON harus dianggap kontrak.

### 4.3 Rekap keuangan untuk Sabrina — hanya 4 angka

```sql
create or replace view public.v_keuangan_rekap
with (security_invoker = off) as        -- WAJIB off, lihat 04-CATATAN-TEKNIS §3.4
select
  tanggal,
  (data->>'total_masuk')::bigint  as total_masuk,
  (data->>'total_keluar')::bigint as total_keluar,
  (data->>'total_masuk')::bigint - (data->>'total_keluar')::bigint as net,
  warna
from report
where form_key = 'accounting'
  and status <> 'draft'
  and (public.has_role('ceo') or public.has_role('pusat') or public.has_role('accounting'));
```

⚠️ View ini **tidak** boleh berisi kolom lain dari laporan Accounting. Saldo bank, piutang, dan prioritas pembayaran tidak boleh bocor lewat sini. RLS pada view mengikuti tabel dasarnya, jadi tetap pasang policy khusus (lihat `04-CATATAN-TEKNIS.md` §3.4).

### 4.4 Silang-cek omzet resto

**Diperbarui 30 Agustus 2026 (migrasi `0031_indosteak_dua_outlet.sql`):** Indosteak jadi DUA outlet (Cempaka & Pekansari), bukan satu -- pola kunci lama `'omzet_' || lower(nama outlet)` berhenti berfungsi begitu nama outlet berspasi ("Indosteak Cempaka") dan dua outlet berbagi awalan yang sama. Diganti kolom `outlet.slug` (identitas stabil, independen dari nama tampilan) -- kunci JSON sekarang `'omzet_' || outlet.slug`. Live sekarang sebagai fungsi berparameter tanggal (`selisih_resto_untuk_tanggal(p_tanggal)`, migrasi `0020`), bukan lagi view tetap -- bentuk di bawah dipertahankan sebagai gambaran logika, bukan SQL yang benar-benar dijalankan:

```sql
create or replace view public.v_selisih_resto as
select
  o.nama                                       as outlet,
  (mr.data->>'total_omzet')::bigint            as versi_manager,
  (it.data->>('omzet_' || o.slug))::bigint     as versi_ita,
  (mr.data->>'total_omzet')::bigint
    - (it.data->>('omzet_' || o.slug))::bigint as selisih
from outlet o
join report mr on mr.form_key = 'manager_resto'
              and mr.outlet_id = o.id
              and mr.tanggal = (now() at time zone 'Asia/Jakarta')::date
join report it on it.form_key = 'ita'
              and it.tanggal = (now() at time zone 'Asia/Jakarta')::date;
```

Kalau `selisih <> 0`, **kedua** laporan ditandai 🔴 di Papan Kontrol dan otomatis dibuatkan baris `decision` berurgensi 2.

---

## §5 · Status warna laporan

Warna akhir sebuah laporan = **yang paling buruk** antara warna yang dipilih pengisi dan hasil pemeriksaan otomatis.

```
warna_akhir = max(warna_dipilih, warna_otomatis)      // merah > kuning > hijau
```

`warna_otomatis` menjadi 🔴 kalau salah satu terjadi:
- ada selisih uang atau stok yang belum ada penyebabnya
- ada `decision` berurgensi 1 dari laporan itu
- lampiran wajib tidak lengkap (seharusnya sudah tertahan validasi, ini jaring pengaman)

`warna_otomatis` menjadi 🟡 kalau:
- laporan `terlambat`
- ada `decision` berurgensi 2 atau 3

Alasan: pengisi bisa saja menandai laporannya hijau padahal ada selisih uang. Sistem tidak boleh ikut menganggapnya aman.

---

## §6 · Zona waktu — aturan mutlak

Semua "hari ini" berarti **hari ini di WIB**.

```ts
// lib/tanggal.ts
export const TZ = 'Asia/Jakarta';

export function tanggalWIB(d = new Date()): string {
  // → 'YYYY-MM-DD'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function jamWIB(d = new Date()): string {
  // → 'HH:mm'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function hariISOWIB(d = new Date()): number {
  // 1 = Senin … 7 = Minggu
  const nama = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return ({ Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 } as const)[nama as 'Mon'];
}
```

**Jangan pernah** memakai `new Date().toISOString().slice(0,10)`. Di WIB itu meleset satu hari setiap sebelum pukul 07.00 pagi — tepat jam satpam shift pagi mengirim laporan.

Di Postgres, selalu `(now() at time zone 'Asia/Jakarta')::date`.

---

## §7 · Rupiah

- Simpan sebagai `bigint`, satuan rupiah penuh, tanpa desimal
- Jangan pakai `float` untuk uang, pada nilai apa pun
- Tampilkan: `new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n)`
- Saat mengetik: terima angka polos, format saat blur, kirim ke database polos lagi
