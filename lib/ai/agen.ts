import type { BagianGemini, DeklarasiFungsi, IsiGemini, PanggilModel } from './gemini';
import type { TabelAi } from './tabel';

/**
 * Loop agen asisten AI (28 September 2026). Murni -- model dan pelaksana alat
 * disuntikkan, jadi bisa diuji tanpa jaringan (scripts/uji-agen-ai.mts).
 *
 * Batas: paling banyak MAKS_PUTARAN_ALAT putaran alat per pertanyaan. Kalau
 * model masih minta alat sesudahnya, jawabannya "tidak bisa menjawab" --
 * BUKAN jawaban parsial yang terlihat lengkap, dan tabel setengah jalan
 * tidak ikut ditampilkan.
 */

export const MAKS_PUTARAN_ALAT = 4;

export const JAWABAN_MELEBIHI_PUTARAN =
  'Pertanyaan ini butuh lebih dari 4 langkah pengambilan data, jadi saya tidak bisa menjawabnya dengan lengkap. Coba persempit pertanyaannya (satu periode, satu outlet, atau satu jenis data).';
export const JAWABAN_KOSONG = 'Maaf, saya tidak bisa menjawab pertanyaan itu dengan alat yang tersedia.';

export type PanggilanModel = { name: string; args: Record<string, unknown> };

export type HasilPutaran = { untukModel: Record<string, unknown>; tabel: TabelAi[] };

export type HasilAgen = {
  jawaban: string;
  tabel: TabelAi[];
  status: 'selesai' | 'melebihi_putaran' | 'kosong';
  putaranAlat: number;
};

export function instruksiSistem(tanggalHariIni: string): string {
  return [
    'Kamu asisten analisis data operasional Koperumnas Group (laporan harian, absensi, dan data POS restoran).',
    `Hari ini ${tanggalHariIni} (zona Asia/Jakarta). Tafsirkan "kemarin", "minggu ini", dst. dari tanggal ini.`,
    '',
    'Aturan, wajib diikuti:',
    '- Jawab singkat. Angka lebih dulu. Tanpa pembukaan, tanpa mengulang pertanyaan, tanpa basa-basi.',
    '- KALAU HASIL ALAT PUNYA BARIS (tabel ditampilkan otomatis di bawah jawaban): jawaban HANYA SATU KALIMAT -- angka utama dari `ringkasan`, periode, dan cakupan (outlet/orang). Contoh: "18 dari 31 orang belum mengirim laporan untuk 28-29 Sep 2026." JANGAN menyebut nama atau baris satu per satu; tabel adalah rinciannya.',
    '- Periode relatif ("hari ini", "kemarin", "minggu ini", "minggu lalu", "bulan ini", "bulan lalu"): isi argumen `periode`, JANGAN menghitung start_date/end_date sendiri. Sebut periode persis seperti yang dikembalikan alat.',
    '- Setiap angka di jawaban HARUS berasal dari hasil alat. Jangan pernah memperkirakan, menebak, atau mengisi dari ingatan.',
    '- Jangan menghitung total atau rata-rata sendiri. Kalau alat tidak memberi angka itu, katakan alatnya tidak menyediakannya.',
    '- Kalau status tidak_ada_data, katakan tidak ada data untuk periode/outlet itu. Jangan diperhalus jadi tebakan.',
    '- BATAS HAK BUKAN DATA KOSONG. Jangan pernah menyebut nol, kosong, atau "tidak ada data" untuk status berikut:',
    '  - tidak_berhak: katakan angka itu tidak tersedia untuk peranmu.',
    '  - kosong_dalam_hak: katakan tidak ada data di dalam hak aksesmu, dan data di luar hakmu tidak ikut dihitung.',
    '  - outlet_di_luar_hak: katakan outlet itu tidak termasuk outlet yang boleh kamu lihat.',
    '  - tanpa_akses_pos: katakan kamu tidak punya akses data POS.',
    '- Kalau hasil alat membawa batas_hak, sebutkan batas itu di jawaban (mis. "hanya outlet yang boleh kamu lihat").',
    '- Selalu sebut periode dan outlet yang dicakup jawaban (sebut persis seperti di hasil alat).',
    '- Kalau pertanyaan butuh data yang tidak disediakan alat mana pun, katakan terus terang tidak bisa dijawab dengan alat yang tersedia.',
    '- Tanpa poin/daftar kecuali membandingkan beberapa hal DAN tidak ada tabel.',
    '- Bahasa Indonesia, kecuali penanya memakai bahasa lain.',
  ].join('\n');
}

/**
 * Kalau tabel tampil, prosa cuma SATU kalimat (koreksi CEO 29 September 2026:
 * daftar 18 nama lalu tabel 31 baris = mengatakan hal yang sama dua kali).
 * Instruksi sistem sudah memintanya; ini jaring kedua kalau model tetap
 * menulis daftar -- ambil baris pertama yang berisi, buang penanda poin/tebal.
 */
export function satuKalimat(teks: string): string {
  const baris = teks
    .split('\n')
    .map((b) => b.replace(/^\s*([*\-\u2022]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim())
    .filter((b) => b.length > 0);
  return baris[0] ?? teks.trim();
}

function panggilanDari(isi: IsiGemini): PanggilanModel[] {
  return isi.parts
    .filter((b): b is Extract<BagianGemini, { functionCall: unknown }> => 'functionCall' in b)
    .map((b) => ({ name: String(b.functionCall.name ?? ''), args: (b.functionCall.args ?? {}) as Record<string, unknown> }));
}

function teksDari(isi: IsiGemini): string {
  return isi.parts
    .filter((b): b is Extract<BagianGemini, { text: string }> => 'text' in b && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function jalankanAgen(params: {
  panggilModel: PanggilModel;
  instruksi: string;
  fungsi: DeklarasiFungsi[];
  riwayat: IsiGemini[];
  pertanyaan: string;
  jalankanPutaran: (panggilan: PanggilanModel[]) => Promise<HasilPutaran[]>;
}): Promise<HasilAgen> {
  const isi: IsiGemini[] = [...params.riwayat, { role: 'user', parts: [{ text: params.pertanyaan }] }];
  const tabel: TabelAi[] = [];

  for (let putaran = 0; ; putaran++) {
    const jawabanModel = await params.panggilModel({ instruksiSistem: params.instruksi, isi, fungsi: params.fungsi });
    const panggilan = panggilanDari(jawabanModel);

    if (panggilan.length === 0) {
      const teks = teksDari(jawabanModel);
      if (!teks) return { jawaban: JAWABAN_KOSONG, tabel: [], status: 'kosong', putaranAlat: putaran };
      return { jawaban: tabel.length > 0 ? satuKalimat(teks) : teks, tabel, status: 'selesai', putaranAlat: putaran };
    }
    if (putaran >= MAKS_PUTARAN_ALAT) {
      return { jawaban: JAWABAN_MELEBIHI_PUTARAN, tabel: [], status: 'melebihi_putaran', putaranAlat: putaran };
    }

    const hasil = await params.jalankanPutaran(panggilan);
    for (const h of hasil) tabel.push(...h.tabel);

    // Bagian model dikirim balik apa adanya (termasuk thoughtSignature kalau ada).
    isi.push(jawabanModel);
    isi.push({
      role: 'user',
      parts: panggilan.map((p, i) => ({ functionResponse: { name: p.name, response: hasil[i]?.untukModel ?? { status: 'galat' } } })),
    });
  }
}
