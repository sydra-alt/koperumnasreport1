import type { SupabaseClient } from '@supabase/supabase-js';
import type { AksesPos } from '../posHandoff';
import { GalatPenyediaAi, type PanggilModelJson } from './gemini';
import type { JawabanTinjauanUkuranPos } from './jembatanPos';
import { PESAN_TIDAK_AKTIF, pesanJatahHabis, type HasilTangani, type StatusAi } from './tanganiChat';
import { gerbang } from './tanganiImporOpname';
import { daftarUntukModel, INSTRUKSI_UKURAN, parseUsulan, ringkasanTinjauan, SKEMA_UKURAN, tabelUsulanUkuran, type BahanTinjauan } from './tinjauanUkuran';

/**
 * POST /api/asisten/tinjau-ukuran (29 September 2026). Gerbang & jatah sama
 * dengan impor (satu tinjauan = satu pertanyaan). Urutan: pos-fnb daftar
 * bahan yang jenisnya belum ditentukan -> percakapan + pesan user -> AI
 * MENGUSULKAN -> usulan disaring (id & jenis sah) -> pos-fnb menyimpan
 * riwayat tinjauan -> log alat -> jawaban. Tidak ada jenis ukuran yang
 * terisi dari sini.
 */

const galat = (status: number, pesan: string, tambahan: Record<string, unknown> = {}): HasilTangani => ({ status, body: { error: pesan, ...tambahan } });

type PanggilPos = (user: { id: string; email: string }, body: Record<string, unknown>, akses: AksesPos | null) => Promise<JawabanTinjauanUkuranPos>;

export async function tanganiTinjauanUkuran(deps: {
  supabase: SupabaseClient;
  terkonfigurasi: boolean;
  buatModelJson: () => PanggilModelJson;
  namaModel: string;
  panggilPos: PanggilPos;
}): Promise<HasilTangani> {
  const { supabase } = deps;
  const g = await gerbang(supabase, deps.terkonfigurasi);
  if (!g.ok) return g.gagal;
  const { user, status } = g as { user: { id: string; email: string }; status: StatusAi };
  if (status.terpakai >= status.batas) return galat(429, pesanJatahHabis(status.batas), { batasTercapai: true });

  const { data: akses } = await supabase.rpc('akses_pos_saya');
  const aksesPos = (akses as AksesPos | null) ?? null;
  const daftar = await deps.panggilPos(user, { action: 'ingredients' }, aksesPos);
  if (daftar.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.');
  if (daftar.akses === 'galat') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.');
  if (daftar.status === 'forbidden') return galat(403, 'Peran POS Anda tidak boleh mengubah data bahan.');
  if (daftar.status !== 'ok' || !('ingredients' in daftar)) return galat(502, 'Jawaban sistem POS tidak dikenal.');
  const bahan: BahanTinjauan[] = daftar.ingredients;
  if (bahan.length === 0) return galat(422, 'Semua bahan aktif sudah punya jenis ukuran. Tidak ada yang perlu ditinjau.');

  const { data: percakapan, error: galatPercakapan } = await supabase.from('ai_percakapan').insert({ judul: 'Tinjauan jenis ukuran bahan' }).select('id').single();
  if (galatPercakapan || !percakapan) return galat(500, 'Gagal membuat percakapan baru.');
  const percakapanId = percakapan.id as string;
  const { data: pesanUser, error: galatPesan } = await supabase
    .from('ai_pesan')
    .insert({ percakapan_id: percakapanId, peran: 'user', isi: `Tinjau jenis ukuran ${bahan.length} bahan` })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatPesan || !pesanUser) {
    if (/AI_TIDAK_AKTIF/.test(galatPesan?.message ?? '')) return galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true, percakapanId });
    const batas = /BATAS_PESAN_AI:(\d+)/.exec(galatPesan?.message ?? '');
    if (batas) return galat(429, pesanJatahHabis(Number(batas[1])), { batasTercapai: true, percakapanId });
    return galat(500, 'Gagal menyimpan permintaan.', { percakapanId });
  }

  let hasilAi;
  try {
    const teks = await deps.buatModelJson()({ instruksiSistem: INSTRUKSI_UKURAN, teks: daftarUntukModel(bahan), skema: SKEMA_UKURAN });
    hasilAi = parseUsulan(teks, bahan);
  } catch (err) {
    console.error('tinjau-ukuran:', err instanceof GalatPenyediaAi ? `gemini ${err.status} ${err.alasan}` : err instanceof Error ? err.message : 'gagal');
    return galat(502, 'Asisten AI sedang tidak bisa dihubungi atau usulannya tidak valid. Coba lagi sebentar lagi.', { percakapanId });
  }
  if (hasilAi.usulan.length === 0) return galat(422, 'AI tidak menghasilkan usulan yang sah. Coba lagi.', { percakapanId });

  const j = await deps.panggilPos(user, { action: 'create', aiModel: deps.namaModel, rawRead: hasilAi.mentah, proposals: hasilAi.usulan }, aksesPos);
  const statusLog = j.akses === 'tanpa_akses_pos' ? 'tanpa_akses_pos' : j.akses === 'galat' ? 'galat' : j.status === 'ok' ? 'ok' : j.status === 'invalid' ? 'argumen_salah' : 'ditolak';
  const { error: galatLog } = await supabase.from('ai_panggilan_alat').insert({
    percakapan_id: percakapanId,
    alat: 'tinjau_jenis_ukuran',
    argumen: { bahan: bahan.length, usulan: hasilAi.usulan.length },
    sumber: 'pos',
    status: statusLog,
    jumlah_baris: hasilAi.usulan.length,
  });
  if (galatLog) return galat(500, 'Gagal mencatat tinjauan.', { percakapanId });
  if (j.akses === 'tanpa_akses_pos') return galat(403, 'Anda tidak punya akses data POS.', { percakapanId });
  if (j.akses === 'galat') return galat(502, 'Sistem POS tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  if (j.status !== 'ok' || !('reviewId' in j)) return galat(403, 'Tinjauan tidak bisa disimpan di POS.', { percakapanId });

  const { data: pesanModel, error: galatModel } = await supabase
    .from('ai_pesan')
    .insert({
      percakapan_id: percakapanId,
      peran: 'model',
      balasan_untuk: pesanUser.id,
      isi: ringkasanTinjauan({ jumlah: j.usulan.length, tidakDiusulkan: j.tidakDiusulkan, bentrok: j.bentrokSatuanDasar }),
      tabel: [tabelUsulanUkuran(j.usulan)],
    })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatModel || !pesanModel) return galat(500, 'Gagal menyimpan hasil tinjauan.', { percakapanId });
  const { data: statusAkhir } = await supabase.rpc('ai_status').single<StatusAi>();
  return { status: 200, body: { percakapanId, pesanUser, pesanModel, statusAi: statusAkhir } };
}
