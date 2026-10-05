'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Terlindungi } from '../../components/Terlindungi';
import { PemilihTanggal } from '../../components/PemilihTanggal';
import { useAuth } from '../../lib/auth/AuthProvider';
import { geserTanggalYmd, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/rupiah';
import { teksOutlet, teksWhatsApp, tautanWhatsApp, type BarisKontrol } from '../../lib/kontrolHarian';
import { useKontrolHarian, useSimpanCatatanKontrol } from '../../lib/api/kontrolHarian';

/**
 * Kontrol Harian (7 Oktober 2026) -- untuk Ita, tiap pagi untuk hari kemarin.
 * Rancangan: docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §2. Status "OK" hanya
 * kalau datanya lengkap; selain itu "Data belum lengkap" + yang kurang.
 */
const RAIL: Record<string, string> = { OK: 'rail-hijau', Selisih: 'rail-merah', 'Data belum lengkap': 'rail-kuning' };
const WARNA: Record<string, string> = { OK: 'var(--hijau)', Selisih: 'var(--merah)', 'Data belum lengkap': 'var(--kuning)' };
const LABEL_METODE: Record<string, string> = { qris: 'QRIS', transfer: 'Transfer', cash: 'Tunai', lain: 'Lainnya' };
const label = { fontSize: 13, color: 'var(--label)', lineHeight: 1.3 } as const;
const tombol = { borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, borderRadius: 8 } as const;

function rp(n: number | null) {
  return n === null ? 'belum ada' : `${n < 0 ? '-' : ''}${formatRupiah(Math.abs(n))}`;
}
function rapi(s: string) {
  const n = Number(s);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function salin(teks: string, setPesan: (s: string) => void) {
  navigator.clipboard?.writeText(teks).then(
    () => setPesan('Teks disalin.'),
    () => setPesan('Gagal menyalin -- pakai tombol WhatsApp.'),
  );
}

function Catatan({ b, tanggal, bolehUbah }: { b: BarisKontrol; tanggal: string; bolehUbah: boolean }) {
  const simpan = useSimpanCatatanKontrol(tanggal);
  const [penyebab, setPenyebab] = useState(b.catatan?.penyebab ?? '');
  const [tindakan, setTindakan] = useState(b.catatan?.tindakan ?? '');
  const berubah = penyebab !== (b.catatan?.penyebab ?? '') || tindakan !== (b.catatan?.tindakan ?? '');
  if (!bolehUbah) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p><span style={label}>Penyebab: </span>{b.catatan?.penyebab || '-'}</p>
        <p><span style={label}>Tindakan: </span>{b.catatan?.tindakan || '-'}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {b.perluCatatan ? <p className="text-sm status-teks" style={{ color: 'var(--merah)' }}>Status Selisih: tulis penyebab dan tindakan.</p> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span style={label}>Penyebab</span>
        <textarea id={`penyebab-${b.outletId}`} value={penyebab} onChange={(e) => setPenyebab(e.target.value)} maxLength={2000} rows={2} className="border p-2" style={{ borderColor: 'var(--garis)', borderRadius: 8 }} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span style={label}>Tindakan</span>
        <textarea id={`tindakan-${b.outletId}`} value={tindakan} onChange={(e) => setTindakan(e.target.value)} maxLength={2000} rows={2} className="border p-2" style={{ borderColor: 'var(--garis)', borderRadius: 8 }} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="border px-4 text-sm" style={tombol} disabled={!berubah || simpan.isPending} onClick={() => simpan.mutate({ outletId: b.outletId, penyebab, tindakan })}>
          {simpan.isPending ? 'Menyimpan...' : 'Simpan catatan'}
        </button>
        {simpan.isError ? <span className="text-sm" style={{ color: 'var(--merah)' }}>{(simpan.error as Error).message}</span> : null}
        {simpan.isSuccess && !berubah ? <span className="text-sm" style={label}>Tersimpan.</span> : null}
      </div>
    </div>
  );
}

function KartuOutlet({ b, tanggal, bolehUbah }: { b: BarisKontrol; tanggal: string; bolehUbah: boolean }) {
  const [pesan, setPesan] = useState('');
  const teks = teksOutlet(b, tanggal);
  const p = b.pos;
  return (
    <section className={`kartu-status ${RAIL[b.status]} flex flex-col gap-3`} aria-label={b.outletNama}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>{b.outletNama}</h2>
        <span className="status-teks" style={{ color: WARNA[b.status], fontWeight: 700 }}>{b.status}</span>
      </div>
      {b.kurang.length ? (
        <div className="flex flex-col gap-1">
          <p style={label}>Yang kurang:</p>
          <ul className="list-disc pl-5 text-sm">
            {b.kurang.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div>
          <p style={label}>Penjualan sistem (POS)</p>
          <p style={{ fontFamily: 'var(--mono)' }}>{p ? `${formatRupiah(Number(p.penjualan.uangSistem))} · ${p.penjualan.jumlahOrder} transaksi` : 'belum ada'}</p>
          {p?.penjualan.perMetode.length ? <p style={label}>{p.penjualan.perMetode.map((m) => `${LABEL_METODE[m.metode] ?? m.metode} ${formatRupiah(Number(m.jumlah))}`).join(' · ')}</p> : null}
        </div>
        <div>
          <p style={label}>Uang masuk (Laporan Kontrol F&amp;B)</p>
          <p style={{ fontFamily: 'var(--mono)' }}>{rp(b.uang.masuk)}</p>
          {b.uang.masuk !== null ? <p style={label}>Cash {rp(b.uang.perMetode.cash ?? 0)} · QRIS {rp(b.uang.perMetode.qris ?? 0)} · Bank {rp(b.uang.perMetode.bank ?? 0)}</p> : null}
        </div>
        <div>
          <p style={label}>Selisih uang</p>
          <p style={{ fontFamily: 'var(--mono)', color: b.uang.melewatiToleransi ? 'var(--merah)' : undefined }}>{rp(b.uang.selisih)}</p>
          <p style={label}>PIC: {p?.pic.length ? p.pic.join(', ') : '-'}</p>
        </div>
      </div>
      {p?.bahan.length ? (
        <div className="flex flex-col gap-1">
          <p style={label}>Stok per bahan: awal / masuk / terjual (resep) / sisa → selisih</p>
          <ul className="flex flex-col divide-y text-sm" style={{ borderColor: 'var(--garis)' }}>
            {p.bahan.map((k) => (
              <li key={k.ingredientId} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span>
                  {k.nama} <span style={label}>({k.satuan})</span>
                  {!k.diResep ? <span className="status-teks" style={{ color: 'var(--merah)' }}> · tidak ada di resep</span> : null}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: k.melewatiAmbang ? 'var(--merah)' : undefined }}>
                  {rapi(k.awal)} / {rapi(k.masuk)} / {rapi(k.teoretis)} / {rapi(k.akhir)} → {Number(k.selisih) > 0 ? '+' : ''}{rapi(k.selisih)}
                  {k.nilaiSelisih !== null ? ` (${rp(Number(k.nilaiSelisih))})` : Number(k.selisih) !== 0 ? ' (harga belum ada)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p?.produkTanpaResep.length ? (
        <p className="text-sm"><span style={label}>Terjual tanpa resep: </span>{p.produkTanpaResep.map((x) => `${x.nama} x${rapi(x.qty)}`).join(', ')}</p>
      ) : null}
      <Catatan key={`${b.outletId}-${b.catatan?.diubah_pada ?? ''}`} b={b} tanggal={tanggal} bolehUbah={bolehUbah} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="border px-4 text-sm" style={tombol} onClick={() => salin(teks, setPesan)}>Salin teks outlet</button>
        <a className="border px-4 text-sm flex items-center" style={tombol} href={tautanWhatsApp(teks)} target="_blank" rel="noopener noreferrer">Kirim lewat WhatsApp</a>
        {pesan ? <span className="text-sm" style={label}>{pesan}</span> : null}
      </div>
    </section>
  );
}

function Isi() {
  const [tanggal, setTanggal] = useState(() => geserTanggalYmd(tanggalWIB(), -1));
  const { data, isLoading, isError, error } = useKontrolHarian(tanggal);
  const [pesan, setPesan] = useState('');
  const { roles, profile } = useAuth();
  // Tautan saja; gerbang sungguhan boleh_lihat_aset_persediaan() (migrasi 0076).
  const bolehAset = ['ceo', 'admin', 'accounting'].some((r) => roles.includes(r)) || profile?.akses_semua_outlet_pos === true;
  const teksSemua = data ? teksWhatsApp(data.tanggal, data.baris) : '';
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>Kontrol Harian</h1>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Penjualan POS dibanding uang masuk dan pemakaian stok (opname awal + masuk − opname akhir) dibanding resep. Bahan yang tidak ada di resep otomatis menjadi selisih. Status OK hanya kalau datanya lengkap.
        </p>
        {bolehAset ? (
          <Link href="/aset-persediaan" className="text-sm underline flex items-center" style={{ color: 'var(--biru)', minHeight: 44 }}>
            Nilai Aset Persediaan dan HPP bulanan
          </Link>
        ) : null}
      </header>
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />
      {isLoading ? <p className="text-sm">Memuat data POS dan laporan...</p> : null}
      {isError ? <p className="kartu-status rail-merah text-sm">{(error as Error).message}</p> : null}
      {data ? (
        <>
          {data.posGalat ? <p className="kartu-status rail-kuning text-sm">Data POS tidak tersedia: {data.posGalat}. Status semua outlet: Data belum lengkap.</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="border px-4 text-sm" style={tombol} onClick={() => salin(teksSemua, setPesan)}>Salin laporan semua outlet</button>
            <a className="border px-4 text-sm flex items-center" style={tombol} href={tautanWhatsApp(teksSemua)} target="_blank" rel="noopener noreferrer">Kirim semua lewat WhatsApp</a>
            {pesan ? <span className="text-sm" style={label}>{pesan}</span> : null}
            {!data.bolehUbah ? <span className="text-sm" style={label}>Anda hanya bisa melihat (catatan diisi Ita, CEO, atau Admin).</span> : null}
          </div>
          {data.baris.map((b) => <KartuOutlet key={b.outletId} b={b} tanggal={data.tanggal} bolehUbah={data.bolehUbah} />)}
        </>
      ) : null}
    </main>
  );
}

export default function KontrolHarianPage() {
  const { assignments } = useAuth();
  return (
    <Terlindungi peran={['ceo', 'admin', 'pusat', 'accounting']} boleh={assignments.some((a) => a.form_key === 'kontrol_fnb')}>
      <Isi />
    </Terlindungi>
  );
}
