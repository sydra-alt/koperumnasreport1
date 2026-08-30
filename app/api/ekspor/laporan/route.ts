import { NextResponse } from 'next/server';
import { periksaPeranEkspor, rentangBulan } from '../../../../lib/ekspor/otorisasi';
import { bukaWorkbook, buatSheet, responsXlsx } from '../../../../lib/ekspor/workbook';
import { formRegistry } from '../../../../forms';
import type { Field } from '../../../../forms/types';

/**
 * Rekap Laporan per Divisi (§4, prioritas #3 user) -- satu sheet per FORM
 * (bukan literal per `profile.divisi`): satu form_key sudah = satu jenis
 * laporan dengan kolom yang konsisten (mis. `hrd` = divisi HRD, `security`
 * = divisi Security). Mengelompokkan per `profile.divisi` yang sebenarnya
 * akan mencampur form BERBEDA kolom (mis. `personal_marketing` yang
 * dikirim SEMUA karyawan) dalam satu sheet yang sama -- kolom tidak akan
 * pernah konsisten. Interpretasi ini dicatat eksplisit, bukan ditebak
 * diam-diam.
 *
 * `accounting` (`rahasia: true` di schema-nya) DIKECUALIKAN MUTLAK dari
 * daftar form yang diekspor di sini, TANPA PENGECUALIAN -- gerbang halaman
 * ini (pusat+ceo) LEBIH LEBAR dari kerahasiaan accounting (ceo+accounting
 * saja, CLAUDE.md #3). Kalau accounting ikut lewat sini, Sabrina (pusat)
 * bisa membaca laporan keuangan lewat jalur belakang -- pelanggaran fatal.
 * Ekspor keuangan API TERPISAH (`app/api/ekspor/keuangan/route.ts`).
 */
export async function GET(request: Request) {
  const cek = await periksaPeranEkspor(['pusat', 'ceo']);
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
  const workbook = bukaWorkbook();
  let adaSheet = false;

  for (const [formKey, schema] of Object.entries(formRegistry)) {
    if (schema.rahasia) continue; // accounting -- lihat komentar di atas, TIDAK PERNAH lewat sini

    const { data, error } = await supabase
      .from('report')
      .select('tanggal, status, submitted_at, warna, data, profile:author_id(nama, divisi)')
      .eq('form_key', formKey)
      .gte('tanggal', rentang.awal)
      .lte('tanggal', rentang.akhir)
      .neq('status', 'draft')
      .order('tanggal');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) continue; // sheet kosong dilewati, bukan ditampilkan kosong

    const semuaField: Field[] = schema.blocks.flatMap((b) => b.fields);
    const sheet = buatSheet(workbook, schema.nama, [
      { header: 'Tanggal', key: 'tanggal', width: 13, numFmt: 'dd/mm/yyyy' },
      { header: 'Nama', key: 'nama', width: 20 },
      { header: 'Divisi', key: 'divisi', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      ...semuaField
        .filter((f) => f.type !== 'lampiran')
        .map((f) => ({ header: f.label, key: f.key, width: 20, numFmt: f.type === 'uang' || f.type === 'angka' ? '#,##0' : undefined })),
    ]);

    for (const r of data) {
      const nilai = (r.data as Record<string, unknown>) ?? {};
      const profil = r.profile as unknown as { nama: string; divisi: string | null } | null;
      const baris: Record<string, unknown> = {
        tanggal: new Date(`${r.tanggal}T00:00:00Z`),
        nama: profil?.nama ?? '—',
        divisi: profil?.divisi ?? '—',
        status: r.status === 'terlambat' ? 'Terlambat' : 'Tepat waktu',
      };
      for (const f of semuaField) {
        if (f.type === 'lampiran') continue;
        const v = nilai[f.key];
        // Field 'tabel' isinya larik objek -- diringkas jadi teks, bukan
        // diekspansi jadi banyak baris (di luar cakupan yang diminta).
        baris[f.key] = Array.isArray(v) ? `${v.length} baris` : v === null || v === undefined ? '' : v;
      }
      sheet.addRow(baris);
    }
    adaSheet = true;
  }

  if (!adaSheet) {
    workbook.addWorksheet('Kosong').addRow(['Tidak ada laporan terkirim (bukan draft) di bulan ini.']);
  }

  return responsXlsx(workbook, `rekap-laporan-${bulan}.xlsx`);
}
