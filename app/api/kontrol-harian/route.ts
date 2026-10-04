import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { tanggalWIB } from '../../../lib/tanggal';
import { gabungKontrol, type CatatanKontrol, type OutletPos, type UangOutlet } from '../../../lib/kontrolHarian';

/**
 * GET /api/kontrol-harian?tanggal=yyyy-MM-dd (7 Oktober 2026) -- Kontrol Harian Ita.
 *
 * - Gerbang: sesi pengguna + boleh_lihat_kontrol_harian() (migrasi 0074): Ita (penugasan
 *   kontrol_fnb), CEO, Admin; pusat & accounting lihat saja. Selain itu 403, bukan data kosong.
 * - Data POS ditarik server-ke-server dari pos-fnb /api/integrasi/kontrol-harian dengan
 *   POS_INTEGRASI_TOKEN (env server, pola sama sinkron omzet; tidak pernah ke klien).
 * - Uang masuk (kontrol_harian_uang) & catatan dibaca dengan klien Supabase MILIK PENGGUNA (RLS).
 * POS gagal -> baris tetap tampil dengan status "Data belum lengkap" + alasannya.
 */
export const dynamic = 'force-dynamic';

const HEADER = { 'Cache-Control': 'no-store' };
const TIMEOUT_POS_MS = 20_000;

export async function GET(request: Request) {
  const tanggal = new URL(request.url).searchParams.get('tanggal') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal > tanggalWIB()) {
    return NextResponse.json({ galat: 'Tanggal tidak valid.' }, { status: 400, headers: HEADER });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ galat: 'Silakan masuk dulu.' }, { status: 401, headers: HEADER });

  const { data: boleh, error: galatHak } = await supabase.rpc('boleh_lihat_kontrol_harian');
  if (galatHak) return NextResponse.json({ galat: 'Gagal memeriksa hak akses.' }, { status: 500, headers: HEADER });
  if (!boleh) return NextResponse.json({ galat: 'Kontrol Harian hanya untuk Ita, CEO, Admin, Pusat, dan Accounting.', tidakBerhak: true }, { status: 403, headers: HEADER });

  const [uangRes, catatanRes, ubahRes, pos] = await Promise.all([
    supabase.rpc('kontrol_harian_uang', { p_tanggal: tanggal }),
    supabase.from('kontrol_harian_catatan').select('outlet_id, penyebab, tindakan, diubah_pada').eq('tanggal', tanggal),
    supabase.rpc('boleh_ubah_kontrol_harian'),
    ambilPos(tanggal),
  ]);
  if (uangRes.error || catatanRes.error) {
    return NextResponse.json({ galat: 'Gagal membaca data laporan.' }, { status: 500, headers: HEADER });
  }

  const posPerId = new Map<string, OutletPos>((pos.data ?? []).map((o) => [o.posOutletId, o]));
  const catatanPerOutlet = new Map((catatanRes.data ?? []).map((c) => [c.outlet_id as string, c]));
  const baris = ((uangRes.data ?? []) as UangOutlet[])
    .map((u) => {
      const c = catatanPerOutlet.get(u.outlet_id);
      const catatan: CatatanKontrol = c ? { penyebab: c.penyebab as string, tindakan: c.tindakan as string, diubah_pada: c.diubah_pada as string } : null;
      const uang: UangOutlet = { ...u, cash: u.cash === null ? null : Number(u.cash), qris: u.qris === null ? null : Number(u.qris), bank: u.bank === null ? null : Number(u.bank) };
      return gabungKontrol(posPerId.get(u.pos_outlet_id) ?? null, uang, catatan, pos.galat);
    })
    .sort((a, b) => a.outletNama.localeCompare(b.outletNama, 'id'));

  return NextResponse.json({ tanggal, bolehUbah: ubahRes.data === true, posGalat: pos.galat, baris }, { status: 200, headers: HEADER });
}

async function ambilPos(tanggal: string): Promise<{ data: OutletPos[] | null; galat: string | null }> {
  const url = process.env.POS_INTEGRASI_URL;
  const token = process.env.POS_INTEGRASI_TOKEN;
  if (!url || !token) return { data: null, galat: 'integrasi POS belum dikonfigurasi' };
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/integrasi/kontrol-harian?tanggal=${tanggal}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_POS_MS),
    });
    if (!res.ok) return { data: null, galat: `POS menjawab HTTP ${res.status}` };
    const json = (await res.json()) as { outlet?: OutletPos[] };
    return { data: json.outlet ?? [], galat: null };
  } catch (e) {
    return { data: null, galat: e instanceof Error && e.name === 'TimeoutError' ? 'POS tidak menjawab dalam 20 detik' : 'POS tidak terjangkau' };
  }
}
