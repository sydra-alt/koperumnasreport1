# 04 — CATATAN TEKNIS

---

## §1 · Skema database

File: `supabase/migrations/0001_init.sql`

```sql
create extension if not exists "pgcrypto";

-- ─── ENUM ────────────────────────────────────────────────────────────
create type report_status  as enum ('draft','terkirim','terlambat');
create type warna          as enum ('hijau','kuning','merah');
create type decision_status as enum ('menunggu','disetujui','dicicil','ditunda','ditolak');

-- ─── ORANG ───────────────────────────────────────────────────────────
create table public.profile (
  id          uuid primary key references auth.users on delete cascade,
  nama        text not null,
  jabatan     text,
  divisi      text,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.role (
  user_id uuid not null references public.profile(id) on delete cascade,
  role    text not null
          check (role in ('ceo','pusat','accounting','kontrol_marketing',
                          'kadiv','pic_lokasi','manager_resto','karyawan')),
  primary key (user_id, role)
);

-- ─── TEMPAT ──────────────────────────────────────────────────────────
create table public.lokasi (
  id    uuid primary key default gen_random_uuid(),
  nama  text not null unique,
  aktif boolean not null default true
);

create table public.outlet (
  id    uuid primary key default gen_random_uuid(),
  nama  text not null unique,
  aktif boolean not null default true
);

-- siapa bertanggung jawab mengisi form apa, untuk scope mana
create table public.assignment (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profile(id) on delete cascade,
  form_key  text not null,
  lokasi_id uuid references public.lokasi(id) on delete cascade,
  outlet_id uuid references public.outlet(id) on delete cascade,
  shift     text check (shift in ('pagi','siang','malam'))
);

create unique index assignment_uniq on public.assignment (
  user_id, form_key,
  coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(shift, '-')
);

-- ─── LAPORAN ─────────────────────────────────────────────────────────
create table public.report (
  id           uuid primary key default gen_random_uuid(),
  form_key     text not null,
  form_version int  not null default 1,
  tanggal      date not null,
  author_id    uuid not null references public.profile(id),
  lokasi_id    uuid references public.lokasi(id),
  outlet_id    uuid references public.outlet(id),
  shift        text check (shift in ('pagi','siang','malam')),
  data         jsonb not null default '{}'::jsonb,
  status       report_status not null default 'draft',
  warna        warna,
  submitted_at timestamptz,
  nudged_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index report_uniq on public.report (
  form_key, tanggal, author_id,
  coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(shift, '-')
);
create index report_tanggal_idx on public.report (tanggal desc);
create index report_form_idx    on public.report (form_key, tanggal desc);
create index report_data_gin    on public.report using gin (data);

create table public.attachment (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.report(id) on delete cascade,
  field_key   text not null,
  path        text not null,
  mime        text,
  bytes       bigint,
  captured_at timestamptz,
  created_at  timestamptz not null default now()
);
create index attachment_report_idx on public.attachment (report_id, field_key);

-- ─── MARKETING ───────────────────────────────────────────────────────
create table public.pte_daily (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profile(id) on delete cascade,
  tanggal          date not null,
  live             boolean not null default false,
  undang_jumlah    int not null default 0,
  kesaksian_jumlah int not null default 0,
  review_jumlah    int not null default 0,
  konten_jumlah    int not null default 0,
  mentahan_jumlah  int not null default 0,
  lengkap boolean generated always as (
    live
    and undang_jumlah    > 0
    and kesaksian_jumlah > 0
    and review_jumlah    > 0
    and konten_jumlah   >= 3
    and mentahan_jumlah  > 0
  ) stored,
  report_id  uuid references public.report(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

create table public.closing (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profile(id) on delete cascade,
  nama_konsumen text not null,
  lokasi_id     uuid references public.lokasi(id),
  tanggal       date not null,
  status        text not null default 'booking'
                check (status in ('booking','akad','batal')),
  report_id     uuid references public.report(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index closing_user_idx on public.closing (user_id, tanggal desc);

-- ─── KEPUTUSAN CEO ───────────────────────────────────────────────────
create table public.decision (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid references public.report(id) on delete cascade,
  judul              text not null,
  masalah            text,
  dampak             text,
  nominal            bigint not null default 0,
  pic_id             uuid references public.profile(id),
  deadline           date,
  urgensi            int not null default 2 check (urgensi between 1 and 3),
  status             decision_status not null default 'menunggu',
  keputusan_catatan  text,
  decided_by         uuid references public.profile(id),
  decided_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index decision_antrean_idx
  on public.decision (status, urgensi, deadline nulls last);

-- ─── ATURAN BISNIS ───────────────────────────────────────────────────
create table public.policy (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
```

> **Catatan tentang `pte_daily.lengkap`.** Ambang `konten_jumlah >= 3` terpaksa ditulis
> di dalam generated column karena Postgres tidak mengizinkan subquery di sana.
> Ini satu-satunya angka aturan bisnis yang boleh ada di luar tabel `policy`.
> Kalau `policy.pte_konten_minimal` diubah, generated column ini **harus** ikut
> diubah lewat migrasi baru. Catat kaitan ini di komentar SQL-nya.

---

## §2 · Trigger `updated_at`

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger report_updated    before update on public.report
  for each row execute function public.set_updated_at();
create trigger pte_daily_updated before update on public.pte_daily
  for each row execute function public.set_updated_at();
```

---

## §3 · Row Level Security

File: `supabase/migrations/0002_rls.sql`

### 3.1 Fungsi bantu

```sql
create or replace function public.has_role(r text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role where user_id = auth.uid() and role = r);
$$;

create or replace function public.can_see_report(f text, author uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
       author = auth.uid()
    or public.has_role('ceo')
    or (public.has_role('pusat')             and f <> 'accounting')
    or (public.has_role('kontrol_marketing') and f =  'personal_marketing')
    or (public.has_role('accounting')        and f in ('accounting','manager_resto','ita'))
    or (public.has_role('manager_resto')     and f =  'personal_marketing');
$$;
```

Baris `pusat and f <> 'accounting'` adalah inti kerahasiaan yang diminta klien. Jangan diubah.

### 3.2 Policy `report`

```sql
alter table public.report enable row level security;

create policy report_select on public.report for select
  using (public.can_see_report(form_key, author_id));

create policy report_insert on public.report for insert
  with check (author_id = auth.uid());

create policy report_update on public.report for update
  using (author_id = auth.uid()
         and tanggal = (now() at time zone 'Asia/Jakarta')::date)
  with check (author_id = auth.uid());

-- tombol "Tagih" milik Pusat hanya boleh menyentuh nudged_at
create policy report_nudge on public.report for update
  using (public.has_role('pusat') or public.has_role('ceo'))
  with check (true);
```

> Policy `report_nudge` di atas terlalu longgar kalau berdiri sendiri — `with check (true)`
> berarti Pusat bisa mengubah kolom apa pun. Kolom yang boleh disentuh tidak bisa dibatasi
> lewat RLS. Karena itu **tombol Tagih wajib lewat RPC**, bukan `update` langsung dari klien:

```sql
create or replace function public.tagih_laporan(assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('pusat') or public.has_role('ceo')) then
    raise exception 'Tidak berhak';
  end if;
  -- catat penagihan; implementasi menyusul di Task 18
end $$;
```

Dan policy `report_nudge` **dihapus**. Ditulis di sini supaya agent tidak menemukannya
sendiri lalu memasangnya tanpa sadar konsekuensinya.

### 3.3 Policy tabel lain

```sql
-- profile: semua yang login boleh melihat nama rekan (untuk daftar PIC)
alter table public.profile enable row level security;
create policy profile_select on public.profile for select using (auth.uid() is not null);
create policy profile_update on public.profile for update
  using (id = auth.uid() or public.has_role('ceo'));

-- role, lokasi, outlet, assignment, policy: baca untuk semua, tulis hanya CEO
alter table public.role       enable row level security;
alter table public.lokasi     enable row level security;
alter table public.outlet     enable row level security;
alter table public.assignment enable row level security;
alter table public.policy     enable row level security;

create policy role_select   on public.role       for select using (auth.uid() is not null);
create policy lokasi_select on public.lokasi     for select using (auth.uid() is not null);
create policy outlet_select on public.outlet     for select using (auth.uid() is not null);
create policy asg_select    on public.assignment for select using (auth.uid() is not null);
create policy policy_select on public.policy     for select using (auth.uid() is not null);

create policy role_admin   on public.role       for all using (public.has_role('ceo')) with check (public.has_role('ceo'));
create policy lokasi_admin on public.lokasi     for all using (public.has_role('ceo')) with check (public.has_role('ceo'));
create policy outlet_admin on public.outlet     for all using (public.has_role('ceo')) with check (public.has_role('ceo'));
create policy asg_admin    on public.assignment for all using (public.has_role('ceo')) with check (public.has_role('ceo'));
create policy policy_admin on public.policy     for all using (public.has_role('ceo')) with check (public.has_role('ceo'));

-- attachment: ikut visibilitas laporan induknya
alter table public.attachment enable row level security;
create policy att_select on public.attachment for select using (
  exists (select 1 from public.report r
          where r.id = report_id and public.can_see_report(r.form_key, r.author_id))
);
create policy att_insert on public.attachment for insert with check (
  exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);
create policy att_delete on public.attachment for delete using (
  exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);

-- pte_daily & closing: milik sendiri + pengawas marketing
alter table public.pte_daily enable row level security;
alter table public.closing   enable row level security;

create policy pte_select on public.pte_daily for select using (
  user_id = auth.uid() or public.has_role('ceo')
  or public.has_role('pusat') or public.has_role('kontrol_marketing')
  or public.has_role('manager_resto')
);
create policy pte_write on public.pte_daily for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy closing_select on public.closing for select using (
  user_id = auth.uid() or public.has_role('ceo')
  or public.has_role('pusat') or public.has_role('kontrol_marketing')
);
create policy closing_write on public.closing for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- decision: dilihat CEO & Pusat, dibuat pemilik laporan, diputuskan CEO saja
alter table public.decision enable row level security;
create policy dec_select on public.decision for select using (
  public.has_role('ceo') or public.has_role('pusat')
  or exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);
create policy dec_insert on public.decision for insert with check (
  exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);
create policy dec_decide on public.decision for update
  using (public.has_role('ceo')) with check (public.has_role('ceo'));
```

### 3.4 View

View di Postgres berjalan dengan hak pembuatnya, sehingga **bisa membocorkan data
yang seharusnya tertutup RLS**. Karena itu setiap view di `03-CALC-SPEC.md` harus dibuat
dengan `security_invoker`:

```sql
alter view public.v_keuangan_rekap  set (security_invoker = on);
alter view public.v_papan_hari_ini  set (security_invoker = on);
alter view public.v_marketing_bulanan set (security_invoker = on);
alter view public.v_pembangunan_hari_ini set (security_invoker = on);
alter view public.v_selisih_resto   set (security_invoker = on);
```

Tanpa baris ini, Ibu Sabrina bisa melihat saldo bank lewat view. Ini kesalahan paling
mudah terlewat di seluruh proyek.

### 3.4b View agregat lintas divisi

Ada kalanya seseorang butuh **angka** dari laporan divisi lain, tapi tidak berhak membaca **isinya**. Contoh: Kepala Pembangunan perlu jumlah unit dari seluruh PIC lokasi, tapi tidak perlu tahu keluhan konsumen atau permintaan keputusan CEO yang ada di laporan yang sama.

Jangan melebarkan `can_see_report()` untuk kasus seperti ini. Melebarkan akses baris berarti memberi seluruh isi laporan, bukan cuma yang dibutuhkan.

Pola yang benar — view agregat `security definer` dengan penjaga di dalamnya:

```sql
create or replace view public.v_pembangunan_per_lokasi
with (security_invoker = off) as        -- SENGAJA off: lihat penjaga di bawah
select
  l.nama as lokasi,
  sum((r.data->>'unit_dibangun')::int)    as dibangun,
  sum((r.data->>'unit_finishing')::int)   as finishing,
  sum((r.data->>'unit_selesai')::int)     as selesai_hari_ini
from report r
join lokasi l on l.id = r.lokasi_id
where r.form_key = 'pic_lokasi'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('pembangunan')      -- PENJAGA
group by l.nama;
```

```sql
-- Boleh melihat rekap kalau memang ditugaskan mengisi form yang membutuhkannya
create or replace function public.boleh_lihat_rekap(untuk_form text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
       public.has_role('ceo')
    or public.has_role('pusat')
    or exists (select 1 from assignment a
               where a.user_id = auth.uid() and a.form_key = untuk_form);
$$;
```

**Tiga syarat mutlak** untuk setiap view semacam ini:

1. **Daftar putih per field, bukan "hanya angka".** Setiap kolom view disebut satu per satu dan dipilih karena memang dibutuhkan untuk pekerjaan pembacanya. Aturannya bukan tipe datanya, melainkan apakah isinya bisa ditebak:

   | Boleh | Tidak boleh |
   |---|---|
   | Angka dan hitungan | **Field teks bebas** — apa pun bisa ditulis di sana, termasuk keluhan konsumen atau hal pribadi |
   | Pilihan tertutup (`jalan_status`, `air_status`) | Nama orang, nama konsumen |
   | Tabel terstruktur yang memang dibutuhkan, misal daftar material kurang (nama material, jumlah, tanggal dibutuhkan) | Isi masalah, permintaan keputusan CEO, catatan PIC |

   Kepala Pembangunan perlu tahu material **apa** yang kurang, bukan cuma berapa banyak jenisnya — tanpa itu dia tidak bisa memesan apa-apa. Tapi `infrastruktur_kebutuhan` dan `kiriman_kekurangan` tetap ditutup, karena keduanya teks bebas dan isinya tidak bisa dijamin.

   Uji setiap view baru dengan menanam field umpan berisi teks mencolok di laporan sumber, lalu pastikan tidak muncul di hasil view.
2. Wajib memanggil `boleh_lihat_rekap()` di klausa `where`. Tanpa itu, `security_invoker = off` membuat view terbuka untuk siapa pun yang login.
3. **`form_key = 'accounting'` tidak boleh menjadi sumber view mana pun** selain `v_keuangan_rekap` yang sudah ada. Jangan pernah menambahkannya, dengan alasan apa pun.

Alasan memilih pola ini: Ibu Sabrina tidak diberi akses ke baris laporan Accounting, melainkan view berisi empat angka. Kepala Pembangunan diperlakukan sama.

### 3.5 Storage

```sql
create policy bukti_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'bukti' and (storage.foldername(name))[1] in (
    select r.id::text from public.report r where r.author_id = auth.uid()
  ));

create policy bukti_read on storage.objects for select to authenticated
  using (bucket_id = 'bukti' and (storage.foldername(name))[1] in (
    select r.id::text from public.report r
    where public.can_see_report(r.form_key, r.author_id)
  ));
```

---

## §4 · Matriks uji (Task 24)

Jalankan sebagai lima akun berbeda. Semua harus lolos sebelum deploy.

| # | Sebagai | Skenario | Harapan |
|---|---|---|---|
| 1 | `pusat` | `select * from report where form_key='accounting'` | **0 baris** |
| 2 | `ceo` | idem | ada baris |
| 3 | `pusat` | `select * from v_keuangan_rekap` | 4 kolom saja, tanpa saldo bank |
| 4 | `karyawan` | `select * from report` | hanya laporan sendiri |
| 5 | `karyawan` | insert report dengan `author_id` orang lain | **ditolak** |
| 6 | `pic_lokasi` | update laporan orang lain | **ditolak** |
| 7 | `pic_lokasi` | update laporan sendiri kemarin | **ditolak** (bukan tanggal hari ini) |
| 8 | `pusat` | `update decision set status='disetujui'` | **ditolak** |
| 9 | `ceo` | idem | berhasil |
| 10 | `karyawan` | buka path storage orang lain tanpa signed URL | **ditolak** |
| 11 | `karyawan` | kirim laporan dua kali di hari sama | baris tetap satu |
| 12 | `security` | kirim laporan shift pagi & siang di hari sama | dua baris, tidak bentrok |
| 13 | `kontrol_marketing` | `select * from report where form_key='accounting'` | **0 baris** |
| 14 | belum login | `select * from report` | **0 baris** |

---

## §5 · Struktur folder

```
app/
  layout.tsx            Server Component — kop halaman, penyedia global
  page.tsx              beranda
  tokens.css            token desain
  masuk/page.tsx
  lapor/[formKey]/page.tsx
  papan/page.tsx
  keputusan/page.tsx
  marketing/page.tsx
  terpusat/page.tsx
  admin/page.tsx
  api/                  Route Handler — baru dipakai di Fase 2
components/
  FormRenderer.tsx      'use client'
  fields/               'use client' — Angka, Uang, Teks, TeksPanjang, Pilih,
                        YaTidak, Centang, StatusWarna, Tabel, Lampiran
  PapanKartu.tsx, AntreanKartu.tsx, AngkaGrid.tsx, KopHalaman.tsx
  Terlindungi.tsx       'use client'
lib/
  supabase/client.ts    createBrowserClient — untuk Client Component
  supabase/server.ts    createServerClient  — untuk Server Component & Route Handler
  api/                  report.ts, policy.ts, decision.ts, papan.ts, marketing.ts, admin.ts
  auth/AuthProvider.tsx 'use client'
  tanggal.ts, rupiah.ts, gambar.ts
forms/                  types.ts, index.ts, f01…f15
supabase/
  migrations/           0001_init.sql, 0002_rls.sql, 0003_seed.sql, 0004_views.sql
docs/
```

**Dua klien Supabase, jangan tertukar.** `lib/supabase/client.ts` memakai `createBrowserClient` dan hanya dipakai di file ber-`'use client'`. `lib/supabase/server.ts` memakai `createServerClient` dengan `cookies()` dari `next/headers`, dipakai di Server Component dan Route Handler. Memanggil yang salah menghasilkan error yang membingungkan tentang cookie.

---

## §6 · Token desain

Arahnya **cetak biru gambar teknik**: kertas gambar pucat, tinta biru tua, garis grid halus.
Alasannya fungsional, bukan selera — warna 🟢🟡🔴 sudah punya arti tetap di perusahaan ini,
jadi warna dasar antarmuka tidak boleh ikut memakai hijau, kuning, atau merah.

```css
:root{
  --kertas:    #E6E9E3;
  --kertas-2:  #F1F3EE;
  --tinta:     #10202E;
  --biru:      #123A56;
  --biru-2:    #1D5476;
  --biru-3:    #2E6E93;
  --garis:     #9FAEA9;

  --hijau:     #2C7A50;
  --kuning:    #B8801B;
  --merah:     #A62B2B;
  --kosong:    #8A968F;

  --display: "Barlow Condensed", sans-serif;  /* judul, label, tombol — huruf besar */
  --body:    "IBM Plex Sans", system-ui, sans-serif;
  --mono:    "IBM Plex Mono", monospace;      /* angka, rupiah, jam, kode form */
}
```

Aturan pemakaian:
- Semua **angka** memakai `--mono`. Rupiah, jumlah unit, jam, persentase.
- Semua **judul dan label** memakai `--display`, huruf besar, `letter-spacing` renggang.
- Sudut kotak **0px**. Tidak ada `border-radius` di mana pun.
- Bayangan tidak dipakai. Pemisah memakai garis 1,5px `--tinta`.
- Kartu "belum lapor" memakai garis putus-putus `--kosong`, bukan warna merah — belum lapor
  bukan berarti bermasalah.

---

## §7 · Jebakan yang paling sering terjadi

1. **`toISOString()` untuk tanggal.** Meleset satu hari sebelum pukul 07.00 WIB. Selalu lewat `tanggalWIB()`.
2. **View tanpa `security_invoker`.** Membocorkan data Accounting ke Ibu Sabrina. Lihat §3.4.
3. **Kunci JSON tidak sinkron.** Field `key` di schema harus sama persis dengan kunci di view agregasi. Beda satu huruf, hasilnya nol tanpa error apa pun.
4. **Uang sebagai float.** `Rp1.234.567` bisa berubah jadi `1234566.9999`. Selalu `bigint`.
5. **Menghitung ulang agregasi di React.** Dua tempat menghitung hal sama, cepat atau lambat hasilnya beda. Semua agregasi lewat view.
6. **Menyembunyikan tombol tanpa RLS.** Menyembunyikan menu Accounting dari Ibu Sabrina tapi datanya tetap terkirim ke browser bukan pengamanan — hanya penyamaran.
7. **Foto HP 4 MB langsung diunggah.** Di sinyal lapangan bisa gagal terus. Kompres di browser dulu.
8. **Membangun 15 form satu per satu.** Kalau agent mulai menulis komponen React per form, hentikan. Semua lewat `FormRenderer`.

9. **Pola cookie `@supabase/ssr` yang lama akan merusak aplikasi.** Supabase secara khusus memperingatkan model AI soal ini, karena pola lamanya masih banyak beredar di tutorial dan data latih.

   ❌ **Jangan pernah** memakai `get(name)`, `set(name, value)`, `remove(name)`:
   ```ts
   cookies: { get(name) {...}, set(name, value) {...}, remove(name) {...} }  // RUSAK
   ```

   ✅ **Satu-satunya pola yang benar** — `getAll` dan `setAll`:
   ```ts
   // lib/supabase/server.ts
   import { createServerClient } from '@supabase/ssr'
   import { cookies } from 'next/headers'

   export async function createClient() {
     const cookieStore = await cookies()          // WAJIB await — async sejak Next 15
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll() { return cookieStore.getAll() },
           setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options))
             } catch {
               // dipanggil dari Server Component — aman diabaikan
               // selama middleware/proxy menyegarkan sesi
             }
           },
         },
       }
     )
   }
   ```

9b. **`setAll` menerima parameter kedua.** Pada `@supabase/ssr` 0.12.x, tipe `SetAllCookies` memberikan `headers` sebagai argumen kedua: `setAll(cookiesToSet, headers)`. Dipakai di `proxy.ts` agar cookie sesi tidak ikut ter-cache CDN. Banyak panduan meringkasnya jadi satu parameter saja — periksa `node_modules/@supabase/ssr/dist/main/types.d.ts` untuk versi yang benar-benar terpasang.

10. **`cookies()` sekarang asinkron.** Di Next.js 16 wajib `await cookies()`. Kode tanpa `await` akan lolos TypeScript di beberapa kasus lalu gagal saat dijalankan dengan pesan yang tidak menunjuk ke akar masalah.

11. **Penyegar sesi bernama `proxy.ts`, bukan `middleware.ts`.** Dikonfirmasi pada Next.js 16: berkas `proxy.ts` di root, fungsi bernama `proxy`, `export const config = { matcher }`. Pola `middleware.ts` dari Next.js 14 sudah tidak berlaku.

12. **Jangan mematikan aturan ESLint secara global.** Kalau ada satu pola yang memicu peringatan palsu, matikan di baris itu saja atau batasi ke folder terkait lewat `overrides`. Aturan yang dimatikan global akan tetap mati bertahun-tahun dan menyembunyikan bug asli yang berbeda.
