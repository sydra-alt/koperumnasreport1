#!/usr/bin/env node
// Item 2+3 dari instruksi user (30 Agustus 2026), setelah 40 akun asli
// dibuat lewat buat-akun.mjs:
//   2. Audit -- berapa kartu Papan Kontrol hari ini, form tanpa pengisi,
//      orang tanpa satu pun tugas. HANYA MELAPORKAN, tidak memperbaiki.
//   3. Ekspor daftar ke Excel (pakai exceljs, sudah ada di package.json)
//      untuk dicek CEO sebelum dibagikan ke 40 orang.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

const { rows: orang } = await db.query(`
  select
    p.id, p.nama, u.email, p.jabatan, p.divisi, p.aktif,
    p.wajib_pte, p.alasan_bebas_pte,
    coalesce(array_agg(distinct r.role) filter (where r.role is not null), '{}') as roles
  from public.profile p
  join auth.users u on u.id = p.id
  left join public.role r on r.user_id = p.id
  group by p.id, p.nama, u.email, p.jabatan, p.divisi, p.aktif, p.wajib_pte, p.alasan_bebas_pte
  order by p.nama;
`);

const { rows: assignmentRows } = await db.query(`
  select a.user_id, a.form_key, l.nama as lokasi_nama, o.nama as outlet_nama, s.nama as shift_nama
  from public.assignment a
  left join public.lokasi l on l.id = a.lokasi_id
  left join public.outlet o on o.id = a.outlet_id
  left join public.shift  s on s.id = a.shift_id;
`);

const { rows: titikRows } = await db.query(`
  select pa.user_id, la.nama as titik_nama
  from public.penugasan_absen pa
  join public.lokasi_absen la on la.id = pa.lokasi_absen_id;
`);

const assignmentByUser = new Map();
for (const a of assignmentRows) {
  const list = assignmentByUser.get(a.user_id) ?? [];
  const scope = a.lokasi_nama ?? a.outlet_nama ?? null;
  list.push(`${a.form_key}${scope ? ` (${scope})` : ''}${a.shift_nama ? ` · ${a.shift_nama}` : ''}`);
  assignmentByUser.set(a.user_id, list);
}
const titikByUser = new Map();
for (const t of titikRows) {
  const list = titikByUser.get(t.user_id) ?? [];
  list.push(t.titik_nama);
  titikByUser.set(t.user_id, list);
}

// ── AUDIT (item 2) -- HANYA LAPORAN, tidak memperbaiki ──────────────────
console.log(`Total akun: ${orang.length}\n`);

console.log('═══ Kartu Papan Kontrol HARI INI (dari tabel assignment) ═══');
const { rows: papan } = await db.query(`select * from public.papan_untuk_tanggal();`);
console.log(`Total kartu: ${papan.length}`);
const formCount = new Map();
for (const p of papan) formCount.set(p.form_key, (formCount.get(p.form_key) ?? 0) + 1);
console.table([...formCount.entries()].map(([form_key, jumlah]) => ({ form_key, jumlah })));

console.log('\n═══ form_key TANPA satu pun pengisi (form terdaftar, assignment kosong) ═══');
const SEMUA_FORM_KEY = [
  'personal_marketing', // wajib semua karyawan lewat role, BUKAN lewat assignment -- sengaja dikecualikan di bawah
  'pic_lokasi', 'hrd', 'security', 'perizinan', 'it', 'pembangunan', 'dti',
  'kendaraan', 'cs', 'ga', 'manager_resto', 'thrifting', 'kontrol_fnb',
  'accounting', 'pusat',
];
const formKeyDenganAssignment = new Set(assignmentRows.map((a) => a.form_key));
const formKosong = SEMUA_FORM_KEY.filter((f) => f !== 'personal_marketing' && !formKeyDenganAssignment.has(f));
console.log(formKosong.length > 0 ? formKosong.join(', ') : '(tidak ada -- semua form punya minimal 1 pengisi)');
console.log('(catatan: personal_marketing SENGAJA tidak lewat assignment/Papan Kontrol -- wajib otomatis untuk semua role karyawan, dilacak lewat pte_daily/report langsung, bukan RPC papan_untuk_tanggal)');

console.log('\n═══ Orang TANPA satu pun form assignment ═══');
const orangTanpaAssignment = orang.filter((o) => !assignmentByUser.has(o.id) && !o.roles.includes('ceo'));
console.log(`${orangTanpaAssignment.length} dari ${orang.length - orang.filter((o) => o.roles.includes('ceo')).length} (CEO dikecualikan -- dashboard saja, tidak mengisi form)`);
console.table(orangTanpaAssignment.map((o) => ({ nama: o.nama, divisi: o.divisi, roles: o.roles.join(',') })));

console.log('\n═══ Orang TANPA satu pun titik absen ═══');
const orangTanpaTitik = orang.filter((o) => !titikByUser.has(o.id));
console.log(`${orangTanpaTitik.length} dari ${orang.length}`);
console.table(orangTanpaTitik.map((o) => ({ nama: o.nama, divisi: o.divisi })));

// ── EKSPOR EXCEL (item 3) ────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('40 Akun Koperumnas');
ws.columns = [
  { header: 'Nama', key: 'nama', width: 16 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Divisi', key: 'divisi', width: 14 },
  { header: 'Jabatan', key: 'jabatan', width: 30 },
  { header: 'Peran (role)', key: 'roles', width: 26 },
  { header: 'Form yang diisi', key: 'forms', width: 40 },
  { header: 'Titik absen', key: 'titik', width: 24 },
  { header: 'Wajib PTE', key: 'wajibPte', width: 12 },
  { header: 'Alasan bebas PTE', key: 'alasanBebasPte', width: 30 },
  { header: 'Aktif', key: 'aktif', width: 8 },
];
for (const o of orang) {
  ws.addRow({
    nama: o.nama,
    email: o.email,
    divisi: o.divisi ?? '',
    jabatan: o.jabatan ?? '',
    roles: o.roles.join(', '),
    forms: (assignmentByUser.get(o.id) ?? []).join('; ') || '(belum ada)',
    titik: (titikByUser.get(o.id) ?? []).join('; ') || '(belum ada)',
    wajibPte: o.wajib_pte ? 'Ya' : 'TIDAK',
    alasanBebasPte: o.alasan_bebas_pte ?? '',
    aktif: o.aktif ? 'Ya' : 'Tidak',
  });
}
ws.getRow(1).font = { bold: true };
ws.autoFilter = { from: 'A1', to: 'J1' };

// Root proyek, BUKAN tmpdir -- instruksi eksplisit user (30 Agustus 2026),
// diambil manual dari sana. Digitignore-kan (bukan dicommit) -- lihat .gitignore.
const outPath = path.join(__dirname, '..', 'audit-40-akun.xlsx');
await wb.xlsx.writeFile(outPath);
console.log(`\nEkspor Excel: ${outPath}`);

await db.end();
