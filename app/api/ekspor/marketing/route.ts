import { NextResponse } from 'next/server';
import { periksaPeranEkspor } from '../../../../lib/ekspor/otorisasi';
import { bukaWorkbook, buatSheet, responsXlsx } from '../../../../lib/ekspor/workbook';
import { hitungKelayakanBonus, hitungPotongan } from '../../../../lib/api/pte';
import type { PolicyMap } from '../../../../lib/api/policy';

/**
 * Kepatuhan Marketing Bulanan (§4, prioritas #2 user) -- undangan, closing,
 * hari bolong, status bonus, status potongan, satu baris per orang. Angka
 * dari `marketing_bulanan_untuk()` (migrasi 0023 -- lihat komentar di sana
 * KENAPA fungsi baru dibutuhkan, bukan pakai `v_marketing_bulanan` yang
 * sudah ada langsung: view lama itu cuma pernah menghitung bulan BERJALAN).
 * Status bonus/potongan dihitung lewat `hitungKelayakanBonus`/
 * `hitungPotongan` (lib/api/pte.ts) -- fungsi SAMA yang dipakai layar
 * (LaporForm.tsx pratinjau PTE), tidak ada rumus baru ditulis di sini
 * (CLAUDE.md #4/#7).
 */
export async function GET(request: Request) {
  const cek = await periksaPeranEkspor(['kontrol_marketing', 'ceo', 'pusat']);
  if (!cek.ok) return cek.response;

  const bulan = new URL(request.url).searchParams.get('bulan');
  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
    return NextResponse.json({ error: 'Parameter bulan wajib diisi format YYYY-MM, mis. ?bulan=2026-08.' }, { status: 400 });
  }

  const { supabase } = cek;
  const [{ data: baris, error: errBaris }, { data: policyRows, error: errPolicy }] = await Promise.all([
    supabase.rpc('marketing_bulanan_untuk', { p_bulan: `${bulan}-01` }),
    supabase.from('policy').select('key, value'),
  ]);
  if (errBaris) return NextResponse.json({ error: errBaris.message }, { status: 500 });
  if (errPolicy) return NextResponse.json({ error: errPolicy.message }, { status: 500 });

  const policy: PolicyMap = {};
  for (const p of policyRows ?? []) policy[p.key] = p.value;

  const workbook = bukaWorkbook();
  const sheet = buatSheet(workbook, `Marketing ${bulan}`, [
    { header: 'Nama', key: 'nama', width: 22 },
    { header: 'Divisi', key: 'divisi', width: 16 },
    { header: 'Hari Wajib', key: 'hariWajib', width: 12, numFmt: '#,##0' },
    { header: 'Hari Lengkap', key: 'hariLengkap', width: 12, numFmt: '#,##0' },
    { header: 'Hari Bolong', key: 'hariBolong', width: 12, numFmt: '#,##0' },
    { header: 'Undangan', key: 'undangan', width: 12, numFmt: '#,##0' },
    { header: 'Closing', key: 'closing', width: 12, numFmt: '#,##0' },
    { header: 'Status Bonus', key: 'statusBonus', width: 18 },
    { header: 'Nominal Bonus', key: 'nominalBonus', width: 16, numFmt: '#,##0' },
    { header: 'Status Potongan', key: 'statusPotongan', width: 18 },
    { header: 'Nominal Potongan', key: 'nominalPotongan', width: 16, numFmt: '#,##0' },
  ]);

  for (const r of baris ?? []) {
    const bonus = hitungKelayakanBonus(policy, r.pte_berlaku, Number(r.hari_bolong), Number(r.hari_lengkap), Number(r.hari_wajib));
    const potongan = hitungPotongan(policy, r.pte_berlaku, Number(r.closing));
    sheet.addRow({
      nama: r.nama,
      divisi: r.divisi ?? '—',
      hariWajib: r.hari_wajib,
      hariLengkap: Number(r.hari_lengkap),
      hariBolong: Number(r.hari_bolong),
      undangan: Number(r.undangan),
      closing: Number(r.closing),
      statusBonus: !bonus.berlaku ? 'Belum berlaku' : bonus.layak ? 'Layak' : 'Tidak layak',
      nominalBonus: bonus.berlaku ? (bonus.nominal ?? 0) : null,
      statusPotongan: !potongan.berlaku ? 'Belum berlaku' : potongan.potongan && potongan.potongan > 0 ? 'Kena potongan' : 'Tidak kena potongan',
      nominalPotongan: potongan.berlaku ? (potongan.potongan ?? 0) : null,
    });
  }

  return responsXlsx(workbook, `kepatuhan-marketing-${bulan}.xlsx`);
}
