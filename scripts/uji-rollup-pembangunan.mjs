#!/usr/bin/env node
// Verifikasi POSITIF (pelengkap uji-rls-gap-pembangunan.mjs yang membuktikan
// kasus NEGATIF): bagi role yang MEMANG diberi akses can_see_report ke
// pic_lokasi (ceo/pusat), apakah query yang dipakai useRekapPicLokasi()
// (lib/api/pembangunan.ts) benar-benar mengembalikan data yang cocok dengan
// yang dikirim PIC, dan apakah parsing asInt/asBool/asStr-nya benar?
// SEKALI PAKAI, dibungkus BEGIN...ROLLBACK.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
function q(sql, params) { return client.query(sql, params); }
async function jadiSebagai(uuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true);`, [uuid]);
  const r = await q('select auth.uid() as siapa;');
  if (r.rows[0].siapa !== uuid) throw new Error('Penyamaran gagal');
}
function langkah(j) { console.log(`\n── ${j} ──`); }
function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}

// Replika persis fungsi parsing di lib/api/pembangunan.ts.
function asInt(v) { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function asBool(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'ya' || v === 'true') return true;
  if (v === 'tidak' || v === 'false') return false;
  return null;
}
function asStr(v) { if (v == null || v === '') return null; return String(v); }

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  const { rows: dadangRows } = await q(`select id from profile where nama='Dadang';`);
  const { rows: putriRows } = await q(`select id from profile where nama='Putri';`);
  const dadang = dadangRows[0].id;
  const putri = putriRows[0].id;
  const { rows: tajurRows } = await q(`select id from lokasi where nama='Tajur';`);
  const tajur = tajurRows[0].id;

  langkah('SETUP — Dadang kirim laporan pic_lokasi (Tajur) dengan data unit/material/infra');
  await q('set local role authenticated;');
  await jadiSebagai(dadang);
  const dataDikirim = {
    target_unit: 10,
    unit_dibangun: 4,
    unit_finishing: 2,
    unit_selesai: 1,
    unit_belum_mulai: 3,
    material_cukup: 'tidak',
    material_kurang: [{ material: 'Semen', kebutuhan: '50 sak', untuk_unit: 'Blok A', dibutuhkan_tanggal: 'besok' }],
    kiriman_precast_jumlah: 12,
    kiriman_kekurangan: 'Kurang 3 pcs',
    jalan_status: 'Rusak',
    listrik_status: 'Proses',
    air_status: 'Sudah',
    drainase_baik: 'tidak',
    penerangan_baik: 'ya',
    gerbang_baik: 'ya',
    infrastruktur_kebutuhan: 'Perlu perbaikan gorong-gorong',
  };
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, 'terkirim', 'hijau', now());`,
    [dadang, tajur, JSON.stringify(dataDikirim)],
  );

  langkah('UJI — sebagai Putri (CEO, PUNYA akses can_see_report), baca lewat query setara useRekapPicLokasi()');
  await jadiSebagai(putri);
  const { rows: hasil } = await q(
    `select r.data, l.nama as lokasi_nama from report r
     join lokasi l on l.id = r.lokasi_id
     where r.form_key='pic_lokasi' and r.tanggal=(now() at time zone 'Asia/Jakarta')::date and r.status <> 'draft';`,
  );
  cek(hasil.length === 1, `Putri (ceo) bisa baca 1 baris, dapat ${hasil.length}`);

  if (hasil.length === 1) {
    const d = hasil[0].data;
    const lok = hasil[0].lokasi_nama;
    cek(lok === 'Tajur', `lokasi_nama = Tajur, dapat ${lok}`);

    const unit = {
      lokasi: lok, target: asInt(d.target_unit), sedang_dibangun: asInt(d.unit_dibangun),
      finishing: asInt(d.unit_finishing), selesai_hari_ini: asInt(d.unit_selesai), belum_mulai: asInt(d.unit_belum_mulai),
    };
    cek(
      unit.target === 10 && unit.sedang_dibangun === 4 && unit.finishing === 2 && unit.selesai_hari_ini === 1 && unit.belum_mulai === 3,
      `blok 1 (unit) parse benar: ${JSON.stringify(unit)}`,
    );

    const material = {
      lokasi: lok, material_cukup: asBool(d.material_cukup),
      material_kurang: Array.isArray(d.material_kurang) ? d.material_kurang : [],
      kiriman_precast_jumlah: asInt(d.kiriman_precast_jumlah), kiriman_kekurangan: asStr(d.kiriman_kekurangan),
    };
    cek(
      material.material_cukup === false && material.material_kurang.length === 1 && material.kiriman_precast_jumlah === 12,
      `blok 3 (material) parse benar: ${JSON.stringify(material)}`,
    );

    const infra = {
      lokasi: lok, jalan_status: asStr(d.jalan_status), listrik_status: asStr(d.listrik_status), air_status: asStr(d.air_status),
      drainase_baik: d.drainase_baik ?? null, penerangan_baik: d.penerangan_baik ?? null, gerbang_baik: d.gerbang_baik ?? null,
      infrastruktur_kebutuhan: asStr(d.infrastruktur_kebutuhan),
    };
    cek(
      infra.jalan_status === 'Rusak' && infra.listrik_status === 'Proses' && infra.air_status === 'Sudah',
      `blok 5 (infrastruktur) parse benar: ${JSON.stringify(infra)}`,
    );
    cek(!('infrastruktur_estimasi_biaya' in d), 'field infrastruktur_estimasi_biaya (D4, dihapus) memang tidak terkirim dari PIC');
  }

  await q('rollback;');
  console.log('\n=== ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
