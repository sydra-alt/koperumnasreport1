# LOG PERINTAH MERUSAK

> Ditulis OTOMATIS oleh `scripts/db.mjs` setiap kali perintah DROP/TRUNCATE/
> DELETE/UPDATE benar-benar DIJALANKAN (bukan dry-run) -- lihat komentar di
> kepala skrip itu untuk aturan lengkapnya. Jangan diedit manual.

- 2026-09-29T06:36:02+07:00 -- sumber: supabase/migrations/0067_akses_ai_per_orang.sql
  - DELETE -- 1 baris akan terhapus: `delete from public.policy where key = 'ai_peran_boleh';`
  - UPDATE -- 3 baris akan berubah: `-- Akun CEO/Direksi (Putri; AKUN UJI - CEO dipakai uji browser) dan Ita. -- Daftar EKSPLISIT per email. update public.profile set punya_akses_ai = true where id in ( select id from auth.users where em`
- 2026-09-29T07:56:16+07:00 -- sumber: supabase/migrations/0068_akses_pos_dari_laporan.sql
  - UPDATE -- 1 baris akan berubah: `update public.outlet_pos_map set form_akses = 'thrifting' where pos_outlet_id = '01a08e38-0737-7e92-8fb1-1bf597e0c6a7' and diabaikan;`
  - UPDATE -- 6 baris akan berubah: `-- ─── 5. Tanda awal (disetujui CEO) ────────────────────────────────────── -- Empat manajer resto + Mba Rika; AKUN UJI - CEO untuk uji produksi. update public.profile set punya_akses_pos = true where`
  - UPDATE -- 1 baris akan berubah: `-- Ita saja: semua outlet POS + audit_all_outlets. update public.profile set akses_semua_outlet_pos = true where id in (select id from auth.users where email = 'ita@koperumnas.local');`
- 2026-09-29T09:03:18+07:00 -- sumber: (perintah langsung)
  - UPDATE -- 1 baris akan berubah: `update public.profile set punya_akses_pos = false where id = (select id from auth.users where email = 'uji-ceo@koperumnas.local')`
