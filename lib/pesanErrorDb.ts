/**
 * Terjemahan galat database → kalimat yang bisa dimengerti orang biasa.
 * Dipakai SELURUH tab Admin (30 Agustus 2026, instruksi eksplisit user
 * setelah "tambah outlet gagal, tidak ada pesan yang berguna") -- akar
 * masalahnya DUA hal sekaligus: (1) `outlet.slug` NOT NULL tidak pernah
 * diisi form-nya (lihat lib/api/admin.ts useTambahOutlet, sekarang
 * diperbaiki), (2) galat yang BERHASIL ditangkap sering tidak ditampilkan
 * sama sekali di UI, dan yang ditampilkan pun masih pesan Postgres mentah
 * (mis. "null value in column ... violates not-null constraint").
 *
 * Postgres error `code` (bukan `message`, yang bisa berubah bentuk/bahasa)
 * dipakai sebagai kunci utama -- lihat https://www.postgresql.org/docs/current/errcodes-appendix.html.
 * Route Handler (buat pengguna, atur ulang kata sandi) sudah melempar Error
 * dengan pesan Indonesia sendiri yang layak tampil apa adanya -- fungsi ini
 * HANYA menerjemahkan galat mentah dari Postgres/PostgREST, tidak menimpa
 * pesan yang sudah manusiawi.
 */

interface GalatMirip {
  code?: string;
  message?: string;
}

const PETA_KODE: Record<string, string> = {
  '23502': 'Ada bagian yang belum terisi. Lengkapi dulu, lalu coba lagi.',
  '23505': 'Nama ini sudah dipakai. Pilih nama lain.',
  '23503': 'Data yang dipilih sudah dihapus atau tidak berlaku lagi. Muat ulang halaman, lalu coba lagi.',
  '23514': 'Nilai yang dipilih tidak berlaku.',
  '42501': 'Kamu tidak punya izin untuk melakukan ini.',
  PGRST301: 'Sesi kamu berakhir. Masuk ulang, lalu coba lagi.',
};

function sudahManusiawi(pesan: string): boolean {
  // Route Handler (app/api/admin/user/*) sudah melempar Error Indonesia
  // sendiri -- kalimat ini SEMUANYA sudah pernah ditulis di sana, jangan
  // ditimpa. Galat Postgres mentah selalu berupa istilah teknis Inggris
  // (constraint/relation/column/dst.) -- itu yang justru harus diterjemahkan.
  const penandaMentah = /constraint|relation|column|duplicate key|row-level security|violates|syntax error|permission denied for/i;
  return !penandaMentah.test(pesan);
}

export function pesanKesalahanDb(err: unknown, konteks = 'menyimpan perubahan'): string {
  if (!err) return `Gagal ${konteks}. Coba lagi.`;

  const g = err as GalatMirip;
  if (g.code && PETA_KODE[g.code]) return PETA_KODE[g.code];

  if (typeof g.message === 'string' && g.message.trim()) {
    if (sudahManusiawi(g.message)) return g.message;
  }

  if (err instanceof TypeError) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.';
  }

  return `Gagal ${konteks}. Coba lagi -- kalau terus terjadi, hubungi IT.`;
}
