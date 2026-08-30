import { NextResponse } from 'next/server';
import { periksaPeranEkspor, rentangBulan } from '../../../../lib/ekspor/otorisasi';
import { bukaWorkbook, buatSheet, responsXlsx } from '../../../../lib/ekspor/workbook';

/**
 * Rekap Absensi Bulanan (§4 06-RENCANA-PRESENSI-MOBILE.md, prioritas #1
 * user) -- per orang PER TANGGAL (satu baris gabung masuk+pulang, bukan
 * satu baris per tipe -- lebih gampang dibaca HRD/penggajian daripada dua
 * baris terpisah untuk hari yang sama). Peran: sama seperti halaman Tinjau
 * Absensi (ceo/pusat/kadiv+HRD) -- rekap ini isinya SEMUA orang, bukan
 * cuma milik pengunduh sendiri, jadi RLS `absensi_select` saja tidak cukup
 * (karyawan biasa akan dapat file nyaris kosong berisi cuma barisnya
 * sendiri kalau cuma diandalkan RLS) -- makanya penjaga eksplisit di sini.
 */
export async function GET(request: Request) {
  const cek = await periksaPeranEkspor(['ceo', 'pusat'], { bolehKadivHrd: true });
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
    .from('absensi')
    .select('user_id, tanggal, tipe, waktu, terlambat_menit, status, jarak_meter, profile:user_id(nama), lokasi_absen:lokasi_absen_id(nama)')
    .gte('tanggal', rentang.awal)
    .lte('tanggal', rentang.akhir)
    .order('tanggal')
    .order('user_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pivot: satu baris per (user_id, tanggal), gabung tipe masuk+pulang.
  interface BarisPivot {
    nama: string;
    tanggal: string;
    titik: string;
    jamMasuk: Date | null;
    terlambatMenit: number | null;
    statusMasuk: string | null;
    jamPulang: Date | null;
    statusPulang: string | null;
  }
  const pivot = new Map<string, BarisPivot>();
  for (const r of data ?? []) {
    const nama = (r.profile as unknown as { nama: string } | null)?.nama ?? '—';
    const titik = (r.lokasi_absen as unknown as { nama: string } | null)?.nama ?? '—';
    const kunci = `${r.user_id}|${r.tanggal}`;
    const baris = pivot.get(kunci) ?? { nama, tanggal: r.tanggal, titik, jamMasuk: null, terlambatMenit: null, statusMasuk: null, jamPulang: null, statusPulang: null };
    const statusLabel = r.status === 'di_luar_radius' ? 'Di luar radius' : r.status === 'manual_hrd' ? 'Dicatat manual HRD' : 'Dalam radius';
    if (r.tipe === 'masuk') {
      baris.jamMasuk = new Date(r.waktu);
      baris.terlambatMenit = r.terlambat_menit;
      baris.statusMasuk = statusLabel;
    } else {
      baris.jamPulang = new Date(r.waktu);
      baris.statusPulang = statusLabel;
    }
    pivot.set(kunci, baris);
  }

  const workbook = bukaWorkbook();
  const sheet = buatSheet(workbook, `Absensi ${bulan}`, [
    { header: 'Nama', key: 'nama', width: 22 },
    { header: 'Tanggal', key: 'tanggal', width: 13, numFmt: 'dd/mm/yyyy' },
    { header: 'Titik Absen', key: 'titik', width: 20 },
    { header: 'Jam Masuk', key: 'jamMasuk', width: 12, numFmt: 'hh:mm' },
    { header: 'Terlambat (menit)', key: 'terlambatMenit', width: 16, numFmt: '#,##0' },
    { header: 'Status Masuk', key: 'statusMasuk', width: 16 },
    { header: 'Jam Pulang', key: 'jamPulang', width: 12, numFmt: 'hh:mm' },
    { header: 'Status Pulang', key: 'statusPulang', width: 16 },
  ]);

  for (const baris of Array.from(pivot.values()).sort((a, b) => a.nama.localeCompare(b.nama) || a.tanggal.localeCompare(b.tanggal))) {
    sheet.addRow({
      nama: baris.nama,
      tanggal: new Date(`${baris.tanggal}T00:00:00Z`),
      titik: baris.titik,
      jamMasuk: baris.jamMasuk,
      terlambatMenit: baris.terlambatMenit,
      statusMasuk: baris.statusMasuk ?? '—',
      jamPulang: baris.jamPulang,
      statusPulang: baris.statusPulang ?? '—',
    });
  }

  return responsXlsx(workbook, `rekap-absensi-${bulan}.xlsx`);
}
