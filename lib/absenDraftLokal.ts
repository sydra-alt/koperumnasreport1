/**
 * "Jangan blokir kalau sudah terlanjur di kamera" (instruksi user) -- kalau
 * GPS+foto sudah didapat tapi kirim gagal (sinyal putus, sering terjadi di
 * lapangan), foto+koordinat DISIMPAN di localStorage supaya retry tidak
 * perlu mengulang GPS/kamera dari awal. Di-scope per userId (bukan kunci
 * tetap) supaya tidak nyasar ke sesi orang lain kalau HP dipakai bergantian
 * -- kekhawatiran yang sama dengan catatan cache service worker di
 * app/sw.ts, level kehati-hatian yang sama diterapkan di sini.
 */

export interface AbsenPending {
  userId: string;
  tanggal: string; // WIB, tanggalWIB() saat capture
  tipe: 'masuk' | 'pulang';
  lokasiAbsenId: string;
  lokasiNama: string;
  lat: number;
  lon: number;
  akurasi: number;
  jarak: number;
  status: 'valid' | 'di_luar_radius';
  terlambatMenit: number | null;
  fotoBase64: string;
  fotoMime: string;
}

const KUNCI = 'koperumnas-absen-pending';

export function simpanAbsenPending(draft: AbsenPending): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(draft));
  } catch {
    // localStorage tidak tersedia (mode privat, dsb) -- retry tetap bisa
    // jalan selama tab tidak ditutup (state React saja), cuma tidak
    // bertahan dari reload. Bukan kegagalan fatal, tidak perlu dilempar.
  }
}

export function muatAbsenPending(userId: string): AbsenPending | null {
  try {
    const raw = localStorage.getItem(KUNCI);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AbsenPending;
    if (draft.userId !== userId) return null; // kepunyaan sesi lain -- jangan dipakai
    return draft;
  } catch {
    return null;
  }
}

export function hapusAbsenPending(): void {
  try {
    localStorage.removeItem(KUNCI);
  } catch {
    // sama seperti di atas -- tidak fatal.
  }
}

export function blobKeBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca foto.'));
    reader.readAsDataURL(blob);
  });
}

export function base64KeBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg';
  const biner = atob(data);
  const bytes = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) bytes[i] = biner.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
