#!/usr/bin/env node
// Uji asisten AI di BROWSER SUNGGUHAN (Chromium lewat Playwright) terhadap
// situs yang ter-deploy (28 September 2026): login, buka /asisten, kirim SATU
// pertanyaan sungguhan (Gemini sungguhan dipanggil -- berbayar, satu pesan),
// tunggu jawaban, simpan screenshot, cetak teks jawaban + tabel.
//
// ⚠️ LIVE: HANYA akun uji-ceo@koperumnas.local (akun uji, bukan orang
// sungguhan): password sementara + harus_ganti_password=false selama uji,
// dikembalikan ke admin123 + nilai semula lewat pasangPemulih. Percakapan
// yang dibuat SENGAJA dibiarkan (bukti jawaban pertama; tercatat di
// ai_panggilan_alat).
//
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-asisten-browser.mjs "pertanyaan lokal" ["pertanyaan POS"]

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
const PERTANYAAN = process.argv[2] ?? 'Siapa yang belum kirim laporan minggu ini?';
const PERTANYAAN_POS = process.argv[3] ?? null; // opsional, ditanyakan di percakapan KEDUA
// Harapan periode untuk pertanyaan "minggu ini" (opsional, lewat env): mis.
// UJI_MINGGU_INI=2026-09-28..2026-09-29
const PERIODE_HARAPAN = process.env.UJI_MINGGU_INI
  ? (() => {
      const [dari, sampai] = process.env.UJI_MINGGU_INI.split('..');
      const hari = (ymd) => String(Number(ymd.slice(8, 10)));
      // "28-29 Sep", "28 - 29 September", "2026-09-28 s/d 2026-09-29", dst.
      return { periode: 'minggu_ini', dari, sampai, cocok: new RegExp(`(${hari(dari)}\\D{1,12}${hari(sampai)}|${dari})`) };
    })()
  : null;
const SCREENSHOT = process.env.UJI_SCREENSHOT ?? path.join(__dirname, '..', 'asisten-uji.png');
const EMAIL = 'uji-ceo@koperumnas.local';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

const { rows } = await db.query(
  `select u.id, p.harus_ganti_password from auth.users u join public.profile p on p.id = u.id where u.email = $1`,
  [EMAIL],
);
if (rows.length === 0) throw new Error(`${EMAIL} tidak ditemukan`);
const { id, harus_ganti_password: gantiAwal } = rows[0];
const pw = `Uji-${crypto.randomBytes(9).toString('base64url')}`;

const pulihkan = pasangPemulih('uji-asisten-browser', async () => {
  const { error } = await admin.auth.admin.updateUserById(id, { password: 'admin123' });
  if (error) throw new Error(`gagal mengembalikan password ${EMAIL}: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = $2 where id = $1', [id, gantiAwal]);
  console.log(`[pulih] ${EMAIL}: password admin123, harus_ganti_password=${gantiAwal}.`);
  await db.end();
});

let kode = 1;
const browser = await chromium.launch();
try {
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) throw new Error(`reset password gagal: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1', [id]);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE_URL}/masuk`);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(pw);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 20000 });

  await page.goto(`${BASE_URL}/asisten`);
  const kotak = page.locator('#pertanyaan-ai');
  await kotak.waitFor({ state: 'visible', timeout: 20000 });
  const riwayat = page.locator('nav[aria-label="Riwayat percakapan"] button');
  const gelembungTeks = () => page.locator('main section .whitespace-pre-wrap').allInnerTexts();
  const cek = [];
  const catat = (nama, lolos, detail = '') => { cek.push({ nama, lolos }); console.log(`${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${detail ? `  (${detail})` : ''}`); };

  console.log(`Status sebelum kirim: ${await page.locator('form span').first().innerText()}`);
  // Hitung dari database, bukan dari sidebar yang mungkin belum selesai dimuat.
  const jumlahPercakapan = async () => (await db.query('select count(*)::int n from public.ai_percakapan where user_id = $1', [id])).rows[0].n;
  const jumlahRiwayatAwal = await jumlahPercakapan();

  // ─── 1. Satu pertanyaan sungguhan (alat LOKAL) ───────────────────────
  await kotak.fill(PERTANYAAN);
  const mulai = Date.now();
  await page.getByRole('button', { name: 'Kirim', exact: true }).click();
  await page.getByText('Menunggu jawaban...').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.getByText('Menunggu jawaban...').waitFor({ state: 'detached', timeout: 90000 });
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);

  // Next.js punya pengumum rute ber-role=alert yang kosong -- hanya teks yang berisi yang dihitung galat.
  const galat = (await page.locator('[role="alert"]').allInnerTexts()).filter((t) => t.trim() !== '');
  const gelembung = await gelembungTeks();
  const tabel = await page.locator('section[aria-label]').evaluateAll((els) =>
    els.map((el) => ({
      judul: el.getAttribute('aria-label'),
      header: [...el.querySelectorAll('th')].map((t) => t.textContent),
      baris: [...el.querySelectorAll('tbody tr')].slice(0, 8).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)),
      jumlahBaris: el.querySelectorAll('tbody tr').length,
    })),
  );
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-1-jawaban.png'), fullPage: true });

  console.log(`\nPertanyaan: ${PERTANYAAN}`);
  console.log(`Waktu jawab: ${detik} detik`);
  if (galat.length) console.log(`GALAT DI LAYAR: ${galat.join(' | ')}`);
  console.log(`Gelembung:\n${gelembung.map((g) => `  > ${g.replace(/\n/g, '\n    ')}`).join('\n')}`);
  console.log(`Tabel: ${JSON.stringify(tabel, null, 2)}`);
  console.log(`Status sesudah: ${await page.locator('form span').first().innerText()}\n`);
  catat('jawaban muncul tanpa galat (1 pertanyaan + 1 jawaban)', galat.length === 0 && gelembung.length === 2, `${gelembung.length} gelembung`);
  const jawabanPertama = gelembung[1] ?? '';
  const isiJawaban = jawabanPertama.replace(/^Asisten:\s*/, '').trim();
  if (tabel.length > 0) {
    catat('ada tabel -> jawaban SATU kalimat berisi angka', !isiJawaban.includes('\n') && /\d/.test(isiJawaban), JSON.stringify(isiJawaban));
  }
  const semuaSel = tabel.flatMap((t) => t.baris.flat()).join(' ');
  catat('tabel tanpa AKUN UJI', !/AKUN UJI/i.test(semuaSel) && !/AKUN UJI/i.test(isiJawaban));
  const logAlat = (await db.query(
    `select alat, argumen, status, jumlah_baris from public.ai_panggilan_alat where user_id = $1 order by created_at desc limit 3`, [id],
  )).rows;
  console.log(`Log alat (terbaru dulu): ${JSON.stringify(logAlat)}`);
  if (PERIODE_HARAPAN) {
    const a = logAlat.find((l) => l.alat === 'status_laporan' || l.alat === 'presensi')?.argumen ?? {};
    catat(`periode dari server: argumen periode=${PERIODE_HARAPAN.periode} (bukan tanggal hitungan model)`,
      a.periode === PERIODE_HARAPAN.periode || (a.start_date === PERIODE_HARAPAN.dari && a.end_date === PERIODE_HARAPAN.sampai), JSON.stringify(a));
    catat(`jawaban menyebut periode kalender (${PERIODE_HARAPAN.dari} s/d ${PERIODE_HARAPAN.sampai}), bukan jendela bergulir`,
      PERIODE_HARAPAN.cocok.test(isiJawaban), JSON.stringify(isiJawaban));
  }

  // ─── 2. Muat ulang halaman: percakapan tetap ada di riwayat ──────────
  await page.reload();
  await kotak.waitFor({ state: 'visible', timeout: 20000 });
  await riwayat.first().waitFor({ state: 'visible', timeout: 20000 });
  const judulRiwayat = await riwayat.allInnerTexts();
  catat('setelah reload: percakapan baru ada di riwayat, paling atas', judulRiwayat.length === jumlahRiwayatAwal + 1 && judulRiwayat[0] === PERTANYAAN.slice(0, 80),
    JSON.stringify(judulRiwayat.slice(0, 3)));

  await riwayat.first().click();
  await page.locator('main section .whitespace-pre-wrap').nth(1).waitFor({ state: 'visible', timeout: 20000 });
  const setelahReload = await gelembungTeks();
  const tabelSetelahReload = await page.locator('section[aria-label]').count();
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-2-setelah-reload.png'), fullPage: true });
  catat('dibuka dari riwayat: KEDUA pesan (pertanyaan + jawaban yang sama) + tabel tampil lagi',
    setelahReload.length === 2 && setelahReload[0].includes(PERTANYAAN) && setelahReload[1] === jawabanPertama && tabelSetelahReload === tabel.length,
    `${setelahReload.length} gelembung, ${tabelSetelahReload} tabel`);

  // ─── 3. "Chat baru": kosong, percakapan pertama tidak hilang ─────────
  await page.getByRole('button', { name: 'Chat baru', exact: true }).click();
  await page.getByText('Contoh pertanyaan:').waitFor({ state: 'visible', timeout: 10000 });
  const setelahBaru = await gelembungTeks();
  const riwayatSetelahBaru = await riwayat.allInnerTexts();
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-3-chat-baru.png'), fullPage: true });
  catat('Chat baru: layar kosong (nol gelembung, contoh pertanyaan tampil)', setelahBaru.length === 0, `${setelahBaru.length} gelembung`);
  catat('Chat baru: percakapan pertama tetap di riwayat', riwayatSetelahBaru[0] === PERTANYAAN.slice(0, 80), JSON.stringify(riwayatSetelahBaru.slice(0, 2)));

  await riwayat.first().click();
  await page.locator('main section .whitespace-pre-wrap').nth(1).waitFor({ state: 'visible', timeout: 20000 });
  const kembali = await gelembungTeks();
  catat('kembali ke percakapan pertama dari riwayat: masih utuh', kembali.length === 2 && kembali[1] === jawabanPertama);

  // ─── 4. Pertanyaan KEDUA, terpisah: alat POS ─────────────────────────
  if (PERTANYAAN_POS) {
    await page.getByRole('button', { name: 'Chat baru', exact: true }).click();
    await page.getByText('Contoh pertanyaan:').waitFor({ state: 'visible', timeout: 10000 });
    await kotak.fill(PERTANYAAN_POS);
    const mulaiPos = Date.now();
    await page.getByRole('button', { name: 'Kirim', exact: true }).click();
    await page.getByText('Menunggu jawaban...').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.getByText('Menunggu jawaban...').waitFor({ state: 'detached', timeout: 90000 });
    const galatPos = (await page.locator('[role="alert"]').allInnerTexts()).filter((t) => t.trim() !== '');
    const gelembungPos = await gelembungTeks();
    const riwayatAkhir = await riwayat.allInnerTexts();
    await page.screenshot({ path: SCREENSHOT.replace('.png', '-4-pos.png'), fullPage: true });
    console.log(`\nPertanyaan POS: ${PERTANYAAN_POS}`);
    console.log(`Waktu jawab: ${((Date.now() - mulaiPos) / 1000).toFixed(1)} detik`);
    if (galatPos.length) console.log(`GALAT DI LAYAR: ${galatPos.join(' | ')}`);
    console.log(`Gelembung:\n${gelembungPos.map((g) => `  > ${g.replace(/\n/g, '\n    ')}`).join('\n')}`);
    catat('pertanyaan POS dijawab dalam percakapan terpisah', galatPos.length === 0 && gelembungPos.length === 2);
    const jawabanPos = (gelembungPos[1] ?? '').replace(/^Asisten:\s*/, '');
    catat('POS tanpa pemetaan -> "tidak punya akses", BUKAN galat/nol', /akses/i.test(jawabanPos) && !/galat|kesalahan|nol\b|0 bahan/i.test(jawabanPos), JSON.stringify(jawabanPos));
    catat('riwayat kini berisi dua percakapan, pertanyaan pertama tetap ada',
      riwayatAkhir[0] === PERTANYAAN_POS.slice(0, 80) && riwayatAkhir[1] === PERTANYAAN.slice(0, 80), JSON.stringify(riwayatAkhir.slice(0, 2)));
  }

  console.log(`\nScreenshot: ${SCREENSHOT.replace('.png', '-{1,2,3,4}-*.png')}`);
  kode = cek.every((c) => c.lolos) ? 0 : 1;
} catch (e) {
  console.error(`GAGAL: ${e instanceof Error ? e.message : e}`);
} finally {
  await browser.close();
  await pulihkan();
}
process.exit(kode);
