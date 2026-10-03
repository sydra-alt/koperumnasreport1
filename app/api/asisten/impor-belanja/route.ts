import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { aiTerkonfigurasi, buatPanggilGeminiJson, namaModelGemini } from '../../../../lib/ai/gemini';
import { panggilImporBelanjaPos } from '../../../../lib/ai/jembatanPos';
import { tanganiImporBelanja, tanganiOutletBelanja } from '../../../../lib/ai/tanganiImporBelanja';

export const maxDuration = 60;

/**
 * /api/asisten/impor-belanja — impor belanja dari foto nota (3 Oktober
 * 2026). GET = outlet yang boleh dicatat pembeliannya; POST (multipart:
 * foto, outletId, pembelanja, tanggalBelanja) = baca foto + kirim ke pos-fnb.
 * Semua gerbang di lib/ai/tanganiImporBelanja.ts.
 */
export async function GET() {
  const hasil = await tanganiOutletBelanja({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    panggilPos: panggilImporBelanjaPos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid (foto terlalu besar?).' }, { status: 400 });
  }
  const foto = form.get('foto');
  const hasil = await tanganiImporBelanja({
    supabase: await createServerClient(),
    terkonfigurasi: aiTerkonfigurasi(),
    outletId: form.get('outletId'),
    pembelanja: form.get('pembelanja'),
    tanggalBelanja: form.get('tanggalBelanja'),
    foto: foto instanceof File ? { nama: foto.name, jenis: foto.type, data: await foto.arrayBuffer() } : null,
    buatModelJson: buatPanggilGeminiJson,
    namaModel: namaModelGemini(),
    panggilPos: panggilImporBelanjaPos,
  });
  return NextResponse.json(hasil.body, { status: hasil.status });
}
