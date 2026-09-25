/**
 * Tautan dari dashboard laporan ke dashboard pos-fnb (sistem kasir).
 *
 * SUPERSEDED (25 September 2026) -- keputusan 19 September 2026 di bawah
 * ini ("sesi tidak menyambung, buka tab baru, login sendiri") DIGANTI oleh
 * handoff satu pintu masuk: tombol sekarang lewat `/api/pos-handoff`
 * (lib/posHandoff.ts + route-nya), bukan tautan langsung ke pos-fnb.
 * Sesi TETAP tidak disalin/dua sistem TETAP terpisah total -- yang berubah
 * cuma orang tidak perlu login KEDUA KALINYA kalau sudah dipetakan di
 * pos-fnb (lihat report_identity_links, tabel di pos-fnb). Kalau belum
 * dipetakan, pos-fnb sendiri yang menampilkan "akun toko belum disiapkan".
 *
 * Bukan rahasia -- URL server-only (POS_INTEGRASI_URL, dibaca di
 * app/api/pos-handoff/route.ts, BUKAN di sini) karena token ditandatangani
 * server, tapi URL dasarnya sendiri bukan rahasia.
 */

/**
 * SUPERSEDED LAGI (25 September 2026, sama hari) -- daftar email ditulis
 * mati di kode di sini SEMPAT ada, lalu dicabut: itu melanggar aturan
 * proyek "nol business rule hardcode" (tiap orang baru berarti ubah kode +
 * deploy). Diganti kolom `profile.punya_akses_pos` (migrasi 0063), diatur
 * lewat Admin -> tab Penugasan (sama pola `wajib_pte`) -- TIDAK PERLU
 * deploy untuk menambah/mencabut orang.
 *
 * PENTING: kolom ini MURNI menentukan tampil/tidaknya tombol, BUKAN
 * gerbang keamanan. Siapa BENAR-BENAR bisa masuk ke pos-fnb ditentukan
 * SEPENUHNYA di sisi pos-fnb sendiri (`report_identity_links`, dikelola
 * owner pos-fnb lewat /team di sana, repo terpisah). Menyalakan kolom ini
 * untuk seseorang TANPA pemetaan yang cocok di pos-fnb cuma membuat
 * tombolnya tampil lalu berakhir "akun toko belum disiapkan" -- tidak
 * berbahaya, cuma sia-sia. Isi awal (Putri, Ita) lewat migrasi 0063 supaya
 * perilakunya sama seperti daftar hardcode yang barusan dicabut.
 */
export function bolehLihatTautanPos(punyaAksesPos: boolean | null | undefined): boolean {
  return punyaAksesPos === true;
}
