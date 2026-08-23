export type FieldType =
  | 'angka' | 'uang' | 'teks' | 'teks_panjang' | 'pilih'
  | 'ya_tidak' | 'centang' | 'status_warna' | 'tabel' | 'lampiran';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  wajib?: boolean;
  wajibYa?: boolean;              // khusus 'ya_tidak': harus PERSIS "ya", bukan cuma "sudah dijawab"
                                  // -- dipakai untuk pernyataan/persetujuan wajib dicentang.
  wajibJika?: { field: string; nilai: unknown }; // wajib diisi KALAU field lain (disebut lewat
                                  // key-nya) bernilai persis `nilai` -- dipakai utk "kalau ada
                                  // selisih, penyebab wajib" (Task 16). Field lain itu boleh di
                                  // blok mana pun di form yang sama, dicek dari data lengkap saat
                                  // submit, bukan cuma dalam satu blok.
  buktiWajib?: boolean;          // centang tanpa lampiran → ditolak
  buktiKunci?: string;           // field_key di tabel attachment untuk bukti field ini;
                                  // default ke `key`. Perlu beda kalau nama field data
                                  // (mis. undang_jumlah) beda dari nama tag bukti (undang)
                                  // -- lihat 03-CALC-SPEC.md §2, dua namespace berbeda.
  pilihan?: string[];            // untuk 'pilih'
  kolom?: { key: string; label: string; type: FieldType; pilihan?: string[] }[]; // untuk 'tabel'
  sumberKeputusan?: boolean;     // khusus type:'tabel' -- tiap BARIS jadi satu baris `decision`
                                  // terpisah saat kirim (bukan satu keputusan per laporan seperti
                                  // blokKeputusanCeo). Kolom tabelnya WAJIB pakai kunci persis:
                                  // `judul`, `nominal`, `deadline`, `dampak`. urgensi = urutan
                                  // baris (baris 1 -> urgensi 1, dst., maksimal 3 -- dibatasi
                                  // constraint `decision.urgensi between 1 and 3`). Dipakai
                                  // form accounting §16 "Prioritas Pembayaran".
  bantuan?: string;
  min?: number; max?: number;
}

export interface Block {
  id: string;
  judul: string;
  catatan?: string;
  fields: Field[];
  hanyaHari?: number[]; // blok cuma tampil & tervalidasi kalau hari ISO (1=Senin..7=Minggu, lib/tanggal.ts)
                        // ada di daftar ini -- dipakai utk "Stock Opname" ita yang cuma muncul Senin.
}

export interface FormSchema {
  key: string;
  nama: string;
  navLabel?: string;             // label pendek utk tab navigasi (KopHalaman); default ke `nama` kalau tidak diisi
  scope: 'global' | 'lokasi' | 'outlet' | 'user';
  rahasia?: boolean;             // true hanya untuk 'accounting'
  blocks: Block[];
}
