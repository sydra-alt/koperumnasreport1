import { NextResponse } from 'next/server';
import { periksaPeranEkspor, rentangBulan } from '../../../../lib/ekspor/otorisasi';
import { bukaWorkbook, buatSheet, responsXlsx } from '../../../../lib/ekspor/workbook';
import { hitungRingkasanKeuanganCeo, hitungCashflowHariIni } from '../../../../lib/api/accounting';

/**
 * Rekap Keuangan Bulanan (§4, prioritas #4 user) -- "HANYA ceo dan
 * accounting", ditegaskan dua kali di instruksi user. `periksaPeranEkspor`
 * di sini mengembalikan 403 SEBELUM baris `report` mana pun disentuh --
 * bukan cuma menyembunyikan tombol, bukan juga mengandalkan RLS diam-diam
 * mengembalikan 0 baris (itu tetap akan menghasilkan file .xlsx KOSONG yang
 * berhasil diunduh, bukan penolakan tegas). Diuji eksplisit lewat curl
 * sebagai Sabrina (`pusat`, BUKAN ceo/accounting) -- lihat
 * `scripts/uji-ekspor-keuangan-curl.mjs`.
 */
export async function GET(request: Request) {
  const cek = await periksaPeranEkspor(['ceo', 'accounting']);
  if (!cek.ok) return cek.response;

  const bulan = new URL(request.url).searchParams.get('bulan');
  if (!bulan) return NextResponse.json({ error: 'Parameter bulan wajib diisi, mis. ?bulan=2026-08.' }, { status: 400 });

  let rentang: { awal: string; akhir: string };
  try {
    rentang = rentangBulan(bulan);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Bulan tidak valid.' }, { status: 400 });
  }

  const { supabase } = cek;
  const { data, error } = await supabase
    .from('report')
    .select('tanggal, data')
    .eq('form_key', 'accounting')
    .neq('status', 'draft')
    .gte('tanggal', rentang.awal)
    .lte('tanggal', rentang.akhir)
    .order('tanggal');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const workbook = bukaWorkbook();
  const sheet = buatSheet(workbook, `Keuangan ${bulan}`, [
    { header: 'Tanggal', key: 'tanggal', width: 13, numFmt: 'dd/mm/yyyy' },
    { header: 'Uang Masuk', key: 'masuk', width: 16, numFmt: '#,##0' },
    { header: 'Uang Keluar', key: 'keluar', width: 16, numFmt: '#,##0' },
    { header: 'Net Cashflow', key: 'net', width: 16, numFmt: '#,##0' },
    { header: 'Dana Tersedia', key: 'danaTersedia', width: 16, numFmt: '#,##0' },
    { header: 'Piutang', key: 'piutang', width: 16, numFmt: '#,##0' },
    { header: 'Kewajiban 7 Hari', key: 'kewajiban7', width: 16, numFmt: '#,##0' },
    { header: 'Kewajiban 30 Hari', key: 'kewajiban30', width: 16, numFmt: '#,##0' },
    { header: 'Surplus/Kekurangan', key: 'surplus', width: 18, numFmt: '#,##0' },
  ]);

  for (const r of data ?? []) {
    const nilai = (r.data as Record<string, unknown>) ?? {};
    const cashflow = hitungCashflowHariIni(nilai);
    const ringkasan = hitungRingkasanKeuanganCeo(nilai);
    sheet.addRow({
      tanggal: new Date(`${r.tanggal}T00:00:00Z`),
      masuk: cashflow.totalMasuk,
      keluar: cashflow.totalKeluar,
      net: cashflow.net,
      danaTersedia: ringkasan.danaTersedia,
      piutang: ringkasan.piutangTotal,
      kewajiban7: ringkasan.kewajiban7Hari,
      kewajiban30: ringkasan.kewajiban30Hari,
      surplus: ringkasan.surplusKekurangan,
    });
  }

  return responsXlsx(workbook, `rekap-keuangan-${bulan}.xlsx`);
}
