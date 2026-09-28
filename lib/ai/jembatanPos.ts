import { AI_QUERY_AUDIENCE, buatTokenPos } from '../posHandoff';

/**
 * Jembatan asisten AI ke pos-fnb (28 September 2026). Satu permintaan per
 * PUTARAN alat (semua panggilan alat POS di putaran itu digabung), satu
 * token baru tiap permintaan (sekali pakai, 60 detik).
 *
 * Token cuma membawa email + uid user yang SEDANG bertanya (CLAUDE.md #13) --
 * pos-fnb yang menentukan outlet mana yang boleh ia lihat, lewat
 * report_identity_links + membership di sana. Repo ini TIDAK PERNAH
 * mengirim role/outlet.
 */

export type PanggilanPos = { name: string; args: Record<string, unknown> };

export type HasilPos =
  | {
      status: 'ok';
      outletFilter: 'all_visible' | 'matched' | 'not_visible';
      matchedOutlet?: string;
      period: { from: string; to: string } | { date: string } | null;
      rows: Record<string, string | number | boolean | null>[];
      totalCount: number;
      extra?: { weekly?: Record<string, string | number | boolean | null>[] };
    }
  | { status: 'forbidden' | 'invalid_args' | 'unknown_tool' | 'error' };

export type JawabanPos =
  | { akses: 'ok'; cakupanOutlet: 'all' | 'limited' | 'none'; hasil: HasilPos[] }
  | { akses: 'tanpa_akses_pos' }
  | { akses: 'galat' };

export async function panggilAlatPos(
  user: { id: string; email: string },
  panggilan: PanggilanPos[],
): Promise<JawabanPos> {
  const posUrl = process.env.POS_INTEGRASI_URL;
  if (!posUrl || !process.env.POS_HANDOFF_SECRET) return { akses: 'galat' };

  try {
    const res = await fetch(`${posUrl.replace(/\/+$/, '')}/api/ai/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: buatTokenPos(user, AI_QUERY_AUDIENCE), calls: panggilan }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('jembatanPos: status', res.status);
      return { akses: 'galat' };
    }
    const body = (await res.json()) as {
      access?: string;
      outletScope?: 'all' | 'limited' | 'none';
      results?: { name: string; result: HasilPos }[];
    };
    if (body.access === 'no_pos_access') return { akses: 'tanpa_akses_pos' };
    if (body.access !== 'ok' || !Array.isArray(body.results) || body.results.length !== panggilan.length) {
      return { akses: 'galat' };
    }
    // Cakupan tak dikenal diperlakukan TERBATAS -- jangan pernah mengklaim "semua outlet" tanpa bukti.
    const cakupanOutlet = body.outletScope === 'all' || body.outletScope === 'none' ? body.outletScope : 'limited';
    return { akses: 'ok', cakupanOutlet, hasil: body.results.map((r) => r.result) };
  } catch (err) {
    console.error('jembatanPos:', err instanceof Error ? err.name : 'gagal');
    return { akses: 'galat' };
  }
}
