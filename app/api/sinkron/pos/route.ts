import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { bearerCocok, jalankanSinkronPos, type HasilTerapkan } from '../../../../lib/sinkronPos';

/**
 * Sinkron omzet POS -> laporan (19 September 2026, rancangan TARIKAN yang
 * disetujui). Route Handler = file server-only: `SUPABASE_SERVICE_ROLE_KEY`,
 * `POS_INTEGRASI_TOKEN`, dan `CRON_SECRET` dibaca dari `process.env` DI SINI
 * SAJA dan tidak pernah dikirim ke klien (CLAUDE.md #12).
 *
 * TIDAK ADA SESI PENGGUNA: dipanggil penjadwal, dijaga `Authorization: Bearer
 * <CRON_SECRET>` (Vercel Cron mengirim header itu otomatis kalau env CRON_SECRET
 * diisi). Karena proxy.ts mengalihkan semua permintaan tanpa sesi ke /masuk,
 * jalur ini dikecualikan di proxy.ts (SATU jalur persis, bukan seluruh /api).
 * Tanpa CRON_SECRET terkonfigurasi (>= 16 karakter) route MENOLAK SEMUA
 * permintaan (503) -- gagal tertutup.
 *
 * Yang dikerjakan: tarik ringkasan dari pos-fnb, lalu terapkan_sinkron_pos()
 * (fungsi database, satu transaksi, hanya service_role). Setiap percobaan
 * meninggalkan baris di sinkron_pos_log -- itulah yang dipakai layar untuk
 * stempel waktu, peringatan gagal, dan menyembunyikan angka basi.
 */
export const dynamic = 'force-dynamic';

const TIMEOUT_POS_MS = 20_000;
const HEADER = { 'Cache-Control': 'no-store' };

function terlarang() {
  return NextResponse.json({ galat: 'Tidak berwenang.' }, { status: 401, headers: { ...HEADER, 'WWW-Authenticate': 'Bearer' } });
}

async function tangani(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ galat: 'Sinkron belum dikonfigurasi.' }, { status: 503, headers: HEADER });
  }
  if (!bearerCocok(request.headers.get('authorization'), cronSecret)) return terlarang();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ galat: 'Konfigurasi Supabase server belum lengkap.' }, { status: 503, headers: HEADER });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const posUrl = process.env.POS_INTEGRASI_URL;
  const posToken = process.env.POS_INTEGRASI_TOKEN;
  const rahasia = [cronSecret, serviceKey, posToken ?? ''];

  const hasil = await jalankanSinkronPos({
    rahasia,
    mulaiLog: async () => {
      const { data, error } = await admin.from('sinkron_pos_log').insert({}).select('id').single();
      if (error) throw new Error(`Gagal mencatat log sinkron: ${error.message}`);
      return data.id as string;
    },
    ambilRingkasanPos: async () => {
      if (!posUrl || !posToken) throw new Error('POS_INTEGRASI_URL / POS_INTEGRASI_TOKEN belum dikonfigurasi.');
      const url = `${posUrl.replace(/\/+$/, '')}/api/integrasi/omzet-harian`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${posToken}`, Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(TIMEOUT_POS_MS),
        });
      } catch (e) {
        const nama = e instanceof Error ? e.name : '';
        throw new Error(nama === 'TimeoutError' ? `POS tidak menjawab dalam ${TIMEOUT_POS_MS / 1000} detik.` : 'POS tidak terjangkau.');
      }
      if (!res.ok) throw new Error(`POS menjawab HTTP ${res.status}.`);
      try {
        return await res.json();
      } catch {
        throw new Error('Jawaban POS bukan JSON.');
      }
    },
    terapkan: async (logId, payload) => {
      const { data, error } = await admin.rpc('terapkan_sinkron_pos', { p_log_id: logId, p_payload: payload });
      if (error) throw new Error(error.message);
      return data as HasilTerapkan;
    },
    gagalkanLog: async (logId, galat) => {
      const { error } = await admin
        .from('sinkron_pos_log')
        .update({ status: 'gagal', selesai: new Date().toISOString(), galat })
        .eq('id', logId);
      if (error) throw new Error(error.message);
    },
  });

  if (hasil.ok) {
    return NextResponse.json(
      { ok: true, jumlah_baris: hasil.hasil.jumlah_baris, outlet_terpetakan: hasil.hasil.outlet_terpetakan, belum_dipetakan: hasil.hasil.tak_terpetakan.length },
      { status: 200, headers: HEADER },
    );
  }
  // Pesan sudah dibersihkan dari rahasia oleh jalankanSinkronPos.
  console.error(`[sinkron/pos] gagal di tahap ${hasil.tahap}: ${hasil.galat}`);
  return NextResponse.json({ ok: false, tahap: hasil.tahap, galat: hasil.galat }, { status: hasil.tahap === 'tarik' ? 502 : 500, headers: HEADER });
}

// Vercel Cron memakai GET; POST disediakan untuk pemicu manual dengan rahasia yang sama.
export const GET = tangani;
export const POST = tangani;
