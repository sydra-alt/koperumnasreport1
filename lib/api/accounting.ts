'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';
import { angkaDariTeks } from '../teksAngka';

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
 * security definer di mana pun yang tidak perlu". Kunci `omzet_<slug>` di
 * laporan Ita mengikuti kontrak yang sama dengan
 * `selisih_resto_untuk_tanggal()` (migrasi 0031, `'omzet_' || outlet.slug`
 * -- BUKAN lagi `lower(nama outlet)`, diganti sejak Indosteak jadi dua
 * outlet dengan nama berspasi/berbagi awalan).
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
          .select('data, outlet:outlet_id(nama, slug)')
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
        const outletEmbed = r.outlet as unknown as { nama: string; slug: string } | null;
        const outlet = outletEmbed?.nama ?? '—';
        const kunciIta = `omzet_${outletEmbed?.slug ?? ''}`;
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

/**
 * Blok 6 "Cashflow Hari Ini" -- catatan blok itu sendiri (f17-accounting.ts)
 * bilang uang masuk/keluar/net "dihitung otomatis dari blok 1, 2, dan 4",
 * BUKAN diketik ulang (§3.5b, "satu angka, satu pengisi" berlaku di dalam
 * satu form juga -- sama seperti manager_resto blok 12, Task 16). Angka yang
 * sama ini WAJIB disuntikkan ke `report.data` saat kirim (lihat
 * components/LaporForm.tsx `tanganiKirim`), karena `v_keuangan_rekap`
 * (03-CALC-SPEC.md §4.3, dibuat Task 20) membaca `data->>'total_masuk'` dan
 * `data->>'total_keluar'` langsung dari kolom itu -- kalau tidak pernah
 * ditulis, Bagian 11 Laporan Terpusat Sabrina (Task 21) akan selamanya
 * kosong tanpa error apa pun (jebakan §7 poin 3, kunci JSON tidak sinkron).
 *
 * Blok 2 "metode_*" (Bank/Cash/QRIS/Lainnya) SENGAJA tidak ikut dijumlah --
 * itu rincian CARA masuknya uang yang sama, bukan pemasukan tambahan;
 * menjumlahkannya akan menghitung dobel.
 */
/**
 * Task 20 -- panel keuangan CEO (bukan Sabrina). CEO sudah punya akses baris
 * PENUH ke laporan `accounting` lewat `can_see_report()` (`has_role('ceo')`
 * ada di klausa pertama), jadi ini query BIASA ke `report`, bukan lewat
 * `v_keuangan_rekap` -- view 4-angka itu khusus utk pembaca yang TIDAK
 * berhak atas barisnya (Sabrina). Rule #7 CLAUDE.md ("semua agregasi lewat
 * view") soal AGREGASI LINTAS LAPORAN; ini menjumlahkan field DALAM SATU
 * baris yang sudah dipunya CEO, pola yang sama dengan `hitungCashflowHariIni`
 * di atas dan `ringkasanKebutuhanBesok`/`ringkasanPteHariIni` di modul lain.
 */
export function useLaporanAccountingHariIni(enabled = true, tanggal: string = tanggalWIB()) {
  return useQuery({
    queryKey: ['laporan-accounting-untuk-tanggal', tanggal],
    queryFn: async (): Promise<Record<string, unknown> | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data')
        .eq('form_key', 'accounting')
        .eq('tanggal', tanggal)
        .neq('status', 'draft')
        .maybeSingle();
      if (error) throw error;
      return (data?.data as Record<string, unknown> | undefined) ?? null;
    },
    enabled,
  });
}

export interface RingkasanKeuanganCeo {
  danaTersedia: number;
  piutangTotal: number;
  kewajiban7Hari: number;
  kewajiban30Hari: number;
  surplusKekurangan: number;
}

/**
 * ⚠️ "Surplus/kekurangan" TIDAK punya rumus eksplisit di 03-CALC-SPEC.md §4
 * (istilah itu cuma muncul di daftar kerja Task 20 di task board, bukan
 * sebagai formula bernomor). Dipilih di sini: `danaTersedia - kewajiban30Hari`
 * -- satu-satunya field kewajiban yang benar-benar diketik sebagai TOTAL
 * (`total_kewajiban_30_hari`, blok 7), bukan angka yang ditebak. "Kewajiban
 * 7 hari" TETAP dihitung terpisah (dijumlah dari tabel `jatuh_tempo_7_hari`)
 * dan ditampilkan sendiri karena diminta task board, tapi TIDAK dipakai di
 * rumus surplus/kekurangan supaya tidak menghitung dobel dengan yang 30 hari.
 * Label di UI menyebut ini eksplisit "vs kewajiban 30 hari" -- BUKAN diklaim
 * sebagai KPI resmi yang sudah disetujui CEO. Kalau CEO mau rumus lain,
 * yang berubah cukup fungsi ini, satu tempat.
 */
export function hitungRingkasanKeuanganCeo(data: Record<string, unknown>): RingkasanKeuanganCeo {
  const uang = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : 0);
  const daftarSaldoBank = (data.daftar_saldo_bank as Record<string, unknown>[] | undefined) ?? [];
  const jatuhTempo7Hari = (data.jatuh_tempo_7_hari as Record<string, unknown>[] | undefined) ?? [];

  const totalSaldoBank = daftarSaldoBank.reduce((total, r) => total + angkaDariTeks(r.saldo), 0);
  const danaTersedia = totalSaldoBank + uang('cash_kantor') + uang('cash_outlet') + uang('cash_lainnya_saldo');
  const piutangTotal =
    uang('piutang_konsumen') +
    uang('tunggakan_konsumen') +
    uang('piutang_kontraktor') +
    uang('piutang_operasional_lahan') +
    uang('piutang_lainnya');
  const kewajiban7Hari = jatuhTempo7Hari.reduce((total, r) => total + angkaDariTeks(r.nominal), 0);
  const kewajiban30Hari = uang('total_kewajiban_30_hari');

  return {
    danaTersedia,
    piutangTotal,
    kewajiban7Hari,
    kewajiban30Hari,
    surplusKekurangan: danaTersedia - kewajiban30Hari,
  };
}

export function hitungCashflowHariIni(data: Record<string, unknown>): { totalMasuk: number; totalKeluar: number; net: number } {
  const uang = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : 0);
  const penerimaanLain = (data.penerimaan_lain as Record<string, unknown>[] | undefined) ?? [];
  const daftarKeluar = (data.daftar_uang_keluar as Record<string, unknown>[] | undefined) ?? [];

  const totalMasuk =
    uang('cicilan_konsumen') +
    uang('booking_dp') +
    uang('pelunasan') +
    uang('pembayaran_lainnya_konsumen') +
    uang('masuk_indokopi') +
    uang('masuk_indosteak') +
    uang('masuk_unit_usaha_lainnya') +
    penerimaanLain.reduce((total, r) => total + angkaDariTeks(r.nominal), 0);

  const totalKeluar = daftarKeluar.reduce((total, r) => total + angkaDariTeks(r.nominal), 0);

  return { totalMasuk, totalKeluar, net: totalMasuk - totalKeluar };
}
