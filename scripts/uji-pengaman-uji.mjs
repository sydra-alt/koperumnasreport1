#!/usr/bin/env node
// Uji scripts/_pengaman-uji.mjs -- TIDAK menyentuh database sama sekali.
// Membuktikan pemulihan berjalan TEPAT SEKALI dari tiap jalur keluar:
//   finally normal, sinyal (SIGINT), galat tak tertangkap, promise ditolak.
// Tiap skenario dijalankan di proses anak; "pemulihan" = menambah satu baris
// ke berkas penanda di direktori sementara.
// Catatan Windows: sinyal sungguhan (kill) tidak tersedia, jadi SIGINT diuji
// lewat process.emit('SIGINT') -- jalur penanganan sama, tapi bukan bukti
// bahwa Ctrl-C di konsol tertangkap (itu perilaku Node, bukan kode kita).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modul = pathToFileURL(path.join(__dirname, '_pengaman-uji.mjs')).href;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'uji-pengaman-'));
const hasil = [];

function jalankan(nama, badanTry, { pulihkanGagal = false } = {}) {
  const penanda = path.join(tmp, `${nama}.txt`);
  const kode = `
    import { appendFileSync } from 'node:fs';
    import { pasangPemulih } from ${JSON.stringify(modul)};
    const pulihkan = pasangPemulih(${JSON.stringify(nama)}, async () => {
      appendFileSync(${JSON.stringify(penanda)}, 'pulih\\n');
      ${pulihkanGagal ? "throw new Error('pemulihan sengaja gagal');" : ''}
    });
    try { ${badanTry} } finally { await pulihkan(); }
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', kode], { encoding: 'utf8', timeout: 15000 });
  const n = existsSync(penanda) ? readFileSync(penanda, 'utf8').split('\n').filter(Boolean).length : 0;
  return { n, status: r.status, stderr: r.stderr };
}
function cek(skenario, harapan, mentah, lolos) {
  hasil.push({ skenario, harapan, mentah, lolos });
}

let r = jalankan('normal', `/* tidak ada yang salah */`);
cek('keluar normal lewat finally', 'pulih 1x, exit 0', `pulih ${r.n}x, exit ${r.status}`, r.n === 1 && r.status === 0);

r = jalankan('sinyal', `process.emit('SIGINT'); await new Promise((res) => setTimeout(res, 2000));`);
cek('SIGINT di tengah uji', 'pulih 1x, exit 130', `pulih ${r.n}x, exit ${r.status}`, r.n === 1 && r.status === 130);

r = jalankan('galat-di-try', `throw new Error('meledak di tengah uji');`);
cek('galat dilempar dari dalam try', 'pulih 1x (finally + penangan tidak dobel), exit != 0', `pulih ${r.n}x, exit ${r.status}`, r.n === 1 && r.status !== 0);

r = jalankan('galat-tak-tertangkap', `setTimeout(() => { throw new Error('async'); }, 10); await new Promise((res) => setTimeout(res, 2000));`);
cek('galat async tak tertangkap (di luar try)', 'pulih 1x, exit 1', `pulih ${r.n}x, exit ${r.status}`, r.n === 1 && r.status === 1);

r = jalankan('promise-ditolak', `Promise.reject(new Error('ditolak')); await new Promise((res) => setTimeout(res, 2000));`);
cek('promise ditolak tanpa catch', 'pulih 1x, exit 1', `pulih ${r.n}x, exit ${r.status}`, r.n === 1 && r.status === 1);

r = jalankan('pemulihan-gagal', `/* normal */`, { pulihkanGagal: true });
cek('pemulihan sendiri gagal', 'exit != 0 dan pesan menunjuk pulihkan-akun-uji.mjs', `exit ${r.status}; stderr ${r.stderr.includes('pulihkan-akun-uji.mjs') ? 'menunjuk skrip pemulih' : 'TIDAK menunjuk'}`, r.status !== 0 && r.stderr.includes('pulihkan-akun-uji.mjs'));

rmSync(tmp, { recursive: true, force: true });
let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal++;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.skenario}\n        harapan: ${h.harapan}\n        hasil  : ${h.mentah}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos.`);
process.exit(gagal === 0 ? 0 : 1);
