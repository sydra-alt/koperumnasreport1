import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../lib/supabase/server';

/**
 * Paksa ganti password (instruksi eksplisit user, 30 Agustus 2026) --
 * satu-satunya jalan resmi mematikan `profile.harus_ganti_password`. Guard
 * DB (`jaga_profil_sensitif()`, migrasi 0034) menolak siapa pun mematikan
 * kolom itu lewat update langsung -- HARUS lewat sini, yang membuktikan
 * dulu password sungguhan berubah baru mematikan penandanya.
 *
 * Pola client GANDA sama seperti app/api/admin/user/route.ts: (1) sesi
 * cookie biasa (anon key) HANYA untuk tahu siapa yang meminta -- pengguna
 * mengganti password MILIK SENDIRI, tidak perlu cek role apa pun; (2)
 * service_role dipakai untuk KEDUA operasi (ganti password sungguhan lewat
 * Auth Admin API, lalu matikan `harus_ganti_password`) supaya trigger DB
 * di atas melihat `auth.uid() is null` (konteks service role) dan
 * mengizinkan -- persis mekanisme yang sengaja dirancang guard itu.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const passwordBaru = typeof body?.password === 'string' ? body.password : '';

  if (passwordBaru.length < 8) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  }
  if (passwordBaru === 'admin123') {
    return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password awal.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset di server.' }, { status: 500 });
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: errUpdate } = await admin.auth.admin.updateUserById(user.id, { password: passwordBaru });
  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 400 });
  }

  const { error: errFlag } = await admin.from('profile').update({ harus_ganti_password: false }).eq('id', user.id);
  if (errFlag) {
    return NextResponse.json({ error: errFlag.message }, { status: 500 });
  }

  return NextResponse.json({});
}
