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
  buktiWajib?: boolean;          // centang tanpa lampiran → ditolak
  buktiKunci?: string;           // field_key di tabel attachment untuk bukti field ini;
                                  // default ke `key`. Perlu beda kalau nama field data
                                  // (mis. undang_jumlah) beda dari nama tag bukti (undang)
                                  // -- lihat 03-CALC-SPEC.md §2, dua namespace berbeda.
  pilihan?: string[];            // untuk 'pilih'
  kolom?: { key: string; label: string; type: FieldType }[]; // untuk 'tabel'
  bantuan?: string;
  min?: number; max?: number;
}

export interface Block { id: string; judul: string; catatan?: string; fields: Field[]; }

export interface FormSchema {
  key: string;
  nama: string;
  scope: 'global' | 'lokasi' | 'outlet' | 'user';
  rahasia?: boolean;             // true hanya untuk 'accounting'
  blocks: Block[];
}
