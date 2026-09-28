import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { aiTerkonfigurasi, buatPanggilGemini } from '../../../../lib/ai/gemini';
import { tanganiChat } from '../../../../lib/ai/tanganiChat';
import { tanggalWIB } from '../../../../lib/tanggal';

export const maxDuration = 60;

/**
 * POST /api/ai/chat — satu pertanyaan ke asisten AI (28 September 2026).
 * Semua gerbang + alurnya di lib/ai/tanganiChat.ts; di sini cuma menyambung
 * klien Supabase milik penanya (cookie sesi) dan model Gemini sungguhan.
 */
export async function POST(request: Request) {
  let bodyMentah: unknown;
  try {
    bodyMentah = await request.json();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const hasil = await tanganiChat({
    supabase: await createServerClient(),
    bodyMentah,
    terkonfigurasi: aiTerkonfigurasi(),
    buatModel: buatPanggilGemini,
    tanggalHariIni: tanggalWIB(),
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}
