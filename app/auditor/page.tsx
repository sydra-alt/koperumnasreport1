import { redirect } from 'next/navigation'
import { geserTanggalYmd, tanggalWIB } from '@/lib/tanggal'

/**
 * Halaman auditor root — redirect ke hari kemarin secara otomatis.
 *
 * URL: /auditor → redirect ke /auditor/[tanggal kemarin]
 */
export default function AuditorIndex() {
  redirect(`/auditor/${geserTanggalYmd(tanggalWIB(), -1)}`)
}
