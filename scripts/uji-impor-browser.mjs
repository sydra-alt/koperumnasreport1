#!/usr/bin/env node
// ⚠️ LIVE: menulis ke database PRODUKSI (akun uji saja); dipulihkan otomatis lewat scripts/_pengaman-uji.mjs.
// Uji impor opname Excel di BROWSER SUNGGUHAN terhadap produksi (29
// September 2026): login -> /asisten -> "Impor opname (Excel)" -> pilih
// outlet -> unggah .xlsx buatan skrip -> "Baca dan cocokkan" -> bendera per
// baris harus PERSIS aturan (match.ts pos-fnb, koreksi CEO 29 September).
//
// Berhenti SEBELUM "Buka draf": mengeklik membuat draf opname sungguhan di
// outlet produksi (bisa mengganggu opname staf). Membuka draf + cakupan
// tautan diuji di pos-fnb (src/lib/opname-import/__tests__/opname-import.test.ts).
//
// ⚠️ LIVE: HANYA akun uji-ceo@koperumnas.local. Gemini sungguhan (satu pesan
// dari jatah). Yang tertinggal SENGAJA: satu percakapan "Impor opname: ..."
// dan satu baris opname_imports status 'menunggu' (riwayat, tanpa stok).
// punya_akses_pos dinyalakan selama uji lalu dipulihkan (_akses-pos-uji.mjs).
//
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-impor-browser.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { pasangPemulih } from './_pengaman-uji.mjs';
import { passwordUji } from './_kredensial-uji.mjs';
import { aksesPosUjiSementara } from './_akses-pos-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const SCREENSHOT = process.env.UJI_SCREENSHOT ?? path.join(os.tmpdir(), 'koperumnas-uji', 'impor-uji.png');
mkdirSync(path.dirname(SCREENSHOT.endsWith('.png') ? SCREENSHOT : `${SCREENSHOT}.png`), { recursive: true }); // tangkapan layar = data produksi -> temp OS, tidak pernah di repo
const EMAIL = 'uji-ceo@koperumnas.local';
const OUTLET = 'Indokopi Jatinegara';

// Satu baris per aturan. Harapan dihitung dari master & stok Jatinegara
// (29 September: Berry Blend 1448 g, Biji kopi 1440 g, Bubuk Avocado 1033 g,
// Beras 8160 g, Aqua 59 pcs, Cuka tanpa baris stok).
const BARIS = [
  { nama: 'Berry Blend', qty: 1500, satuan: 'gram', harap: 'Hijau', kenapa: 'persis + satuan sama' },
  { nama: 'Biji kopi / Gram', qty: 1.4, satuan: 'kg', harap: 'Kuning', kenapa: 'konversi kg -> gram' },
  { nama: 'Bubuk Avocado', qty: 1000, satuan: null, harap: 'Kuning', kenapa: 'satuan kosong, stok > 0', alasan: /dianggap gram/ },
  { nama: 'Cuka', qty: 2, satuan: null, harap: 'Merah', kenapa: 'satuan kosong, tanpa stok', alasan: /dianggap botol/ },
  { nama: 'Beras/ gram', qty: 8, satuan: 'gram', harap: 'Merah', kenapa: '>= 100x stok', alasan: /tidak masuk akal/ },
  { nama: 'Aqua/ pcs', qty: 5, satuan: 'pcs', harap: 'Kuning', kenapa: '>= 10x stok', alasan: /jauh dari stok/ },
  { nama: 'Bahan Uji Tidak Ada', qty: 3, satuan: 'pcs', harap: 'Merah', kenapa: 'tidak ada di master', alasan: /tidak ada di master/ },
];

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
const { rows } = await db.query(`select u.id, p.harus_ganti_password from auth.users u join public.profile p on p.id = u.id where u.email = $1`, [EMAIL]);
const { id, harus_ganti_password: gantiAwal } = rows[0];
const pw = `Uji-${crypto.randomBytes(9).toString('base64url')}`;

let pulihAkses = null;
const pulihkan = pasangPemulih('uji-impor-browser', async () => {
  if (pulihAkses) await pulihAkses();
  const { error } = await admin.auth.admin.updateUserById(id, { password: passwordUji(EMAIL) });
  if (error) throw new Error(`gagal mengembalikan password ${EMAIL}: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = $2 where id = $1', [id, gantiAwal]);
  console.log(`[pulih] ${EMAIL}: password dari berkas kredensial uji, harus_ganti_password=${gantiAwal}.`);
  await db.end();
});

const hasil = [];
const catat = (nama, lolos, detail = '') => { hasil.push(lolos); console.log(`${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${detail ? `  (${detail})` : ''}`); };

async function buatFile() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Opname');
  ws.addRow(['Nama Bahan', 'Jumlah', 'Satuan']);
  for (const b of BARIS) ws.addRow([b.nama, b.qty, b.satuan ?? '']);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uji-impor-'));
  const file = path.join(dir, 'opname-uji-jatinegara.xlsx');
  writeFileSync(file, Buffer.from(await wb.xlsx.writeBuffer()));
  return file;
}

const browser = await chromium.launch();
try {
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) throw new Error(`reset password gagal: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1', [id]);
  pulihAkses = await aksesPosUjiSementara(db, EMAIL);
  const file = await buatFile();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE_URL}/masuk`);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(pw);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 20000 });
  await page.goto(`${BASE_URL}/asisten`);

  await page.getByRole('button', { name: 'Impor opname (Excel)' }).click();
  const pilih = page.locator('#impor-outlet');
  await pilih.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#impor-outlet option').length > 1, null, { timeout: 30000 });
  const opsi = (await pilih.locator('option').allInnerTexts()).filter((t) => t !== 'Pilih outlet');
  console.log(`outlet yang boleh diimpor: ${opsi.join(', ')}`);
  catat('daftar outlet dari pos-fnb (cakupan penanya) muncul', opsi.includes(OUTLET), opsi.join(', '));
  await pilih.selectOption({ label: OUTLET });
  await page.locator('#impor-file').setInputFiles(file);

  const mulai = Date.now();
  await page.getByRole('button', { name: 'Baca dan cocokkan' }).click();
  await page.getByRole('button', { name: 'Membaca file...' }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: 'Membaca file...' }).waitFor({ state: 'detached', timeout: 90000 });
  console.log(`Waktu baca: ${((Date.now() - mulai) / 1000).toFixed(1)} detik`);
  const galat = (await page.locator('[role="alert"]').allInnerTexts()).filter((t) => t.trim() !== '');
  catat('impor selesai tanpa galat di layar', galat.length === 0, galat.join(' | '));

  const tautan = page.locator('a[href^="/api/pos-handoff?next="]');
  await tautan.first().waitFor({ state: 'visible', timeout: 20000 });
  const href = await tautan.first().getAttribute('href');
  const next = decodeURIComponent(href.split('next=')[1] ?? '');
  catat('tautan "Buka draf" HANYA /stock-opnames?import=<uuid>', /^\/stock-opnames\?import=[0-9a-f-]{36}$/i.test(next), next);
  await page.screenshot({ path: SCREENSHOT, fullPage: true });

  // Hasil tersimpan (sumber yang sama dengan yang digambar layar).
  const pesan = (await db.query(
    `select m.isi, m.tabel from ai_pesan m join ai_percakapan p on p.id = m.percakapan_id
     where p.user_id = $1 and m.peran = 'model' order by m.created_at desc limit 1`, [id],
  )).rows[0];
  console.log(`Ringkasan: ${pesan.isi}`);
  const tabel = pesan.tabel?.[0];
  catat('ringkasan: 1 hijau, 3 kuning, 3 merah', /1 hijau, 3 kuning, 3 merah/.test(pesan.isi), pesan.isi.slice(0, 120));
  for (const b of BARIS) {
    const r = tabel?.baris.find((x) => x.nama_file === b.nama);
    console.log(`  ${r?.bendera ?? '-'}  ${b.nama}: ${r?.alasan || '(tanpa alasan)'}`);
    catat(`${b.nama} -> ${b.harap} (${b.kenapa})`, r?.bendera === b.harap && (!b.alasan || b.alasan.test(r?.alasan ?? '')), r ? `${r.bendera}; ${r.alasan}` : 'baris tidak ada');
  }
  const log = (await db.query(
    `select a.alat, a.status, a.jumlah_baris from ai_panggilan_alat a join ai_percakapan p on p.id = a.percakapan_id
     where p.user_id = $1 order by a.created_at desc limit 1`, [id],
  )).rows[0];
  catat('panggilan tercatat di ai_panggilan_alat (impor_opname, ok)', log?.alat === 'impor_opname' && log?.status === 'ok', JSON.stringify(log));
  console.log(`Screenshot: ${SCREENSHOT}`);
} catch (e) {
  catat('skrip selesai tanpa galat', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  await pulihkan();
}
process.exit(hasil.length > 0 && hasil.every(Boolean) ? 0 : 1);
