/**
 * Server-side functions untuk halaman Auditor.
 *
 * Digunakan oleh Server Component (halaman) untuk fetch data awal.
 * Bukan client module — tidak boleh di-import dari client component.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Tipe data untuk response halaman auditor.
 */

export interface OutletAuditData {
  outletId: string
  outletNama: string
  adaShift: boolean
  shiftInfo: ShiftInfo | null
  kontrolFnb: KontrolFnbData | null
  kebersihan: KebersihanData | null
  auditStatus: AuditStatus | null
  fotoGagal: FotoGagalInfo[]  
}

export interface ShiftInfo {
  nama: string
  jamMulai: string | null
  jamSelesai: string | null
  forceClose: boolean
}

export interface KontrolFnbData {
  omzetSistem: number | null
  cash: number | null
  qris: number | null
  bank: number | null
  sesuai: 'ya' | 'tidak' | null
  selisih: number | null
  penyebab: string | null
  totalUang: number | null
  jumlahOrder: number | null
  kameraGagal: boolean
}

export interface KebersihanData {
  foto: Record<string, string | null>
  catatan: string | null
  status: 'draft' | 'terkirim' | 'terlambat' | null
  submittedAt: string | null
}

export interface AuditStatus {
  sudahTinjau: boolean
  ditinjauPada: string | null
  catatan: string | null
}

export interface FotoGagalInfo {
  context: string
  alasan: string
}

/**
 * Fetch semua data yang dibutuhkan halaman auditor untuk satu hari.
 * Dipakai oleh Server Component (halaman) untuk fetch awal.
 */
export async function fetchAuditorPageData(
  userId: string,
  tanggal: string,
) {
  const supabase = await createClient()

  // 1. List outlet yang diaudit user ini
  const { data: assignments, error: asgError } = await supabase
    .from('assignment')
    .select('outlet:outlet_id(id, nama)')
    .eq('user_id', userId)
    .eq('form_key', 'auditor')

  if (asgError) throw asgError

  const outlets = (assignments ?? [])
    .map((r) => r.outlet as unknown as { id: string; nama: string } | null)
    .filter((o): o is { id: string; nama: string } => o !== null)

  // 2. Untuk tiap outlet, fetch data audit
  const results: OutletAuditData[] = []
  for (const outlet of outlets) {
    try {
      const data = await fetchAuditDataForOutlet(supabase, outlet, tanggal, userId)
      results.push(data)
    } catch {
      // Skip outlet yang error — tidak menampilkan
    }
  }

  return { outlets, data: results }
}

async function fetchAuditDataForOutlet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  outlet: { id: string; nama: string },
  tanggal: string,
  userId: string,
): Promise<OutletAuditData> {
  // ─── 1. Cek apakah ada jadwal operasional untuk hari ini ──────────
  // hari_iso: 1=Senin ... 7=Minggu
  const tanggalDate = new Date(tanggal + 'T00:00:00Z')
  const hariIso = ((tanggalDate.getUTCDay() + 6) % 7) + 1 // konversi: 0=Minggu→7, 1=Senin→1, dst

  const { data: jadwal, error: jadwalError } = await supabase
    .from('jadwal_operasional')
    .select('id, jam_buka, buka_24_jam')
    .eq('outlet_id', outlet.id)
    .eq('hari_iso', hariIso)
    .maybeSingle()

  const adaShift = !jadwalError && jadwal !== null

  // ─── 2. Fetch shift info (dari tabel shift) ───────────────────────
  let shiftInfo: ShiftInfo | null = null
  if (jadwal && !jadwalError) {
    // Untuk shift info, kita perlu join ke tabel shift melalui assignment
    const { data: assignment } = await supabase
      .from('assignment')
      .select('shift_id')
      .eq('outlet_id', outlet.id)
      .eq('form_key', 'manager_resto') // atau form yang relevan
      .maybeSingle()

    if (assignment?.shift_id) {
      const { data: shift } = await supabase
        .from('shift')
        .select('nama, jam_mulai, jam_selesai')
        .eq('id', assignment.shift_id)
        .maybeSingle()

      if (shift) {
        shiftInfo = {
          nama: shift.nama,
          jamMulai: shift.jam_mulai,
          jamSelesai: shift.jam_selesai,
          forceClose: false, // belum ada flag di schema
        }
      }
    }
  }

  // ─── 3. Fetch laporan kontrol_fnb ────────────────────────────────
  const { data: kontrolFnbReport, error: kfError } = await supabase
    .from('report')
    .select('id, data, submitted_at, status')
    .eq('outlet_id', outlet.id)
    .eq('form_key', 'kontrol_fnb')
    .eq('tanggal', tanggal)
    .eq('status', 'terkirim')
    .maybeSingle()

  const kontrolFnb: KontrolFnbData | null = !kfError && kontrolFnbReport
    ? extractKontrolFnbData(kontrolFnbReport.data)
    : null

  // ─── 4. Fetch laporan kebersihan ────────────────────────────────
  const { data: kebersihanReport, error: kbError } = await supabase
    .from('report')
    .select('id, data, submitted_at, status')
    .eq('outlet_id', outlet.id)
    .eq('form_key', 'kebersihan')
    .eq('tanggal', tanggal)
    .maybeSingle()

  const kebersihan: KebersihanData | null = !kbError && kebersihanReport
    ? extractKebersihanData(kebersihanReport)
    : null

  // ─── 5. Fetch status audit_review ────────────────────────────────
  const { data: auditReview, error: arError } = await supabase
    .from('audit_review')
    .select('id, ditinjau_pada, catatan')
    .eq('outlet_id', outlet.id)
    .eq('tanggal', tanggal)
    .eq('reviewer_id', userId)
    .maybeSingle()

  const auditStatus: AuditStatus | null = !arError && auditReview
    ? {
        sudahTinjau: true,
        ditinjauPada: auditReview.ditinjau_pada
          ? new Date(auditReview.ditinjau_pada).toISOString()
          : null,
        catatan: auditReview.catatan,
      }
    : null

  return {
    outletId: outlet.id,
    outletNama: outlet.nama,
    adaShift,
    shiftInfo,
    kontrolFnb,
    kebersihan,
    auditStatus,
    fotoGagal: [],
  }
}

// ─── Helper extract data dari JSONB report ─────────────────────────────

function extractKontrolFnbData(data: object): KontrolFnbData {
  const d = data as Record<string, unknown>
  const toBigint = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'bigint') return Number(v)
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      try {
        const n = BigInt(v)
        return Number(n)
      } catch {
        return null
      }
    }
    return null
  }

  const cash = toBigint(d.cash)
  const qris = toBigint(d.qris)
  const bank = toBigint(d.bank)

  return {
    omzetSistem: toBigint(d.omzet_sistem),
    cash,
    qris,
    bank,
    sesuai: d.sesuai === 'ya' ? 'ya' : d.sesuai === 'tidak' ? 'tidak' : null,
    selisih: d.sesuai === 'tidak' ? toBigint(d.selisih) : null,
    penyebab: typeof d.penyebab === 'string' ? d.penyebab : null,
    totalUang: (cash ?? 0) + (qris ?? 0) + (bank ?? 0),
    jumlahOrder: null, // belum ada di form ini; akan diintegrasikan dari POS
    kameraGagal: false, // belum ada flag di form ini
  }
}

function extractKebersihanData(
  report: { id: string; data: object; submitted_at: string | null; status: string | null },
): KebersihanData {
  const d = report.data as Record<string, unknown>

  // Foto per slot — dari attachment
  const fotoList = (d.foto as Array<{ slot: string; path: string }>) ?? []
  const foto: Record<string, string | null> = {}
  for (const f of fotoList) {
    foto[f.slot] = f.path
  }

  return {
    foto,
    catatan: typeof d.catatan === 'string' ? d.catatan : null,
    status: (report.status as 'draft' | 'terkirim' | 'terlambat') ?? null,
    submittedAt: report.submitted_at,
  }
}
