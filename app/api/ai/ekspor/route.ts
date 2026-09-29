import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { bukaWorkbook, buatSheet, responsXlsx } from '../../../../lib/ekspor/workbook';
import { keteranganSaringan, saringanDariQuery, saringTabel, type TabelAi } from '../../../../lib/ai/tabel';

/**
 * GET /api/ai/ekspor?pesan=<id>&tabel=<urutan> — satu tabel dari jawaban
 * asisten AI sebagai Excel. Dibaca ulang lewat sesi penanya (RLS ai_pesan:
 * cuma pemiliknya), jadi id pesan orang lain = 404, bukan data orang lain.
 *
 * Saringan layar (cari, outlet, urut -- 29 September 2026) ikut lewat query
 * dan diterapkan dengan fungsi yang SAMA (saringTabel): file berisi persis
 * baris yang tersaring, dan saringannya ditulis di dalam file.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pesanId = url.searchParams.get('pesan') ?? '';
  const urutan = Number(url.searchParams.get('tabel') ?? '0');
  if (!/^[0-9a-f-]{36}$/i.test(pesanId) || !Number.isInteger(urutan) || urutan < 0) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sesi berakhir. Silakan masuk lagi.' }, { status: 401 });

  const { data } = await supabase.from('ai_pesan').select('tabel, created_at').eq('id', pesanId).maybeSingle();
  const tabel = (data?.tabel as TabelAi[] | null)?.[urutan];
  if (!tabel) return NextResponse.json({ error: 'Tabel tidak ditemukan.' }, { status: 404 });

  const workbook = bukaWorkbook();
  const sheet = buatSheet(
    workbook,
    tabel.judul,
    tabel.kolom.map((k) => ({
      header: k.label,
      key: k.key,
      width: k.jenis === 'teks' ? 24 : 16,
      numFmt: k.jenis === 'rupiah' ? '#,##0' : k.jenis === 'angka' ? '#,##0.####' : undefined,
    })),
  );
  const saringan = saringanDariQuery(tabel, url.searchParams);
  const barisTersaring = saringTabel(tabel, saringan);
  const keterangan = keteranganSaringan(tabel, saringan);
  for (const baris of barisTersaring) {
    const sel: Record<string, string | number | null> = {};
    for (const k of tabel.kolom) {
      const v = baris[k.key] ?? null;
      if (typeof v === 'boolean') sel[k.key] = v ? 'Ya' : 'Tidak';
      else if (k.jenis !== 'teks' && v !== null && Number.isFinite(Number(v))) sel[k.key] = Number(v);
      else sel[k.key] = v === null ? null : String(v);
    }
    sheet.addRow(sel);
  }
  if (keterangan) {
    sheet.addRow({});
    sheet.addRow({ [tabel.kolom[0]!.key]: `Disaring: ${keterangan}. ${barisTersaring.length} dari ${tabel.baris.length} baris.` });
  }
  if (tabel.totalBaris > tabel.baris.length) {
    sheet.addRow({});
    sheet.addRow({ [tabel.kolom[0]!.key]: `Hanya ${tabel.baris.length} dari ${tabel.totalBaris} baris. Untuk data lengkap, pakai laporan di POS.` });
  }

  const slug = tabel.judul.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return responsXlsx(workbook, `asisten-${slug}.xlsx`);
}
