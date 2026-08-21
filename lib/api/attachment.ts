'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { kompresGambar } from '../gambar';
import { createClient } from '../supabase/client';

const KUALITAS_JPEG = 0.8; // parameter teknis kompresi, bukan aturan bisnis -- tidak ada di tabel policy

export interface AttachmentRow {
  id: string;
  report_id: string;
  field_key: string;
  path: string;
  mime: string | null;
  bytes: number | null;
  captured_at: string | null;
}

interface UnggahParams {
  fieldKey: string;
  file: File;
  gambarMaksPx: number; // dari policy.gambar_max_px
  lampiranMaksMb: number; // dari policy.lampiran_max_mb
  onProgress?: (persen: number) => void;
}

function ekstensiDari(file: File): string {
  const dariNama = file.name.split('.').pop();
  return dariNama ? dariNama.toLowerCase() : (file.type.split('/')[1] ?? 'bin');
}

/**
 * Unggah lewat XMLHttpRequest langsung ke REST Storage Supabase, BUKAN
 * `supabase.storage.upload()` -- SDK resmi (@supabase/storage-js 2.x) tidak
 * punya callback progres byte-per-byte (pakai fetch, bukan XHR, di baliknya).
 * Ini satu-satunya cara dapat progres unggah nyata per file tanpa library.
 */
async function unggahDenganProgres(
  path: string,
  blob: Blob,
  contentType: string,
  accessToken: string,
  onProgress?: (persen: number) => void,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Konfigurasi Supabase belum lengkap.');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/bukti/${path}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Unggah gagal (${xhr.status}): ${xhr.responseText || 'kesalahan server'}`));
      }
    };
    xhr.onerror = () => reject(new Error('Unggah gagal — periksa koneksi internet.'));
    xhr.send(blob);
  });
}

export function useUnggahLampiran(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldKey, file, gambarMaksPx, lampiranMaksMb, onProgress }: UnggahParams) => {
      const isVideo = file.type.startsWith('video/');
      const isGambar = file.type.startsWith('image/');

      if (isVideo && file.size > lampiranMaksMb * 1024 * 1024) {
        const ukuranMb = (file.size / 1024 / 1024).toFixed(1);
        throw new Error(`Video ${ukuranMb} MB melebihi batas ${lampiranMaksMb} MB. Video tidak dikompres — pilih file yang lebih kecil.`);
      }

      let blobUnggah: Blob = file;
      let contentType = file.type || 'application/octet-stream';
      let ext = ekstensiDari(file);

      if (isGambar) {
        blobUnggah = await kompresGambar(file, gambarMaksPx, KUALITAS_JPEG);
        contentType = 'image/jpeg';
        ext = 'jpg';
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Belum masuk.');

      const path = `${reportId}/${fieldKey}/${crypto.randomUUID()}.${ext}`;
      await unggahDenganProgres(path, blobUnggah, contentType, session.access_token, onProgress);

      const { data, error } = await supabase
        .from('attachment')
        .insert({
          report_id: reportId,
          field_key: fieldKey,
          path,
          mime: contentType,
          bytes: blobUnggah.size,
          // captured_at: file.lastModified adalah satu-satunya metadata waktu yang
          // tersedia tanpa parser EXIF (tidak ada library EXIF yang diizinkan) --
          // ini pendekatan terbaik yang wajar, bukan tanggal pengambilan foto sungguhan.
          captured_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AttachmentRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachment', reportId, variables.fieldKey] });
    },
  });
}

export function useSignedUrl() {
  return useMutation({
    mutationFn: async ({ path, umurDetik = 60 }: { path: string; umurDetik?: number }) => {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from('bukti').createSignedUrl(path, umurDetik);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
