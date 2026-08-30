import ExcelJS from 'exceljs';

export interface KolomEkspor {
  header: string;
  key: string;
  width?: number;
  /** Format sel Excel (bukan format teks JS) -- '#,##0' rupiah/angka gaya Indonesia, 'dd/mm/yyyy' tanggal, sesuai instruksi. */
  numFmt?: string;
}

/**
 * Satu sheet siap pakai -- header tebal, baris judul DIBEKUKAN (`views`),
 * lebar kolom & format angka/tanggal per instruksi §4 dokumen ("Format
 * angka #,##0 gaya Indonesia, tanggal dd/mm/yyyy, baris judul dibekukan").
 * Dipakai ke-4 Route Handler ekspor supaya aturannya SATU tempat, bukan
 * diulang.
 */
/** Excel melarang \ / ? * [ ] : di nama sheet (dan maksimal 31 karakter) -- mis. "Laporan Harian DTI / Precast / Perikas" akan gagal apa adanya. */
function namaSheetAman(nama: string): string {
  return nama.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

export function buatSheet(workbook: ExcelJS.Workbook, namaSheet: string, kolom: KolomEkspor[]) {
  const sheet = workbook.addWorksheet(namaSheetAman(namaSheet), { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = kolom.map((k) => ({ header: k.header, key: k.key, width: k.width ?? 16 }));
  sheet.getRow(1).font = { bold: true };
  for (const k of kolom) {
    if (k.numFmt) sheet.getColumn(k.key).numFmt = k.numFmt;
  }
  return sheet;
}

export function bukaWorkbook() {
  return new ExcelJS.Workbook();
}

export async function responsXlsx(workbook: ExcelJS.Workbook, namaFile: string): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${namaFile}"`,
    },
  });
}
