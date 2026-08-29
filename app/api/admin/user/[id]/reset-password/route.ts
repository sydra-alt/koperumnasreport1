import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../../../lib/supabase/server';

/**
 * Pra-peluncuran (docs/07-CATATAN-PELUNCURAN.md) -- tidak ada alur "lupa
 * password" mandiri lewat email (email @koperumnas.local tidak nyata, tombol
 * reset bawaan Supabase tidak akan pernah sampai). Ini SATU-SATUNYA jalan
 * reset: CEO mengatur ulang lewat halaman Admin. Pola guard & pemakaian
 * service_role PERSIS `app/api/admin/user/route.ts` (dua lapis: sesi login
 * sungguhan, lalu sesi itu punya role `ceo`) -- lihat komentar di file itu
 * untuk penjelasan lengkap kenapa dua lapis.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetId } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 });
  }

  const { data: rolesData, error: errRoles } = await supabase.from('role').select('role').eq('user_id', user.id);
  if (errRoles) {
    return NextResponse.json({ error: errRoles.message }, { status: 500 });
  }
  const roles = (rolesData ?? []).map((r) => r.role);
  if (!roles.includes('ceo')) {
    return NextResponse.json({ error: 'Tidak berhak. Hanya CEO yang bisa mengatur ulang kata sandi.' }, { status: 403 });
  }

  if (!targetId) {
    return NextResponse.json({ error: 'ID pengguna tidak ada.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset di server.' }, { status: 500 });
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Sama seperti scripts/set-password.mjs: 16 karakter acak dari
  // crypto.randomBytes (bukan Math.random), ditampilkan sekali ke pemanggil,
  // TIDAK PERNAH disimpan ke mana pun oleh server ini.
  const passwordBaru = randomBytes(12).toString('base64url').slice(0, 16);

  const { error: errUpdate } = await admin.auth.admin.updateUserById(targetId, { password: passwordBaru });
  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 400 });
  }

  const { error: errLog } = await admin.from('reset_password_log').insert({ actor_id: user.id, target_id: targetId });
  if (errLog) {
    // Password SUDAH terganti -- gagal mencatat log tidak boleh membuat
    // pemanggil mengira reset-nya gagal (bisa berujung dicoba ulang, lalu
    // mengganti password lagi tanpa perlu). Log kegagalan pencatatan di
    // server, tapi tetap kembalikan password baru ke pemanggil.
    console.error('Gagal mencatat reset_password_log:', errLog.message);
  }

  return NextResponse.json({ password: passwordBaru });
}
