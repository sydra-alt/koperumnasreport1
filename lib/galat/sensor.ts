/**
 * Sensor pesan error (sisi aplikasi; SQL catat_galat() menyensor lagi dengan
 * pola yang sama): email, angka >= 4 digit (PIN, telepon, nominal), token,
 * dan 'password=...'/'pin: ...' tidak pernah tersimpan.
 */
export const POLA_SENSOR: [RegExp, string][] = [
  [/(password|kata ?sandi|pin|secret|token|key|authorization)\s*[:=]\s*\S+/gi, '$1=[disensor]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g, '[token]'],
  [/[A-Za-z0-9_-]{32,}/g, '[token]'],
  [/[0-9]{4,}/g, '[angka]'],
];

export function sensorPesan(teks: string, maks = 300): string {
  let s = teks;
  for (const [pola, ganti] of POLA_SENSOR) s = s.replace(pola, ganti);
  return s.slice(0, maks);
}

/** 'NamaError: pesan' baris pertama, disensor. */
export function ringkasGalat(err: unknown): string {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Galat tidak dikenal');
  const baris = `${e.name}: ${e.message}`.split('\n')[0] ?? e.name;
  return sensorPesan(baris);
}
