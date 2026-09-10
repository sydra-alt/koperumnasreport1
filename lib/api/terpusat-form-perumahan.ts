'use client';

/**
 * Fungsi Laporan Terpusat yang TERIKAT form perumahan yang DIBUANG
 * (docs/RENCANA-PROYEK-BARU.md §2-§3, 2-3 September 2026) -- dipisah dari
 * lib/api/terpusat.ts (dulu isinya campur dengan fungsi yang masih dipakai:
 * useLaporanHariIni generik, useMarketingUntukTanggal, useKaryawanTertinggal)
 * SUPAYA gampang dihapus sekaligus lewat file ini, bukan dicari-cari lagi
 * satu-satu di file yang isinya campuran.
 *
 * Ketiga fungsi di sini terikat form `cs` dan `pic_lokasi` -- KEDUANYA ada
 * di daftar 9 form yang dinonaktifkan lewat assignment (migrasi 0045).
 * `app/terpusat/page.tsx` MASIH memanggil ketiganya untuk sekarang (halaman
 * itu sendiri belum ditulis ulang, lihat §3 poin 4 dokumen) -- pemindahan
 * ini SENGAJA cuma memindah lokasi kode, BUKAN mengubah/menghapus perilaku
 * apa pun, supaya halaman Terpusat yang ada tidak rusak sebelum giliran
 * ditulis ulang tiba.
 *
 * `security` (form ke-16, masih terikat `lokasi`) SENGAJA TIDAK ikut
 * dipindah ke sini -- CEO sedang menanyakan apakah form itu tetap dipakai
 * untuk resto/thrifting. `useSecurityUntukTanggal` tetap di
 * lib/api/terpusat.ts sampai ada jawaban, tidak disentuh sama sekali.
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * §2 CS -- sejak Koreksi 2 (30 Agustus 2026) form `cs` bisa punya sampai 7
 * pengisi sekaligus dalam satu hari (Avril/Anne/Fur + 4 inservice
 * security/GA yang juga bertugas CS kalau ada konsumen datang), jadi TIDAK
 * bisa lagi diasumsikan satu baris per hari seperti `useLaporanHariIni`.
 * Kembalikan daftar per pengisi -- pemanggil yang menjumlahkan angka &
 * menampilkan masalah urgent per orang.
 */
export interface LaporanCsHariIni {
  penulisNama: string;
  submittedAt: string | null;
  data: Record<string, unknown>;
}

export function useLaporanCsHariIni(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['laporan-cs-hari-ini-terpusat', tanggal],
    queryFn: async (): Promise<LaporanCsHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, submitted_at, author:author_id(nama)')
        .eq('form_key', 'cs')
        .eq('tanggal', tanggal)
        .neq('status', 'draft');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        penulisNama: (r.author as unknown as { nama: string } | null)?.nama ?? '—',
        submittedAt: r.submitted_at,
        data: r.data as Record<string, unknown>,
      }));
    },
    enabled,
  });
}

/** §9 STK -- RPC `stk_untuk_tanggal` (migrasi 0020), SUM lintas lokasi utk tanggal yang diminta. Bagian dari form `pic_lokasi`. */
export interface StkHariIni {
  total: number;
  sudahDitempati: number;
  belumDitempati: number;
  rumahKosong: number;
  perluMaintenance: number;
}

export function useStkUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['stk-untuk-tanggal', tanggal],
    queryFn: async (): Promise<StkHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('stk_untuk_tanggal', { p_tanggal: tanggal }).single();
      if (error) throw error;
      const baris = data as Record<string, unknown> | null;
      return {
        total: Number(baris?.stk_total ?? 0),
        sudahDitempati: Number(baris?.sudah_ditempati ?? 0),
        belumDitempati: Number(baris?.belum_ditempati ?? 0),
        rumahKosong: Number(baris?.rumah_kosong ?? 0),
        perluMaintenance: Number(baris?.perlu_maintenance ?? 0),
      };
    },
    enabled,
  });
}

/** §8 Kontrol Per Lokasi -- listing langsung (bukan agregasi) utk tanggal yang diminta, pusat/ceo sudah berhak baca baris `pic_lokasi`. */
export interface PicLokasiHariIni {
  lokasi: string;
  picNama: string;
  data: Record<string, unknown>;
}

export function usePicLokasiUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['pic-lokasi-untuk-tanggal', tanggal],
    queryFn: async (): Promise<PicLokasiHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, lokasi:lokasi_id(nama), author:author_id(nama)')
        .eq('form_key', 'pic_lokasi')
        .eq('tanggal', tanggal)
        .neq('status', 'draft');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        lokasi: (r.lokasi as unknown as { nama: string } | null)?.nama ?? '—',
        picNama: (r.author as unknown as { nama: string } | null)?.nama ?? '—',
        data: r.data as Record<string, unknown>,
      }));
    },
    enabled,
  });
}
