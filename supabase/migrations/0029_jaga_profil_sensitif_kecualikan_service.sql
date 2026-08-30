-- Ditemukan sendiri DALAM HITUNGAN DETIK setelah 0028 diterapkan, sebelum
-- sempat di-commit: `jaga_profil_sensitif()` memblokir juga koneksi
-- pemilik/service-role (scripts/buat-akun.mjs, scripts/db.mjs, migrasi lain)
-- -- pada koneksi itu `auth.uid()` bernilai NULL (tidak ada
-- `request.jwt.claims` sama sekali), jadi `has_role('ceo')` selalu false,
-- dan trigger 0028 akan menolak UPSERT profile.divisi yang justru diperlukan
-- scripts/buat-akun.mjs setiap kali dijalankan ulang (idempoten, ON CONFLICT
-- DO UPDATE menyentuh kolom divisi). Dibuktikan langsung: `select auth.uid()`
-- di koneksi `scripts/db.mjs` mengembalikan `null`.
--
-- Perbaikan: guard HANYA berlaku kalau ada sesi pengguna sungguhan
-- (`auth.uid() is not null`) -- idiom yang SUDAH dipakai berulang di seluruh
-- RLS codebase ini (`profile_select`, `role_select`, dst., 0002_rls.sql) utk
-- membedakan "sesi browser lewat PostgREST" dari "koneksi langsung/service
-- role". Koneksi tanpa sesi (migrasi, skrip admin, service role) TETAP
-- dipercaya penuh -- sama seperti RLS itu sendiri sudah dilewati untuk
-- koneksi itu; trigger ini menutup celah UNTUK PENGGUNA BIASA, bukan
-- menambah lapisan baru di atas jalur admin yang sudah dipercaya.
create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('ceo') then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO yang boleh mengubah divisi atau status aktif.';
    end if;
  end if;
  return new;
end $$;
