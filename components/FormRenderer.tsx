'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FormProvider, useForm, useWatch, type FieldValues } from 'react-hook-form';
import type { Block, Field, FormSchema } from '../forms/types';
import { blokBerlakuHariIni, buildZodSchema, terisi } from '../forms/validasi';
import { tanggalIndonesiaWIB, jamWIB } from '../lib/tanggal';
import { Angka } from './fields/Angka';
import { Centang } from './fields/Centang';
import { Lampiran } from './fields/Lampiran';
import { LampiranInput } from './fields/LampiranInput';
import { Pilih } from './fields/Pilih';
import { StatusWarna } from './fields/StatusWarna';
import { Tabel } from './fields/Tabel';
import { Teks } from './fields/Teks';
import { TeksPanjang } from './fields/TeksPanjang';
import { Uang } from './fields/Uang';
import { YaTidak } from './fields/YaTidak';

export interface RingkasanBlok {
  /** "0 dari 2 konsumen" -- layer B (DESIGN.md §5.2): hasil/progres bagian ini, dihitung PEMANGGIL (LaporForm.tsx tahu angka bisnisnya -- target policy, dst). FormRenderer sendiri TETAP generik, tidak tahu form_key apa pun (CLAUDE.md #6). */
  progres?: string;
  /** "Belum memenuhi target bulanan." -- layer C: konsekuensi kalau belum selesai. */
  konsekuensi?: string;
  /** Warna aksen angka progres -- opsional. TIDAK PERNAH emas/gold (instruksi eksplisit user, 30 Agustus 2026 -- gold cuma dipakai di logo). */
  status?: 'aman' | 'perlu_dikawal' | 'urgent';
}

export interface LaporanTerkirim {
  status: 'terkirim' | 'terlambat';
  /** ISO timestamp (`report.submitted_at`). */
  submittedAt: string;
  /** "Terkirim, tercatat terlambat 2 jam dari batas 18.00" -- SUDAH lengkap sebagai kalimat, dihitung PEMANGGIL (`apakahTerlambat`/`labelSisaWaktu` sudah ada di lib/tugasHariIni.ts, tidak diulang di sini). `null`/tidak diisi kalau status `'terkirim'` (tidak terlambat). */
  pesanTerlambat?: string | null;
  /** Baris ringkasan singkat, opsional -- generik: kalau ada, biasanya diambil dari `ringkasanBlok` yang progres-nya terisi. */
  ringkasan?: string[];
}

interface FormRendererProps {
  schema: FormSchema;
  nilaiAwal?: FieldValues;
  onSubmit: (data: FieldValues) => void;
  /** Dipanggil tiap nilai form berubah -- dipakai pemanggil untuk autosave ter-debounce. */
  onChange?: (data: FieldValues) => void;
  /** Laporan hari ini, kalau sudah ada -- diteruskan ke field lampiran supaya bisa unggah sungguhan. */
  reportId?: string | null;
  /** Ringkasan progres/konsekuensi PER BAGIAN (key = Block.id), opsional -- lihat RingkasanBlok. */
  ringkasanBlok?: Record<string, RingkasanBlok>;
  /**
   * Laporan HARI INI sudah terkirim (status bukan 'draft') -- kalau diisi,
   * FormRenderer menampilkan layar konfirmasi (bukan form kosong/terisi)
   * begitu dibuka, GENERIK untuk semua form (instruksi eksplisit user, 30
   * Agustus 2026: "Terapkan ke SEMUA form lewat FormRenderer"). `null`/tidak
   * diisi -- form dirender seperti biasa (belum pernah dikirim hari ini).
   */
  laporanTerkirim?: LaporanTerkirim | null;
  /** Teks status draft singkat ("Menyimpan draft…", "Draft tersimpan."), dari pemanggil -- murni tampilan di panel progres; kosong/tidak diisi = tidak ada teks. */
  catatanStatus?: string;
}

const WARNA_STATUS: Record<NonNullable<RingkasanBlok['status']>, string> = {
  aman: 'var(--hijau)',
  perlu_dikawal: 'var(--kuning)',
  urgent: 'var(--merah)',
};

/**
 * Layar konfirmasi setelah kirim (instruksi eksplisit user, 30 Agustus
 * 2026: "seperti Google Form -- form HILANG, diganti layar konfirmasi",
 * bukan cuma tulisan kecil di bawah tombol). GENERIK lewat prop
 * `LaporanTerkirim` -- tidak tahu form_key apa pun, cuma menampilkan apa
 * yang diberi pemanggil. Status TERLAMBAT wajib ditampilkan jelas di sini,
 * TIDAK PERNAH disembunyikan (instruksi eksplisit).
 */
function LayarKonfirmasiKirim({ schema, info, onUbah }: { schema: FormSchema; info: LaporanTerkirim; onUbah: () => void }) {
  const d = new Date(info.submittedAt);
  const terlambat = info.status === 'terlambat';
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div
        className="flex items-center justify-center"
        style={{ width: 64, height: 64, borderRadius: '50%', background: terlambat ? 'var(--kuning)' : 'var(--hijau)', color: 'var(--kertas-2)', fontSize: 32 }}
      >
        {terlambat ? '!' : '✓'}
      </div>

      <div>
        <p className="angka-kecil" style={{ color: 'var(--biru)' }}>Laporan terkirim</p>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          {schema.nama} · {tanggalIndonesiaWIB(d)} · pukul {jamWIB(d)}
        </p>
      </div>

      {terlambat && info.pesanTerlambat && (
        <div className="kartu-status rail-kuning text-sm text-left" style={{ maxWidth: '24rem' }}>
          {info.pesanTerlambat}
        </div>
      )}

      {info.ringkasan && info.ringkasan.length > 0 && (
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          {info.ringkasan.join(' · ')}
        </p>
      )}

      <div className="flex w-full max-w-sm flex-col gap-2">
        <Link href="/riwayat" className="tombol-utama text-center">
          Lihat laporan saya
        </Link>
        <button type="button" onClick={onUbah} className="tombol-sekunder">
          Ubah laporan ini
        </button>
        <Link href="/" className="px-4 py-3 text-center text-sm" style={{ color: 'var(--label)', minHeight: 44 }}>
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}

/**
 * Penyusunan TAMPILAN saja: field `angka`/`uang` yang berurutan dan sekelompok secara alami
 * ditata sebagai grid berpasangan. Kelompok = label berawalan sama sebelum " -- " (mis.
 * "Live -- lengkap" + "Live -- dari total", "Es batu -- stok awal" ...), atau -- kalau tidak ada
 * awalan -- 2 sampai 4 field berurutan bertipe sama. Urutan, key, dan nilai field TIDAK berubah.
 */
type ButirTampil = { jenis: 'satu'; field: Field } | { jenis: 'grup'; tipe: 'angka' | 'uang'; kunci: string; fields: Field[] };

function kunciKelompok(f: Field): string {
  const i = f.label.indexOf(' -- ');
  return i >= 0 ? f.label.slice(0, i) : '';
}

function labelTanpaKunci(label: string): string {
  const i = label.indexOf(' -- ');
  const sisa = i >= 0 ? label.slice(i + 4) : label;
  return sisa.charAt(0).toUpperCase() + sisa.slice(1);
}

function susunButir(fields: Field[]): ButirTampil[] {
  const hasil: ButirTampil[] = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    if ((f.type === 'angka' || f.type === 'uang') && !f.buktiWajib) {
      const kunci = kunciKelompok(f);
      let j = i + 1;
      while (j < fields.length && fields[j].type === f.type && !fields[j].buktiWajib && kunciKelompok(fields[j]) === kunci) j++;
      const n = j - i;
      if (n >= 2 && (kunci !== '' || n <= 4)) {
        hasil.push({ jenis: 'grup', tipe: f.type, kunci, fields: fields.slice(i, j) });
        i = j;
        continue;
      }
    }
    hasil.push({ jenis: 'satu', field: f });
    i++;
  }
  return hasil;
}

/**
 * Pola hierarki form (DESIGN.md §5) -- pengganti "9 kartu setara" lama, satu
 * `<fieldset>` datar per blok tanpa konteks. Sekarang: peta kemajuan di atas
 * + tiap bagian punya 4 lapisan (indeks, progres, konsekuensi, detail field)
 * dan bisa diringkas/dibuka. GENERIK -- dipakai SEMUA 15 form lewat schema +
 * `ringkasanBlok` opsional, tidak ada cabang per form_key di sini (CLAUDE.md #6).
 *
 * Koreksi eksplisit user, 30 Agustus 2026: bagian yang PUNYA GALAT VALIDASI
 * wajib terbuka -- `terbuka` di bawah adalah UNION dari togel manual dan
 * `bermasalah`, bukan cuma togel manual. Menyembunyikan galat di balik
 * bagian yang diringkas akan membuat pengguna tidak pernah tahu kenapa
 * kirim ditolak.
 */
export function FormRenderer({ schema, nilaiAwal, onSubmit, onChange, reportId, ringkasanBlok, laporanTerkirim, catatanStatus }: FormRendererProps) {
  const methods = useForm({
    defaultValues: nilaiAwal,
    resolver: zodResolver(buildZodSchema(schema)),
  });
  const {
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = methods;
  const nilaiForm = useWatch({ control });

  const blocks = blokBerlakuHariIni(schema);

  const pesanError = Object.entries(errors)
    .filter(([key]) => key !== '_bukti')
    .map(([key, err]) => ({ key, pesan: (err?.message as string) ?? `${key} tidak valid` }));

  useEffect(() => {
    if (pesanError.length === 0) return;
    document.getElementById(`baris-${pesanError[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const sub = watch((nilai) => onChangeRef.current?.(nilai as FieldValues));
    return () => sub.unsubscribe();
  }, [watch]);

  // Layar konfirmasi (§ "seperti Google Form") vs mode edit -- `modeEdit`
  // ditogel manual lewat tombol "Ubah laporan ini", TAPI direset otomatis
  // begitu ada pengiriman BARU (submittedAt berubah, termasuk pengiriman
  // PERTAMA kali) -- supaya submit sukses selalu berakhir di layar
  // konfirmasi, bukan macet di mode edit yang baru saja dipakai untuk
  // mengirim ulang. Dibandingkan lewat ref (bukan effect dependency array
  // langsung ke objek `laporanTerkirim`) karena objeknya baru tiap render
  // dari pemanggil -- yang benar-benar berarti cuma `submittedAt`-nya berubah.
  const [modeEdit, setModeEdit] = useState(false);
  const submittedAtRef = useRef(laporanTerkirim?.submittedAt);
  useEffect(() => {
    if (laporanTerkirim?.submittedAt !== submittedAtRef.current) {
      submittedAtRef.current = laporanTerkirim?.submittedAt;
      setModeEdit(false);
    }
  }, [laporanTerkirim?.submittedAt]);

  // Bagian pertama terbuka secara default ("checklist perjalanan", §5.1),
  // sisanya diringkas -- ditogel manual lewat header/tautan "Buka bagian".
  const [dibukaManual, setDibukaManual] = useState<Set<string>>(() => new Set(blocks[0] ? [blocks[0].id] : []));
  function togel(id: string) {
    setDibukaManual((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function bukaDanGulir(id: string) {
    setDibukaManual((prev) => new Set(prev).add(id));
    document.getElementById(`bagian-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function blokBermasalah(block: Block): boolean {
    return block.fields.some((f) => Boolean(errors[f.key]));
  }

  // null = bagian ini TIDAK PUNYA field `wajib`/`wajibYa` sama sekali --
  // BUKAN berarti "selesai" (banyak bagian di schema ini pakai `buktiWajib`
  // buat syarat bukti, bukan `wajib` buat syarat isi -- keduanya beda,
  // lihat forms/types.ts). Klaim "Selesai" padahal belum diisi apa-apa
  // adalah kebohongan yang justru ditolak DESIGN.md (§16: pengguna harus
  // bisa percaya status yang ditampilkan) -- ditemukan lewat pratinjau
  // visual (screenshot), bukan tebakan. Bagian begini dikecualikan dari
  // rasio "X dari Y", ditandai "Tidak wajib" di peta kemajuan.
  function blokSelesai(block: Block): boolean | null {
    const wajibFields = block.fields.filter((f) => f.wajib || f.wajibYa);
    if (wajibFields.length === 0) return null;
    return wajibFields.every((f) => terisi(f.type, nilaiForm?.[f.key]));
  }

  const blokBerwajib = blocks.filter((b) => blokSelesai(b) !== null);
  const totalSelesai = blokBerwajib.filter((b) => blokSelesai(b) === true).length;

  // Laporan hari ini SUDAH terkirim dan belum diminta mode edit -- tampilkan
  // layar konfirmasi, BUKAN form (kosong atau terisi). Instruksi eksplisit
  // user: "kalau orang membuka form yang hari ini sudah dikirim, jangan
  // tampilkan form kosong -- langsung tampilkan layar konfirmasi ini".
  if (laporanTerkirim && !modeEdit) {
    return <LayarKonfirmasiKirim schema={schema} info={laporanTerkirim} onUbah={() => setModeEdit(true)} />;
  }

  // ── Susunan visual (TIDAK mengubah data/validasi): satu `.panel` datar per bagian, baris field
  // ringkas, angka berpasangan dalam grid. Elemen pembungkus tiap field memakai id `baris-${key}`
  // (target gulir galat, sama seperti sebelumnya).
  const labelNode = (f: Field, teks: string) => (
    <span style={{ fontSize: 'var(--ukuran-label)', color: 'var(--label)', lineHeight: 1.35 }}>
      {teks}
      {f.wajib && <span style={{ color: 'var(--merah)' }}> *</span>}
    </span>
  );
  const pesanGalat = (f: Field) =>
    errors[f.key] ? (
      <span className="text-sm" style={{ color: 'var(--merah)' }}>
        {String(errors[f.key]?.message ?? '')}
      </span>
    ) : null;
  const bantuanNode = (f: Field) => (f.bantuan ? <span className="teks-penjelasan">{f.bantuan}</span> : null);
  // type:'tabel' dengan buktiPerBaris merender LampiranInput-nya SENDIRI, satu per baris, di dalam
  // Tabel.tsx -- bukan di sini (satu bukti per FIELD tidak masuk akal kalau field ini punya banyak
  // baris yang masing-masing perlu buktinya sendiri).
  const buktiNode = (f: Field) =>
    f.buktiWajib && !(f.type === 'tabel' && f.buktiPerBaris) ? (
      <LampiranInput name={`_bukti.${f.key}`} label="Lampirkan bukti" reportId={reportId} fieldKeyAsli={f.buktiKunci ?? f.key} />
    ) : null;
  const kontrolNode = (f: Field) => (
    <>
      {f.type === 'angka' && <Angka field={f} />}
      {f.type === 'uang' && <Uang field={f} />}
      {f.type === 'teks' && <Teks field={f} />}
      {f.type === 'teks_panjang' && <TeksPanjang field={f} />}
      {f.type === 'pilih' && <Pilih field={f} />}
      {f.type === 'ya_tidak' && <YaTidak field={f} />}
      {f.type === 'centang' && <Centang field={f} />}
      {f.type === 'status_warna' && <StatusWarna field={f} />}
      {f.type === 'tabel' && <Tabel field={f} reportId={reportId} />}
      {f.type === 'lampiran' && <Lampiran field={f} reportId={reportId} />}
    </>
  );

  function barisField(f: Field) {
    const galat = Boolean(errors[f.key]);
    const kelas = `panel-baris flex flex-col gap-2${galat ? ' status-merah' : ''}`;

    if (f.type === 'ya_tidak') {
      return (
        <div key={f.key} id={`baris-${f.key}`} className={kelas} style={{ minHeight: 56 }}>
          <div className="flex items-center justify-between gap-3">
            {labelNode(f, f.label)}
            <YaTidak field={f} />
          </div>
          {buktiNode(f)}
          {bantuanNode(f)}
          {pesanGalat(f)}
        </div>
      );
    }

    if (f.type === 'centang') {
      return (
        <div key={f.key} id={`baris-${f.key}`} className={kelas}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex min-w-0 flex-1 items-center gap-3" style={{ flexBasis: 200 }}>
              <Centang field={f} />
              {labelNode(f, f.label)}
            </label>
            {buktiNode(f)}
          </div>
          {bantuanNode(f)}
          {pesanGalat(f)}
        </div>
      );
    }

    // tabel / lampiran / status_warna memegang banyak kontrol -- BUKAN <label> (klik pada teks label
    // tidak boleh meneruskan klik ke tombol pertama di dalamnya).
    if (f.type === 'tabel' || f.type === 'lampiran' || f.type === 'status_warna') {
      return (
        <div key={f.key} id={`baris-${f.key}`} className={kelas}>
          {labelNode(f, f.label)}
          {kontrolNode(f)}
          {buktiNode(f)}
          {bantuanNode(f)}
          {pesanGalat(f)}
        </div>
      );
    }

    const sempit = f.type === 'angka' || f.type === 'uang';
    return (
      <div key={f.key} id={`baris-${f.key}`} className={kelas}>
        <label className={`flex flex-col gap-1${sempit ? ' md:max-w-[320px]' : ''}`}>
          {labelNode(f, f.label)}
          {kontrolNode(f)}
        </label>
        {buktiNode(f)}
        {bantuanNode(f)}
        {pesanGalat(f)}
      </div>
    );
  }

  function barisGrup(butir: Extract<ButirTampil, { jenis: 'grup' }>) {
    const { fields, kunci } = butir;
    const kolomMd = fields.length === 2 ? 2 : fields.length === 4 ? 2 : 3;
    return (
      <div key={fields[0].key} className="panel-baris flex flex-col gap-2">
        {kunci && (
          <p style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--biru)' }}>{kunci}</p>
        )}
        <div
          role="group"
          aria-label={kunci || undefined}
          className={`grup-isian${butir.tipe === 'uang' ? ' grup-uang' : ''}`}
          style={{ ['--kolom-md' as string]: kolomMd } as CSSProperties}
        >
          {fields.map((f) => {
            const galat = Boolean(errors[f.key]);
            return (
              <div
                key={f.key}
                id={`baris-${f.key}`}
                className="flex flex-col gap-1"
                style={{ background: galat ? 'var(--merah-lembut)' : undefined, borderRadius: 10, padding: galat ? 6 : 0 }}
              >
                <label className="flex flex-col gap-1">
                  {labelNode(f, kunci ? labelTanpaKunci(f.label) : f.label)}
                  {kontrolNode(f)}
                </label>
                {bantuanNode(f)}
                {pesanGalat(f)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const labelStatusBlok = (block: Block) => {
    const selesai = blokSelesai(block);
    if (blokBermasalah(block)) return { teks: 'Periksa lagi', warna: 'var(--merah)' };
    if (selesai === true) return { teks: 'Selesai', warna: 'var(--hijau)' };
    if (selesai === false) return { teks: 'Belum diisi', warna: 'var(--label)' };
    return { teks: `${block.fields.length} isian`, warna: 'var(--kosong)' };
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 lg:grid-cols-[minmax(0,720px)_300px] lg:items-start lg:gap-x-8">
        {/* Progres (§5.1) -- SATU panel: angka, bilah, dan lompat-ke-bagian. Di HP: deretan nomor
            bagian (ketuk = buka + gulir, sama seperti tombol peta lama); di desktop: kolom samping
            berisi nama + status. Murni navigasi UI -- tidak mengubah data. */}
        <aside className="panel lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1" aria-label="Progres laporan">
          <div className="panel-baris flex flex-col gap-2" style={{ padding: 16 }}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="judul-seksi">Progres laporan</p>
              {catatanStatus && (
                <span className="text-sm" style={{ color: 'var(--kosong)' }} aria-live="polite">
                  {catatanStatus}
                </span>
              )}
            </div>
            {blokBerwajib.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{totalSelesai}</span>
                  <span className="text-sm" style={{ color: 'var(--label)' }}>
                    dari {blokBerwajib.length} bagian wajib selesai · {blocks.length} bagian
                  </span>
                </div>
                <div className="progres-bar">
                  <div className="progres-bar-isi" style={{ width: `${Math.round((totalSelesai / blokBerwajib.length) * 100)}%` }} />
                </div>
                {blokBerwajib.length - totalSelesai > 0 && (
                  <p className="text-sm" style={{ color: 'var(--label)' }}>
                    {blokBerwajib.length - totalSelesai} masih perlu diisi
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--label)' }}>
                {blocks.length} bagian · tidak ada yang wajib
              </p>
            )}
          </div>
          <nav className="panel-baris flex flex-wrap gap-2 lg:flex-col lg:gap-1.5" aria-label="Lompat ke bagian" style={{ padding: 12 }}>
            {blocks.map((block, i) => {
              const st = labelStatusBlok(block);
              const bermasalah = blokBermasalah(block);
              const selesai = blokSelesai(block) === true;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => bukaDanGulir(block.id)}
                  aria-label={`${block.judul}: ${st.teks}`}
                  className="flex items-center justify-center gap-2 text-sm lg:justify-between lg:px-2"
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    borderRadius: 10,
                    border: '1px solid var(--garis)',
                    background: bermasalah ? 'var(--merah-lembut)' : selesai ? 'var(--hijau-lembut)' : 'var(--kertas)',
                    color: bermasalah ? 'var(--merah)' : selesai ? 'var(--hijau)' : 'var(--tinta)',
                    fontWeight: 600,
                  }}
                >
                  <span className="flex items-baseline gap-2 text-left">
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="sr-only lg:not-sr-only lg:font-medium">{block.judul}</span>
                  </span>
                  <span className="status-teks hidden lg:inline" style={{ color: st.warna, flexShrink: 0 }}>{st.teks}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          {blocks.map((block, i) => {
            const bermasalah = blokBermasalah(block);
            const terbuka = bermasalah || dibukaManual.has(block.id);
            const ringkasan = ringkasanBlok?.[block.id];
            const st = labelStatusBlok(block);

            return (
              <section key={block.id} id={`bagian-${block.id}`} className="panel">
                <button
                  type="button"
                  onClick={() => togel(block.id)}
                  aria-expanded={terbuka}
                  className={`panel-baris flex w-full items-center justify-between gap-3 text-left${bermasalah ? ' status-merah' : ''}`}
                  style={{ minHeight: 56 }}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--kosong)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="judul-seksi">{block.judul}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="status-teks" style={{ color: st.warna }}>{st.teks}</span>
                    <span aria-hidden="true" style={{ color: 'var(--kosong)', fontSize: 12 }}>{terbuka ? '▲' : '▼'}</span>
                  </span>
                </button>

                {ringkasan?.progres && (
                  <div className="panel-baris">
                    <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-progres)', fontWeight: 700, color: ringkasan.status ? WARNA_STATUS[ringkasan.status] : 'var(--tinta)' }}>
                      {ringkasan.progres}
                    </p>
                    {ringkasan.konsekuensi && (
                      <p className="text-sm" style={{ color: 'var(--label)' }}>
                        {ringkasan.konsekuensi}
                      </p>
                    )}
                  </div>
                )}
                {!ringkasan?.progres && ringkasan?.konsekuensi && (
                  <div className="panel-baris">
                    <p className="text-sm" style={{ color: 'var(--label)' }}>
                      {ringkasan.konsekuensi}
                    </p>
                  </div>
                )}

                {/* Konten bagian — beranimasi buka/tutup lewat .bagian-isi (DESIGN-MODERN.md §M4:
                    tinggi + opasitas). Semua anak SELALU di-render (bukan kondisional) supaya
                    transisi height:0→auto berjalan mulus. Jarak/garis ada di div DALAM (bukan di
                    div yang di-clip) supaya bagian yang diciutkan setinggi 0 -- tanpa strip kosong. */}
                <div className={`bagian-isi${terbuka ? ' bagian-isi-terbuka' : ''}`}>
                  <div>
                    <div style={{ borderTop: '1px solid var(--garis)' }}>
                      {block.catatan && (
                        <div className="panel-baris">
                          <p className="teks-penjelasan">{block.catatan}</p>
                        </div>
                      )}
                      {susunButir(block.fields).map((butir) => (butir.jenis === 'grup' ? barisGrup(butir) : barisField(butir.field)))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {/* IKUT TER-SCROLL bersama form (app/globals.css .tombol-kirim-menempel sekarang
              position:static) -- sebelumnya sticky, tapi itu menutupi daftar galat validasi tepat
              saat paling perlu dibaca (uji HP sungguhan 18 September 2026). */}
          <div className="tombol-kirim-menempel flex flex-col gap-3" style={{ paddingTop: 4 }}>
            {pesanError.length > 0 && (
              <div className="kartu-status rail-merah">
                <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>Periksa kembali sebelum mengirim:</p>
                <ul className="list-disc pl-5 text-sm" style={{ color: 'var(--merah)' }}>
                  {pesanError.map((e) => (
                    <li key={e.key}>
                      <button
                        type="button"
                        onClick={() => document.getElementById(`baris-${e.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        className="text-left underline"
                        style={{ color: 'var(--merah)', minHeight: 44 }}
                      >
                        {e.pesan}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button type="submit" className="tombol-utama w-full">
              Kirim
            </button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
