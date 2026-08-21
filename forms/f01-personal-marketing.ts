import type { FormSchema } from './types';

/**
 * SEBAGIAN, bukan lengkap. `docs/REFERENSI-FORMAT-LAPORAN.md` yang jadi acuan
 * resmi Task 12 tidak ada di repo (dicatat berkali-kali di docs/PROGRESS.md
 * sepanjang proyek). Blok di bawah ini HANYA berisi 6 kewajiban PTE dan
 * closing -- satu-satunya bagian yang presisi terdokumentasi, di
 * 03-CALC-SPEC.md §2 dan skema tabel `closing`. Field lain yang mungkin ada
 * di format asli (kalau ada) BELUM ditambahkan -- jangan dianggap lengkap.
 */
export const f01PersonalMarketing: FormSchema = {
  key: 'personal_marketing',
  nama: 'Laporan Personal Marketing',
  scope: 'user',
  blocks: [
    {
      id: 'pte',
      judul: 'PTE Harian',
      catatan: 'Enam kewajiban harian. Tanpa bukti foto/video, jumlahnya dianggap nol saat dikirim.',
      fields: [
        { key: 'live', label: 'Live', type: 'centang', buktiWajib: true, buktiKunci: 'live' },
        { key: 'undang_jumlah', label: 'Jumlah Undangan', type: 'angka', buktiWajib: true, buktiKunci: 'undang' },
        { key: 'kesaksian_jumlah', label: 'Jumlah Kesaksian', type: 'angka', buktiWajib: true, buktiKunci: 'kesaksian' },
        { key: 'review_jumlah', label: 'Jumlah Review', type: 'angka', buktiWajib: true, buktiKunci: 'review' },
        { key: 'konten_jumlah', label: 'Jumlah Konten', type: 'angka', buktiWajib: true, buktiKunci: 'konten' },
        { key: 'mentahan_jumlah', label: 'Jumlah Mentahan', type: 'angka', buktiWajib: true, buktiKunci: 'mentahan' },
      ],
    },
    {
      id: 'closing',
      judul: 'Closing Hari Ini',
      catatan: 'Tambahkan baris untuk tiap closing (booking/akad/batal) yang terjadi hari ini. Kosongkan kalau tidak ada.',
      fields: [
        {
          key: 'daftar_closing',
          label: 'Daftar Closing',
          type: 'tabel',
          kolom: [
            { key: 'nama_konsumen', label: 'Nama Konsumen', type: 'teks' },
            { key: 'status', label: 'Status (booking / akad / batal)', type: 'teks' },
          ],
        },
      ],
    },
  ],
};
