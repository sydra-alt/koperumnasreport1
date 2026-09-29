import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { aiTerkonfigurasi, buatPanggilGeminiJson, namaModelGemini } from '../../../../lib/ai/gemini';
import { panggilImporOpnamePos } from '../../../../lib/ai/jembatanPos';
import { tanganiImporOpname, tanganiOutletImpor } from '../../../../lib/ai/tanganiImporOpname';

export const maxDuration = 60;

/**
 * /api/asisten/impor-opname — impor opname dari Excel (29 September 2026,
 * fase 2). GET = outlet yang boleh diimpor; POST (multipart: file, outletId)
 * = baca + verifikasi + kirim ke pos-fnb. Semua gerbang di
 * lib/ai/tanganiImporOpname.ts.
 */
export async function GET() {
  const hasil = await tanganiOutletImpor({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    panggilPos: panggilImporOpnamePos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const file = form.get('file');
  const hasil = await tanganiImporOpname({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    outletId: form.get('outletId'),
    file: file instanceof File ? { nama: file.name, data: await file.arrayBuffer() } : null,
    buatModelJson: buatPanggilGeminiJson,
    namaModel: namaModelGemini(),
    panggilPos: panggilImporOpnamePos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}
