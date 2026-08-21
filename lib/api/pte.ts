'use client';

import type { PolicyMap } from './policy';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Sinkronisasi pte_daily saat laporan personal_marketing dikirim.
 * Persis pseudocode 03-CALC-SPEC.md §2 -- termasuk polanya: kalau bukti
 * TIDAK ADA, jumlahnya dianggap NOL, bukan diterima lalu ditandai bermasalah.
 * `attachment.field_key` yang dipakai di sini adalah tag bukti (live, undang,
 * kesaksian, review, konten, mentahan) -- BUKAN nama field data
 * (undang_jumlah dst.), lihat `Field.buktiKunci` di forms/types.ts.
 */
export async function sinkronPteDaily(reportId: string, userId: string, data: Record<string, unknown>) {
  const supabase = createClient();

  const { data: lampiran, error: errLampiran } = await supabase
    .from('attachment')
    .select('field_key')
    .eq('report_id', reportId);
  if (errLampiran) throw errLampiran;

  const jumlahLampiran = (fieldKey: string) => (lampiran ?? []).filter((a) => a.field_key === fieldKey).length;

  const { error } = await supabase.from('pte_daily').upsert(
    {
      user_id: userId,
      tanggal: tanggalWIB(),
      live: Boolean(data.live) && jumlahLampiran('live') > 0,
      undang_jumlah: jumlahLampiran('undang') > 0 ? Number(data.undang_jumlah) || 0 : 0,
      kesaksian_jumlah: jumlahLampiran('kesaksian') > 0 ? Number(data.kesaksian_jumlah) || 0 : 0,
      review_jumlah: jumlahLampiran('review') > 0 ? Number(data.review_jumlah) || 0 : 0,
      konten_jumlah: jumlahLampiran('konten') > 0 ? Number(data.konten_jumlah) || 0 : 0,
      mentahan_jumlah: jumlahLampiran('mentahan') > 0 ? Number(data.mentahan_jumlah) || 0 : 0,
      report_id: reportId,
    },
    { onConflict: 'user_id,tanggal' },
  );
  if (error) throw error;
}

interface BarisClosing {
  nama_konsumen?: string;
  status?: string;
}

/**
 * Hapus lalu tulis ulang baris `closing` milik laporan ini -- supaya kirim
 * ulang (draft yang sama dikirim dua kali) tidak menggandakan closing.
 */
export async function sinkronClosing(userId: string, reportId: string, daftarClosing: BarisClosing[] | undefined) {
  const supabase = createClient();

  const { error: errHapus } = await supabase.from('closing').delete().eq('report_id', reportId);
  if (errHapus) throw errHapus;

  const baris = (daftarClosing ?? [])
    .filter((c) => c.nama_konsumen && c.nama_konsumen.trim().length > 0)
    .map((c) => {
      const statusMentah = (c.status ?? '').trim().toLowerCase();
      const status = (['booking', 'akad', 'batal'] as const).includes(statusMentah as 'booking' | 'akad' | 'batal')
        ? (statusMentah as 'booking' | 'akad' | 'batal')
        : 'booking';
      return {
        user_id: userId,
        nama_konsumen: c.nama_konsumen!.trim(),
        tanggal: tanggalWIB(),
        status,
        report_id: reportId,
      };
    });

  if (baris.length === 0) return;

  const { error } = await supabase.from('closing').insert(baris);
  if (error) throw error;
}

export interface KelayakanBonus {
  /** false = policy.pte_mulai_berlaku masih null. JANGAN tampilkan `layak`/`nominal` -- tampilkan "belum berlaku". */
  berlaku: boolean;
  layak?: boolean;
  nominal?: number;
}

/**
 * Kelayakan bonus PTE Rp500rb, persis 03-CALC-SPEC.md §3.
 * SATU-SATUNYA tempat rumus ini boleh dihitung -- UI mana pun yang mau
 * menampilkan status bonus WAJIB lewat fungsi ini, bukan menghitung ulang
 * sendiri, supaya guard `berlaku` tidak pernah kelewat.
 */
export function hitungKelayakanBonus(policy: PolicyMap, hariBolong: number, hariLengkap: number, hariWajib: number): KelayakanBonus {
  if (!policy.pte_mulai_berlaku) {
    return { berlaku: false };
  }
  const jumlahBonus = Number(policy.pte_bonus_amount);

  if (policy.pte_bonus_rule === 'per_day') {
    const layak = hariLengkap > 0;
    const nominal = hariWajib > 0 ? Math.round((jumlahBonus * hariLengkap) / hariWajib) : 0;
    return { berlaku: true, layak, nominal };
  }

  // default: 'no_gap'
  const layak = hariBolong === 0;
  return { berlaku: true, layak, nominal: layak ? jumlahBonus : 0 };
}

export interface InfoPotongan {
  /** false = policy.pte_mulai_berlaku masih null. JANGAN tampilkan `potongan` -- tampilkan "belum berlaku". */
  berlaku: boolean;
  potongan?: number;
}

/** Potongan closing Rp300rb, persis 03-CALC-SPEC.md §3. Sama seperti hitungKelayakanBonus -- satu-satunya tempat rumus ini boleh dihitung. */
export function hitungPotongan(policy: PolicyMap, closing: number): InfoPotongan {
  if (!policy.pte_mulai_berlaku) {
    return { berlaku: false };
  }
  const target = Number(policy.closing_target);
  const nominal = Number(policy.closing_penalty);
  return { berlaku: true, potongan: closing < target ? nominal : 0 };
}
