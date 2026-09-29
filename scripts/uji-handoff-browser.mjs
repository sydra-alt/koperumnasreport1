#!/usr/bin/env node
// Uji "Buka Dashboard Toko" di BROWSER SUNGGUHAN terhadap produksi (29
// September 2026): login di laporan -> klik tombol -> tab baru harus mendarat
// DI pos-fnb (bukan localhost, bukan /login, bukan /handoff/gagal) dengan sesi
// sungguhan, peran & outlet sesuai akses yang dihitung laporan, dan tetap
// masuk saat dibuka lagi (tidak ada login kedua).
//
// ⚠️ LIVE: HANYA akun uji-ceo@koperumnas.local (akun uji): password sementara
// + harus_ganti_password=false selama uji, dipulihkan lewat pasangPemulih.
// Membership pos-fnb uji-ceo@koperumnas.com IKUT DISESUAIKAN oleh
// provisioning -- itu memang yang diuji.
//
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-handoff-browser.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { pasangPemulih } from './_pengaman-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const POS_HOST = new URL(process.env.POS_INTEGRASI_URL ?? 'https://pos-fnb.badarbaradja112.workers.dev').host;
const SCREENSHOT = process.env.UJI_SCREENSHOT ?? path.join(__dirname, '..', 'handoff-uji.png');
const EMAIL = 'uji-ceo@koperumnas.local';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
const { rows } = await db.query(`select u.id, p.harus_ganti_password from auth.users u join public.profile p on p.id = u.id where u.email = $1`, [EMAIL]);
const { id, harus_ganti_password: gantiAwal } = rows[0];
const pw = `Uji-${crypto.randomBytes(9).toString('base64url')}`;

const pulihkan = pasangPemulih('uji-handoff-browser', async () => {
  const { error } = await admin.auth.admin.updateUserById(id, { password: 'admin123' });
  if (error) throw new Error(`gagal mengembalikan password ${EMAIL}: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = $2 where id = $1', [id, gantiAwal]);
  console.log(`[pulih] ${EMAIL}: password admin123, harus_ganti_password=${gantiAwal}.`);
  await db.end();
});

const hasil = [];
const catat = (nama, lolos, detail = '') => { hasil.push(lolos); console.log(`${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch();
try {
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) throw new Error(`reset password gagal: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1', [id]);

  // Akses yang DIHITUNG laporan untuk orang ini (penyamaran di transaksi baca, di-ROLLBACK).
  await db.query('begin');
  await db.query(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [id]);
  await db.query(`select set_config('role', 'authenticated', true)`);
  const akses = (await db.query('select public.akses_pos_saya() as a')).rows[0].a;
  await db.query('rollback');
  console.log(`akses dihitung laporan: ${JSON.stringify(akses)}`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/masuk`);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(pw);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 20000 });
  await page.goto(`${BASE_URL}/`);

  const tombol = page.locator('a[href="/api/pos-handoff"]');
  await tombol.waitFor({ state: 'visible', timeout: 20000 });
  const [tab] = await Promise.all([context.waitForEvent('page'), tombol.click()]);
  await tab.waitForLoadState('load', { timeout: 30000 });
  await tab.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const akhir = new URL(tab.url());
  console.log(`mendarat di: ${akhir.host}${akhir.pathname}${akhir.search ? '?' + [...akhir.searchParams.keys()].join('&') : ''}`);
  await tab.screenshot({ path: SCREENSHOT, fullPage: true });

  catat('mendarat di pos-fnb (bukan localhost / laporan)', akhir.host === POS_HOST, akhir.host);
  catat('bukan halaman login atau gagal', !akhir.pathname.startsWith('/login') && !akhir.pathname.startsWith('/handoff'), akhir.pathname);
  const kue = (await context.cookies(`https://${POS_HOST}`)).map((c) => c.name);
  catat('cookie sesi Supabase pos-fnb terpasang', kue.some((n) => /^sb-.*-auth-token/.test(n)), kue.join(','));
  const teks = (await tab.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  console.log(`isi halaman (awal): ${teks}`);

  // Dibuka lagi di tab yang sama -> tetap masuk (tidak ada login kedua).
  await tab.goto(`https://${POS_HOST}/`);
  await tab.waitForLoadState('load');
  catat('dibuka lagi: tetap masuk, tidak diminta login', !new URL(tab.url()).pathname.startsWith('/login'), new URL(tab.url()).pathname);

  // Membership pos-fnb sesudah provisioning = persis akses laporan.
  const posDb = new pg.Client({ connectionString: process.env.POS_DATABASE_URL_UJI });
  if (process.env.POS_DATABASE_URL_UJI) {
    await posDb.connect();
    const m = (await posDb.query(
      `select m.role, m.outlet_ids, m.audit_all_outlets from memberships m join report_identity_links l on l.pos_profile_id = m.user_id join businesses b on b.id = m.business_id where l.report_email = $1 and b.name = 'Koperumnas Group'`,
      [EMAIL],
    )).rows[0];
    await posDb.end();
    console.log(`membership pos-fnb: ${JSON.stringify(m)}`);
    catat('membership pos-fnb sesuai akses laporan (peran, outlet, audit)',
      m && m.role === akses.peran_pos && (akses.semua_outlet ? m.outlet_ids === null : JSON.stringify([...m.outlet_ids].sort()) === JSON.stringify([...akses.outlet_pos_ids].sort())) &&
        m.audit_all_outlets === akses.audit_semua, JSON.stringify(m));
  }
  console.log(`Screenshot: ${SCREENSHOT}`);
} catch (e) {
  catat('skrip selesai tanpa galat', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  await pulihkan();
}
process.exit(hasil.length > 0 && hasil.every(Boolean) ? 0 : 1);
