import type { SupabaseClient } from '@supabase/supabase-js';
import type { AksesPos } from '../posHandoff';
import { GalatPenyediaAi, type PanggilModelJson } from './gemini';
import { bacaGrid, GalatFileImpor, gridUntukModel, MAKS_BYTE_FILE } from './imporOpname';
import { INSTRUKSI_BACA_RESEP, parseBacaanResep, ringkasanImporResep, SKEMA_BACA_RESEP, tabelHasilImporResep, verifikasiBacaanResep } from './imporResep';
import type { JawabanImporResepPos } from './jembatanPos';
import { PESAN_TIDAK_AKTIF, pesanJatahHabis, type HasilTangani, type StatusAi } from './tanganiChat';
import { gerbang } from './tanganiImporOpname';

/**
 * POST /api/asisten/impor-resep (29 September 2026). Pola SAMA dengan impor
 * opname (lib/ai/tanganiImporOpname.ts): gerbang ai_status + jatah (satu
 * impor = satu pertanyaan), file dibaca & dibatasi, AI MEMBACA, sistem
 * memverifikasi sel, pos-fnb mencocokkan (aturan pasti) & menyimpan riwayat
 * recipe_imports, panggilan tercatat di ai_panggilan_alat. Tidak ada resep
 * yang tersimpan: draf dibuka & dikonfirmasi manusia per produk di pos-fnb.
 * Resep berlaku untuk seluruh bisnis (bukan per outlet), jadi tidak ada
 * pilihan outlet -- gerbangnya izin mengubah resep (product.manage) di pos-fnb.
 */

const galat = (status: number, pesan: string, tambahan: Record<string, unknown> = {}): HasilTangani => ({
  status,
  body: { error: pesan, ...tambahan },
});

type PanggilPos = (user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null) => Promise<JawabanImporResepPos>;

export async function tanganiImporResep(deps: {
  supabase: SupabaseClient;
  terkonfigurasi: boolean;
  file: { nama: string; data: ArrayBuffer } | null;
  buatModelJson: () => PanggilModelJson;
  namaModel: string;
  panggilPos: PanggilPos;
}): Promise<HasilTangani> {
  const { supabase } = deps;
  const g = await gerbang(supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { user, status } = g as { user: { id: string; email: string }; status: StatusAi };

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
    .insert({ judul: `Impor resep: ${fileNama}`.slice(0, 120) })
    .select('id')
    .single();
  if (galatPercakapan || !percakapan) return galat(500, 'Gagal membuat percakapan baru.');
  const percakapanId = percakapan.id as string;

  const { data: pesanUser, error: galatPesan } = await supabase
    .from('ai_pesan')
    .insert({ percakapan_id: percakapanId, peran: 'user', isi: `Impor resep dari Excel: ${fileNama}` })
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
    const teks = await deps.buatModelJson()({ instruksiSistem: INSTRUKSI_BACA_RESEP, teks: gridUntukModel(grid), skema: SKEMA_BACA_RESEP });
    bacaan = parseBacaanResep(teks, grid);
  } catch (err) {
    console.error('impor-resep:', err instanceof GalatPenyediaAi ? `gemini ${err.status} ${err.alasan}` : err instanceof Error ? err.message : 'gagal');
    if (err instanceof GalatFileImpor) return galat(502, err.message, { percakapanId });
    return galat(502, 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  }
  if (bacaan.length === 0) return galat(422, 'AI tidak menemukan baris produk + bahan di file ini. Periksa isi file-nya.', { percakapanId });

  // 2. Verifikasi pasti terhadap sel file.
  const sumber = verifikasiBacaanResep(bacaan, grid);

  // 3. pos-fnb: izin resep + pencocokan aturan pasti + riwayat.
  const { data: akses } = await supabase.rpc('akses_pos_saya');
  const j = await deps.panggilPos(
    user,
    {
      action: 'create',
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
    alat: 'impor_resep',
    argumen: { file: fileNama, baris_dibaca: bacaan.length },
    sumber: 'pos',
    status: statusLog,
    jumlah_baris: bacaan.length,
  });
  if (galatLog) return galat(500, 'Gagal mencatat impor.', { percakapanId });

  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.', { percakapanId });
  if (j.akses === 'galat') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  if (j.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh mengubah resep.', { percakapanId });
  if (j.status !== 'ok' || !('importId' in j)) return galat(400, 'Isi file tidak bisa diproses (terlalu banyak baris atau file terlalu besar).', { percakapanId });

  const { data: pesanModel, error: galatModel } = await supabase
    .from('ai_pesan')
    .insert({
      percakapan_id: percakapanId,
      peran: 'model',
      balasan_untuk: pesanUser.id,
      isi: ringkasanImporResep({ fileNama, ringkasan: j.ringkasan }),
      tabel: [tabelHasilImporResep(j.produk, j.importId)],
    })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatModel || !pesanModel) return galat(500, 'Gagal menyimpan hasil impor.', { percakapanId });

  const { data: statusAkhir } = await supabase.rpc('ai_status').single<StatusAi>();
  return { status: 200, body: { percakapanId, pesanUser, pesanModel, statusAi: statusAkhir } };
}
