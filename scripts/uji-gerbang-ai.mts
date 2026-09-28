#!/usr/bin/env -S npx tsx
// Uji GERBANG AKSES asisten AI -- yang paling mahal kalau salah: orang tanpa
// akses TIDAK BOLEH sampai memanggil Gemini.
//
// Sejak migrasi 0067 (29 September 2026) akses PER ORANG
// (profile.punya_akses_ai), bukan per peran. Yang dibuktikan:
// - Kontrol FnB BERTANDA (kasus Ita: peran karyawan, tugas Kontrol FnB) masuk
//   dan sampai ke model tepat sekali
// - manager_resto TANPA tanda ditolak 403 SEBELUM model dibuat
// - accounting, pusat, admin, karyawan, bahkan peran ceo -- TANPA tanda --
//   semuanya ditolak sebelum model dibuat
//
// ⚠️ LIVE: menulis sungguhan ke database (dev = produksi), HANYA akun uji
// uji1 (Manager Resto), uji3 (Kontrol FnB), uji5 (Tanpa Peran) dari
// scripts/buat-akun-uji.mjs: password sementara, baris role uji5, tanda
// punya_akses_ai, dan percakapan AI mereka. Semua dipulihkan lewat
// pasangPemulih (juga saat Ctrl-C). Tidak menyentuh akun orang sungguhan,
// tidak mengubah policy.
//
// Jalur yang diuji = tanganiChat() SUNGGUHAN (isi POST /api/ai/chat) dengan
// sesi Supabase sungguhan; yang palsu cuma modelnya (penghitung).
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
type Akun = { email: string; id: string; peran: string[]; aksesAi: boolean };
const akun: Record<string, Akun> = {};
for (const email of ['uji1@koperumnas.local', 'uji3@koperumnas.local', 'uji5@koperumnas.local']) {
  const { rows } = await db.query(
    `select u.id, p.punya_akses_ai from auth.users u join public.profile p on p.id = u.id where u.email = $1`,
    [email],
  );
  if (rows.length === 0) throw new Error(`${email} tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.`);
  const peran = (await db.query('select role from public.role where user_id = $1 order by role', [rows[0].id])).rows.map((r: { role: string }) => r.role);
  akun[email] = { email, id: rows[0].id, peran, aksesAi: rows[0].punya_akses_ai };
}
const uji1 = akun['uji1@koperumnas.local']!;
const uji3 = akun['uji3@koperumnas.local']!;
const uji5 = akun['uji5@koperumnas.local']!;
const passwordSementara = crypto.randomBytes(12).toString('base64url').slice(0, 16);

const pulihkan = pasangPemulih('uji-gerbang-ai', async () => {
  for (const a of Object.values(akun)) {
    await db.query('delete from public.ai_percakapan where user_id = $1', [a.id]);
    await db.query('delete from public.role where user_id = $1', [a.id]);
    for (const r of a.peran) await db.query('insert into public.role (user_id, role) values ($1, $2)', [a.id, r]);
    await db.query('update public.profile set punya_akses_ai = $2 where id = $1', [a.id, a.aksesAi]);
    const { error } = await admin.auth.admin.updateUserById(a.id, { password: 'admin123' });
    if (error) throw new Error(`gagal mengembalikan password ${a.email}: ${error.message}`);
    const peranKini = (await db.query('select role from public.role where user_id = $1 order by role', [a.id])).rows.map((r: { role: string }) => r.role);
    const aksesKini = (await db.query('select punya_akses_ai from public.profile where id = $1', [a.id])).rows[0].punya_akses_ai;
    if (JSON.stringify(peranKini) !== JSON.stringify(a.peran) || aksesKini !== a.aksesAi) {
      throw new Error(`pemulihan ${a.email} tidak sempurna: peran=${JSON.stringify(peranKini)}, akses_ai=${aksesKini}`);
    }
  }
  console.log('[pulih] uji1/uji3/uji5: peran, akses AI, password admin123, percakapan AI dihapus.');
  await db.end();
});

async function sesi(a: Akun, opsi: { peran?: string[]; aksesAi: boolean }): Promise<SupabaseClient> {
  if (opsi.peran) {
    await db.query('delete from public.role where user_id = $1', [a.id]);
    for (const r of opsi.peran) await db.query('insert into public.role (user_id, role) values ($1, $2)', [a.id, r]);
  }
  await db.query('update public.profile set punya_akses_ai = $2 where id = $1', [a.id, opsi.aksesAi]);
  const klien = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await klien.auth.signInWithPassword({ email: a.email, password: passwordSementara });
  if (error) throw new Error(`login ${a.email} gagal: ${error.message}`);
  return klien;
}

async function tanya(supabase: SupabaseClient) {
  const m = modelMata();
  const r = await tanganiChat({ supabase, bodyMentah: { pesan: 'Berapa omzet kemarin?' }, terkonfigurasi: true, buatModel: m.buatModel, tanggalHariIni: '2026-09-29' });
  return { r, m };
}
const jumlahPercakapan = async (a: Akun) => (await db.query('select count(*)::int n from public.ai_percakapan where user_id = $1', [a.id])).rows[0].n;

try {
  for (const a of Object.values(akun)) {
    const { error } = await admin.auth.admin.updateUserById(a.id, { password: passwordSementara });
    if (error) throw new Error(`reset password ${a.email} gagal: ${error.message}`);
  }

  // ─── Kasus Ita: Kontrol FnB BERTANDA -> masuk, model dipanggil sekali ──
  {
    const s = await sesi(uji3, { aksesAi: true });
    const { r, m } = await tanya(s);
    cek(`Kontrol FnB BERTANDA (uji3, peran ${JSON.stringify(uji3.peran)}): 200, model dibuat & dipanggil tepat sekali`,
      r.status === 200 && m.hitung.dibuat === 1 && m.hitung.dipanggil === 1, { status: r.status, body: r.body, model: m.hitung });
    await s.auth.signOut();
  }

  // ─── manager_resto TANPA tanda -> ditolak sebelum Gemini ─────────────
  {
    const s = await sesi(uji1, { aksesAi: false });
    const { r, m } = await tanya(s);
    cek(`manager_resto TANPA tanda (uji1): 403 "${PESAN_TIDAK_BOLEH}", model TIDAK dibuat, nol percakapan`,
      r.status === 403 && r.body.error === PESAN_TIDAK_BOLEH && m.hitung.dibuat === 0 && (await jumlahPercakapan(uji1)) === 0,
      { status: r.status, body: r.body, model: m.hitung });
    await s.auth.signOut();
  }

  // ─── Peran lain TANPA tanda (termasuk ceo) -> ditolak sebelum Gemini ──
  for (const peran of ['accounting', 'pusat', 'admin', 'karyawan', 'ceo']) {
    const s = await sesi(uji5, { peran: [peran], aksesAi: false });
    const { r, m } = await tanya(s);
    cek(`${peran} TANPA tanda: 403, model TIDAK dibuat, nol percakapan`,
      r.status === 403 && m.hitung.dibuat === 0 && m.hitung.dipanggil === 0 && (await jumlahPercakapan(uji5)) === 0,
      { status: r.status, model: m.hitung });
    await s.auth.signOut();
  }

  // ─── Tanda dicabut di tengah jalan -> langsung ditolak lagi ───────────
  {
    const s = await sesi(uji3, { aksesAi: false });
    const { r, m } = await tanya(s);
    cek('tanda uji3 dicabut -> 403 berikutnya, model tidak dibuat', r.status === 403 && m.hitung.dibuat === 0, { status: r.status });
    await s.auth.signOut();
  }

  // ─── "Belum diaktifkan" vs "jatah habis" (pemetaan pesan, klien palsu) ─
  {
    const palsu = (status: Record<string, unknown>) =>
      ({
        auth: { getUser: async () => ({ data: { user: { id: 'x', email: 'x@koperumnas.local' } } }) },
        rpc: () => ({ single: async () => ({ data: status, error: null }) }),
      }) as unknown as SupabaseClient;
    const m1 = modelMata();
    const r1 = await tanganiChat({ supabase: palsu({ aktif: false, boleh: false, batas: 0, terpakai: 0 }), bodyMentah: { pesan: 'x' }, terkonfigurasi: true, buatModel: m1.buatModel, tanggalHariIni: '2026-09-29' });
    cek('tidak aktif -> 503 "belum diaktifkan untuk bisnis ini" (bukan "batas tercapai"), model tidak dibuat',
      r1.status === 503 && r1.body.error === PESAN_TIDAK_AKTIF && !/Batas/.test(String(r1.body.error)) && m1.hitung.dibuat === 0, r1);
    const m2 = modelMata();
    const r2 = await tanganiChat({ supabase: palsu({ aktif: true, boleh: true, batas: 30, terpakai: 30 }), bodyMentah: { pesan: 'x' }, terkonfigurasi: true, buatModel: m2.buatModel, tanggalHariIni: '2026-09-29' });
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
