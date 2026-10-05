import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { tanggalWIB } from '../../../lib/tanggal';
import { bulanValid, type AsetPersediaan } from '../../../lib/asetPersediaan';

/**
 * GET /api/aset-persediaan?bulan=yyyy-MM (Pusat fase B, 8 Oktober 2026) -- Nilai Aset Persediaan.
 *
 * - Gerbang: sesi pengguna + boleh_lihat_aset_persediaan() (migrasi 0076): CEO, Admin, Ita
 *   (akses_semua_outlet_pos), Accounting -- lihat saja. Selain itu 403, bukan data kosong.
 * - Data ditarik server-ke-server dari pos-fnb /api/integrasi/aset-persediaan dengan
 *   POS_INTEGRASI_TOKEN (env server, pola sama Kontrol Harian; tidak pernah ke klien).
 *   Semua agregasi di SQL pos-fnb; di sini tidak ada hitungan ulang.
 * POS gagal -> 502 dengan alasannya (tidak pernah angka nol).
 */
export const dynamic = 'force-dynamic';

const HEADER = { 'Cache-Control': 'no-store' };
const TIMEOUT_POS_MS = 20_000;

export async function GET(request: Request) {
  const bulan = new URL(request.url).searchParams.get('bulan') ?? '';
  if (!bulanValid(bulan, tanggalWIB())) {
    return NextResponse.json({ galat: 'Bulan tidak valid.' }, { status: 400, headers: HEADER });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ galat: 'Silakan masuk dulu.' }, { status: 401, headers: HEADER });

  const { data: boleh, error: galatHak } = await supabase.rpc('boleh_lihat_aset_persediaan');
  if (galatHak) return NextResponse.json({ galat: 'Gagal memeriksa hak akses.' }, { status: 500, headers: HEADER });
  if (!boleh) {
    return NextResponse.json({ galat: 'Nilai Aset Persediaan hanya untuk CEO, Admin, Ita, dan Accounting.', tidakBerhak: true }, { status: 403, headers: HEADER });
  }

  const url = process.env.POS_INTEGRASI_URL;
  const token = process.env.POS_INTEGRASI_TOKEN;
  if (!url || !token) return NextResponse.json({ galat: 'Integrasi POS belum dikonfigurasi.' }, { status: 503, headers: HEADER });
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/integrasi/aset-persediaan?bulan=${bulan}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_POS_MS),
    });
    if (!res.ok) return NextResponse.json({ galat: `Data POS tidak tersedia (POS menjawab HTTP ${res.status}).` }, { status: 502, headers: HEADER });
    const data = (await res.json()) as AsetPersediaan;
    return NextResponse.json(data, { status: 200, headers: HEADER });
  } catch (e) {
    const alasan = e instanceof Error && e.name === 'TimeoutError' ? 'POS tidak menjawab dalam 20 detik' : 'POS tidak terjangkau';
    return NextResponse.json({ galat: `Data POS tidak tersedia (${alasan}).` }, { status: 502, headers: HEADER });
  }
}
