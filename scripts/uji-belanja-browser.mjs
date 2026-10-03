#!/usr/bin/env node
// Uji impor belanja dari FOTO nota di browser sungguhan (3 Oktober 2026).
// BUTUH migrasi 0055 diterapkan + pos-fnb & sistem laporan ter-deploy.
//
// Alur: skrip MENGGAMBAR nota belanja (HTML -> tangkapan layar PNG) dengan
// bahan sungguhan Jatinegara + satu barang yang tidak ada di master + total
// nota yang SENGAJA beda -> login uji-ceo -> /asisten -> "Impor belanja (foto
// nota)" -> outlet, tanggal, pembelanja -> "Baca dan cocokkan" -> periksa:
// tidak ada baris hijau, barang tak dikenal merah, peringatan total nota
// dengan KEDUA angka, tautan HANYA /purchases?import=<uuid> -> buka draf di
// POS (foto tampil, outlet per baris, tanggal) -> BATALKAN impor.
// TIDAK PERNAH dikonfirmasi: stok, rata-rata, movement, harga terakhir, dan
// riwayat rata-rata dibandingkan sebelum-sesudah (harus sama persis).
//
// ⚠️ LIVE: HANYA uji-ceo@koperumnas.local, Gemini sungguhan (satu pesan).
// Yang tertinggal SENGAJA: satu percakapan, satu purchase_imports
// 'dibatalkan' + fotonya (riwayat, tanpa stok). punya_akses_pos dipulihkan.
// Database pos-fnb hanya dibaca (DATABASE_URL dari ../pos-fnb/.env.local).
//
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-belanja-browser.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { pasangPemulih } from './_pengaman-uji.mjs';
import { aksesPosUjiSementara } from './_akses-pos-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
const envPos = dotenv.parse(readFileSync(path.join(__dirname, '..', '..', 'pos-fnb', '.env.local')));

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const SCREENSHOT = path.join(__dirname, '..', 'belanja-uji');
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
const pulihkan = pasangPemulih('uji-belanja-browser', async () => {
  if (pulihAkses) await pulihAkses();
  const { error } = await admin.auth.admin.updateUserById(id, { password: 'admin123' });
  if (error) throw new Error(`gagal mengembalikan password ${EMAIL}: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = $2 where id = $1', [id, gantiAwal]);
  console.log(`[pulih] ${EMAIL}: password admin123, harus_ganti_password=${gantiAwal}.`);
  await db.end();
  await pos.end();
});

const hasil = [];
const catat = (nama, lolos, detail = '') => { hasil.push(lolos); console.log(`${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${detail ? `  (${detail})` : ''}`); };

// --- Data produksi (SELECT saja): dua bahan berharga di Jatinegara, harga wajar ---
const [outletPos] = (await pos.query(`select id, business_id from outlets where name = $1 and is_active`, [OUTLET])).rows;
const bisnis = outletPos.business_id;
const bahan = (await pos.query(
  `select i.name, i.base_unit, sl.avg_cost::float avg from stock_levels sl join ingredients i on i.id = sl.ingredient_id
    where sl.outlet_id = $1 and i.is_active and i.lacak_stok and sl.avg_cost > 0 and i.base_unit in ('gram', 'ml')
      and i.name !~ '[0-9/]' order by i.name limit 2`, [outletPos.id],
)).rows;
if (bahan.length < 2) throw new Error('bahan berharga Jatinegara kurang dari 2');
// 1 kg / 1 liter dengan harga = rata-rata x 1000 -> x1000 (kuning), harga dekat rata-rata.
const NOTA = [
  ...bahan.map((b) => ({ nama: b.name, qty: '1', satuan: b.base_unit === 'gram' ? 'kg' : 'liter', total: Math.round(b.avg * 1000) })),
  { nama: 'Barang Uji Tidak Ada', qty: '2', satuan: 'pcs', total: 7000 },
];
const jumlahBaris = NOTA.reduce((s, n) => s + n.total, 0);
const TOTAL_NOTA = jumlahBaris + 5000; // sengaja beda
const rupiah = (n) => n.toLocaleString('id-ID');

async function snapshot() {
  const [h] = (await pos.query('select count(*)::int n from stock_avg_cost_changes where business_id = $1', [bisnis])).rows;
  const [m] = (await pos.query('select count(*)::int n from stock_movements where business_id = $1', [bisnis])).rows;
  const [p] = (await pos.query('select count(*)::int n from ingredient_price_changes where business_id = $1', [bisnis])).rows;
  const sl = (await pos.query('select ingredient_id, outlet_id, qty_on_hand::text q, avg_cost::text a from stock_levels where business_id = $1 order by 1, 2', [bisnis])).rows;
  return { riwayat: h.n, movement: m.n, harga: p.n, stok: JSON.stringify(sl) };
}

const sebelum = await snapshot();
const browser = await chromium.launch();
try {
  // Gambar nota (tulisan seperti struk) -> PNG.
  const kanvas = await browser.newPage({ viewport: { width: 700, height: 520 } });
  await kanvas.setContent(`<body style="font:22px 'Courier New',monospace;background:#fbfaf3;padding:28px;color:#222">
    <div style="text-align:center;font-weight:bold">TOKO SUMBER REJEKI</div><div style="text-align:center">Nota belanja</div><hr>
    ${NOTA.map((n, i) => `<div style="display:flex;justify-content:space-between"><span>${i + 1}. ${n.nama} ${n.qty} ${n.satuan}</span><span>${rupiah(n.total)}</span></div>`).join('')}
    <hr><div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>${rupiah(TOTAL_NOTA)}</span></div></body>`);
  const foto = path.join(mkdtempSync(path.join(os.tmpdir(), 'uji-belanja-')), 'nota.png');
  await kanvas.screenshot({ path: foto });
  await kanvas.close();

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

  // UJI_IMPORT_ID: lanjutkan impor yang SUDAH dibuat (mis. uji sebelumnya berhenti sesudah unggah) --
  // tanpa unggah/Gemini baru; hasil dibaca dari pesan tersimpan, lalu draf dibuka & dibatalkan.
  const lanjut = process.env.UJI_IMPORT_ID;
  if (!lanjut) {
  await page.getByRole('button', { name: 'Impor belanja (foto nota)' }).click();
  const pilih = page.locator('#belanja-outlet');
  await pilih.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#belanja-outlet option').length > 1, null, { timeout: 30000 });
  const opsi = (await pilih.locator('option').allInnerTexts()).filter((t) => t !== 'Pilih outlet');
  catat('daftar outlet dari pos-fnb (aktif, dalam cakupan) muncul; Gudang tidak', opsi.includes(OUTLET) && !opsi.some((o) => /gudang/i.test(o)), opsi.join(', '));
  await pilih.selectOption({ label: OUTLET });
  await page.locator('#belanja-foto').setInputFiles(foto);
  await page.locator('#belanja-pembelanja').fill('Uji Otomatis');
  const mulai = Date.now();
  await page.getByRole('button', { name: 'Baca dan cocokkan' }).click();
  await page.getByRole('button', { name: /Menyiapkan foto|Membaca nota/ }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  // Sukses = panel tertutup & tautan draf muncul; gagal = galat tampil di panel.
  await Promise.race([
    page.locator('a[href*="purchases%3Fimport"]').first().waitFor({ state: 'visible', timeout: 120000 }),
    page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 120000 }),
  ]);
  console.log(`Waktu baca: ${((Date.now() - mulai) / 1000).toFixed(1)} detik`);
  const galat = (await page.locator('[role="alert"]').allInnerTexts()).filter((t) => t.trim() !== '');
  catat('impor selesai tanpa galat di layar', galat.length === 0, galat.join(' | '));
  }

  const pesan = (await db.query(
    `select m.isi, m.tabel from ai_pesan m join ai_percakapan p on p.id = m.percakapan_id
     where p.user_id = $1 and m.peran = 'model' order by m.created_at desc limit 1`, [id],
  )).rows[0];
  console.log(`Ringkasan: ${pesan.isi}`);
  const tabel = pesan.tabel?.[0];
  catat('tidak ada baris hijau', tabel?.baris.every((b) => b.bendera !== 'Hijau'), tabel?.baris.map((b) => b.bendera).join());
  catat('peringatan total nota dengan KEDUA angka', pesan.isi.includes(`Rp${rupiah(TOTAL_NOTA)}`) && pesan.isi.includes(`Rp${rupiah(jumlahBaris)}`), pesan.isi.slice(0, 200));
  const asing = tabel?.baris.find((b) => /Barang Uji/i.test(b.nama_foto));
  catat('barang tidak ada di master -> merah', asing?.bendera === 'Merah', asing ? `${asing.bendera}; ${asing.alasan}` : 'tidak terbaca');
  for (const b of bahan) {
    const r = tabel?.baris.find((x) => x.bahan === b.name);
    catat(`${b.name} 1 ${b.base_unit === 'gram' ? 'kg' : 'liter'} -> kuning (x1000, harga dekat rata-rata)`, r?.bendera === 'Kuning' && /x1000/.test(r?.alasan ?? ''), r ? `${r.bendera}; ${r.alasan}` : 'tidak cocok');
  }
  await page.screenshot({ path: `${SCREENSHOT}-asisten.png`, fullPage: true });

  const hrefTabel = tabel?.tautan?.href ?? '';
  const next = decodeURIComponent(hrefTabel.split('next=')[1] ?? '');
  catat('tautan HANYA /purchases?import=<uuid>', /^\/purchases\?import=[0-9a-f-]{36}$/i.test(next), next);
  if (lanjut) catat('pesan tersimpan milik impor yang dilanjutkan', next.endsWith(lanjut), next);
  let posPage = null;
  if (lanjut) await page.goto(`${BASE_URL}${hrefTabel}`);
  else {
    const tautan = page.locator('a[href^="/api/pos-handoff?next="]').last();
    [posPage] = await Promise.all([page.context().waitForEvent('page', { timeout: 20000 }).catch(() => null), tautan.click()]);
  }
  const p2 = posPage ?? page;
  await p2.waitForURL((u) => u.pathname.startsWith('/purchases'), { timeout: 60000 });
  await p2.getByText('Ikut disimpan').first().waitFor({ state: 'visible', timeout: 60000 });
  catat('draf POS: foto nota tampil (URL bertanda tangan, bucket privat)', (await p2.locator('img[alt="Foto nota belanja"]').count()) === 1);
  catat('draf POS: peringatan total nota tampil', (await p2.getByText(/Total di nota/).count()) > 0);
  catat('draf POS: tiap baris punya pilihan outlet', (await p2.locator('select').filter({ hasText: OUTLET }).count()) >= NOTA.length);
  await p2.screenshot({ path: `${SCREENSHOT}-draf-pos.png`, fullPage: true });
  await p2.getByRole('button', { name: 'Batalkan impor' }).first().click();
  await p2.getByRole('dialog').getByRole('button', { name: 'Batalkan impor' }).click();
  await p2.getByText('Dibatalkan').first().waitFor({ state: 'visible', timeout: 30000 });
  const importId = next.split('import=')[1];
  const [imp] = (await pos.query('select status from purchase_imports where id = $1', [importId])).rows;
  catat('impor dibatalkan, TIDAK dikonfirmasi', imp?.status === 'dibatalkan', imp?.status);
} catch (e) {
  catat('skrip selesai tanpa galat', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  const sesudah = await snapshot();
  catat('stok & rata-rata: TIDAK berubah', sesudah.stok === sebelum.stok);
  catat('movement, harga terakhir, riwayat rata-rata: TIDAK bertambah', sesudah.movement === sebelum.movement && sesudah.harga === sebelum.harga && sesudah.riwayat === sebelum.riwayat,
    `${sebelum.movement}/${sebelum.harga}/${sebelum.riwayat} -> ${sesudah.movement}/${sesudah.harga}/${sesudah.riwayat}`);
  await pulihkan();
}
process.exit(hasil.length > 0 && hasil.every(Boolean) ? 0 : 1);
