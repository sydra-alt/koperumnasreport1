/**
 * Ringkasan "Kebutuhan untuk Besok" (blok 12 dokumen asli, forms/f16-manager-resto.ts)
 * -- §3.5b berlaku juga DI DALAM satu form: dihitung dari data blok 4 (stok
 * habis) + blok 5 (kebutuhan besok es batu/air/gas) yang SEDANG diisi Manager
 * sendiri, bukan dari laporan orang lain. Karena itu ini fungsi MURNI (bukan
 * hook/query DB) -- dipanggil dari data form yang sedang live, sama pola
 * dengan `ringkasanPteHariIni` (lib/api/pte.ts).
 */
export interface BarisStok {
  barang?: string;
  jumlah?: string;
  satuan?: string;
  kebutuhan_tanggal?: string;
}

export interface RingkasanKebutuhanBesok {
  stokHabis: BarisStok[];
  stokAkanHabis: BarisStok[];
  esBatu: number | null;
  air: string | null;
  gas: number | null;
}

export function ringkasanKebutuhanBesok(data: Record<string, unknown>): RingkasanKebutuhanBesok {
  const stokHabis = Array.isArray(data.stok_habis) ? (data.stok_habis as BarisStok[]) : [];
  const stokAkanHabis = Array.isArray(data.stok_akan_habis) ? (data.stok_akan_habis as BarisStok[]) : [];
  const esBatu = typeof data.es_batu_kebutuhan_besok === 'number' ? data.es_batu_kebutuhan_besok : null;
  const air = typeof data.air_kebutuhan_besok === 'string' && data.air_kebutuhan_besok ? data.air_kebutuhan_besok : null;
  const gas = typeof data.gas_kebutuhan_besok === 'number' ? data.gas_kebutuhan_besok : null;
  return { stokHabis, stokAkanHabis, esBatu, air, gas };
}
