/**
 * Password AWAL seragam untuk akun karyawan baru -- SATU-SATUNYA tempat nilai
 * ini didefinisikan (3 Oktober 2026).
 *
 * Keputusan CEO (30 Agustus 2026, ditegaskan 3 Oktober 2026): selama
 * PENGEMBANGAN, setiap akun baru dibuat dengan password ini dan
 * `profile.harus_ganti_password = true`; `proxy.ts` memaksa ganti password
 * sebelum halaman apa pun terbuka, dan password baru tidak boleh sama dengan
 * nilai ini.
 *
 * ⚠️ BUKAN untuk produksi sungguhan: nilai ini ada di riwayat git. Lihat
 * "Go-live checklist" di CLAUDE.md -- sebelum karyawan sungguhan memakai
 * sistem, ganti dengan password sekali-pakai acak per akun dan reset setiap
 * akun yang masih `harus_ganti_password`.
 *
 * Akun UJI tidak pernah memakai nilai ini (password-nya di berkas kredensial
 * uji di luar repo, scripts/_kredensial-uji.mjs).
 */
export const PASSWORD_AWAL = 'admin123';
