import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { ringkasCadangan } from '../../../lib/cadanganStatus';
import { gabungKesiapan, type OutletPosKesiapan } from '../../../lib/kesiapanOutlet';

/**
 * GET /api/kesiapan-outlet (8 Oktober 2026) -- Kesiapan Outlet, baca saja.
 *
 * - Gerbang: sesi pengguna + is_admin() (CEO atau Admin). Selain itu 403, bukan data kosong.
 * - Butir POS ditarik server-ke-server dari pos-fnb /api/integrasi/kesiapan-outlet dengan
 *   POS_INTEGRASI_TOKEN (env server, pola sama Kontrol Harian; tidak pernah ke klien).
 * - Penugasan Kontrol F&B (kontrol_harian_penugasan, migrasi 0077) dan status cadangan laporan
 *   (status_cadangan, RLS is_admin) dibaca dengan klien Supabase MILIK PENGGUNA.
 * Murah: satu tarikan POS (kueri teragregasi) + dua kueri kecil di sini.
 */
export const dynamic = 'force-dynamic';

const HEADER = { 'Cache-Control': 'no-store' };
const TIMEOUT_POS_MS = 20_000;

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ galat: 'Silakan masuk dulu.' }, { status: 401, headers: HEADER });

  const { data: boleh, error: galatHak } = await supabase.rpc('is_admin');
  if (galatHak) return NextResponse.json({ galat: 'Gagal memeriksa hak akses.' }, { status: 500, headers: HEADER });
  if (!boleh) return NextResponse.json({ galat: 'Kesiapan Outlet hanya untuk CEO dan Admin.', tidakBerhak: true }, { status: 403, headers: HEADER });

  const [penugasanRes, cadanganRes, pos] = await Promise.all([
    supabase.rpc('kontrol_harian_penugasan'),
    supabase.from('status_cadangan').select('terakhir_ok, hasil_terakhir, ukuran_byte').eq('basis_data', 'laporan').maybeSingle(),
    ambilPos(),
  ]);
  if (penugasanRes.error || cadanganRes.error) {
    return NextResponse.json({ galat: 'Gagal membaca data laporan.' }, { status: 500, headers: HEADER });
  }
  if (pos.galat !== null) return NextResponse.json({ galat: `Data POS tidak tersedia (${pos.galat}).` }, { status: 502, headers: HEADER });

  const penugasan = new Map(((penugasanRes.data ?? []) as { pos_outlet_id: string; ada_penugasan: boolean }[]).map((p) => [p.pos_outlet_id, p.ada_penugasan]));
  const c = cadanganRes.data;
  const cadangan = ringkasCadangan(
    c ? { terakhirOk: c.terakhir_ok ? new Date(c.terakhir_ok as string) : null, hasilTerakhir: c.hasil_terakhir as string, ukuranByte: c.ukuran_byte === null ? null : Number(c.ukuran_byte) } : null,
    new Date(),
  );
  const baris = pos.data.map((o) => gabungKesiapan(o, penugasan.has(o.posOutletId) ? penugasan.get(o.posOutletId)! : null, cadangan));
  return NextResponse.json({ dibuatPada: pos.dibuatPada, baris }, { status: 200, headers: HEADER });
}

async function ambilPos(): Promise<{ data: OutletPosKesiapan[]; dibuatPada: string; galat: null } | { galat: string }> {
  const url = process.env.POS_INTEGRASI_URL;
  const token = process.env.POS_INTEGRASI_TOKEN;
  if (!url || !token) return { galat: 'integrasi POS belum dikonfigurasi' };
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/integrasi/kesiapan-outlet`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_POS_MS),
    });
    if (!res.ok) return { galat: `POS menjawab HTTP ${res.status}` };
    const json = (await res.json()) as { outlet?: OutletPosKesiapan[]; dibuatPada?: string };
    return { data: json.outlet ?? [], dibuatPada: json.dibuatPada ?? new Date().toISOString(), galat: null };
  } catch (e) {
    return { galat: e instanceof Error && e.name === 'TimeoutError' ? 'POS tidak menjawab dalam 20 detik' : 'POS tidak terjangkau' };
  }
}
