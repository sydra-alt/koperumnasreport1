-- ═══════════════════════════════════════════════════════════════════════
-- 0064_auditor_rls.sql
-- Policy RLS tambahan untuk halaman auditor Ita.
--
-- Masalah: halaman auditor lintas-outlet, tapi Ita (role 'karyawan')
-- hanya diizinkan baca laporan yang dia sendiri authored (via
-- can_see_report()). Untuk meninjau laporan kontrol_fnb & kebersihan
-- yang diisi oleh orang lain (mis. Rika), Ita butuh akses tambahan.
--
-- Solusi: tambah role 'auditor' + policy terpisah yang memeriksa
-- assignment 'auditor' per-outlet. Tidak ada pengecualian global.
-- ───────────────────────────────────────────────────────────────────────

-- ─── Function: apakah user bisa mengaudit outlet tertentu untuk form tertentu?
--
-- Dipakai oleh policy report_select_auditor di bawah. Tidak dipakai
-- dimana pun lain — function ini mah khusus untuk policy ini.
-- ───────────────────────────────────────────────────────────────────────

create or replace function public.bisa_audit_outlet(p_form_key text, p_outlet_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.has_role('auditor')
    and (
      -- Untuk form per-outlet (kontrol_fnb, kebersihan): cek assignment
      -- ke outlet tersebut dengan form_key 'auditor'.
      (p_form_key in ('kontrol_fnb', 'kebersihan')
       and exists (
         select 1 from public.assignment
         where user_id = auth.uid()
           and form_key = 'auditor'
           and outlet_id = p_outlet_id
       ))
      -- Untuk form global (thrifting): cukup punya role auditor.
      -- Thrifting tidak terikat ke outlet tertentu, jadi tidak perlu
      -- cek assignment per-outlet.
      or (p_form_key = 'thrifting' and public.has_role('auditor'))
    )
$$;

-- ─── Policy report_select_auditor ──────────────────────────────────────
--
-- Policy ini BERTAMBAHAN terhadap policy report_select yang sudah ada.
-- Postgres memperbolehkanmultiple policy pada tabel yang sama; saat
-- SELECT, baris diizinkan jika SATU policy terpenuhi (OR).
--
-- Jadi:
--   - Policy lama report_select: user bisa baca jika can_see_report() TRUE
--     (author sendiri, CEO, accounting, dll.)
--   - Policy baru ini: user bisa baca jika role 'auditor' DAN punya
--     assignment 'auditor' untuk outlet tersebut DAN form_key adalah
--     'kontrol_fnb' atau 'kebersihan' (atau 'thrifting' untuk global).
--
-- Akibatnya:
--   - Ita tetap bisa baca laporan yang dia sendiri authored (via policy lama).
--   - Ita bisa baca laporan kontrol_fnb & kebersihan untuk outlet yang
--     dia audit, meskipun authored oleh orang lain (via policy baru).
--   - User lain yang bukan auditor tetap hanya bisa baca sesuai policy lama.
--   - Tidak ada pengecualian yang melewati RLS.
-- ───────────────────────────────────────────────────────────────────────

create policy report_select_auditor on public.report for select
  using (
    public.bisa_audit_outlet(form_key, outlet_id)
  );

-- ─── Policy attachment_select_auditor ──────────────────────────────────
--
-- Attachment diizinkan dibaca jika report induknya bisa dilihat.
-- Policy bukti_read yang ada sudah memanggil can_see_report(), yang
-- kita modifikasi nanti (lihat catatan di bawah). Tapi karena kita
-- tambahkan policy report_select_auditor terpisah, attachment juga
-- perlu policy terpisang untuk kasus auditor.
--
-- Catatan: attachment_select sudah ada (att_select) yang memanggil
-- can_see_report(r.form_key, r.author_id). Karena can_see_report()
-- tidak mengetahui apakah user adalah auditor untuk outlet tertentu,
-- kita perlu policy terpisang yang memakai bisa_audit_outlet().
-- ───────────────────────────────────────────────────────────────────────

create policy attachment_select_auditor on public.attachment for select
  using (
    exists (
      select 1 from public.report r
      where r.id = attachment.report_id
        and public.bisa_audit_outlet(r.form_key, r.outlet_id)
    )
  );

-- ─── Catatan penting: can_see_report() ────────────────────────────────
--
-- Function can_see_report() TIDAK diubah dalam migration ini.
-- Alasannya:
--   1. can_see_report() adalah function inti yang menentukan visibilitas
--      laporan di SELURUH sistem. Mengubahnya berisiko mempengaruhi
--      halaman lain yang tidak terkait dengan auditor.
--   2. Policy terpisang (report_select_auditor) sudah memberikan akses
--      tambahan yang cukup untuk halaman auditor, tanpa mengubah function
--      inti.
--
-- Jika suatu saat diinginkan untuk menyatukan logic, dapat mempertimbangkan
-- untuk memodifikasi can_see_report() dan menghapus policy terpisang.
-- Tapi untuk sekarang, pendekatan policy terpisang lebih aman.
-- ───────────────────────────────────────────────────────────────────────

-- ─── Index tambahan untuk performa query audit ────────────────────────

-- Index untuk query assignment auditor per outlet
create index if not exists assignment_auditor_outlet_idx
  on public.assignment (user_id, form_key, outlet_id)
  where form_key = 'auditor';

-- Index untuk query report per outlet + form_key + tanggal
create index if not exists report_audit_fetch_idx
  on public.report (outlet_id, form_key, tanggal)
  where form_key in ('kontrol_fnb', 'kebersihan');
