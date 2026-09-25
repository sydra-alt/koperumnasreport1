-- Tombol handoff pos-fnb (lib/posLink.ts) TIDAK BOLEH pakai daftar email
-- ditulis mati di kode -- itu melanggar aturan proyek "nol business rule
-- hardcode" (tiap orang baru berarti ubah kode + deploy). Diganti kolom
-- boolean di profile, diatur lewat Admin (tab Penugasan), sama pola
-- wajib_pte (migrasi 0035).
--
-- PENTING, batas kolom ini (dicatat juga sebagai komentar kolom di bawah):
-- `punya_akses_pos` MURNI menentukan TAMPIL/TIDAKNYA tombol di dashboard
-- ini. BUKAN gerbang keamanan -- otorisasi SUNGGUHAN siapa benar-benar bisa
-- masuk ke pos-fnb ada SEPENUHNYA di tabel `report_identity_links` milik
-- pos-fnb sendiri (repo terpisah, dikelola owner pos-fnb lewat /team di
-- sana). Menyalakan kolom ini tanpa pemetaan yang cocok di pos-fnb cuma
-- membuat tombol tampil lalu berakhir "akun toko belum disiapkan" --
-- tidak berbahaya, cuma sia-sia. Sebaliknya kolom ini FALSE tidak mencegah
-- siapa pun yang punya pemetaan pos-fnb masuk lewat jalur lain (mis. login
-- langsung di pos-fnb) -- kolom ini tidak pernah dibaca pos-fnb sama sekali.
alter table public.profile
  add column punya_akses_pos boolean not null default false;

comment on column public.profile.punya_akses_pos is
  'Murni tampil/tidaknya tombol handoff pos-fnb di dashboard ini -- BUKAN otorisasi. Otorisasi sungguhan ada di report_identity_links milik pos-fnb (repo terpisah).';

-- Guard sama pola wajib_pte (0035) lalu is_admin() (0039) -- kolom sensitif
-- baru ikut ditambahkan ke daftar yang HANYA boleh diubah CEO/Admin, bukan
-- pemiliknya sendiri lewat profile_update (RLS: id = auth.uid() or is_admin()).
create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO/Admin yang boleh mengubah divisi atau status aktif.';
    end if;
    if old.harus_ganti_password = true and new.harus_ganti_password = false then
      raise exception 'harus_ganti_password hanya bisa dimatikan lewat proses ganti password resmi.';
    end if;
    if new.wajib_pte is distinct from old.wajib_pte or new.alasan_bebas_pte is distinct from old.alasan_bebas_pte then
      raise exception 'Hanya CEO/Admin yang boleh mengubah status wajib PTE.';
    end if;
    if new.punya_akses_pos is distinct from old.punya_akses_pos then
      raise exception 'Hanya CEO/Admin yang boleh mengubah akses tombol POS.';
    end if;
  end if;
  return new;
end $$;

-- Isi TRUE untuk Putri dan Ita -- supaya perilaku SAMA seperti daftar email
-- hardcode yang barusan dihapus dari lib/posLink.ts (tidak ada perubahan
-- perilaku yang terlihat user dari migrasi ini sendiri).
update public.profile set punya_akses_pos = true
where id in (
  select id from auth.users where email in ('putri@koperumnas.local', 'ita@koperumnas.local')
);
