import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { aiTerkonfigurasi, buatPanggilGeminiJson, namaModelGemini } from '../../../../lib/ai/gemini';
import { panggilImporResepPos } from '../../../../lib/ai/jembatanPos';
import { tanganiImporResep } from '../../../../lib/ai/tanganiImporResep';

export const maxDuration = 60;

/**
 * POST /api/asisten/impor-resep (multipart: file) — impor resep dari Excel
 * (29 September 2026). Baca + verifikasi + kirim ke pos-fnb; semua gerbang
 * di lib/ai/tanganiImporResep.ts. Tidak ada resep yang tersimpan dari sini.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const file = form.get('file');
  const hasil = await tanganiImporResep({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    file: file instanceof File ? { nama: file.name, data: await file.arrayBuffer() } : null,
    buatModelJson: buatPanggilGeminiJson,
    namaModel: namaModelGemini(),
    panggilPos: panggilImporResepPos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}
