import { AI_QUERY_AUDIENCE, buatTokenPos, type AksesPos } from '../posHandoff';

/**
 * Jembatan asisten AI ke pos-fnb (28 September 2026). Satu permintaan per
 * PUTARAN alat (semua panggilan alat POS di putaran itu digabung), satu
 * token baru tiap permintaan (sekali pakai, 60 detik).
 *
 * Token membawa email + uid user yang SEDANG bertanya dan `akses` hasil
 * akses_pos_saya() miliknya sendiri (CLAUDE.md #13, 29 September 2026).
 * pos-fnb menerapkan akses itu dengan batasnya sendiri (maks manager, owner
 * tidak disentuh) sebelum alat apa pun dijalankan.
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
      extra?: {
        weekly?: Record<string, string | number | boolean | null>[];
        stockCoverage?: { outletsWithoutStock: string[]; withoutMinimum: number; stockRows: number };
        recipeCoverage?: {
          perOutlet: { outletName: string; ingredientsWithoutRecipe: number; productsWithoutRecipe: number; stockRows: number }[];
          products: Record<string, string | number | boolean | null>[];
          productTotal: number;
          masterIngredientsWithoutRecipe: number;
          masterIngredients: number;
        };
      };
    }
  | { status: 'forbidden' | 'invalid_args' | 'unknown_tool' | 'error' };

export type JawabanPos =
  | { akses: 'ok'; cakupanOutlet: 'all' | 'limited' | 'none'; hasil: HasilPos[] }
  | { akses: 'tanpa_akses_pos' }
  | { akses: 'galat' };

export async function panggilAlatPos(
  user: { id: string; email: string },
  panggilan: PanggilanPos[],
  akses: AksesPos | null,
): Promise<JawabanPos> {
  const posUrl = process.env.POS_INTEGRASI_URL;
  if (!posUrl || !process.env.POS_HANDOFF_SECRET) return { akses: 'galat' };

  try {
    const res = await fetch(`${posUrl.replace(/\/+$/, '')}/api/ai/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: buatTokenPos(user, AI_QUERY_AUDIENCE, { akses }), calls: panggilan }),
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

/**
 * Impor opname Excel (29 September 2026, fase 2): POST /api/ai/opname-import
 * pos-fnb. Token SAMA (audience AI, sekali pakai, 60 detik, akses dari
 * akses_pos_saya()). pos-fnb hanya menyimpan opname_imports -- tidak membuat
 * draf, tidak menyentuh stok.
 */
export type JawabanImporPos =
  | { akses: 'tanpa_akses_pos' }
  | { akses: 'galat' }
  | { akses: 'ok'; status: 'forbidden' | 'outlet_not_allowed' | 'invalid' }
  | { akses: 'ok'; status: 'ok'; outlets: { id: string; name: string }[] }
  | {
      akses: 'ok';
      status: 'ok';
      importId: string;
      outletName: string;
      counts: { hijau: number; kuning: number; merah: number };
      rows: import('./imporOpname').BarisHasilImpor[];
    };

export type JawabanImporResepPos =
  | { akses: 'tanpa_akses_pos' }
  | { akses: 'galat' }
  | { akses: 'ok'; status: 'forbidden' | 'invalid' }
  | {
      akses: 'ok';
      status: 'ok';
      importId: string;
      ringkasan: import('./imporResep').RingkasanResep;
      produk: import('./imporResep').ProdukResepHasil[];
    };

export function panggilImporOpnamePos(user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null): Promise<JawabanImporPos> {
  return panggilImporPos<JawabanImporPos>('/api/ai/opname-import', user, body, akses);
}

/** Impor resep (29 September 2026): endpoint pos-fnb HANYA menyimpan recipe_imports, tidak pernah resep. */
export function panggilImporResepPos(user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null): Promise<JawabanImporResepPos> {
  return panggilImporPos<JawabanImporResepPos>('/api/ai/recipe-import', user, body, akses);
}

async function panggilImporPos<T>(
  path: '/api/ai/opname-import' | '/api/ai/recipe-import',
  user: { id: string; email: string },
  body: Record<string, unknown>,
  akses: AksesPos | null,
): Promise<T | { akses: 'galat' } | { akses: 'tanpa_akses_pos' }> {
  const posUrl = process.env.POS_INTEGRASI_URL;
  if (!posUrl || !process.env.POS_HANDOFF_SECRET) return { akses: 'galat' };
  try {
    const res = await fetch(`${posUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, token: buatTokenPos(user, AI_QUERY_AUDIENCE, { akses }) }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('jembatanPos impor: status', res.status);
      return { akses: 'galat' };
    }
    const j = (await res.json()) as Record<string, unknown>;
    if (j.access === 'no_pos_access') return { akses: 'tanpa_akses_pos' };
    if (j.access !== 'ok') return { akses: 'galat' };
    const isi = { ...j };
    delete isi.access;
    return { akses: 'ok', ...isi } as T;
  } catch (err) {
    console.error('jembatanPos impor:', err instanceof Error ? err.name : 'gagal');
    return { akses: 'galat' };
  }
}
