'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch, type FieldValues } from 'react-hook-form';
import type { Block, FormSchema } from '../forms/types';
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
export function FormRenderer({ schema, nilaiAwal, onSubmit, onChange, reportId, ringkasanBlok, laporanTerkirim }: FormRendererProps) {
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

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col" style={{ gap: 'var(--jarak-bagian)' }}>
        {/* Peta kemajuan (§5.1) -- lihat semua bagian & status sebelum masuk detail. */}
        <div className="flex flex-col gap-3 border p-4" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--kertas-2)' }}>
          <p className="judul-bagian">Ringkasan pekerjaan hari ini</p>
          {blokBerwajib.length > 0 && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{totalSelesai}</span>
                <span className="text-sm" style={{ color: 'var(--label)' }}>dari {blokBerwajib.length} bagian wajib selesai</span>
              </div>
              <div className="progres-bar">
                <div
                  className="progres-bar-isi"
                  style={{ width: `${Math.round((totalSelesai / blokBerwajib.length) * 100)}%` }}
                />
              </div>
              {blokBerwajib.length - totalSelesai > 0 && (
                <p className="text-sm" style={{ color: 'var(--label)' }}>
                  {blokBerwajib.length - totalSelesai} masih perlu diisi
                </p>
              )}
            </>
          )}
          <div className="flex flex-col">
            {blocks.map((block, i) => {
              const selesai = blokSelesai(block);
              const bermasalah = blokBermasalah(block);
              const label = bermasalah
                ? 'Periksa lagi'
                : selesai === true
                  ? 'Selesai'
                  : selesai === false
                    ? (ringkasanBlok?.[block.id]?.progres ?? 'Belum diisi')
                    : 'Tidak wajib';
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => bukaDanGulir(block.id)}
                  className="flex items-center justify-between gap-2 py-2 text-left text-sm"
                  style={{ minHeight: 44 }}
                >
                  <span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--kosong)' }}>{String(i + 1).padStart(2, '0')}</span>{' '}
                    <span style={{ fontWeight: 500 }}>{block.judul}</span>
                  </span>
                  <span className="status-teks" style={{ color: bermasalah ? 'var(--merah)' : selesai === true ? 'var(--hijau)' : 'var(--kosong)', flexShrink: 0 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {blocks.map((block, i) => {
          const bermasalah = blokBermasalah(block);
          const terbuka = bermasalah || dibukaManual.has(block.id);
          const ringkasan = ringkasanBlok?.[block.id];

          return (
            <fieldset
              key={block.id}
              id={`bagian-${block.id}`}
              className="flex flex-col border"
              style={{
                borderColor: bermasalah ? 'var(--merah-garis)' : 'var(--garis)',
                borderLeftWidth: terbuka ? 'var(--lebar-rail)' : 1,
                borderLeftColor: bermasalah ? 'var(--merah)' : terbuka ? 'var(--biru)' : 'var(--garis)',
                borderRadius: 'var(--radius-besar)',
                padding: 16,
                gap: terbuka ? 'var(--jarak-field)' : 6,
                background: bermasalah ? 'var(--merah-lembut)' : 'transparent',
              }}
            >
              <legend className="w-full px-1">
                <button type="button" onClick={() => togel(block.id)} className="flex w-full items-start justify-between gap-2 text-left" style={{ minHeight: 44 }}>
                  <span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--kosong)' }}>{String(i + 1).padStart(2, '0')}</span>{' '}
                    <span className="judul-bagian">{block.judul}</span>
                  </span>
                  <span style={{ color: 'var(--kosong)', fontSize: 'var(--ukuran-label)' }}>{terbuka ? '▲' : '▼'}</span>
                </button>
              </legend>

              {ringkasan?.progres && (
                <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-progres)', fontWeight: 700, color: ringkasan.status ? WARNA_STATUS[ringkasan.status] : 'var(--tinta)' }}>
                  {ringkasan.progres}
                </p>
              )}
              {ringkasan?.konsekuensi && (
                <p className="text-sm" style={{ color: 'var(--label)' }}>
                  {ringkasan.konsekuensi}
                </p>
              )}

              {!terbuka ? (
                <button type="button" onClick={() => togel(block.id)} className="w-fit text-sm" style={{ color: 'var(--biru-3)', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  Buka bagian →
                </button>
              ) : (
                <>
                  {block.catatan && <p className="teks-penjelasan">{block.catatan}</p>}
                  {block.fields.map((field) => {
                    const bermasalahField = Boolean(errors[field.key]);
                    return (
                      <label
                        key={field.key}
                        id={`baris-${field.key}`}
                        className="flex flex-col gap-1 p-2"
                        style={{ background: bermasalahField ? 'rgba(166,43,43,0.12)' : 'transparent', borderRadius: 'var(--radius-kecil)' }}
                      >
                        <span style={{ fontSize: 'var(--ukuran-label)', color: 'var(--label)' }}>
                          {field.label}
                          {field.wajib && <span style={{ color: 'var(--merah)' }}> *</span>}
                        </span>

                        {field.type === 'angka' && <Angka field={field} />}
                        {field.type === 'uang' && <Uang field={field} />}
                        {field.type === 'teks' && <Teks field={field} />}
                        {field.type === 'teks_panjang' && <TeksPanjang field={field} />}
                        {field.type === 'pilih' && <Pilih field={field} />}
                        {field.type === 'ya_tidak' && <YaTidak field={field} />}
                        {field.type === 'centang' && <Centang field={field} />}
                        {field.type === 'status_warna' && <StatusWarna field={field} />}
                        {field.type === 'tabel' && <Tabel field={field} />}
                        {field.type === 'lampiran' && <Lampiran field={field} reportId={reportId} />}

                        {field.buktiWajib && (
                          <LampiranInput name={`_bukti.${field.key}`} label="Lampirkan bukti" reportId={reportId} fieldKeyAsli={field.buktiKunci ?? field.key} />
                        )}

                        {field.bantuan && <span className="teks-penjelasan">{field.bantuan}</span>}

                        {bermasalahField && (
                          <span className="text-sm" style={{ color: 'var(--merah)' }}>
                            {String(errors[field.key]?.message ?? '')}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </>
              )}
            </fieldset>
          );
        })}

        {/* Menempel di atas nav bawah pada layar sempit (§2 06-RENCANA-PRESENSI-MOBILE.md) --
            form personal_marketing 9 blok baru terlihat tombolnya kalau digulir sampai
            bawah tanpa ini; dengan sticky, selalu terlihat. Background solid wajib supaya
            konten yang lewat di baliknya tidak tembus pandang. */}
        <div className="tombol-kirim-menempel flex flex-col gap-3" style={{ background: 'var(--kertas)', paddingTop: 12 }}>
          {pesanError.length > 0 && (
            <div className="kartu-status rail-merah">
              <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>Periksa kembali sebelum mengirim:</p>
              <ul className="list-disc pl-5 text-sm" style={{ color: 'var(--merah)' }}>
                {pesanError.map((e) => (
                  <li key={e.key}>{e.pesan}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" className="tombol-utama w-full">
            Kirim
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
