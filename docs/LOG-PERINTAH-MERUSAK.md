# LOG PERINTAH MERUSAK

> Ditulis OTOMATIS oleh `scripts/db.mjs` setiap kali perintah DROP/TRUNCATE/
> DELETE/UPDATE benar-benar DIJALANKAN (bukan dry-run) -- lihat komentar di
> kepala skrip itu untuk aturan lengkapnya. Jangan diedit manual.

- 2026-09-29T06:36:02+07:00 -- sumber: supabase/migrations/0067_akses_ai_per_orang.sql
  - DELETE -- 1 baris akan terhapus: `delete from public.policy where key = 'ai_peran_boleh';`
  - UPDATE -- 3 baris akan berubah: `-- Akun CEO/Direksi (Putri; AKUN UJI - CEO dipakai uji browser) dan Ita. -- Daftar EKSPLISIT per email. update public.profile set punya_akses_ai = true where id in ( select id from auth.users where em`
