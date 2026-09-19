'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Fungsi campuran YANG DIBAWA (docs/RENCANA-PROYEK-BARU.md §3 poin 3, 3
 * September 2026) -- dulu file ini juga punya `usePembangunanUntukTanggal`
 * (form `pembangunan`, DIBUANG), sekarang dipindah ke lib/api/pembangunan.ts
 * supaya file itu bisa dihapus utuh nanti tanpa mencari-cari fungsi yang
 * masih dipakai. Kedua fungsi di bawah ini INTI sistem baru (keuangan +
 * silang-cek omzet resto), tetap dipakai.
 */

/** 03-CALC-SPEC.md §4.3 -- empat angka mutlak utk TANGGAL yang diminta, sama yang dilihat Sabrina (Task 21 Bagian 11). */
export interface KeuanganRekap {
  tanggal: string;
  totalMasuk: number;
  totalKeluar: number;
  net: number;
  warna: 'hijau' | 'kuning' | 'merah' | null;
}

export function useKeuanganRekapUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['keuangan-rekap-untuk-tanggal', tanggal],
    queryFn: async (): Promise<KeuanganRekap | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_keuangan_rekap').select('*').eq('tanggal', tanggal).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        tanggal: data.tanggal,
        totalMasuk: Number(data.total_masuk ?? 0),
        totalKeluar: Number(data.total_keluar ?? 0),
        net: Number(data.net ?? 0),
        warna: data.warna,
      };
    },
    enabled,
  });
}

/**
 * 03-CALC-SPEC.md §4.4 -- silang-cek omzet resto utk TANGGAL yang diminta,
 * per outlet. Diperbarui 30 Agustus 2026 (migrasi 0036) -- `versiIta`
 * diganti `versiKontrolFnb`, mengikuti form `ita` yang dipecah jadi
 * `thrifting`+`kontrol_fnb`.
 */
export interface SelisihRestoRow {
  outlet: string;
  versiManager: number | null;
  versiKontrolFnb: number | null;
  selisih: number | null;
}

export function useSelisihRestoUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['selisih-resto-untuk-tanggal', tanggal],
    queryFn: async (): Promise<SelisihRestoRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('selisih_resto_untuk_tanggal', { p_tanggal: tanggal }).order('outlet');
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        outlet: r.outlet as string,
        versiManager: r.versi_manager as number | null,
        versiKontrolFnb: r.versi_kontrol_fnb as number | null,
        selisih: r.selisih as number | null,
      }));
    },
    enabled,
  });
}

/**
 * Silang-Cek Omzet Resto -- TIGA sumber untuk satu tanggal (migrasi 0062,
 * omzet_tiga_sumber_untuk_tanggal): Manager Resto (ketikan), Kontrol F&B/Ita
 * (ketikan), POS (mesin). Semua outlet aktif; angka yang belum ada = null
 * (BUKAN 0). Selisih = ketikan - pembanding (positif = ketikan lebih tinggi),
 * null kalau salah satu angka tidak ada; selisih terhadap POS hanya untuk hari
 * bisnis yang sudah tutup. Semua aturan itu dihitung di database, bukan di sini.
 */
export type PosStatus =
  | 'final' // hari bisnis sudah tutup -- angka POS final
  | 'berjalan' // hari bisnis berjalan -- angka POS SEMENTARA
  | 'tanpa_transaksi' // tercakup sinkron tapi 0 order -> "Belum ada transaksi POS", BUKAN Rp 0
  | 'belum_dipetakan'
  | 'belum_pernah_sinkron'
  | 'basi' // sinkron terakhir melewati batas umur -> angka disembunyikan
  | 'belum_ada_data_pos' // di luar cakupan sinkron / metadata belum ada
  | 'belum_dimulai'; // hari bisnis belum mulai

export interface OmzetTigaSumberRow {
  outletId: string;
  outlet: string;
  manager: number | null;
  kontrolFnb: number | null;
  posStatus: PosStatus;
  posUangDiterima: number | null;
  posPenjualanBersih: number | null;
  posJumlahOrder: number | null;
  posBatasHari: string | null;
  posBatasTerkonfirmasi: boolean | null;
  selisihManagerKontrol: number | null;
  selisihManagerPos: number | null;
  selisihKontrolPos: number | null;
}

export function useOmzetTigaSumberUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['omzet-tiga-sumber-untuk-tanggal', tanggal],
    queryFn: async (): Promise<OmzetTigaSumberRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('omzet_tiga_sumber_untuk_tanggal', { p_tanggal: tanggal });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        outletId: r.outlet_id as string,
        outlet: r.outlet as string,
        manager: (r.manager as number | null) ?? null,
        kontrolFnb: (r.kontrol_fnb as number | null) ?? null,
        posStatus: r.pos_status as PosStatus,
        posUangDiterima: (r.pos_uang_diterima as number | null) ?? null,
        posPenjualanBersih: (r.pos_penjualan_bersih as number | null) ?? null,
        posJumlahOrder: (r.pos_jumlah_order as number | null) ?? null,
        posBatasHari: (r.pos_batas_hari as string | null) ?? null,
        posBatasTerkonfirmasi: (r.pos_batas_terkonfirmasi as boolean | null) ?? null,
        selisihManagerKontrol: (r.selisih_manager_kontrol as number | null) ?? null,
        selisihManagerPos: (r.selisih_manager_pos as number | null) ?? null,
        selisihKontrolPos: (r.selisih_kontrol_pos as number | null) ?? null,
      }));
    },
    enabled,
  });
}

/** Status sinkron POS (satu baris): stempel waktu, basi/tidak, percobaan terakhir gagal, jumlah outlet POS belum dipetakan. */
export interface StatusSinkronPos {
  pernahBerhasil: boolean;
  dataPer: string | null;
  umurJam: number | null;
  maksUmurJam: number;
  basi: boolean;
  percobaanTerakhir: string | null;
  percobaanStatus: 'berhasil' | 'gagal' | null;
  percobaanGalat: string | null;
  jumlahBelumDipetakan: number;
}

export function useStatusSinkronPos(enabled = true) {
  return useQuery({
    queryKey: ['status-sinkron-pos'],
    queryFn: async (): Promise<StatusSinkronPos> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('status_sinkron_pos');
      if (error) throw error;
      const r = ((data ?? []) as Record<string, unknown>[])[0];
      if (!r) throw new Error('status_sinkron_pos tidak mengembalikan baris.');
      return {
        pernahBerhasil: Boolean(r.pernah_berhasil),
        dataPer: (r.data_per as string | null) ?? null,
        umurJam: r.umur_jam === null || r.umur_jam === undefined ? null : Number(r.umur_jam),
        maksUmurJam: Number(r.maks_umur_jam),
        basi: Boolean(r.basi),
        percobaanTerakhir: (r.percobaan_terakhir as string | null) ?? null,
        percobaanStatus: (r.percobaan_status as 'berhasil' | 'gagal' | null) ?? null,
        percobaanGalat: (r.percobaan_galat as string | null) ?? null,
        jumlahBelumDipetakan: Number(r.jumlah_belum_dipetakan ?? 0),
      };
    },
    enabled,
    staleTime: 60_000,
  });
}
