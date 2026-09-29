import type { SupabaseClient } from '@supabase/supabase-js';
import type { AksesPos } from '../posHandoff';
import { GalatPenyediaAi, type PanggilModelJson } from './gemini';
import {
  bacaGrid,
  GalatFileImpor,
  gridUntukModel,
  INSTRUKSI_BACA,
  MAKS_BYTE_FILE,
  parseBacaan,
  ringkasanImpor,
  SKEMA_BACA,
  tabelHasilImpor,
  verifikasiBacaan,
} from './imporOpname';
import type { JawabanImporPos } from './jembatanPos';
import { PESAN_TIDAK_AKTIF, PESAN_TIDAK_BOLEH, pesanJatahHabis, type HasilTangani, type StatusAi } from './tanganiChat';

/**
 * POST /api/asisten/impor-opname (29 September 2026, fase 2). Gerbang SAMA
 * dengan chat: ai_status() (aktif + punya_akses_ai per orang) dan jatah
 * harian -- satu impor = satu pertanyaan, dicatat sebagai percakapan
 * ("Impor opname: file.xlsx") supaya ada di riwayat dan memakai jatah hanya
 * kalau terjawab (balasan_untuk, migrasi 0066).
 *
 * Urutan: file dibaca & dibatasi (sebelum apa pun disimpan) -> percakapan +
 * pesan user (trigger jatah) -> Gemini MEMBACA -> verifikasi sel -> pos-fnb
 * mencocokkan (aturan pasti) & menyimpan riwayat -> log alat -> jawaban.
 * Tidak ada yang tercatat ke stok: draf dibuat manusia di pos-fnb.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const galat = (status: number, pesan: string, tambahan: Record<string, unknown> = {}): HasilTangani => ({
  status,
  body: { error: pesan, ...tambahan },
});

type PanggilPos = (user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null) => Promise<JawabanImporPos>;

type HasilGerbang = { ok: false; gagal: HasilTangani } | { ok: true; user: { id: string; email: string }; status: StatusAi };

export async function gerbang(supabase: SupabaseClient, terkonfigurasi: boolean): Promise<HasilGerbang> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, gagal: galat(401, 'Sesi berakhir. Silakan masuk lagi.') };
  const { data: status, error } = await supabase.rpc('ai_status').single<StatusAi>();
  if (error || !status) return { ok: false, gagal: galat(500, 'Status asisten tidak bisa dibaca. Coba lagi.') };
  if (!status.aktif) return { ok: false, gagal: galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true }) };
  if (!status.boleh) return { ok: false, gagal: galat(403, PESAN_TIDAK_BOLEH) };
  if (!terkonfigurasi) return { ok: false, gagal: galat(503, 'Asisten AI belum aktif di server (kunci API belum dipasang). Hubungi admin.') };
  return { ok: true, user: { id: user.id, email: user.email }, status };
}

/** GET: outlet F&B yang boleh diimpor penanya (cakupan & izin dari pos-fnb). */
export async function tanganiOutletImpor(deps: {
  supabase: SupabaseClient;
  terkonfigurasi: boolean;
  panggilPos: PanggilPos;
}): Promise<HasilTangani> {
  const g = await gerbang(deps.supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { data: akses } = await deps.supabase.rpc('akses_pos_saya');
  const j = await deps.panggilPos(g.user, { action: 'outlets' }, (akses as AksesPos | null) ?? null);
  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.');
  if (j.akses !== 'ok') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.');
  if (j.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh input opname.');
  if (j.status !== 'ok' || !('outlets' in j)) return galat(502, 'Jawaban sistem POS tidak dikenal.');
  return { status: 200, body: { outlets: j.outlets } };
}

export async function tanganiImporOpname(deps: {
  supabase: SupabaseClient;
  terkonfigurasi: boolean;
  outletId: unknown;
  file: { nama: string; data: ArrayBuffer } | null;
  buatModelJson: () => PanggilModelJson;
  namaModel: string;
  panggilPos: PanggilPos;
}): Promise<HasilTangani> {
  const { supabase } = deps;
  const g = await gerbang(supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { user, status } = g;

  if (typeof deps.outletId !== 'string' || !UUID.test(deps.outletId)) return galat(400, 'Pilih outlet dulu.');
  const outletId = deps.outletId;
  if (!deps.file) return galat(400, 'Pilih file Excel dulu.');
  const fileNama = deps.file.nama.slice(0, 200);
  if (!/\.xlsx$/i.test(fileNama)) return galat(400, 'File harus .xlsx (Excel). Simpan ulang sebagai .xlsx kalau masih .xls/.csv.');
  if (deps.file.data.byteLength > MAKS_BYTE_FILE) return galat(400, 'File lebih dari 1 MB. Hapus lembar/gambar yang tidak perlu.');
  if (status.terpakai >= status.batas) return galat(429, pesanJatahHabis(status.batas), { batasTercapai: true });

  let grid;
  try {
    grid = await bacaGrid(deps.file.data);
  } catch (err) {
    return galat(400, err instanceof GalatFileImpor ? err.message : 'File tidak bisa dibaca.');
  }

  const { data: percakapan, error: galatPercakapan } = await supabase
    .from('ai_percakapan')
    .insert({ judul: `Impor opname: ${fileNama}`.slice(0, 120) })
    .select('id')
    .single();
  if (galatPercakapan || !percakapan) return galat(500, 'Gagal membuat percakapan baru.');
  const percakapanId = percakapan.id as string;

  const { data: pesanUser, error: galatPesan } = await supabase
    .from('ai_pesan')
    .insert({ percakapan_id: percakapanId, peran: 'user', isi: `Impor opname dari Excel: ${fileNama}` })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatPesan || !pesanUser) {
    if (/AI_TIDAK_AKTIF/.test(galatPesan?.message ?? '')) return galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true, percakapanId });
    const batas = /BATAS_PESAN_AI:(\d+)/.exec(galatPesan?.message ?? '');
    if (batas) return galat(429, pesanJatahHabis(Number(batas[1])), { batasTercapai: true, percakapanId });
    return galat(500, 'Gagal menyimpan permintaan impor.', { percakapanId });
  }

  // 1. AI MEMBACA (bukan mencocokkan).
  let bacaan;
  try {
    const teks = await deps.buatModelJson()({ instruksiSistem: INSTRUKSI_BACA, teks: gridUntukModel(grid), skema: SKEMA_BACA });
    bacaan = parseBacaan(teks, grid);
  } catch (err) {
    console.error('impor-opname:', err instanceof GalatPenyediaAi ? `gemini ${err.status} ${err.alasan}` : err instanceof Error ? err.message : 'gagal');
    if (err instanceof GalatFileImpor) return galat(502, err.message, { percakapanId });
    return galat(502, 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  }
  if (bacaan.length === 0) return galat(422, 'AI tidak menemukan baris bahan + jumlah di file ini. Periksa isi file-nya.', { percakapanId });

  // 2. Verifikasi pasti terhadap sel file.
  const sumber = verifikasiBacaan(bacaan, grid);

  // 3. pos-fnb: cakupan outlet + izin opname + pencocokan aturan pasti + riwayat.
  const { data: akses } = await supabase.rpc('akses_pos_saya');
  const j = await deps.panggilPos(
    user,
    {
      action: 'create',
      outletId,
      fileName: fileNama,
      fileBase64: Buffer.from(deps.file.data).toString('base64'),
      aiModel: deps.namaModel,
      rawRead: bacaan,
      rows: sumber,
    },
    (akses as AksesPos | null) ?? null,
  );

  const statusLog =
    j.akses === 'tanpa_akses_pos' ? 'tanpa_akses_pos' : j.akses === 'galat' ? 'galat' : j.status === 'ok' ? 'ok' : j.status === 'invalid' ? 'argumen_salah' : 'ditolak';
  const { error: galatLog } = await supabase.from('ai_panggilan_alat').insert({
    percakapan_id: percakapanId,
    alat: 'impor_opname',
    argumen: { outlet_id: outletId, file: fileNama, baris_dibaca: bacaan.length },
    sumber: 'pos',
    status: statusLog,
    jumlah_baris: bacaan.length,
  });
  if (galatLog) return galat(500, 'Gagal mencatat impor.', { percakapanId });

  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.', { percakapanId });
  if (j.akses === 'galat') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  if (j.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh input opname.', { percakapanId });
  if (j.status === 'outlet_not_allowed') return galat(403, 'Outlet itu tidak termasuk outlet yang boleh Anda lihat.', { percakapanId });
  if (j.status !== 'ok' || !('importId' in j)) return galat(400, 'Isi file tidak bisa diproses (terlalu banyak baris atau file terlalu besar).', { percakapanId });

  const { data: pesanModel, error: galatModel } = await supabase
    .from('ai_pesan')
    .insert({
      percakapan_id: percakapanId,
      peran: 'model',
      balasan_untuk: pesanUser.id,
      isi: ringkasanImpor({ outletNama: j.outletName, fileNama, counts: j.counts }),
      tabel: [tabelHasilImpor(j.rows, j.importId)],
    })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatModel || !pesanModel) return galat(500, 'Gagal menyimpan hasil impor.', { percakapanId });

  const { data: statusAkhir } = await supabase.rpc('ai_status').single<StatusAi>();
  return { status: 200, body: { percakapanId, pesanUser, pesanModel, statusAi: statusAkhir } };
}
