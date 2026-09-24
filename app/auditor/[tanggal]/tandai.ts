'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { tanggalWIB } from '@/lib/tanggal'

/**
 * Server Action: tandai outlet sebagai sudah ditinjau.
 *
 * Dipanggil dari Client Component saat user menekan tombol
 * "Tandai sudah ditinjau".
 *
 * Data yang disimpan:
 *   - outlet_id: outlet yang ditinjau
 *   - tanggal: hari operasi yang ditinjau (bukan tanggal review)
 *   - reviewer_id: user yang meninjau (diambil dari sesi)
 *   - ditinjau_pada: waktu review (otomatis sekarang)
 *   - catatan: opsional, dari input user
 */

export async function tandaiTinjau(
  outletId: string,
  tanggal: string,
  catatan: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Dapatkan user ID dari sesi
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: 'Anda harus login untuk melakukan review.' }
  }

  const userId = session.user.id

  // Cek apakah review sudah ada
  const { data: existing, error: cekError } = await supabase
    .from('audit_review')
    .select('id')
    .eq('outlet_id', outletId)
    .eq('tanggal', tanggal)
    .eq('reviewer_id', userId)
    .maybeSingle()

  if (cekError) {
    return { success: false, error: 'Gagal memeriksa status review.' }
  }

  const ditinjauPada = new Date().toISOString()

  if (existing) {
    // Update existing review
    const { error: updateError } = await supabase
      .from('audit_review')
      .update({ catatan, ditinjau_pada: ditinjauPada })
      .eq('id', existing.id)

    if (updateError) {
      return { success: false, error: 'Gagal memperbarui review.' }
    }
  } else {
    // Insert baru
    const { error: insertError } = await supabase
      .from('audit_review')
      .insert({
        outlet_id: outletId,
        tanggal,
        reviewer_id: userId,
        catatan,
        ditinjau_pada: ditinjauPada,
      })

    if (insertError) {
      return { success: false, error: 'Gagal menambahkan review.' }
    }
  }

  // Revalidate halaman yang sedang ditampilkan
  revalidatePath(`/auditor/${tanggal}`)

  return { success: true }
}

/**
 * Server Action: hapus tanda "sudah ditinjau".
 *
 * Digunakan saat user ingin membatalkan review.
 */
export async function hapusTinjau(
  outletId: string,
  tanggal: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: 'Anda harus login.' }
  }

  const { error } = await supabase
    .from('audit_review')
    .delete()
    .eq('outlet_id', outletId)
    .eq('tanggal', tanggal)
    .eq('reviewer_id', session.user.id)

  if (error) {
    return { success: false, error: 'Gagal menghapus review.' }
  }

  revalidatePath(`/auditor/${tanggal}`)
  return { success: true }
}
