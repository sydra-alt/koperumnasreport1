#!/usr/bin/env node
// ⚠️ LIVE: menulis ke database PRODUKSI (akun uji saja); dipulihkan otomatis lewat scripts/_pengaman-uji.mjs.
// Uji asap PRODUKSI item 1 & 2 (3 Oktober 2026) di browser sungguhan:
//  1. Alat stok: tanya asisten -> kolom harga rata-rata & nilai stok,
//     "belum ada harga" (bukan Rp0), kalimat utama menyebut jumlah tanpa harga.
//  2. Impor opname dengan kolom "harga per satuan": bendera harga (>=3x
//     kuning, >=10x merah, tanpa rata-rata kuning) -> BUKA draf di POS (layar
//     opname, label asal harga) -> BATALKAN draf. TIDAK PERNAH dikonfirmasi.
//  3. Database pos-fnb produksi SEBELUM vs SESUDAH: stok, harga rata-rata,
//     movement, dan riwayat harga rata-rata TIDAK berubah sama sekali.
//
// ⚠️ LIVE: HANYA uji-ceo@koperumnas.local, Gemini sungguhan (dua pesan dari
// jatah). Yang tertinggal SENGAJA: dua percakapan, satu opname_imports
// 'dibatalkan', satu stock_opnames 'cancelled' (riwayat, tanpa stok).
// punya_akses_pos dinyalakan selama uji lalu dipulihkan (_akses-pos-uji.mjs).
// Database pos-fnb dibaca dengan DATABASE_URL dari ../pos-fnb/.env.local
// (tidak pernah dicetak) -- HANYA SELECT.
//
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-harga-browser.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const envPos = dotenv.parse(readFileSync(path.join(__dirname, '..', '..', 'pos-fnb', '.env.local')));

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const SCREENSHOT = path.join(os.tmpdir(), 'koperumnas-uji', 'harga-uji');
mkdirSync(path.dirname(SCREENSHOT.endsWith('.png') ? SCREENSHOT : `${SCREENSHOT}.png`), { recursive: true }); // tangkapan layar = data produksi -> temp OS, tidak pernah di repo
const EMAIL = 'uji-ceo@koperumnas.local';
const OUTLET = 'Indokopi Jatinegara';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const pos = new pg.Client({ connectionString: envPos.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
await pos.connect();
await pos.query('set default_transaction_read_only = on');
const { rows } = await db.query(`select u.id, p.harus_ganti_password from auth.users u join public.profile p on p.id = u.id where u.email = $1`, [EMAIL]);
const { id, harus_ganti_password: gantiAwal } = rows[0];
const pw = `Uji-${crypto.randomBytes(9).toString('base64url')}`;

let pulihAkses = null;
const pulihkan = pasangPemulih('uji-harga-browser', async () => {
  if (pulihAkses) await pulihAkses();
  const { error } = await admin.auth.admin.updateUserById(id, { password: passwordUji(EMAIL) });
  if (error) throw new Error(`gagal mengembalikan password ${EMAIL}: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = $2 where id = $1', [id, gantiAwal]);
  console.log(`[pulih] ${EMAIL}: password dari berkas kredensial uji, harus_ganti_password=${gantiAwal}.`);
  await db.end();
  await pos.end();
});

const hasil = [];
const catat = (nama, lolos, detail = '') => { hasil.push(lolos); console.log(`${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${detail ? `  (${detail})` : ''}`); };

// --- Data produksi (SELECT saja) ---
const [outletPos] = (await pos.query(`select id, business_id from outlets where name = $1 and is_active`, [OUTLET])).rows;
const bisnis = outletPos.business_id;
const level = (await pos.query(
  `select i.id, i.name, i.base_unit, sl.qty_on_hand::text qty, sl.avg_cost::text avg
     from stock_levels sl join ingredients i on i.id = sl.ingredient_id
    where sl.outlet_id = $1 and i.is_active and i.lacak_stok and sl.qty_on_hand > 0
      and i.name !~ '[0-9]' order by i.name`, [outletPos.id],
)).rows;
const berharga = level.filter((l) => Number(l.avg) > 0);
// Tanpa rata-rata: baris stok rata-rata 0 ATAU belum punya baris stok di outlet ini
// (stok 0/tidak ada = tanpa pembanding besaran, jadi bendera hanya dari harga).
const tanpaHarga = (await pos.query(
  `select i.id, i.name, i.base_unit, coalesce(sl.qty_on_hand, 0)::text qty, coalesce(sl.avg_cost, 0)::text avg
     from ingredients i left join stock_levels sl on sl.ingredient_id = i.id and sl.outlet_id = $1
    where i.business_id = $2 and i.is_active and i.lacak_stok and coalesce(sl.avg_cost, 0) = 0 and coalesce(sl.qty_on_hand, 0) <= 0
      and i.name !~ '[0-9]' and i.base_unit in ('gram', 'ml', 'pcs') order by i.name limit 1`, [outletPos.id, outletPos.business_id],
)).rows.map((l) => ({ ...l, qty: '5' }));
if (berharga.length < 3 || tanpaHarga.length < 1) throw new Error(`data ${OUTLET} kurang: ${berharga.length} berharga, ${tanpaHarga.length} tanpa harga`);
// Qty = stok sekarang dan satuan = satuan dasar: bendera HANYA dari harga.
const BARIS = [
  { l: berharga[0], kali: 1, harap: 'Hijau', kenapa: 'harga = rata-rata' },
  { l: berharga[1], kali: 4, harap: 'Kuning', kenapa: 'harga 4x rata-rata', alasan: /harga jauh dari rata-rata/ },
  { l: berharga[2], kali: 12, harap: 'Merah', kenapa: 'harga 12x rata-rata', alasan: /harga tidak masuk akal/ },
  { l: tanpaHarga[0], harga: 1000, harap: 'Kuning', kenapa: 'belum ada rata-rata', alasan: /belum ada harga rata-rata/ },
].map((b) => ({ ...b, nama: b.l.name, qty: Number(b.l.qty), satuan: b.l.base_unit, hargaFile: b.harga ?? Number((Number(b.l.avg) * b.kali).toFixed(4)) }));

async function snapshot() {
  const ids = BARIS.map((b) => b.l.id);
  const [h] = (await pos.query('select count(*)::int n, max(changed_at)::text akhir from stock_avg_cost_changes where business_id = $1', [bisnis])).rows;
  const [m] = (await pos.query('select count(*)::int n from stock_movements where business_id = $1', [bisnis])).rows;
  const sl = (await pos.query('select ingredient_id, outlet_id, qty_on_hand::text q, avg_cost::text a from stock_levels where business_id = $1 order by 1, 2', [bisnis])).rows;
  return { riwayat: h.n, riwayatAkhir: h.akhir, movement: m.n, stok: JSON.stringify(sl), bahan: ids.length };
}

async function buatFile() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Opname');
  ws.addRow(['Nama Bahan', 'Jumlah', 'Satuan', 'Harga per satuan']);
  for (const b of BARIS) ws.addRow([b.nama, b.qty, b.satuan, b.hargaFile]);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uji-harga-'));
  const file = path.join(dir, 'opname-harga-uji.xlsx');
  writeFileSync(file, Buffer.from(await wb.xlsx.writeBuffer()));
  return file;
}

async function pesanTerakhir() {
  return (await db.query(
    `select m.isi, m.tabel from ai_pesan m join ai_percakapan p on p.id = m.percakapan_id
     where p.user_id = $1 and m.peran = 'model' order by m.created_at desc limit 1`, [id],
  )).rows[0];
}

const sebelum = await snapshot();
console.log(`Sebelum: ${sebelum.riwayat} baris riwayat rata-rata (terakhir ${sebelum.riwayatAkhir}), ${sebelum.movement} movement.`);
const browser = await chromium.launch();
try {
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
  if (error) throw new Error(`reset password gagal: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1', [id]);
  pulihAkses = await aksesPosUjiSementara(db, EMAIL);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE_URL}/masuk`);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(pw);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 20000 });
  await page.goto(`${BASE_URL}/asisten`);

  // --- 1. Alat stok ---
  const kotak = page.locator('#pertanyaan-ai');
  await kotak.waitFor({ state: 'visible', timeout: 20000 });
  // Semua outlet: Jatinegara semua berharga, Cempaka Putih belum (3 Oktober 2026) -- dua kasus sekaligus.
  await kotak.fill('Stok bahan di semua outlet sekarang, dengan harga rata-rata dan nilai stoknya');
  await page.getByRole('button', { name: 'Kirim', exact: true }).click();
  await page.getByText('Menunggu jawaban...').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.getByText('Menunggu jawaban...').waitFor({ state: 'detached', timeout: 90000 });
  const stok = await pesanTerakhir();
  const tStok = stok.tabel?.find((t) => t.judul === 'Stok bahan');
  console.log(`Jawaban stok: ${stok.isi.slice(0, 400)}`);
  catat('alat stok: kolom Harga rata-rata & Nilai stok', Boolean(tStok?.kolom.some((k) => k.key === 'harga_rata') && tStok?.kolom.some((k) => k.key === 'nilai_stok')), tStok?.kolom.map((k) => k.label).join(', '));
  const nolRp = tStok?.baris.filter((b) => b.nilai_stok === 0 || b.harga_rata === 0) ?? [];
  const belum = tStok?.baris.filter((b) => b.harga_rata === 'belum ada harga') ?? [];
  catat('alat stok: tanpa harga -> "belum ada harga", tidak ada Rp0 dari biaya 0', belum.length > 0 && nolRp.length === 0, `${belum.length} baris belum ada harga, ${nolRp.length} baris 0`);
  catat('alat stok: jawaban menyebut jumlah "belum ada harga"', /belum ada harga/.test(stok.isi), '');
  await page.screenshot({ path: `${SCREENSHOT}-stok.png`, fullPage: true });

  // --- 2. Impor opname dengan harga --- (UJI_HANYA_STOK=1: lewati, tanpa draf baru)
  if (process.env.UJI_HANYA_STOK === '1') throw new Error('LEWATI_IMPOR');
  await page.getByRole('button', { name: 'Impor opname (Excel)' }).click();
  const pilih = page.locator('#impor-outlet');
  await pilih.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#impor-outlet option').length > 1, null, { timeout: 30000 });
  await pilih.selectOption({ label: OUTLET });
  await page.locator('#impor-file').setInputFiles(await buatFile());
  await page.getByRole('button', { name: 'Baca dan cocokkan' }).click();
  await page.getByRole('button', { name: 'Membaca file...' }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: 'Membaca file...' }).waitFor({ state: 'detached', timeout: 90000 });
  const galat = (await page.locator('[role="alert"]').allInnerTexts()).filter((t) => t.trim() !== '');
  catat('impor selesai tanpa galat di layar', galat.length === 0, galat.join(' | '));
  const imp = await pesanTerakhir();
  console.log(`Ringkasan impor: ${imp.isi}`);
  const tImp = imp.tabel?.[0];
  catat('ringkasan menyebut baris berharga + "setelah draf dikonfirmasi"', /4 baris membawa harga per satuan/.test(imp.isi), imp.isi.slice(0, 160));
  for (const b of BARIS) {
    const r = tImp?.baris.find((x) => x.nama_file === b.nama);
    console.log(`  ${r?.bendera ?? '-'}  ${b.nama} @ ${b.hargaFile}/${b.satuan} (rata-rata ${b.l.avg}): ${r?.alasan || '(tanpa alasan)'}`);
    catat(`${b.nama} -> ${b.harap} (${b.kenapa})`, r?.bendera === b.harap && (!b.alasan || b.alasan.test(r?.alasan ?? '')), r ? `${r.bendera}; ${r.alasan}` : 'baris tidak ada');
  }
  await page.screenshot({ path: `${SCREENSHOT}-impor.png`, fullPage: true });

  // --- Buka draf di POS (handoff) -> periksa -> BATALKAN, tidak dikonfirmasi ---
  const tautan = page.locator('a[href^="/api/pos-handoff?next="]').last();
  await tautan.waitFor({ state: 'visible', timeout: 20000 });
  const [posPage] = await Promise.all([page.context().waitForEvent('page', { timeout: 20000 }).catch(() => null), tautan.click()]);
  const p2 = posPage ?? page;
  await p2.waitForURL((u) => u.pathname.startsWith('/stock-opnames'), { timeout: 60000 });
  await p2.getByText('Dari impor Excel:').first().waitFor({ state: 'visible', timeout: 60000 });
  const teksPos = await p2.locator('body').innerText();
  catat('draf POS terbuka dari impor (panel impor)', /Dari impor Excel: opname-harga-uji\.xlsx/.test(teksPos));
  const labelImpor = await p2.getByText('dari file impor', { exact: true }).count();
  catat('harga dari file berlabel "dari file impor" di draf (baris non-merah)', labelImpor === 3, `${labelImpor} label`);
  const daftarLama = await p2.getByText('harga daftar lama', { exact: true }).count();
  console.log(`Label "harga daftar lama" di draf: ${daftarLama} baris (0 = produksi tanpa harga material.csv).`);
  await p2.screenshot({ path: `${SCREENSHOT}-draf-pos.png`, fullPage: true });
  await p2.getByRole('button', { name: 'Batalkan', exact: true }).first().click();
  await p2.getByRole('dialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
  await p2.getByText('Mulai Sesi Baru').waitFor({ state: 'visible', timeout: 30000 });
  const [opImp] = (await pos.query(
    `select oi.status, o.status opname_status from opname_imports oi left join stock_opnames o on o.id = oi.opname_id
      where oi.business_id = $1 and oi.file_name = 'opname-harga-uji.xlsx' order by oi.created_at desc limit 1`, [bisnis],
  )).rows;
  catat('draf dibatalkan (tidak dikonfirmasi): impor dibatalkan, opname cancelled', opImp?.status === 'dibatalkan' && opImp?.opname_status === 'cancelled', JSON.stringify(opImp));
} catch (e) {
  if (!(e instanceof Error && e.message === 'LEWATI_IMPOR')) catat('skrip selesai tanpa galat', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  const sesudah = await snapshot();
  console.log(`Sesudah: ${sesudah.riwayat} baris riwayat rata-rata (terakhir ${sesudah.riwayatAkhir}), ${sesudah.movement} movement.`);
  catat('riwayat harga rata-rata: TIDAK ada baris baru', sesudah.riwayat === sebelum.riwayat && sesudah.riwayatAkhir === sebelum.riwayatAkhir, `${sebelum.riwayat} -> ${sesudah.riwayat}`);
  catat('stok & harga rata-rata semua bahan: TIDAK berubah', sesudah.stok === sebelum.stok);
  catat('movement stok: TIDAK ada yang baru', sesudah.movement === sebelum.movement, `${sebelum.movement} -> ${sesudah.movement}`);
  await pulihkan();
}
process.exit(hasil.length > 0 && hasil.every(Boolean) ? 0 : 1);
