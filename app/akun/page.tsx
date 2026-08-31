'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthProvider';
import { formRegistry } from '../../forms';
import { tabTerlihat, tabLuapan } from '../../lib/navUtama';
import { KerangkaPresensiRingkas } from '../../components/Kerangka';
import { useTitikAbsenSaya, usePresensiSayaUntukBulan } from '../../lib/api/absensi';
import { jamWIB, tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';

/**
 * Halaman "Akun" -- slot terakhir nav bawah (§2 06-RENCANA-PRESENSI-MOBILE.md).
 * Selain profil & Keluar, ini JUGA tempat "luapan" tab yang berhak dibuka
 * user tapi kalah prioritas di nav bawah (mis. CEO tetap bisa buka Marketing
 * & Admin, cuma tidak dapat slot di antara 5 tombol) -- supaya tidak ada
 * halaman yang jadi tidak terjangkau sama sekali gara-gara batas 5 tombol.
 */
export default function AkunPage() {
  const { profile, roles, assignments, signOut, session } = useAuth();
  // divisi WAJIB diteruskan -- tanpa ini, kadiv+HRD yang tab "Tinjau
  // Absensi"-nya kebetulan kalah prioritas & masuk luapan (di bawah) akan
  // kehilangannya di sini juga (bolehTinjauAbsen salah mengira false),
  // sama seperti bug yang sudah pernah terjadi di KopHalaman sebelum ini
  // ditemukan (ditemukan saat menata ulang halaman ini, bukan dicari-cari).
  const semua = tabTerlihat(roles, assignments, formRegistry, profile?.divisi ?? null);
  // punyaTitikAbsen WAJIB juga diteruskan (sama alasan dengan divisi di
  // atas) -- tabLuapan() perlu tahu apakah 2 atau 3 slot tengah dipakai di
  // nav bawah supaya daftar "kalah prioritas" di sini cocok persis.
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const luapan = tabLuapan(semua, (titikSaya?.length ?? 0) > 0);
  const punyaTitikAbsen = (titikSaya?.length ?? 0) > 0;
  const bulanIni = tanggalWIB().slice(0, 7);
  const { data: presensiSaya, isLoading: presensiLoading } = usePresensiSayaUntukBulan(bulanIni, punyaTitikAbsen);

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Akun
      </h1>

      <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>{profile?.nama ?? '—'}</p>
        <p className="teks-penjelasan">
          {profile?.jabatan ?? '—'} · {profile?.divisi ?? '—'}
        </p>
        <p className="teks-penjelasan">
          Peran: {roles.length > 0 ? roles.join(', ') : '—'}
        </p>
      </div>

      {punyaTitikAbsen && (
        <div className="flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
            Presensi saya bulan ini
          </p>
          {presensiLoading ? (
            <KerangkaPresensiRingkas />
          ) : !presensiSaya || presensiSaya.length === 0 ? (
            <p className="teks-penjelasan">Belum ada presensi bulan ini.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {presensiSaya.map((p) => (
                <div key={p.tanggal} className="border p-3" style={{ borderColor: 'var(--garis)' }}>
                  <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{tanggalIndonesiaDariYmd(p.tanggal)}</p>
                  <p className="text-sm" style={{ color: 'var(--label)' }}>{p.titikNama ?? '—'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mt-1" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
                    <span>Masuk {p.jamMasuk ? jamWIB(new Date(p.jamMasuk)) : '—'}</span>
                    <span>Pulang {p.jamPulang ? jamWIB(new Date(p.jamPulang)) : '—'}</span>
                    {p.terlambatMenit ? <span style={{ color: 'var(--merah)' }}>Terlambat {p.terlambatMenit} menit</span> : null}
                    {p.statusMasuk === 'di_luar_radius' || p.statusPulang === 'di_luar_radius' ? (
                      <span style={{ color: 'var(--kuning)' }}>Di luar radius</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {luapan.length > 0 && (
        <div className="flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
            Lainnya
          </p>
          {luapan.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className="border p-3"
              style={{ borderColor: 'var(--garis)', minHeight: 48 }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void signOut()}
        className="border px-4 py-3"
        style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 48, alignSelf: 'flex-start' }}
      >
        Keluar
      </button>
    </main>
  );
}
