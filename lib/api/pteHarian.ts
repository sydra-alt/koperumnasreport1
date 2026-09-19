'use client';

import { useQuery } from '@tanstack/react-query';
import type { PolicyMap } from './policy';
import { createClient } from '../supabase/client';
import { tanggalDariTeks } from '../teksAngka';
import { tanggalWIB } from '../tanggal';

/**
 * PTE Harian versi poin (18 September 2026) -- MENGGANTIKAN skema lama
 * "Enam Kewajiban" (lib/api/pte.ts, TIDAK dihapus, tapi tidak lagi dipanggil
 * dari LaporForm.tsx). Empat komponen (Digital/Undangan/Review/Kesaksian),
 * nilai poin & aturan all-or-nothing SEMUA dari policy.pte_poin_* -- lihat
 * supabase/migrations/0057_pte_harian.sql. Bonus/potongan gaji SENGAJA
 * TIDAK dibangun di sini -- 6 pertanyaan aturan bonus/potongan masih
 * terbuka (instruksi eksplisit CEO).
 */

interface BarisUndangan {
  nama?: string;
  kontak?: string;
  kunci?: string;
}
interface BarisReview {
  nama?: string;
  tanggal?: string;
  kunci?: string;
}
interface BarisKesaksian {
  nama?: string;
  setuju_publikasi?: string;
  kunci?: string;
}

export interface PoinPteHarian {
  poinDigital: number;
  poinUndangan: number;
  poinReview: number;
  poinKesaksian: number;
  poinTotal: number;
}

/** true kalau kolom teks/pilihan terisi (dipakai cek `wajib` per kolom baris). */
function kolomTerisi(v: unknown): boolean {
  return typeof v === 'string' ? v.trim().length > 0 : v != null;
}

/**
 * Baris undangan/review/kesaksian yang SUDAH LENGKAP (kolom wajib terisi +
 * ada bukti baris) -- HANYA baris seperti ini yang dihitung poinnya. Baris
 * setengah isi (mis. nama tanpa bukti) tidak dianggap error di sini (validasi
 * itu urusan forms/validasi.ts saat submit), cuma tidak menyumbang poin.
 */
function barisLengkap<T extends { kunci?: string }>(
  rows: T[] | undefined,
  wajibKeys: (keyof T)[],
  jumlahBukti: (fieldKey: string) => number,
  buktiPrefix: string,
): T[] {
  return (rows ?? []).filter((r) => {
    if (!r.kunci || jumlahBukti(`${buktiPrefix}_${r.kunci}`) === 0) return false;
    return wajibKeys.every((k) => kolomTerisi(r[k]));
  });
}

const PLATFORM_DIGITAL = [
  { field: 'digital_tiktok_tautan', bukti: 'digital_tiktok' },
  { field: 'digital_ig_tautan', bukti: 'digital_ig' },
  { field: 'digital_threads_tautan', bukti: 'digital_threads' },
] as const;

function hitungPoin(
  data: Record<string, unknown>,
  policy: PolicyMap,
  jumlahBukti: (fieldKey: string) => number,
): PoinPteHarian & { undanganRows: BarisUndangan[]; reviewRows: BarisReview[]; kesaksianRows: BarisKesaksian[] } {
  const perPlatform = Number(policy.pte_poin_digital_per_platform);
  let poinDigital = 0;
  for (const p of PLATFORM_DIGITAL) {
    const tautan = typeof data[p.field] === 'string' ? (data[p.field] as string).trim() : '';
    if (tautan.length > 0 && jumlahBukti(p.bukti) > 0) poinDigital += perPlatform;
  }

  const undanganRows = barisLengkap<BarisUndangan>(data.undangan_list as BarisUndangan[] | undefined, ['nama', 'kontak'], jumlahBukti, 'undangan');
  const undanganDihitung = Math.min(undanganRows.length, Number(policy.pte_poin_undangan_target));
  const poinUndangan = undanganDihitung * Number(policy.pte_poin_undangan_per_orang);

  const reviewRows = barisLengkap<BarisReview>(data.review_list as BarisReview[] | undefined, ['nama', 'tanggal'], jumlahBukti, 'review');
  const poinReview = reviewRows.length >= Number(policy.pte_poin_review_target) ? Number(policy.pte_poin_review_lengkap) : 0;

  const kesaksianRows = barisLengkap<BarisKesaksian>(
    data.kesaksian_list as BarisKesaksian[] | undefined,
    ['nama', 'setuju_publikasi'],
    jumlahBukti,
    'kesaksian',
  );
  const poinKesaksian = kesaksianRows.length >= Number(policy.pte_poin_kesaksian_target) ? Number(policy.pte_poin_kesaksian_lengkap) : 0;

  return {
    poinDigital,
    poinUndangan,
    poinReview,
    poinKesaksian,
    poinTotal: poinDigital + poinUndangan + poinReview + poinKesaksian,
    undanganRows,
    reviewRows,
    kesaksianRows,
  };
}

/**
 * Pratinjau poin HARI INI dari nilai form yang sedang diisi -- murni (tidak
 * baca DB), pakai panjang array `_bukti.<key>.<kunciBaris>` yang ada di form
 * sebagai proksi "sudah ada lampiran" -- pola SAMA PERSIS
 * `ringkasanPteHariIni()` lama (lib/api/pte.ts), cuma sumber buktinya per
 * baris, bukan per field.
 */
export function ringkasanPteHarian(data: Record<string, unknown>, policy: PolicyMap): PoinPteHarian {
  const bukti = (data._bukti as Record<string, Record<string, unknown[]>> | undefined) ?? {};

  const jumlahBuktiTabel = (tabelKey: string) => (fieldKey: string) => {
    // fieldKey di sini sudah termasuk prefix (mis. "undangan_<kunci>") --
    // cari nilainya lewat kunci baris yang ada di belakang prefix.
    const kunciBaris = fieldKey.slice(fieldKey.indexOf('_') + 1);
    return bukti[tabelKey]?.[kunciBaris]?.length ?? 0;
  };
  const jumlahBuktiDigital = (fieldKey: string) => (data._bukti as Record<string, unknown[]> | undefined)?.[fieldKey]?.length ?? 0;

  const hasil = hitungPoin(data, policy, (fieldKey: string) => {
    if (fieldKey.startsWith('undangan_')) return jumlahBuktiTabel('undangan_list')(fieldKey);
    if (fieldKey.startsWith('review_')) return jumlahBuktiTabel('review_list')(fieldKey);
    if (fieldKey.startsWith('kesaksian_')) return jumlahBuktiTabel('kesaksian_list')(fieldKey);
    return jumlahBuktiDigital(fieldKey);
  });
  return {
    poinDigital: hasil.poinDigital,
    poinUndangan: hasil.poinUndangan,
    poinReview: hasil.poinReview,
    poinKesaksian: hasil.poinKesaksian,
    poinTotal: hasil.poinTotal,
  };
}

/**
 * Sinkronisasi pte_harian + pte_harian_item saat laporan personal_marketing
 * dikirim -- pola SAMA `sinkronPteDaily` lama: bukti dihitung dari tabel
 * `attachment` SUNGGUHAN (bukan dipercaya dari `_bukti` form state begitu
 * saja), supaya "tanpa bukti = nol poin" tidak bisa disiasati. pte_harian
 * di-upsert (satu baris/hari, pola sama pte_daily); pte_harian_item
 * dihapus lalu ditulis ulang tiap kirim (pola sama sinkronClosing) --
 * supaya baris yang dihapus di form tidak menggantung di database.
 */
export async function sinkronPteHarian(reportId: string, userId: string, data: Record<string, unknown>, policy: PolicyMap): Promise<PoinPteHarian> {
  const supabase = createClient();

  const { data: lampiran, error: errLampiran } = await supabase.from('attachment').select('field_key').eq('report_id', reportId);
  if (errLampiran) throw errLampiran;
  const jumlahLampiran = (fieldKey: string) => (lampiran ?? []).filter((a) => a.field_key === fieldKey).length;

  const hasil = hitungPoin(data, policy, jumlahLampiran);

  const { data: baris, error } = await supabase
    .from('pte_harian')
    .upsert(
      {
        user_id: userId,
        tanggal: tanggalWIB(),
        tiktok_tautan: (data.digital_tiktok_tautan as string) || null,
        ig_tautan: (data.digital_ig_tautan as string) || null,
        threads_tautan: (data.digital_threads_tautan as string) || null,
        poin_digital: hasil.poinDigital,
        poin_undangan: hasil.poinUndangan,
        poin_review: hasil.poinReview,
        poin_kesaksian: hasil.poinKesaksian,
        poin_total: hasil.poinTotal,
        report_id: reportId,
      },
      { onConflict: 'user_id,tanggal' },
    )
    .select('id')
    .single();
  if (error) throw error;
  const pteHarianId = baris.id as string;

  const { error: errHapus } = await supabase.from('pte_harian_item').delete().eq('pte_harian_id', pteHarianId);
  if (errHapus) throw errHapus;

  const items: Record<string, unknown>[] = [
    ...hasil.undanganRows.map((r, i) => ({ pte_harian_id: pteHarianId, jenis: 'undangan', urutan: i + 1, nama: r.nama, kontak: r.kontak })),
    ...hasil.reviewRows.map((r, i) => ({
      pte_harian_id: pteHarianId,
      jenis: 'review',
      urutan: i + 1,
      nama: r.nama,
      tanggal_review: tanggalDariTeks(r.tanggal),
    })),
    ...hasil.kesaksianRows.map((r, i) => ({
      pte_harian_id: pteHarianId,
      jenis: 'kesaksian',
      urutan: i + 1,
      nama: r.nama,
      setuju_publikasi: r.setuju_publikasi === 'ya',
    })),
  ];
  if (items.length > 0) {
    const { error: errItem } = await supabase.from('pte_harian_item').insert(items);
    if (errItem) throw errItem;
  }

  return {
    poinDigital: hasil.poinDigital,
    poinUndangan: hasil.poinUndangan,
    poinReview: hasil.poinReview,
    poinKesaksian: hasil.poinKesaksian,
    poinTotal: hasil.poinTotal,
  };
}

/**
 * Poin maksimal HARIAN (skema PTE Harian, bukan bulanan) -- SATU tempat,
 * dipakai panel "PTE hari ini" (LaporForm.tsx), ringkasan harian di form
 * lain, beranda, dan tabel /marketing. Sebelumnya dihitung inline di
 * LaporForm.tsx sendiri -- diekstrak di sini (audit tampilan skema poin,
 * 20 September 2026) supaya SEMUA konsumen memakai rumus yang SAMA persis,
 * bukan disalin ulang dan berisiko menyimpang.
 */
export function poinMaksimalHarian(policy: PolicyMap): number {
  return (
    Number(policy.pte_poin_digital_per_platform) * 3 +
    Number(policy.pte_poin_undangan_per_orang) * Number(policy.pte_poin_undangan_target) +
    Number(policy.pte_poin_review_lengkap) +
    Number(policy.pte_poin_kesaksian_lengkap)
  );
}

export interface PteHarianBulanRow {
  tanggal: string;
  poin_digital: number;
  poin_undangan: number;
  poin_review: number;
  poin_kesaksian: number;
  poin_total: number;
}

/**
 * Baris `pte_harian` bulan berjalan MILIK SATU USER -- dipakai untuk (a)
 * ringkasan HARI INI (filter tanggal = hari ini dari hasil ini, per
 * komponen, tidak perlu query terpisah) dan (b) akumulasi BULANAN (jumlahkan
 * `poin_total`, hitung berapa hari mencapai `poinMaksimalHarian()` penuh).
 * Pola query SAMA PERSIS `usePteBulanIniUntuk` (lib/api/marketing.ts, tabel
 * `pte_daily` lama) -- cuma tabel & kolomnya beda.
 */
export function usePteHarianBulanIniUntuk(userId: string | null) {
  return useQuery({
    queryKey: ['pte-harian-bulan-ini', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PteHarianBulanRow[]> => {
      const supabase = createClient();
      const [tahun, bulan] = tanggalWIB().split('-');
      const awalBulan = `${tahun}-${bulan}-01`;
      const { data, error } = await supabase
        .from('pte_harian')
        .select('tanggal, poin_digital, poin_undangan, poin_review, poin_kesaksian, poin_total')
        .eq('user_id', userId as string)
        .gte('tanggal', awalBulan)
        .order('tanggal');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Sama seperti di atas, tapi SEMUA user sekaligus -- untuk tabel Dashboard
 * Kontrol Marketing (`/marketing`). `pte_harian_select` (migrasi 0057)
 * sudah mengizinkan kontrol_marketing/ceo/pusat/manager_resto/hrd-kadiv
 * membaca baris siapa pun, jadi satu query tanpa filter user_id cukup --
 * dikelompokkan per user_id di sini, bukan N query terpisah.
 */
export function usePteHarianBulananSemua() {
  return useQuery({
    queryKey: ['pte-harian-bulan-ini-semua'],
    queryFn: async (): Promise<Map<string, PteHarianBulanRow[]>> => {
      const supabase = createClient();
      const [tahun, bulan] = tanggalWIB().split('-');
      const awalBulan = `${tahun}-${bulan}-01`;
      const { data, error } = await supabase
        .from('pte_harian')
        .select('user_id, tanggal, poin_digital, poin_undangan, poin_review, poin_kesaksian, poin_total')
        .gte('tanggal', awalBulan);
      if (error) throw error;
      const peta = new Map<string, PteHarianBulanRow[]>();
      for (const r of (data ?? []) as (PteHarianBulanRow & { user_id: string })[]) {
        const arr = peta.get(r.user_id) ?? [];
        arr.push({
          tanggal: r.tanggal,
          poin_digital: r.poin_digital,
          poin_undangan: r.poin_undangan,
          poin_review: r.poin_review,
          poin_kesaksian: r.poin_kesaksian,
          poin_total: r.poin_total,
        });
        peta.set(r.user_id, arr);
      }
      return peta;
    },
  });
}

/**
 * Ringkasan bulanan (murni, tidak query) dari baris `pte_harian` -- total
 * poin dan berapa HARI yang mencapai poin maksimal harian PENUH. Yang kedua
 * lebih berarti daripada totalnya sendirian (instruksi eksplisit user, 20
 * September 2026): kekurangan satu hari tidak bisa ditutup poin lebih besar
 * di hari lain, jadi "hari penuh" mencerminkan konsistensi, bukan cuma
 * akumulasi. `hariWajib`/`targetBulan` SENGAJA tidak dihitung di sini --
 * `hari_wajib` sudah tersedia dari `v_marketing_bulanan`
 * (`ProgresBulanan.hari_wajib`, lib/api/marketing.ts) yang SUDAH benar
 * mengecualikan cuti disetujui; menghitung ulang di sini berisiko
 * menyimpang dari satu-satunya sumber kebenaran itu.
 */
export function ringkasanPoinBulanan(rows: PteHarianBulanRow[], poinMaksimal: number): { totalPoin: number; hariPenuh: number } {
  return {
    totalPoin: rows.reduce((jumlah, r) => jumlah + r.poin_total, 0),
    hariPenuh: rows.filter((r) => r.poin_total >= poinMaksimal).length,
  };
}

/**
 * Label "Undangan" untuk outlet tertentu -- lewat outlet.unit_kode ->
 * unit_bisnis.label_undangan (migrasi 0057), BUKAN dari profile.divisi
 * (nilainya sekarang cuma "Resto"/"Marketing", tidak membedakan Indosteak
 * dari Indokopi -- lihat laporan investigasi sebelum build). `null` kalau
 * outlet belum ditautkan ke unit apa pun, atau unit itu belum punya aturan
 * PTE (Koperumnas/DTI-Precast/Rukost/Thrifting sekarang) -- pemanggil WAJIB
 * menampilkan itu sebagai "belum ada aturan", bukan menebak default.
 */
export function useLabelUndanganOutlet(outletId: string | null | undefined) {
  return useQuery({
    queryKey: ['pte-label-undangan-outlet', outletId ?? null],
    enabled: Boolean(outletId),
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('outlet').select('unit_kode, unit_bisnis(label_undangan)').eq('id', outletId as string).maybeSingle();
      if (error) throw error;
      const unit = data?.unit_bisnis as unknown as { label_undangan: string | null } | { label_undangan: string | null }[] | null;
      if (!unit) return null;
      return Array.isArray(unit) ? (unit[0]?.label_undangan ?? null) : unit.label_undangan;
    },
  });
}

/**
 * true kalau SALAH SATU outlet ini terhubung ke unit bisnis yang PUNYA aturan
 * PTE (unit_bisnis.label_undangan tidak null -- migrasi 0057: cuma Indosteak &
 * Indokopi). Dipakai Beranda untuk memutuskan apakah kartu PTE ditampilkan:
 * orang yang tidak bekerja di unit ber-PTE (mis. HRD, kantor pusat) tidak
 * perlu melihatnya. `false` untuk daftar outlet kosong.
 */
export function useAdaAturanPteDiOutlet(outletIds: string[]) {
  const kunci = [...outletIds].sort();
  return useQuery({
    queryKey: ['pte-ada-aturan-di-outlet', kunci],
    enabled: kunci.length > 0,
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('outlet').select('id, unit_bisnis(label_undangan)').in('id', kunci);
      if (error) throw error;
      return (data ?? []).some((o) => {
        const unit = o.unit_bisnis as unknown as { label_undangan: string | null } | { label_undangan: string | null }[] | null;
        if (!unit) return false;
        const label = Array.isArray(unit) ? unit[0]?.label_undangan : unit.label_undangan;
        return label !== null && label !== undefined;
      });
    },
  });
}
