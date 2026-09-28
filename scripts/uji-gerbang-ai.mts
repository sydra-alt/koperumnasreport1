#!/usr/bin/env -S npx tsx
// Uji GERBANG PERAN asisten AI (28 September 2026) -- yang paling mahal kalau
// salah: peran yang tidak diizinkan TIDAK BOLEH sampai memanggil Gemini.
//
// ⚠️ LIVE: menulis sungguhan ke database (dev = produksi), HANYA akun uji5
// (AKUN UJI - Tanpa Peran, scripts/buat-akun-uji.mjs): password sementara +
// baris role-nya + percakapan AI miliknya. Semua dipulihkan lewat
// pasangPemulih (juga saat Ctrl-C): role kembali ke semula, password kembali
// ke admin123, percakapan AI uji5 dihapus. Tidak menyentuh akun orang
// sungguhan, tidak mengubah policy.
//
// Jalur yang diuji = tanganiChat() SUNGGUHAN (isi POST /api/ai/chat) dengan
// sesi Supabase sungguhan hasil login uji5; yang palsu cuma modelnya
// (penghitung) supaya "Gemini dipanggil atau tidak" bisa dibuktikan tanpa
// biaya.
//
// Jalankan: npx tsx scripts/uji-gerbang-ai.mts

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
// @ts-expect-error -- paket pg tanpa @types di repo ini (skrip lain memakainya dari .mjs)
import pg from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { tanganiChat, PESAN_TIDAK_AKTIF, PESAN_TIDAK_BOLEH } from '../lib/ai/tanganiChat';
import type { PanggilModel } from '../lib/ai/gemini';
import { pasangPemulih } from './_pengaman-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

function modelMata() {
  const hitung = { dibuat: 0, dipanggil: 0 };
  const buatModel = (): PanggilModel => {
    hitung.dibuat += 1;
    return async () => {
      hitung.dipanggil += 1;
      return { role: 'model', parts: [{ text: 'Jawaban uji.' }] };
    };
  };
  return { hitung, buatModel };
}

await db.connect();
const { rows: target } = await db.query(`select id from auth.users where email = 'uji5@koperumnas.local'`);
if (target.length === 0) throw new Error('uji5@koperumnas.local tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
const uji5 = target[0].id as string;
const peranAwal = (await db.query('select role from public.role where user_id = $1', [uji5])).rows.map((r: { role: string }) => r.role);
const passwordSementara = crypto.randomBytes(12).toString('base64url').slice(0, 16);

const pulihkan = pasangPemulih('uji-gerbang-ai', async () => {
  await db.query('delete from public.ai_percakapan where user_id = $1', [uji5]);
  await db.query('delete from public.role where user_id = $1', [uji5]);
  for (const r of peranAwal) await db.query('insert into public.role (user_id, role) values ($1, $2)', [uji5, r]);
  const { error } = await admin.auth.admin.updateUserById(uji5, { password: 'admin123' });
  if (error) throw new Error(`gagal mengembalikan password uji5: ${error.message}`);
  const sisa = (await db.query('select count(*)::int n from public.ai_percakapan where user_id = $1', [uji5])).rows[0].n;
  const peran = (await db.query('select role from public.role where user_id = $1 order by role', [uji5])).rows.map((r: { role: string }) => r.role);
  if (sisa !== 0 || JSON.stringify(peran) !== JSON.stringify([...peranAwal].sort())) {
    throw new Error(`pemulihan tidak sempurna: percakapan=${sisa}, peran=${JSON.stringify(peran)}`);
  }
  console.log(`[pulih] uji5: peran ${JSON.stringify(peran)}, percakapan AI 0, password admin123.`);
  await db.end();
});

async function sesiSebagai(peran: string[]): Promise<SupabaseClient> {
  await db.query('delete from public.role where user_id = $1', [uji5]);
  for (const r of peran) await db.query('insert into public.role (user_id, role) values ($1, $2)', [uji5, r]);
  const klien = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await klien.auth.signInWithPassword({ email: 'uji5@koperumnas.local', password: passwordSementara });
  if (error) throw new Error(`login uji5 gagal: ${error.message}`);
  return klien;
}

try {
  const { error: galatPw } = await admin.auth.admin.updateUserById(uji5, { password: passwordSementara });
  if (galatPw) throw new Error(`reset password uji5 gagal: ${galatPw.message}`);

  // ─── Peran di luar ai_peran_boleh: ditolak SEBELUM model dibuat ───────
  for (const peran of ['accounting', 'pusat', 'admin', 'karyawan']) {
    const supabase = await sesiSebagai([peran]);
    const m = modelMata();
    const r = await tanganiChat({ supabase, bodyMentah: { pesan: 'Berapa omzet kemarin?' }, terkonfigurasi: true, buatModel: m.buatModel, tanggalHariIni: '2026-09-28' });
    const percakapan = (await db.query('select count(*)::int n from public.ai_percakapan where user_id = $1', [uji5])).rows[0].n;
    cek(`${peran}: 403 "${PESAN_TIDAK_BOLEH}", Gemini TIDAK dibuat/dipanggil, nol percakapan tersimpan`,
      r.status === 403 && r.body.error === PESAN_TIDAK_BOLEH && m.hitung.dibuat === 0 && m.hitung.dipanggil === 0 && percakapan === 0,
      { status: r.status, body: r.body, model: m.hitung, percakapan });
    await supabase.auth.signOut();
  }

  // ─── Tanpa peran sama sekali ─────────────────────────────────────────
  {
    const supabase = await sesiSebagai([]);
    const m = modelMata();
    const r = await tanganiChat({ supabase, bodyMentah: { pesan: 'halo' }, terkonfigurasi: true, buatModel: m.buatModel, tanggalHariIni: '2026-09-28' });
    cek('tanpa peran: 403, Gemini TIDAK dipanggil', r.status === 403 && m.hitung.dibuat === 0, { status: r.status, model: m.hitung });
    await supabase.auth.signOut();
  }

  // ─── Kontrol positif: peran yang diizinkan SAMPAI ke model ───────────
  // (membuktikan penolakan di atas bukan karena jalurnya rusak untuk semua orang)
  {
    const supabase = await sesiSebagai(['manager_resto']);
    const m = modelMata();
    const r = await tanganiChat({ supabase, bodyMentah: { pesan: 'halo' }, terkonfigurasi: true, buatModel: m.buatModel, tanggalHariIni: '2026-09-28' });
    cek('KONTROL: manager_resto -> 200, model dibuat & dipanggil tepat sekali', r.status === 200 && m.hitung.dibuat === 1 && m.hitung.dipanggil === 1,
      { status: r.status, body: r.body, model: m.hitung });
    await supabase.auth.signOut();
  }

  // ─── "Belum diaktifkan" vs "jatah habis" (pemetaan pesan, klien palsu) ─
  {
    const palsu = (status: Record<string, unknown>) =>
      ({
        auth: { getUser: async () => ({ data: { user: { id: 'x', email: 'x@koperumnas.local' } } }) },
        rpc: () => ({ single: async () => ({ data: status, error: null }) }),
      }) as unknown as SupabaseClient;
    const m1 = modelMata();
    const r1 = await tanganiChat({ supabase: palsu({ aktif: false, boleh: false, batas: 0, terpakai: 0 }), bodyMentah: { pesan: 'x' }, terkonfigurasi: true, buatModel: m1.buatModel, tanggalHariIni: '2026-09-28' });
    cek('tidak aktif -> 503 "belum diaktifkan untuk bisnis ini" (bukan "batas tercapai"), model tidak dibuat',
      r1.status === 503 && r1.body.error === PESAN_TIDAK_AKTIF && !/Batas/.test(String(r1.body.error)) && m1.hitung.dibuat === 0, r1);
    const m2 = modelMata();
    const r2 = await tanganiChat({ supabase: palsu({ aktif: true, boleh: true, batas: 30, terpakai: 30 }), bodyMentah: { pesan: 'x' }, terkonfigurasi: true, buatModel: m2.buatModel, tanggalHariIni: '2026-09-28' });
    cek('jatah habis -> 429 "Batas 30 pesan per hari", model tidak dibuat', r2.status === 429 && /Batas 30 pesan/.test(String(r2.body.error)) && m2.hitung.dibuat === 0, r2);
  }
} catch (e) {
  cek('skrip selesai tanpa galat', false, e instanceof Error ? e.message : e);
} finally {
  await pulihkan();
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal += 1;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}${h.lolos ? '' : `\n        -> ${JSON.stringify(h.detail)}`}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos.`);
process.exit(gagal === 0 ? 0 : 1);
