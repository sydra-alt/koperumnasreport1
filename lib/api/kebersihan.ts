'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB, jamWIB } from '../tanggal';

/**
 * Lima slot Laporan Kebersihan (CEO, 6 September 2026) -- TETAP, bukan
 * dari data/policy, sama seperti tahapan absen. `key` dipakai sebagai
 * `attachment.field_key`.
 */
export const SLOT_KEBERSIHAN = [
  { key: 'bar', label: 'Bar' },
  { key: 'toilet', label: 'Toilet' },
  { key: 'meja', label: 'Meja' },
  { key: 'kursi', label: 'Kursi' },
  { key: 'area_bebas', label: 'Area bebas' },
] as const;

export type SlotKebersihan = (typeof SLOT_KEBERSIHAN)[number]['key'];

export interface OutletKebersihan {
  id: string;
  nama: string;
  jamBuka: string | null;
}

/**
 * Outlet yang boleh diisi Kebersihan oleh user ini -- dibaca dari
 * `assignment` (migrasi 0053, sekarang mencerminkan SEMUA orang yang punya
 * `penugasan_absen` di titik yang terhubung ke outlet itu, BUKAN cuma
 * manager_resto). `assignment` dipertahankan sebagai sumber UI supaya
 * Beranda/nav (`hitungTugasHariIni`/`tabLaporDinamis`, generik) tetap
 * berfungsi tanpa perubahan tambahan.
 */
export function useOutletKebersihanSaya(userId: string | undefined) {
  return useQuery({
    queryKey: ['outlet-kebersihan-saya', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<OutletKebersihan[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('assignment')
        .select('outlet:outlet_id(id, nama, jam_buka)')
        .eq('user_id', userId as string)
        .eq('form_key', 'kebersihan');
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.outlet as unknown as { id: string; nama: string; jam_buka: string | null } | null)
        .filter((o): o is { id: string; nama: string; jam_buka: string | null } => o !== null)
        .map((o) => ({ id: o.id, nama: o.nama, jamBuka: o.jam_buka }));
    },
  });
}

/**
 * Batas kirim "HH:mm" WIB = outlet.jam_buka + kebersihan_toleransi_menit.
 * `null` kalau outlet BELUM diisi jam_buka -- TIDAK ADA batas sama sekali
 * (instruksi eksplisit CEO, 6 September 2026: jangan jatuh ke
 * deadline_default, laporan pagi akan tercatat "tepat waktu" secara palsu).
 */
export function hitungBatasKebersihan(jamBuka: string | null, toleransiMenit: number): string | null {
  if (!jamBuka) return null;
  const [jamStr, menitStr] = jamBuka.split(':');
  const totalMenit = (Number(jamStr) * 60 + Number(menitStr) + toleransiMenit) % (24 * 60);
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;
  return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
}

export function apakahTerlambatKebersihan(batas: string | null): boolean {
  return batas !== null && jamWIB() > batas;
}

/**
 * Pastikan baris `report` BERSAMA untuk outlet+hari ini ada -- lewat RPC
 * `kebersihan_pastikan_laporan` (migrasi 0053), BUKAN `report_insert`
 * generik (author-locked, tidak cocok untuk "satu laporan dipakai bersama").
 */
export function usePastikanLaporanKebersihan() {
  return useMutation({
    mutationFn: async (outletId: string): Promise<string> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('kebersihan_pastikan_laporan', { p_outlet_id: outletId });
      if (error) throw error;
      return data as string;
    },
  });
}

export interface FotoKebersihan {
  id: string;
  slot: string;
  path: string;
  createdAt: string;
  uploadedByNama: string | null;
}

/**
 * Foto yang sudah terisi utk laporan ini -- termasuk `uploadedByNama`
 * (dibaca lewat `att_select`, diperluas migrasi 0053 supaya rekan seoutlet,
 * bukan cuma penulis baris, bisa melihat siapa sudah mengisi slot mana).
 */
export function useFotoKebersihanHariIni(reportId: string | null) {
  return useQuery({
    queryKey: ['foto-kebersihan', reportId],
    enabled: Boolean(reportId),
    queryFn: async (): Promise<FotoKebersihan[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('attachment')
        .select('id, field_key, path, created_at, pengunggah:uploaded_by(nama)')
        .eq('report_id', reportId as string);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        slot: r.field_key,
        path: r.path,
        createdAt: r.created_at,
        uploadedByNama: (r.pengunggah as unknown as { nama: string } | null)?.nama ?? null,
      }));
    },
  });
}

async function unggahFotoKebersihan(reportId: string, slot: string, blob: Blob, accessToken: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Konfigurasi Supabase belum lengkap.');

  // Path {reportId}/{slot}/... -- HARUS cocok pola `bukti_upload`/`bukti_read`
  // (folder pertama = report.id, migrasi awal bucket 'bukti'). Bucket dan
  // RLS-nya TIDAK dibuat baru -- reuse infrastruktur lampiran yang sudah ada,
  // diperluas migrasi 0053 supaya rekan seoutlet (bukan cuma penulis baris)
  // juga bisa unggah ke laporan bersama ini.
  const path = `${reportId}/${slot}/${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/bukti/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    },
    body: blob,
  });
  if (!res.ok) {
    const teks = await res.text().catch(() => '');
    throw new Error(`Unggah foto gagal (${res.status}): ${teks || 'kesalahan server'}`);
  }
  return path;
}

export function useKirimFotoKebersihan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, slot, blob }: { reportId: string; slot: string; blob: Blob }) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Belum masuk.');

      const path = await unggahFotoKebersihan(reportId, slot, blob, session.access_token);

      // Insert metadata lewat RPC `kebersihan_catat_foto` (migrasi 0053),
      // BUKAN insert langsung ke `attachment` -- `att_insert` (author_id =
      // auth.uid()) TIDAK dilonggarkan, dipakai 14 form lain. RPC ini
      // mengisi `uploaded_by` dari auth.uid() di server.
      const { error } = await supabase.rpc('kebersihan_catat_foto', {
        p_report_id: reportId,
        p_slot: slot,
        p_path: path,
        p_mime: 'image/jpeg',
        p_bytes: blob.size,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['foto-kebersihan', variables.reportId] });
    },
  });
}

/** Tandai laporan selesai -- lewat RPC `kebersihan_selesaikan_laporan` (migrasi 0053), menghitung status dari jam_buka outlet. */
export function useSelesaikanLaporanKebersihan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('kebersihan_selesaikan_laporan', { p_report_id: reportId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-hari-ini-kebersihan'] });
    },
  });
}

/** Status laporan Kebersihan (outlet+hari ini) -- dibaca via `report_select`, diperluas migrasi 0053 utk rekan seoutlet. */
export interface ReportKebersihanHariIni {
  id: string;
  status: 'draft' | 'terkirim' | 'terlambat';
  submittedAt: string | null;
}

export function useReportKebersihanHariIni(outletId: string | null) {
  return useQuery({
    queryKey: ['report-hari-ini-kebersihan', outletId, tanggalWIB()],
    enabled: Boolean(outletId),
    queryFn: async (): Promise<ReportKebersihanHariIni | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('id, status, submitted_at')
        .eq('form_key', 'kebersihan')
        .eq('outlet_id', outletId as string)
        .eq('tanggal', tanggalWIB())
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, status: data.status, submittedAt: data.submitted_at };
    },
  });
}

/** Presensi/laporan Kebersihan utk TANGGAL yang diminta, dipakai halaman Tinjau (ceo/pusat/is_hrd_kadiv). */
export interface LaporanKebersihanRow {
  reportId: string;
  outletNama: string;
  status: 'draft' | 'terkirim' | 'terlambat';
  submittedAt: string | null;
  foto: FotoKebersihan[];
}

export function useLaporanKebersihanUntukTanggal(tanggal: string = tanggalWIB()) {
  return useQuery({
    queryKey: ['laporan-kebersihan-untuk-tanggal', tanggal],
    queryFn: async (): Promise<LaporanKebersihanRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('id, status, submitted_at, outlet:outlet_id(nama), attachment(id, field_key, path, created_at, pengunggah:uploaded_by(nama))')
        .eq('form_key', 'kebersihan')
        .eq('tanggal', tanggal);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        reportId: r.id,
        outletNama: (r.outlet as unknown as { nama: string } | null)?.nama ?? '—',
        status: r.status,
        submittedAt: r.submitted_at,
        foto: (
          (r.attachment as unknown as { id: string; field_key: string; path: string; created_at: string; pengunggah: { nama: string } | null }[]) ?? []
        ).map((a) => ({
          id: a.id,
          slot: a.field_key,
          path: a.path,
          createdAt: a.created_at,
          uploadedByNama: a.pengunggah?.nama ?? null,
        })),
      }));
    },
  });
}
