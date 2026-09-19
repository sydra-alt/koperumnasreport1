import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * SATU-SATUNYA jalur API tanpa sesi pengguna: sinkron omzet POS (19 September
 * 2026). Dipanggil penjadwal (Vercel Cron), bukan browser, jadi tidak pernah
 * punya cookie -- tanpa pengecualian ini proxy mengalihkannya ke /masuk dan
 * penjadwal tidak pernah sampai. Pengecualiannya PERSIS satu jalur (bukan
 * awalan `/api`); route-nya sendiri menolak permintaan tanpa
 * `Authorization: Bearer <CRON_SECRET>` (401) dan tertutup total (503) kalau
 * CRON_SECRET belum diisi -- lihat app/api/sinkron/pos/route.ts. JANGAN
 * melebarkan pengecualian ini ke jalur lain tanpa mekanisme auth setara.
 */
const JALUR_TANPA_SESI = '/api/sinkron/pos';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === JALUR_TANPA_SESI) {
    return NextResponse.next({ request });
  }
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // WAJIB dipanggil sebelum respons dibuat — kalau tidak, token refresh yang
  // selesai setelah respons dikirim akan hilang dan request berikutnya
  // refresh lagi (lihat komentar di CookieMethodsServer.setAll).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/masuk')) {
    const url = request.nextUrl.clone();
    url.pathname = '/masuk';
    return NextResponse.redirect(url);
  }

  // Paksa ganti password (instruksi eksplisit user, 30 Agustus 2026) --
  // SEMUA rute dialihkan ke /ganti-password selama profile.harus_ganti_
  // password masih true, TIDAK BISA dilewati dengan mengetik alamat lain
  // (proxy ini yang mencegat, bukan pengecekan di tiap halaman -- satu
  // tempat, tidak mungkin lupa dipasang di halaman baru). Dua pengecualian
  // MUTLAK: halaman ganti-password itu sendiri (kalau tidak, redirect
  // loop) dan endpoint API-nya (kalau tidak, permintaan mengganti password
  // sendiri dicegat sebelum sempat jalan).
  if (
    user &&
    !request.nextUrl.pathname.startsWith('/ganti-password') &&
    !request.nextUrl.pathname.startsWith('/api/ganti-password')
  ) {
    const { data: profil } = await supabase.from('profile').select('harus_ganti_password').eq('id', user.id).single();
    if (profil?.harus_ganti_password) {
      const url = request.nextUrl.clone();
      url.pathname = '/ganti-password';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // manifest.webmanifest, favicon.ico, dan serwist/ (service worker)
  // DITAMBAHKAN ke pengecualian di sini -- ditemukan saat menguji ikon PWA
  // (24 Agustus 2026): tanpa ini, browser/OS yang mengambil manifest+ikon
  // TANPA sesi (selalu begitu -- pengecekan "bisa dipasang" & ikon layar
  // utama terjadi sebelum ada login sama sekali) dialihkan ke /masuk,
  // membuat manifestnya rusak (dapat HTML redirect, bukan JSON/gambar) dan
  // PWA tidak pernah bisa dipasang. `serwist` dicek terpisah dengan curl
  // dev server (29 Agustus 2026): rute service worker sungguhnya
  // /serwist/sw.js (bukan /sw.js di root), jadi pengecualian "sw\.js" saja
  // tidak cukup -- prefiks "serwist" ditambahkan.
  //
  // Diperbarui 30 Agustus 2026 -- ikon-ikon (icon-192.png, icon-512.png,
  // apple-touch-icon.png, logo-koperumnas.jpg) sekarang berkas statis di
  // public/, bukan lagi rute dinamis /icon-192, /icon-512, /icon,
  // /apple-icon (dihapus) -- sudah tercakup pengecualian ekstensi gambar
  // generik `.png`/`.jpg`/dst di bawah, pengecualian nama-rute lama dibuang.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|serwist|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
