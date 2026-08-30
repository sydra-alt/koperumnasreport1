import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../lib/supabase/server';

/**
 * Task 23 -- SATU-SATUNYA jalan resmi untuk membuat pengguna baru
 * (baris `auth.users`). Route Handler, BUKAN 'use client' -- ini file
 * server-only (Next.js App Router: apa pun di bawah `app/api/` cuma
 * pernah berjalan di server, tidak pernah dikirim ke browser). Kunci
 * `SUPABASE_SERVICE_ROLE_KEY` dibaca dari `process.env` DI SINI SAJA,
 * tidak pernah diteruskan ke klien lewat response apa pun -- lihat
 * `lib/api/admin.ts` (`useBuatPengguna`), yang cuma `fetch()` endpoint
 * ini dan tidak pernah menyentuh kuncinya.
 *
 * Auth Admin API (`createUser`) tidak tunduk RLS sama sekali -- karena
 * itu, permintaan diverifikasi DUA LAPIS sebelum kunci dipakai:
 * (1) ada sesi login sungguhan (cookie, lewat `lib/supabase/server.ts`
 * yang memakai anon key + RLS biasa), (2) sesi itu punya role `ceo`
 * (dicek lewat query `role` dengan klien SESI ITU SENDIRI, bukan admin
 * client -- kalau bukan `ceo`, RLS `role_select` tetap mengizinkan baca
 * baris sendiri, cukup untuk pengecekan ini).
 *
 * Password SELALU 'admin123' (instruksi eksplisit user, 30 Agustus 2026) --
 * TIDAK PERNAH dibaca dari body permintaan, supaya tidak ada jalan CEO
 * (sengaja atau tidak) membuat akun dengan password lain yang tidak
 * seragam. Aman karena `profile.harus_ganti_password` (default true) +
 * `proxy.ts` memaksa ganti sebelum halaman apa pun terbuka.
 */
const PASSWORD_AWAL = 'admin123';
export async function POST(request: Request) {
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
    return NextResponse.json({ error: 'Tidak berhak. Hanya CEO yang bisa membuat pengguna baru.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const nama = typeof body?.nama === 'string' ? body.nama.trim() : '';
  const jabatan = typeof body?.jabatan === 'string' && body.jabatan.trim() ? body.jabatan.trim() : null;
  const divisi = typeof body?.divisi === 'string' && body.divisi.trim() ? body.divisi.trim() : null;
  const rolesBaru: string[] = Array.isArray(body?.roles) ? body.roles.filter((r: unknown) => typeof r === 'string') : [];

  if (!email || !nama) {
    return NextResponse.json({ error: 'Email dan nama wajib diisi.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset di server.' }, { status: 500 });
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: dibuat, error: errBuat } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD_AWAL,
    email_confirm: true,
  });
  if (errBuat || !dibuat.user) {
    return NextResponse.json({ error: errBuat?.message ?? 'Gagal membuat pengguna.' }, { status: 400 });
  }

  const { error: errProfil } = await admin.from('profile').upsert({ id: dibuat.user.id, nama, jabatan, divisi });
  if (errProfil) {
    return NextResponse.json({ error: errProfil.message }, { status: 500 });
  }

  if (rolesBaru.length > 0) {
    const { error: errRole } = await admin.from('role').insert(rolesBaru.map((role) => ({ user_id: dibuat.user!.id, role })));
    if (errRole) {
      return NextResponse.json({ error: errRole.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: dibuat.user.id });
}
