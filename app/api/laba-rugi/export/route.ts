import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tanggalWIB } from '@/lib/tanggal';
import { bulanValid, namaBulan } from '@/lib/asetPersediaan';
import { bukaWorkbook, buatSheet, responsXlsx } from '@/lib/ekspor/workbook';
import { LabaRugiKonsolidasi } from '@/lib/labaRugi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bulan = url.searchParams.get('bulan') ?? '';
  if (!bulanValid(bulan, tanggalWIB())) {
    return NextResponse.json({ ok: false, error: 'Bulan tidak valid.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const { data: boleh } = await supabase.rpc('boleh_lihat_laba_rugi');
  if (!boleh) {
    return NextResponse.json({ ok: false, error: 'Tidak berhak mengekspor Laba Rugi.' }, { status: 403 });
  }

  // Ambil data P&L internal lewat fetch API lokal
  const internalRes = await fetch(`${url.origin}/api/laba-rugi?bulan=${bulan}`, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });

  if (!internalRes.ok) {
    return NextResponse.json({ ok: false, error: 'Gagal memuat data Laba Rugi.' }, { status: 500 });
  }

  const json = await internalRes.json();
  const pnl: LabaRugiKonsolidasi = json.data;
  if (!pnl) {
    return NextResponse.json({ ok: false, error: 'Data kosong.' }, { status: 404 });
  }

  const wb = bukaWorkbook();
  wb.creator = 'Sistem Laporan Koperumnas Group';
  wb.created = new Date();

  const kolomPnl = [
    { header: 'Pos Laporan', key: 'pos', width: 36 },
    { header: 'Makanan', key: 'makanan', width: 20, numFmt: '#,##0' },
    { header: 'Minuman', key: 'minuman', width: 20, numFmt: '#,##0' },
    { header: 'Thrift', key: 'thrift', width: 20, numFmt: '#,##0' },
    { header: 'Total (Rp)', key: 'total', width: 24, numFmt: '#,##0' },
  ];

  // 1. Sheet Konsolidasi
  const sheetK = buatSheet(wb, 'Konsolidasi', kolomPnl);
  const k = pnl.konsolidasi;

  sheetK.addRow({
    pos: '1. Omzet Penjualan Kotor',
    makanan: k.makanan.omzet,
    minuman: k.minuman.omzet,
    thrift: k.thrift.omzet,
    total: k.totalPenjualan.omzet,
  });
  sheetK.addRow({
    pos: '2. Diskon / Potongan',
    makanan: k.makanan.diskon,
    minuman: k.minuman.diskon,
    thrift: k.thrift.diskon,
    total: k.totalPenjualan.diskon,
  });
  sheetK.addRow({
    pos: '3. Penjualan Bersih (Net Sales)',
    makanan: k.makanan.penjualanBersih,
    minuman: k.minuman.penjualanBersih,
    thrift: k.thrift.penjualanBersih,
    total: k.totalPenjualan.penjualanBersih,
  });
  sheetK.addRow({
    pos: '4. HPP / Modal Resep (COGS)',
    makanan: k.makanan.hpp,
    minuman: k.minuman.hpp,
    thrift: k.thrift.hpp,
    total: k.totalPenjualan.hpp,
  });
  sheetK.addRow({
    pos: '5. Laba Kotor',
    makanan: k.makanan.labaKotor,
    minuman: k.minuman.labaKotor,
    thrift: k.thrift.labaKotor,
    total: k.totalPenjualan.labaKotor,
  });

  sheetK.addRow({});
  sheetK.addRow({ pos: '6. Biaya Operasional Bulanan:' });
  for (const b of k.biayaOperasional) {
    sheetK.addRow({ pos: `   - ${b.kategoriNama}`, total: b.jumlah });
  }
  sheetK.addRow({ pos: 'Total Biaya Operasional', total: k.totalBiayaOperasional });

  sheetK.addRow({});
  sheetK.addRow({ pos: '7. Laba / Rugi Bersih', total: k.labaRugiBersih });

  // 2. Sheet per outlet
  for (const ot of pnl.outlets) {
    const sheetO = buatSheet(wb, ot.outletNama, kolomPnl);
    sheetO.addRow({
      pos: '1. Omzet Penjualan Kotor',
      makanan: ot.makanan.omzet,
      minuman: ot.minuman.omzet,
      thrift: ot.thrift.omzet,
      total: ot.totalPenjualan.omzet,
    });
    sheetO.addRow({
      pos: '2. Diskon / Potongan',
      makanan: ot.makanan.diskon,
      minuman: ot.minuman.diskon,
      thrift: ot.thrift.diskon,
      total: ot.totalPenjualan.diskon,
    });
    sheetO.addRow({
      pos: '3. Penjualan Bersih (Net Sales)',
      makanan: ot.makanan.penjualanBersih,
      minuman: ot.minuman.penjualanBersih,
      thrift: ot.thrift.penjualanBersih,
      total: ot.totalPenjualan.penjualanBersih,
    });
    sheetO.addRow({
      pos: '4. HPP / Modal Resep (COGS)',
      makanan: ot.makanan.hpp,
      minuman: ot.minuman.hpp,
      thrift: ot.thrift.hpp,
      total: ot.totalPenjualan.hpp,
    });
    sheetO.addRow({
      pos: '5. Laba Kotor',
      makanan: ot.makanan.labaKotor,
      minuman: ot.minuman.labaKotor,
      thrift: ot.thrift.labaKotor,
      total: ot.totalPenjualan.labaKotor,
    });

    sheetO.addRow({});
    sheetO.addRow({ pos: '6. Biaya Operasional Bulanan:' });
    for (const b of ot.biayaOperasional) {
      sheetO.addRow({
        pos: `   - ${b.kategoriNama} ${b.catatan ? `(${b.catatan})` : ''}`,
        total: b.jumlah,
      });
    }
    sheetO.addRow({ pos: 'Total Biaya Operasional', total: ot.totalBiayaOperasional });

    sheetO.addRow({});
    sheetO.addRow({ pos: '7. Laba / Rugi Bersih', total: ot.labaRugiBersih });

    sheetO.addRow({});
    sheetO.addRow({
      pos: `Status Laporan: ${ot.status.toUpperCase()} | Sumber: ${ot.sumber.toUpperCase()}`,
    });
    if (ot.catatanIta) sheetO.addRow({ pos: `Catatan Ita: ${ot.catatanIta}` });
    if (ot.catatanAkunting) sheetO.addRow({ pos: `Catatan Akunting: ${ot.catatanAkunting}` });
    if (ot.catatanKualitasData) sheetO.addRow({ pos: `Catatan Kualitas Data: ${ot.catatanKualitasData}` });
  }

  const namaFile = `Laba-Rugi-${namaBulan(bulan).replace(/\s+/g, '-')}.xlsx`;
  return responsXlsx(wb, namaFile);
}
