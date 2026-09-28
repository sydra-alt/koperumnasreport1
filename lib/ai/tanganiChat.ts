import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { GalatPenyediaAi, type IsiGemini, type PanggilModel } from './gemini';
import { DEKLARASI_ALAT, jalankanPutaranAlat } from './alat';
import { instruksiSistem, jalankanAgen } from './agen';

/**
 * Isi POST /api/ai/chat (28 September 2026), dipisah dari route supaya bisa
 * diuji dengan sesi Supabase sungguhan + model palsu (scripts/uji-gerbang-ai.mts).
 *
 * URUTAN GERBANG -- semuanya SEBELUM model dibuat/dipanggil (tiap panggilan
 * model berbayar):
 * 1. sesi login
 * 2. asisten aktif untuk bisnis ini (kunci policy ada & batas > 0)
 * 3. peran penanya ada di policy `ai_peran_boleh` (`boleh_pakai_ai()`)
 * 4. kunci API terpasang
 * 5. isi permintaan valid, jatah hari ini masih ada
 * Semua akses data lewat `supabase` MILIK PENANYA -- RLS sama dengan layar
 * biasa; tidak ada service-role di jalur ini.
 */

const Body = z.object({
  percakapanId: z.string().uuid().nullish(),
  pesan: z.string().trim().min(1, 'Pertanyaan masih kosong.').max(2000, 'Pertanyaan terlalu panjang (maksimal 2000 karakter).'),
});

const RIWAYAT_MAKS = 20;

export const PESAN_TIDAK_AKTIF = 'Asisten AI belum diaktifkan untuk bisnis ini. Hubungi CEO/admin kalau ingin menyalakannya.';
export const PESAN_TIDAK_BOLEH = 'Asisten AI tidak tersedia untuk peranmu.';
export const pesanJatahHabis = (batas: number) => `Batas ${batas} pesan per hari sudah tercapai. Coba lagi besok.`;

export type StatusAi = { aktif: boolean; boleh: boolean; batas: number; terpakai: number };

export type HasilTangani = { status: number; body: Record<string, unknown> };

const galat = (status: number, pesan: string, tambahan: Record<string, unknown> = {}): HasilTangani => ({
  status,
  body: { error: pesan, ...tambahan },
});

export async function tanganiChat(deps: {
  supabase: SupabaseClient;
  bodyMentah: unknown;
  terkonfigurasi: boolean;
  /** Dipanggil HANYA setelah semua gerbang lolos. */
  buatModel: () => PanggilModel;
  tanggalHariIni: string;
}): Promise<HasilTangani> {
  const { supabase } = deps;
  const mulai = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return galat(401, 'Sesi berakhir. Silakan masuk lagi.');

  const { data: status, error: galatStatus } = await supabase.rpc('ai_status').single<StatusAi>();
  if (galatStatus || !status) return galat(500, 'Status asisten tidak bisa dibaca. Coba lagi.');
  if (!status.aktif) return galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true });
  if (!status.boleh) return galat(403, PESAN_TIDAK_BOLEH);

  if (!deps.terkonfigurasi) return galat(503, 'Asisten AI belum aktif di server (kunci API belum dipasang). Hubungi admin.');

  const parsed = Body.safeParse(deps.bodyMentah);
  if (!parsed.success) return galat(400, parsed.error.issues[0]?.message ?? 'Permintaan tidak valid.');
  const body = parsed.data;

  // Cek jatah lebih dulu supaya tidak meninggalkan percakapan kosong.
  if (status.terpakai >= status.batas) return galat(429, pesanJatahHabis(status.batas), { batasTercapai: true });

  let percakapanId = body.percakapanId ?? null;
  if (percakapanId) {
    const { data: ada } = await supabase.from('ai_percakapan').select('id').eq('id', percakapanId).maybeSingle();
    if (!ada) return galat(404, 'Percakapan tidak ditemukan.');
  } else {
    const { data: baru, error } = await supabase.from('ai_percakapan').insert({ judul: body.pesan.slice(0, 80) }).select('id').single();
    if (error || !baru) return galat(500, 'Gagal membuat percakapan baru.');
    percakapanId = baru.id as string;
  }

  const { data: pesanUser, error: galatPesan } = await supabase
    .from('ai_pesan')
    .insert({ percakapan_id: percakapanId, peran: 'user', isi: body.pesan })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatPesan || !pesanUser) {
    // Trigger database adalah penjaga sungguhan (status di atas bisa basi karena balapan).
    if (/AI_TIDAK_AKTIF/.test(galatPesan?.message ?? '')) return galat(503, PESAN_TIDAK_AKTIF, { tidakAktif: true, percakapanId });
    const batas = /BATAS_PESAN_AI:(\d+)/.exec(galatPesan?.message ?? '');
    if (batas) return galat(429, pesanJatahHabis(Number(batas[1])), { batasTercapai: true, percakapanId });
    return galat(500, 'Gagal menyimpan pertanyaan.');
  }

  const { data: lama } = await supabase
    .from('ai_pesan')
    .select('peran, isi')
    .eq('percakapan_id', percakapanId)
    .neq('id', pesanUser.id)
    .order('created_at', { ascending: false })
    .limit(RIWAYAT_MAKS);
  const riwayat: IsiGemini[] = ((lama ?? []) as { peran: 'user' | 'model'; isi: string }[])
    .reverse()
    .map((m) => ({ role: m.peran, parts: [{ text: m.isi }] }));

  // Pengukuran waktu (29 September 2026): di mana waktu jawaban habis --
  // Gemini, alat (query), atau sisanya (sesi, simpan pesan, log). Dicatat ke
  // log server, tidak dikirim ke pengguna.
  const waktu = { gemini: 0, geminiKali: 0, alat: 0, putaran: 0 };
  const model = deps.buatModel();
  let hasil;
  try {
    hasil = await jalankanAgen({
      panggilModel: async (permintaan) => {
        const t = Date.now();
        try {
          return await model(permintaan);
        } finally {
          waktu.gemini += Date.now() - t;
          waktu.geminiKali += 1;
        }
      },
      instruksi: instruksiSistem(deps.tanggalHariIni),
      fungsi: DEKLARASI_ALAT,
      riwayat,
      pertanyaan: body.pesan,
      jalankanPutaran: async (panggilan) => {
        const t = Date.now();
        const putaran = await jalankanPutaranAlat(supabase, { id: user.id, email: user.email! }, panggilan, deps.tanggalHariIni);
        waktu.alat += Date.now() - t;
        waktu.putaran += 1;
        // Log WAJIB: kalau gagal dicatat, jawaban tidak diberikan.
        const { error } = await supabase.from('ai_panggilan_alat').insert(
          putaran.map((h) => ({
            percakapan_id: percakapanId,
            alat: h.catatan.alat,
            argumen: h.catatan.argumen,
            sumber: h.catatan.sumber,
            status: h.catatan.status,
            jumlah_baris: h.catatan.jumlahBaris,
          })),
        );
        if (error) throw new Error('Gagal mencatat panggilan alat.');
        return putaran;
      },
    });
  } catch (err) {
    console.error('ai/chat:', err instanceof GalatPenyediaAi ? `gemini ${err.status}` : err instanceof Error ? err.message : 'gagal');
    return galat(502, 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', { percakapanId });
  }

  const { data: pesanModel, error: galatModel } = await supabase
    .from('ai_pesan')
    .insert({
      percakapan_id: percakapanId,
      peran: 'model',
      isi: hasil.jawaban.slice(0, 8000),
      tabel: hasil.tabel.length > 0 ? hasil.tabel : null,
    })
    .select('id, peran, isi, tabel, created_at')
    .single();
  if (galatModel || !pesanModel) return galat(500, 'Gagal menyimpan jawaban.', { percakapanId });

  const { data: statusAkhir } = await supabase.rpc('ai_status').single<StatusAi>();
  const total = Date.now() - mulai;
  console.log(
    `ai/chat waktu: total=${total}ms gemini=${waktu.gemini}ms (${waktu.geminiKali}x) alat=${waktu.alat}ms (${waktu.putaran} putaran) lainnya=${total - waktu.gemini - waktu.alat}ms`,
  );
  return { status: 200, body: { percakapanId, pesanUser, pesanModel, statusAi: statusAkhir } };
}
