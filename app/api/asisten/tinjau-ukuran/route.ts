import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { aiTerkonfigurasi, buatPanggilGeminiJson, namaModelGemini } from '../../../../lib/ai/gemini';
import { panggilTinjauanUkuranPos } from '../../../../lib/ai/jembatanPos';
import { tanganiTinjauanUkuran } from '../../../../lib/ai/tanganiTinjauanUkuran';

export const maxDuration = 60;

/**
 * POST /api/asisten/tinjau-ukuran — AI mengusulkan jenis ukuran bahan
 * (29 September 2026). Semua gerbang di lib/ai/tanganiTinjauanUkuran.ts.
 * Tidak ada jenis ukuran yang terisi dari sini -- manusia mengonfirmasi di POS.
 */
export async function POST() {
  const hasil = await tanganiTinjauanUkuran({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    buatModelJson: buatPanggilGeminiJson,
    namaModel: namaModelGemini(),
    panggilPos: panggilTinjauanUkuranPos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}
