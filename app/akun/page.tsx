'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { formRegistry } from '../../forms';
import { tabTerlihat, tabLuapan } from '../../lib/navUtama';
import { KerangkaPresensiRingkas } from '../../components/Kerangka';
import { useTitikAbsenSaya, usePresensiSayaUntukBulan } from '../../lib/api/absensi';
import { jamWIB, tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';
import { usePolicy } from '../../lib/api/policy';
import { marketingAktif } from '../../lib/marketing';
import { NavIcon, ikonUntukTab } from '../../components/NavIcon';

function inisialNama(nama: string | null | undefined) {
  const kata = nama?.trim().split(/\s+/).filter(Boolean) ?? [];
  return kata.slice(0, 2).map((bagian) => bagian[0]).join('').toUpperCase() || 'KG';
}

/**
 * Halaman akun standar Neumorphic murni (mengikuti visual referensi):
 * - Tombol navigasi melingkar di atas
 * - Kartu profil terangkat lembut dengan avatar neumorphic
 * - Pengaturan terpisah dengan ikon taktil dan saklar neumorphic
 * - Riwayat presensi dan menu luapan dalam kartu taktil
 */
export default function AkunPage() {
  const router = useRouter();
  const { profile, roles, assignments, signOut, session } = useAuth();
  const { data: policy } = usePolicy();
  const semua = tabTerlihat(roles, assignments, formRegistry, profile?.divisi ?? null, profile?.punya_akses_ai ?? false, marketingAktif(policy));
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const punyaTitikAbsen = (titikSaya?.length ?? 0) > 0;
  const luapan = tabLuapan(semua, punyaTitikAbsen);
  const bulanIni = tanggalWIB().slice(0, 7);
  const { data: presensiSaya, isLoading: presensiLoading } = usePresensiSayaUntukBulan(bulanIni, punyaTitikAbsen);

  // Status toggle switch lokal untuk preferensi UI (mengikuti screenshot neumorphism)
  const [notifikasiAktif, setNotifikasiAktif] = useState(true);
  const [ringkasanOtomatis, setRingkasanOtomatis] = useState(true);

  return (
    <main className="akun-halaman">
      {/* Bar navigasi atas gaya neumorphic persis seperti di referensi screenshot */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="tombol-lingkar"
          aria-label="Kembali"
          title="Kembali"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <h1 className="text-center font-bold" style={{ fontFamily: 'var(--display)', fontSize: '20px', color: 'var(--tinta)' }}>
          Pengaturan Akun
        </h1>

        <div className="tombol-lingkar pointer-events-none opacity-40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      <div className="akun-grid">
        {/* Kartu Profil Utama (Neumorphic Card) */}
        <section className="akun-kartu akun-profil" aria-label="Profil akun">
          <div className="akun-profil-atas">
            <span className="akun-avatar" aria-hidden="true">{inisialNama(profile?.nama)}</span>
            <div className="min-w-0 flex-1">
              <p className="akun-nama truncate">{profile?.nama ?? 'Akun Koperumnas'}</p>
              <p className="akun-jabatan truncate">{[profile?.jabatan, profile?.divisi].filter(Boolean).join(' · ') || 'Profil kerja Koperumnas'}</p>
              <p className="mt-1 text-xs truncate" style={{ color: 'var(--kosong)' }}>{session?.user.email ?? ''}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: 'rgba(166, 180, 200, 0.16)' }}>
            <span className="akun-status">Akun aktif</span>
            {roles.length > 0 && (
              <div className="akun-peran" aria-label="Peran akun" style={{ margin: 0 }}>
                {roles.map((role) => <span key={role}>{role}</span>)}
              </div>
            )}
          </div>
        </section>

        {/* Daftar Pengaturan Gaya Tactile Neumorphic Cards */}
        <div className="flex flex-col gap-6">
          {/* Bagian Preferensi dengan Toggle Switch Neumorphic */}
          <section className="akun-seksi" aria-labelledby="preferensi-aplikasi">
            <div className="akun-seksi-kepala">
              <div>
                <h2 id="preferensi-aplikasi">Preferensi Aplikasi</h2>
                <p>Pengaturan tampilan dan notifikasi kerja harian.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="akun-item-kartu">
                <div className="flex items-center gap-3">
                  <span className="akun-ikon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </span>
                  <div>
                    <p className="akun-baris-judul">Notifikasi Pengingat</p>
                    <p className="akun-baris-bantu">Pengingat jam masuk, pulang, dan laporan.</p>
                  </div>
                </div>
                <label className={`neumo-saklar ${notifikasiAktif ? 'aktif' : ''}`} aria-label="Notifikasi Pengingat">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={notifikasiAktif}
                    onChange={(e) => setNotifikasiAktif(e.target.checked)}
                  />
                  <span className="neumo-saklar-jempol" />
                </label>
              </div>

              <div className="akun-item-kartu">
                <div className="flex items-center gap-3">
                  <span className="akun-ikon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  <div>
                    <p className="akun-baris-judul">Ringkasan Otomatis</p>
                    <p className="akun-baris-bantu">Tampilkan kartu tugas utama di Beranda.</p>
                  </div>
                </div>
                <label className={`neumo-saklar ${ringkasanOtomatis ? 'aktif' : ''}`} aria-label="Ringkasan Otomatis">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={ringkasanOtomatis}
                    onChange={(e) => setRingkasanOtomatis(e.target.checked)}
                  />
                  <span className="neumo-saklar-jempol" />
                </label>
              </div>
            </div>
          </section>

          {/* Bagian Keamanan Akun */}
          <section className="akun-seksi" aria-labelledby="pengaturan-keamanan">
            <div className="akun-seksi-kepala">
              <div>
                <h2 id="pengaturan-keamanan">Keamanan & Sandi</h2>
                <p>Jaga akses akun Anda tetap terlindungi.</p>
              </div>
            </div>
            <div className="akun-daftar">
              <Link href="/ganti-password" className="akun-baris">
                <span className="akun-ikon"><NavIcon nama="akun" size={20} /></span>
                <div className="akun-baris-isi">
                  <span className="akun-baris-judul">Ganti kata sandi</span>
                  <span className="akun-baris-bantu">Perbarui kata sandi untuk akun ini.</span>
                </div>
                <span className="akun-panah" aria-hidden="true">›</span>
              </Link>
            </div>
          </section>

          {/* Presensi Bulan Ini */}
          {punyaTitikAbsen && (
            <section className="akun-seksi" aria-labelledby="presensi-saya">
              <div className="akun-seksi-kepala">
                <div>
                  <h2 id="presensi-saya">Presensi bulan ini</h2>
                  <p>Riwayat kehadiran di titik kerja Anda.</p>
                </div>
              </div>
              {presensiLoading ? (
                <KerangkaPresensiRingkas />
              ) : !presensiSaya || presensiSaya.length === 0 ? (
                <div className="akun-kartu akun-kosong">
                  <span className="akun-kosong-ikon"><NavIcon nama="absen" size={21} /></span>
                  <p className="akun-baris-judul">Belum ada presensi bulan ini</p>
                  <p>Presensi yang Anda buat akan muncul di sini.</p>
                </div>
              ) : (
                <div className="akun-daftar">
                  {presensiSaya.map((p) => (
                    <div key={p.tanggal} className="akun-baris">
                      <span className="akun-ikon"><NavIcon nama="absen" size={20} /></span>
                      <div className="akun-baris-isi">
                        <p className="akun-baris-judul">{tanggalIndonesiaDariYmd(p.tanggal)}</p>
                        <p className="akun-baris-bantu">{p.titikNama ?? 'Titik presensi'}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
                          <span>Masuk {p.jamMasuk ? jamWIB(new Date(p.jamMasuk)) : '—'}</span>
                          <span>Pulang {p.jamPulang ? jamWIB(new Date(p.jamPulang)) : '—'}</span>
                          {p.terlambatMenit ? <span style={{ color: 'var(--merah)' }}>Terlambat {p.terlambatMenit} menit</span> : null}
                          {p.statusMasuk === 'di_luar_radius' || p.statusPulang === 'di_luar_radius' ? <span style={{ color: 'var(--kuning)' }}>Di luar radius</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Menu Lainnya */}
          {luapan.length > 0 && (
            <section className="akun-seksi" aria-labelledby="menu-lainnya">
              <div className="akun-seksi-kepala">
                <div>
                  <h2 id="menu-lainnya">Menu lainnya</h2>
                  <p>Fitur sesuai akses dan penugasan Anda.</p>
                </div>
              </div>
              <div className="akun-daftar">
                {luapan.map((tab) => {
                  const namaIkon = ikonUntukTab(tab.key);
                  return (
                    <Link key={tab.key} href={tab.href} className="akun-baris">
                      <span className="akun-ikon"><NavIcon nama={namaIkon === tab.key ? 'lapor' : namaIkon} size={20} /></span>
                      <span className="akun-baris-isi"><span className="akun-baris-judul">{tab.label}</span></span>
                      <span className="akun-panah" aria-hidden="true">›</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tombol Keluar Neumorphic */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="akun-keluar inline-flex items-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Keluar dari akun
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

