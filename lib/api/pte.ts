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
      // `live` bertipe 'ya_tidak' (bukan 'centang') -- nilainya string 'ya'/'tidak',
      // BUKAN boolean. Boolean('tidak') === true (string non-kosong), jadi harus
      // dibandingkan persis dengan 'ya', bukan di-Boolean()-kan.
      live: data.live === 'ya' && jumlahLampiran('live') > 0,
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

export interface RingkasanPteHariIni {
  live: boolean;
  undang: boolean;
  kesaksian: boolean;
  review: boolean;
  konten: boolean;
  mentahan: boolean;
  lengkap: boolean;
}

/**
 * Pratinjau kepatuhan PTE HARI INI dari nilai form yang sedang diisi --
 * dipakai Blok 5, murni (tidak baca DB), logikanya identik `sinkronPteDaily`
 * tapi pakai panjang array `_bukti.<buktiKunci>` yang ada di form sebagai
 * proksi "sudah ada lampiran" (unggahan yang baru selesai tersimpan di situ
 * segera, lihat `LampiranInput`, sebelum laporan sungguhan dikirim).
 */
export function ringkasanPteHariIni(data: Record<string, unknown>, policy: PolicyMap): RingkasanPteHariIni {
  const bukti = (data._bukti as Record<string, unknown[]> | undefined) ?? {};
  const adaBukti = (kunci: string) => (bukti[kunci]?.length ?? 0) > 0;
  const kontenMinimal = Number(policy.pte_konten_minimal);

  const live = data.live === 'ya' && adaBukti('live');
  const undang = Number(data.undang_jumlah) > 0 && adaBukti('undang');
  const kesaksian = Number(data.kesaksian_jumlah) > 0 && adaBukti('kesaksian');
  const review = Number(data.review_jumlah) > 0 && adaBukti('review');
  const konten = Number(data.konten_jumlah) >= kontenMinimal && adaBukti('konten');
  const mentahan = Number(data.mentahan_jumlah) > 0 && adaBukti('mentahan');

  return {
    live,
    undang,
    kesaksian,
    review,
    konten,
    mentahan,
    lengkap: live && undang && kesaksian && review && konten && mentahan,
  };
}

interface BarisClosing {
  nama_konsumen?: string;
  lokasi?: string;
  status?: string;
}

/**
 * Hapus lalu tulis ulang baris `closing` milik laporan ini -- supaya kirim
 * ulang (draft yang sama dikirim dua kali) tidak menggandakan closing.
 *
 * `lokasi` di tabel `closing_list` seharusnya "pilih dari tabel lokasi"
 * (REFERENSI-FORMAT-LAPORAN.md §2 Blok 2), tapi field `tabel` (Task 08) belum
 * punya dropdown sungguhan per sel -- semua sel dirender input teks polos.
 * Sebagai upaya terbaik, nama yang diketik dicocokkan ke `lokasi.nama`;
 * kalau tidak cocok (typo, atau memang di luar Tajur/Bekasi/DTI), `lokasi_id`
 * dibiarkan null daripada menolak seluruh baris closing -- closing tetap
 * lebih penting tercatat daripada gagal total karena field sekunder ini.
 */
export async function sinkronClosing(userId: string, reportId: string, daftarClosing: BarisClosing[] | undefined) {
  const supabase = createClient();

  const { error: errHapus } = await supabase.from('closing').delete().eq('report_id', reportId);
  if (errHapus) throw errHapus;

  const barisValid = (daftarClosing ?? []).filter((c) => c.nama_konsumen && c.nama_konsumen.trim().length > 0);
  if (barisValid.length === 0) return;

  const { data: semuaLokasi } = await supabase.from('lokasi').select('id, nama');
  const idLokasiDari = (nama: string | undefined) =>
    semuaLokasi?.find((l) => l.nama.toLowerCase() === (nama ?? '').trim().toLowerCase())?.id ?? null;

  const baris = barisValid.map((c) => {
    const statusMentah = (c.status ?? '').trim().toLowerCase();
    const status = (['booking', 'akad', 'batal'] as const).includes(statusMentah as 'booking' | 'akad' | 'batal')
      ? (statusMentah as 'booking' | 'akad' | 'batal')
      : 'booking';
    return {
      user_id: userId,
      nama_konsumen: c.nama_konsumen!.trim(),
      lokasi_id: idLokasiDari(c.lokasi),
      tanggal: tanggalWIB(),
      status,
      report_id: reportId,
    };
  });

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
 *
 * `pteBerlaku` WAJIB diambil dari kolom `pte_berlaku` view `v_marketing_bulanan`
 * -- satu sumber kebenaran, bukan dibaca ulang dari `policy.pte_mulai_berlaku`
 * secara terpisah (dua tempat menghitung hal sama = cepat/lambat beda, jebakan §7 #5).
 */
export function hitungKelayakanBonus(
  policy: PolicyMap,
  pteBerlaku: boolean,
  hariBolong: number,
  hariLengkap: number,
  hariWajib: number,
): KelayakanBonus {
  if (!pteBerlaku) {
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

/**
 * Potongan closing Rp300rb, persis 03-CALC-SPEC.md §3. Sama seperti
 * hitungKelayakanBonus -- satu-satunya tempat rumus ini boleh dihitung,
 * dan `pteBerlaku` WAJIB dari kolom `pte_berlaku` view, bukan dibaca ulang.
 */
export function hitungPotongan(policy: PolicyMap, pteBerlaku: boolean, closing: number): InfoPotongan {
  if (!pteBerlaku) {
    return { berlaku: false };
  }
  const target = Number(policy.closing_target);
  const nominal = Number(policy.closing_penalty);
  return { berlaku: true, potongan: closing < target ? nominal : 0 };
}
