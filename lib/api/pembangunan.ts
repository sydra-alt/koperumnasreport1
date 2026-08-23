'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

export interface PembangunanPerLokasiRow {
  lokasi: string;
  target: number | null;
  sedang_dibangun: number | null;
  finishing: number | null;
  selesai_hari_ini: number | null;
  belum_mulai: number | null;
}

/** Data material per lokasi — diambil dari report.data PIC Lokasi. */
export interface MaterialPerLokasiRow {
  lokasi: string;
  material_cukup: boolean | null;
  material_kurang: { material?: string; kebutuhan?: string; untuk_unit?: string; dibutuhkan_tanggal?: string }[];
  kiriman_precast_jumlah: number | null;
  kiriman_kekurangan: string | null;
}

/** Data infrastruktur per lokasi — diambil dari report.data PIC Lokasi. */
export interface InfrastrukturPerLokasiRow {
  lokasi: string;
  jalan_status: string | null;
  listrik_status: string | null;
  air_status: string | null;
  drainase_baik: boolean | string | null;
  penerangan_baik: boolean | string | null;
  gerbang_baik: boolean | string | null;
  infrastruktur_kebutuhan: string | null;
}

export interface RekapPicLokasi {
  unit: PembangunanPerLokasiRow[];
  material: MaterialPerLokasiRow[];
  infrastruktur: InfrastrukturPerLokasiRow[];
}

/**
 * Rekap data PIC Lokasi hari ini untuk form Pembangunan (blok 1/3/5,
 * read-only -- §3.5b "satu angka, satu pengisi"). Mengambil report.data
 * langsung (bukan lewat view) supaya bisa menampilkan data terstruktur
 * (tabel, ya_tidak) yang sulit dimodelkan lewat SQL view.
 *
 * `v_pembangunan_per_lokasi` (migrasi 0008) TIDAK dipakai fungsi ini --
 * view itu cuma untuk agregasi skalar sederhana (Task 20, dashboard CEO),
 * bukan untuk menampilkan tabel/status bersarang seperti di sini.
 *
 * PERHATIAN -- RLS: query ini tunduk pada `report_select`/`can_see_report()`
 * (0002_rls.sql) seperti query lain. Per definisi saat ini, `can_see_report`
 * TIDAK memberi siapa pun ber-role `kadiv` (termasuk Kepala Pembangunan
 * sungguhan, lihat DATA-KARYAWAN.md -- Ronald, role kadiv+karyawan, BUKAN
 * ceo/pusat) akses baca ke laporan `pic_lokasi` milik orang lain. Sampai
 * ada policy baru yang menutup celah ini, hook ini akan mengembalikan
 * baris KOSONG untuk Kepala Pembangunan sungguhan walau PIC sudah kirim
 * laporan -- dikonfirmasi lewat scripts/uji-rls-gap-pembangunan.mjs.
 * Jangan dianggap "belum ada yang lapor" tanpa mengecek RLS dulu.
 */
export function useRekapPicLokasi(enabled = true) {
  return useQuery({
    queryKey: ['rekap-pic-lokasi-hari-ini'],
    queryFn: async (): Promise<RekapPicLokasi> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, lokasi:lokasi_id(nama)')
        .eq('form_key', 'pic_lokasi')
        .eq('tanggal', tanggalWIB())
        .neq('status', 'draft');
      if (error) throw error;

      const unit: PembangunanPerLokasiRow[] = [];
      const material: MaterialPerLokasiRow[] = [];
      const infrastruktur: InfrastrukturPerLokasiRow[] = [];

      for (const row of data) {
        // Embed report.lokasi_id -> lokasi (FK ke-satu) selalu berupa objek tunggal
        // saat runtime, bukan array -- tipe bawaan supabase-js keliru menduganya
        // array karena proyek ini tidak memakai tipe skema hasil generate.
        const lok = (row.lokasi as unknown as { nama: string } | null)?.nama ?? '—';
        const d = row.data as Record<string, unknown>;

        unit.push({
          lokasi: lok,
          target: asInt(d.target_unit),
          sedang_dibangun: asInt(d.unit_dibangun),
          finishing: asInt(d.unit_finishing),
          selesai_hari_ini: asInt(d.unit_selesai),
          belum_mulai: asInt(d.unit_belum_mulai),
        });

        material.push({
          lokasi: lok,
          material_cukup: asBool(d.material_cukup),
          material_kurang: Array.isArray(d.material_kurang) ? d.material_kurang : [],
          kiriman_precast_jumlah: asInt(d.kiriman_precast_jumlah),
          kiriman_kekurangan: asStr(d.kiriman_kekurangan),
        });

        infrastruktur.push({
          lokasi: lok,
          jalan_status: asStr(d.jalan_status),
          listrik_status: asStr(d.listrik_status),
          air_status: asStr(d.air_status),
          drainase_baik: d.drainase_baik as boolean | string | null ?? null,
          penerangan_baik: d.penerangan_baik as boolean | string | null ?? null,
          gerbang_baik: d.gerbang_baik as boolean | string | null ?? null,
          infrastruktur_kebutuhan: asStr(d.infrastruktur_kebutuhan),
        });
      }

      return { unit, material, infrastruktur };
    },
    enabled,
  });
}

function asInt(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'ya' || v === 'true') return true;
  if (v === 'tidak' || v === 'false') return false;
  return null;
}

function asStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}
