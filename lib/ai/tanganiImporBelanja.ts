import type { SupabaseClient } from '@supabase/supabase-js';
import type { AksesPos } from '../posHandoff';
import { tanggalWIB } from '../tanggal';
import { GalatPenyediaAi, type PanggilModelJson } from './gemini';
import {
  GalatFotoBelanja,
  INSTRUKSI_BELANJA,
  JENIS_FOTO,
  MAKS_BYTE_FOTO,
  parseBacaanBelanja,
  ringkasanBelanja,
  SKEMA_BELANJA,
  tabelHasilBelanja,
} from './imporBelanja';
import type { JawabanImporBelanjaPos } from './jembatanPos';
import { PESAN_TIDAK_AKTIF, pesanJatahHabis, type HasilTangani, type StatusAi } from './tanganiChat';
import { gerbang } from './tanganiImporOpname';

/**
 * POST /api/asisten/impor-belanja (3 Oktober 2026). Gerbang & jatah SAMA
 * dengan impor opname (satu impor = satu pertanyaan). Urutan: isian
 * diperiksa (sebelum apa pun disimpan) -> percakapan + pesan user (trigger
 * jatah) -> Gemini MEMBACA foto -> pos-fnb mencocokkan (aturan pasti, tidak
 * pernah hijau), menyimpan foto di bucket privat + riwayat -> log alat ->
 * jawaban. Tidak ada yang tercatat ke stok dari sini.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

const galat = (status: number, pesan: string, tambahan: Record<string, unknown> = {}): HasilTangani => ({ status, body: { error: pesan, ...tambahan } });

type PanggilPos = (user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null) => Promise<JawabanImporBelanjaPos>;

/** GET: outlet aktif yang boleh dicatat pembeliannya oleh penanya (cakupan & izin dari pos-fnb). */
export async function tanganiOutletBelanja(deps: { supabase: SupabaseClient; terkonfigurasi: boolean; panggilPos: PanggilPos }): Promise<HasilTangani> {
  const g = await gerbang(deps.supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { data: akses } = await deps.supabase.rpc('akses_pos_saya');
  const j = await deps.panggilPos(g.user, { action: 'outlets' }, (akses as AksesPos | null) ?? null);
  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.');
  if (j.akses !== 'ok') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.');
  if (j.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh mencatat pembelian.');
  if (j.status !== 'ok' || !('outlets' in j)) return galat(502, 'Jawaban sistem POS tidak dikenal.');
  return { status: 200, body: { outlets: j.outlets } };
}

export async function tanganiImporBelanja(deps: {
  supabase: SupabaseClient;
  terkonfigurasi: boolean;
  outletId: unknown;
  pembelanja: unknown;
  tanggalBelanja: unknown;
  foto: { nama: string; jenis: string; data: ArrayBuffer } | null;
  buatModelJson: () => PanggilModelJson;
  namaModel: string;
  panggilPos: PanggilPos;
  hariIni?: string;
}): Promise<HasilTangani> {
  const { supabase } = deps;
  const g = await gerbang(supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { user, status } = g;

  if (typeof deps.outletId !== 'string' || !UUID.test(deps.outletId)) return galat(400, 'Pilih outlet dulu.');
  const outletId = deps.outletId;
  const hariIni = deps.hariIni ?? tanggalWIB();
  const tanggal = typeof deps.tanggalBelanja === 'string' && deps.tanggalBelanja !== '' ? deps.tanggalBelanja : hariIni;
  if (!TANGGAL.test(tanggal) || Number.isNaN(Date.parse(`${tanggal}T00:00:00Z`))) return galat(400, 'Tanggal belanja tidak valid.');
  if (tanggal > hariIni) return galat(400, 'Tanggal belanja tidak boleh di masa depan.');
  const pembelanja = typeof deps.pembelanja === 'string' ? deps.pembelanja.trim().slice(0, 80) : '';
  if (!deps.foto) return galat(400, 'Pilih foto nota dulu.');
  if (!(JENIS_FOTO as readonly string[]).includes(deps.foto.jenis)) return galat(400, 'Foto harus JPG, PNG, atau WEBP.');
  if (deps.foto.data.byteLength === 0 || deps.foto.data.byteLength > MAKS_BYTE_FOTO) return galat(400, 'Foto terlalu besar. Pilih foto maksimal 5 MB.');
  if (status.terpakai >= status.batas) return galat(429, pesanJatahHabis(status.batas), { batasTercapai: true });

  const { data: percakapan, error: galatPercakapan } = await supabase
    .from('ai_percakapan')
    .insert({ judul: `Impor belanja ${tanggal}`.slice(0, 120) })
    .select('id')
    .single();
  if (galatPercakapan || !percakapan) return galat(500, 'Gagal membuat percakapan baru.');
  const percakapanId = percakapan.id as string;
  const { data: pesanUser, error: galatPesan } = await supabase
    .from('ai_pesan')
    .insert({ percakapan_id: percakapanId, peran: 'user', isi: `Impor belanja dari foto nota (${tanggal}${pembelanja ? `, belanja oleh ${pembelanja}` : ''})` })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatPesan || !pesanUser) {
    if (/AI_TIDAK_AKTIF/.test(galatPesan?.message ?? '')) return galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true, percakapanId });
    const batas = /BATAS_PESAN_AI:(\d+)/.exec(galatPesan?.message ?? '');
    if (batas) return galat(429, pesanJatahHabis(Number(batas[1])), { batasTercapai: true, percakapanId });
    return galat(500, 'Gagal menyimpan permintaan impor.', { percakapanId });
  }

  const fotoBase64 = Buffer.from(deps.foto.data).toString('base64');

  // 1. AI MEMBACA foto (bukan mencocokkan).
  let bacaan;
  try {
    const teks = await deps.buatModelJson()({
      instruksiSistem: INSTRUKSI_BELANJA,
      teks: 'Baca nota belanja di foto ini.',
      skema: SKEMA_BELANJA,
      gambar: { mimeType: deps.foto.jenis, base64: fotoBase64 },
    });
    bacaan = parseBacaanBelanja(teks);
  } catch (err) {
    console.error('impor-belanja:', err instanceof GalatPenyediaAi ? `gemini ${err.status} ${err.alasan}` : err instanceof Error ? err.message : 'gagal');
    if (err instanceof GalatFotoBelanja) return galat(502, err.message, { percakapanId });
    return galat(502, 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  }
  if (bacaan.baris.length === 0) return galat(422, 'AI tidak menemukan baris barang di foto ini. Pastikan notanya terlihat jelas.', { percakapanId });

  // 2. pos-fnb: cakupan outlet + izin stock.purchase + aturan pasti + foto & riwayat.
  const { data: akses } = await supabase.rpc('akses_pos_saya');
  const j = await deps.panggilPos(
    user,
    {
      action: 'create',
      outletId,
      shoppingDate: tanggal,
      shopper: pembelanja,
      photoBase64: fotoBase64,
      photoMime: deps.foto.jenis,
      aiModel: deps.namaModel,
      rawRead: bacaan.mentah,
      rows: bacaan.baris,
      grandTotal: bacaan.totalNota,
    },
    (akses as AksesPos | null) ?? null,
  );

  const statusLog =
    j.akses === 'tanpa_akses_pos' ? 'tanpa_akses_pos' : j.akses === 'galat' ? 'galat' : j.status === 'ok' ? 'ok' : j.status === 'invalid' ? 'argumen_salah' : 'ditolak';
  const { error: galatLog } = await supabase.from('ai_panggilan_alat').insert({
    percakapan_id: percakapanId,
    alat: 'impor_belanja',
    argumen: { outlet_id: outletId, tanggal_belanja: tanggal, baris_dibaca: bacaan.baris.length },
    sumber: 'pos',
    status: statusLog,
    jumlah_baris: bacaan.baris.length,
  });
  if (galatLog) return galat(500, 'Gagal mencatat impor.', { percakapanId });

  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.', { percakapanId });
  if (j.akses === 'galat') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  if (j.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh mencatat pembelian.', { percakapanId });
  if (j.status === 'outlet_not_allowed') return galat(403, 'Outlet itu tidak termasuk outlet yang boleh Anda catat pembeliannya.', { percakapanId });
  if (j.status !== 'ok' || !('importId' in j)) return galat(400, 'Foto atau isinya tidak bisa diproses.', { percakapanId });

  const { data: pesanModel, error: galatModel } = await supabase
    .from('ai_pesan')
    .insert({
      percakapan_id: percakapanId,
      peran: 'model',
      balasan_untuk: pesanUser.id,
      isi: ringkasanBelanja({ outletNama: j.outletName, ringkasan: j.ringkasan, barisPerluCentang: j.rows.filter((r) => r.perluKonfirmasiHarga).length }),
      tabel: [tabelHasilBelanja(j.rows, j.importId)],
    })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatModel || !pesanModel) return galat(500, 'Gagal menyimpan hasil impor.', { percakapanId });
  const { data: statusAkhir } = await supabase.rpc('ai_status').single<StatusAi>();
  return { status: 200, body: { percakapanId, pesanUser, pesanModel, statusAi: statusAkhir } };
}
