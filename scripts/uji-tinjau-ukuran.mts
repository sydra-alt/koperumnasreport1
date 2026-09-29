#!/usr/bin/env -S npx tsx
// Uji tinjauan jenis ukuran bahan (29 September 2026) -- model palsu, klien
// Supabase palsu, pos-fnb palsu. Tidak menyentuh jaringan atau database.
//
// Jalankan: npx tsx scripts/uji-tinjau-ukuran.mts

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseUsulan, ringkasanTinjauan, type BahanTinjauan } from '../lib/ai/tinjauanUkuran';
import { tanganiTinjauanUkuran } from '../lib/ai/tanganiTinjauanUkuran';
import type { JawabanTinjauanUkuranPos } from '../lib/ai/jembatanPos';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

const BAHAN: BahanTinjauan[] = [
  { id: 'a', name: 'Minyak Goreng/Liter', baseUnit: 'gram', purchaseUnit: 'liter' },
  { id: 'b', name: 'Telur', baseUnit: 'pcs', purchaseUnit: 'pcs' },
];

{
  const r = parseUsulan(
    JSON.stringify({
      usulan: [
        { id: 'a', jenis: 'volume', alasan: 'minyak cair' },
        { id: 'a', jenis: 'berat', alasan: 'duplikat' },
        { id: 'z', jenis: 'berat', alasan: 'id karangan' },
        { id: 'b', jenis: 'cair', alasan: 'jenis tidak sah' },
      ],
    }),
    BAHAN,
  );
  cek('parseUsulan: hanya id yang diberikan & jenis sah; duplikat diambil yang pertama', JSON.stringify(r.usulan) === JSON.stringify([{ ingredientId: 'a', usulan: 'volume', alasan: 'minyak cair' }]), r.usulan);
  cek('parseUsulan: bacaan mentah disimpan apa adanya (4 entri)', r.mentah.length === 4);
  let pesan = '';
  try {
    parseUsulan('bukan json', BAHAN);
  } catch (e) {
    pesan = e instanceof Error ? e.message : '';
  }
  cek('parseUsulan: bukan JSON -> galat jelas', pesan.includes('JSON'), pesan);
  cek(
    'ringkasan: angka dari pos-fnb + belum tersimpan',
    ringkasanTinjauan({ jumlah: 1, tidakDiusulkan: 1, bentrok: 1 }) ===
      'AI mengusulkan jenis ukuran untuk 1 bahan. 1 bahan tidak mendapat usulan yang sah dan tetap "belum ditentukan". 1 usulan tidak sesuai satuan dasar yang tercatat -- periksa baik-baik. Belum ada yang tersimpan. Konfirmasi atau ubah tiap bahan di POS: Bahan > Tinjauan jenis ukuran.',
  );
}

function supabasePalsu(opsi: { status?: Record<string, unknown> } = {}) {
  const tercatat: { tabel: string; baris: Record<string, unknown> }[] = [];
  let n = 0;
  const status = { aktif: true, boleh: true, batas: 20, terpakai: 3, ...opsi.status };
  const klien = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ceo@koperumnas.com' } } }) },
    rpc: (nama: string) => {
      const data = nama === 'ai_status' ? status : nama === 'akses_pos_saya' ? { boleh: true, peran_pos: 'manager' } : null;
      return Object.assign(Promise.resolve({ data, error: null }), { single: async () => ({ data, error: null }) });
    },
    from: (tabel: string) => ({
      insert: (baris: Record<string, unknown>) => {
        tercatat.push({ tabel, baris });
        const h = { data: { id: `${tabel}-${++n}`, ...baris, created_at: '2026-09-29T10:00:00Z' }, error: null };
        return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => h }) });
      },
    }),
  };
  return { klien: klien as unknown as SupabaseClient, tercatat };
}

async function jalankan(pos: (body: Record<string, unknown>) => JawabanTinjauanUkuranPos, sb = supabasePalsu()) {
  const panggilan: Record<string, unknown>[] = [];
  let model = 0;
  const r = await tanganiTinjauanUkuran({
    supabase: sb.klien,
    terkonfigurasi: true,
    buatModelJson: () => async () => {
      model++;
      return JSON.stringify({ usulan: [{ id: 'a', jenis: 'volume', alasan: 'cair' }, { id: 'b', jenis: 'hitungan', alasan: 'per butir' }] });
    },
    namaModel: 'gemini-uji',
    panggilPos: async (_u, body) => {
      panggilan.push(body);
      return pos(body);
    },
  });
  return { r, sb, panggilan, model };
}

const OK = (body: Record<string, unknown>): JawabanTinjauanUkuranPos =>
  body.action === 'ingredients'
    ? { akses: 'ok', status: 'ok', ingredients: BAHAN }
    : {
        akses: 'ok',
        status: 'ok',
        reviewId: 'r1',
        usulan: [
          { ingredientId: 'a', name: 'Minyak Goreng/Liter', baseUnit: 'gram', purchaseUnit: 'liter', usulan: 'volume', alasan: 'cair' },
          { ingredientId: 'b', name: 'Telur', baseUnit: 'pcs', purchaseUnit: 'pcs', usulan: 'hitungan', alasan: 'per butir' },
        ],
        tidakDiusulkan: 0,
        bentrokSatuanDasar: 1,
      };

{
  const { r, sb, panggilan, model } = await jalankan(OK);
  cek('sukses: daftar bahan -> AI sekali -> simpan usulan di pos-fnb', r.status === 200 && model === 1 && panggilan.map((p) => p.action).join() === 'ingredients,create', panggilan.map((p) => p.action));
  const kirim = panggilan[1]!;
  cek('ke pos-fnb: usulan tersaring + bacaan mentah + nama model', (kirim.proposals as unknown[]).length === 2 && (kirim.rawRead as unknown[]).length === 2 && kirim.aiModel === 'gemini-uji');
  const log = sb.tercatat.find((t) => t.tabel === 'ai_panggilan_alat')!.baris;
  cek('log alat: tinjau_jenis_ukuran, sumber pos, ok', log.alat === 'tinjau_jenis_ukuran' && log.sumber === 'pos' && log.status === 'ok', log);
  const pesanModel = sb.tercatat.filter((t) => t.tabel === 'ai_pesan')[1]!.baris;
  cek('jawaban: "belum ada yang tersimpan" + tabel usulan', String(pesanModel.isi).includes('Belum ada yang tersimpan') && (pesanModel.tabel as { baris: unknown[] }[])[0]!.baris.length === 2, pesanModel.isi);
}
{
  const { r, model, sb } = await jalankan(() => ({ akses: 'ok', status: 'ok', ingredients: [] }));
  cek('semua bahan sudah ditentukan -> 422, AI tidak dipanggil, tidak ada percakapan', r.status === 422 && model === 0 && sb.tercatat.length === 0, r);
}
{
  const { r, model } = await jalankan(() => ({ akses: 'ok', status: 'forbidden' }));
  cek('peran POS tanpa izin -> 403, AI tidak dipanggil', r.status === 403 && model === 0, r);
}
{
  const sb = supabasePalsu({ status: { boleh: false } });
  const { r, panggilan } = await jalankan(OK, sb);
  cek('tanpa punya_akses_ai -> 403, pos-fnb tidak dipanggil', r.status === 403 && panggilan.length === 0, r);
}

let gagal = 0;
for (const h of hasil) {
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}`);
  if (!h.lolos) {
    gagal++;
    console.log('       ', JSON.stringify(h.detail));
  }
}
console.log(`${hasil.length - gagal}/${hasil.length} lolos.`);
if (gagal > 0) process.exit(1);
