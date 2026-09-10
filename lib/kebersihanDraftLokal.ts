/**
 * Sama alasan dengan `absenDraftLokal.ts` -- "jangan blokir kalau sudah
 * terlanjur di kamera": kalau foto Kebersihan sudah diambil tapi kirim ke
 * server gagal (sinyal putus), foto DISIMPAN di localStorage supaya retry
 * tidak perlu memfoto ulang.
 *
 * BEDA dari absen: Kebersihan punya 5 slot INDEPENDEN (bar/toilet/meja/
 * kursi/area_bebas) yang bisa gagal SENDIRI-SENDIRI -- instruksi eksplisit
 * CEO "hanya yang gagal yang diulang". Jadi disimpan sebagai BEBERAPA
 * draft sekaligus (satu kunci localStorage per slot), bukan satu draft
 * tunggal seperti absen.
 *
 * Di-scope per userId + outletId + tanggal supaya tidak nyasar ke sesi
 * orang lain atau ke hari lain kalau HP dipakai bergantian / draft
 * tertinggal semalaman -- draft dari tanggal yang BUKAN hari ini dibuang
 * diam-diam saat dimuat (sama pola dengan absen: "TIDAK ADA mode draft
 * lintas hari", laporan kemarin tidak boleh disangka laporan hari ini).
 */

export interface KebersihanPending {
  userId: string;
  outletId: string;
  tanggal: string; // WIB, tanggalWIB() saat capture
  slot: string;
  fotoBase64: string;
  fotoMime: string;
}

function kunci(outletId: string, slot: string): string {
  return `koperumnas-kebersihan-pending-${outletId}-${slot}`;
}

export function simpanKebersihanPending(draft: KebersihanPending): void {
  try {
    localStorage.setItem(kunci(draft.outletId, draft.slot), JSON.stringify(draft));
  } catch {
    // localStorage tidak tersedia (mode privat, dsb) -- retry tetap bisa
    // jalan selama tab tidak ditutup, cuma tidak bertahan dari reload.
  }
}

/** Semua draft pending milik userId+outletId untuk HARI INI -- draft tanggal lain dibuang diam-diam. */
export function muatSemuaKebersihanPending(userId: string, outletId: string, tanggalHariIni: string): KebersihanPending[] {
  const hasil: KebersihanPending[] = [];
  try {
    const awalan = `koperumnas-kebersihan-pending-${outletId}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(awalan)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const draft = JSON.parse(raw) as KebersihanPending;
        if (draft.userId !== userId) continue; // kepunyaan sesi lain
        if (draft.tanggal !== tanggalHariIni) {
          localStorage.removeItem(k); // draft basi (hari lain) -- buang, bukan disodorkan
          continue;
        }
        hasil.push(draft);
      } catch {
        localStorage.removeItem(k); // JSON rusak -- buang, jangan biarkan menumpuk selamanya
      }
    }
  } catch {
    // localStorage tidak tersedia -- tidak ada draft yang bisa dimuat, bukan kegagalan fatal.
  }
  return hasil;
}

export function hapusKebersihanPending(outletId: string, slot: string): void {
  try {
    localStorage.removeItem(kunci(outletId, slot));
  } catch {
    // tidak fatal.
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
