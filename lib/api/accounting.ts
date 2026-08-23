'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Blok 8 "Kebutuhan Pembangunan" + blok 10 "Kontraktor/Supplier/DTI" (yang
 * otomatis) -- sumbernya `v_kebutuhan_pembangunan_accounting` (migrasi 0014,
 * security-definer + penjaga `boleh_lihat_rekap('accounting')`). Accounting
 * tidak punya akses baris ke `pembangunan`/`dti`, lihat 04-CATATAN-TEKNIS.md
 * §3.4b.
 */
export interface MaterialBorongan {
  material: string | null;
  kebutuhan: string | null;
  estimasi_biaya: string | null;
  dibutuhkan_tanggal: string | null;
}

export interface InfrastrukturRencana {
  lokasi: string | null;
  pekerjaan: string | null;
  kontraktor: string | null;
  anggaran: string | null;
  target_selesai: string | null;
}

export interface KebutuhanPembangunanAccounting {
  materialBorongan: MaterialBorongan[];
  totalMaterial: number;
  infrastrukturRencana: InfrastrukturRencana[];
  totalInfrastruktur: number;
  precastDti: number;
}

export function useKebutuhanPembangunanAccounting(enabled = true) {
  return useQuery({
    queryKey: ['kebutuhan-pembangunan-accounting'],
    queryFn: async (): Promise<KebutuhanPembangunanAccounting> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_kebutuhan_pembangunan_accounting')
        .select('material_borongan, total_material, infrastruktur_rencana, total_infrastruktur, precast_dti')
        .maybeSingle();
      if (error) throw error;
      return {
        materialBorongan: (data?.material_borongan as MaterialBorongan[] | undefined) ?? [],
        totalMaterial: Number(data?.total_material ?? 0),
        infrastrukturRencana: (data?.infrastruktur_rencana as InfrastrukturRencana[] | undefined) ?? [],
        totalInfrastruktur: Number(data?.total_infrastruktur ?? 0),
        precastDti: Number(data?.precast_dti ?? 0),
      };
    },
    enabled,
  });
}

/**
 * Blok 13 "Rekonsiliasi Resto" -- omzet versi Manager Resto & versi Ita per
 * outlet, ditampilkan berdampingan dengan angka bank yang diketik Accounting
 * sendiri. TIDAK lewat view security-definer -- role `accounting` SUDAH
 * punya `can_see_report()` langsung ke `manager_resto` dan `ita`
 * (0002_rls.sql), jadi query biasa saja, sesuai instruksi "jangan pakai
 * security definer di mana pun yang tidak perlu". Kunci `omzet_indosteak`/
 * `omzet_indokopi` di laporan Ita mengikuti kontrak yang sama dengan
 * `v_selisih_resto` (03-CALC-SPEC.md §4.4, `'omzet_' || lower(nama outlet)`).
 */
export interface OmzetRestoRow {
  outlet: string;
  omzetManager: number | null;
  omzetIta: number | null;
}

export function useOmzetRestoHariIni(enabled = true) {
  return useQuery({
    queryKey: ['omzet-resto-hari-ini'],
    queryFn: async (): Promise<OmzetRestoRow[]> => {
      const supabase = createClient();
      const tanggal = tanggalWIB();

      const [{ data: laporanManager, error: errManager }, { data: laporanIta, error: errIta }] = await Promise.all([
        supabase
          .from('report')
          .select('data, outlet:outlet_id(nama)')
          .eq('form_key', 'manager_resto')
          .eq('tanggal', tanggal)
          .neq('status', 'draft'),
        supabase.from('report').select('data').eq('form_key', 'ita').eq('tanggal', tanggal).neq('status', 'draft').maybeSingle(),
      ]);
      if (errManager) throw errManager;
      if (errIta) throw errIta;

      const dataIta = (laporanIta?.data as Record<string, unknown> | undefined) ?? {};

      return (laporanManager ?? []).map((r) => {
        // Embed report.outlet_id -> outlet (FK ke-satu) selalu objek tunggal saat
        // runtime -- lihat catatan serupa di lib/api/pembangunan.ts.
        const outlet = (r.outlet as unknown as { nama: string } | null)?.nama ?? '—';
        const kunciIta = `omzet_${outlet.toLowerCase()}`;
        const omzetIta = dataIta[kunciIta];
        const dataManager = r.data as Record<string, unknown>;
        return {
          outlet,
          omzetManager: typeof dataManager.total_omzet === 'number' ? dataManager.total_omzet : null,
          omzetIta: typeof omzetIta === 'number' ? omzetIta : null,
        };
      });
    },
    enabled,
  });
}
