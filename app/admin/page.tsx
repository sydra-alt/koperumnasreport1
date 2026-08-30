'use client';

import { useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { usePolicy } from '../../lib/api/policy';
import {
  useDaftarLokasiAdmin,
  useTambahLokasi,
  useUbahAktifLokasi,
  useDaftarOutletAdmin,
  useTambahOutlet,
  useUbahAktifOutlet,
  useDaftarAssignmentAdmin,
  useTambahAssignment,
  useHapusAssignment,
  useDaftarPolicyAdmin,
  useUbahPolicy,
  useDaftarProfilDenganRole,
  useTambahRole,
  useHapusRole,
  useBuatPengguna,
  useAturUlangKataSandi,
  useDaftarLokasiAbsenAdmin,
  useTambahLokasiAbsen,
  useUbahLokasiAbsen,
  useDaftarPenugasanAbsenAdmin,
  useTambahPenugasanAbsen,
  useHapusPenugasanAbsen,
  useAturJamKerja,
  useDaftarShiftAdmin,
  useTambahShift,
  useUbahShift,
  DAFTAR_ROLE,
} from '../../lib/api/admin';

type Tab = 'lokasi' | 'outlet' | 'assignment' | 'policy' | 'pengguna' | 'titik-absen' | 'shift';

const gayaInput = { borderColor: 'var(--garis)', minHeight: 44 } as const;
const gayaTombol = { borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 } as const;

function TabLokasi() {
  const { data: daftar } = useDaftarLokasiAdmin();
  const tambah = useTambahLokasi();
  const ubahAktif = useUbahAktifLokasi();
  const [nama, setNama] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lokasi baru" className="flex-1 border p-2" style={gayaInput} />
        <button
          type="button"
          disabled={!nama.trim() || tambah.isPending}
          onClick={() => tambah.mutate(nama.trim(), { onSuccess: () => setNama('') })}
          className="border px-4"
          style={gayaTombol}
        >
          Tambah
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {(daftar ?? []).map((l) => (
          <li key={l.id} className="flex items-center justify-between border p-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
            <span>{l.nama}</span>
            <button
              type="button"
              onClick={() => ubahAktif.mutate({ id: l.id, aktif: !l.aktif })}
              className="border px-2 py-1"
              style={{ borderColor: l.aktif ? 'var(--hijau)' : 'var(--kosong)', color: l.aktif ? 'var(--hijau)' : 'var(--kosong)', minHeight: 44 }}
            >
              {l.aktif ? 'Aktif' : 'Nonaktif'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabOutlet() {
  const { data: daftar } = useDaftarOutletAdmin();
  const tambah = useTambahOutlet();
  const ubahAktif = useUbahAktifOutlet();
  const [nama, setNama] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama outlet baru" className="flex-1 border p-2" style={gayaInput} />
        <button
          type="button"
          disabled={!nama.trim() || tambah.isPending}
          onClick={() => tambah.mutate(nama.trim(), { onSuccess: () => setNama('') })}
          className="border px-4"
          style={gayaTombol}
        >
          Tambah
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {(daftar ?? []).map((o) => (
          <li key={o.id} className="flex items-center justify-between border p-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
            <span>{o.nama}</span>
            <button
              type="button"
              onClick={() => ubahAktif.mutate({ id: o.id, aktif: !o.aktif })}
              className="border px-2 py-1"
              style={{ borderColor: o.aktif ? 'var(--hijau)' : 'var(--kosong)', color: o.aktif ? 'var(--hijau)' : 'var(--kosong)', minHeight: 44 }}
            >
              {o.aktif ? 'Aktif' : 'Nonaktif'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabAssignment() {
  const { data: daftar } = useDaftarAssignmentAdmin();
  const { data: profil } = useDaftarProfilDenganRole();
  const { data: lokasi } = useDaftarLokasiAdmin();
  const { data: outlet } = useDaftarOutletAdmin();
  const { data: shiftDaftar } = useDaftarShiftAdmin();
  const tambah = useTambahAssignment();
  const hapus = useHapusAssignment();

  const [userId, setUserId] = useState('');
  const [formKey, setFormKey] = useState('');
  const [lokasiId, setLokasiId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [shiftId, setShiftId] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>Tambah penugasan</p>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Pilih pengguna --</option>
          {(profil ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
        <input value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="form_key (mis. pic_lokasi, security)" className="border p-2" style={gayaInput} />
        <select value={lokasiId} onChange={(e) => setLokasiId(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Tanpa lokasi --</option>
          {(lokasi ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.nama}
            </option>
          ))}
        </select>
        <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Tanpa outlet --</option>
          {(outlet ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Tanpa shift --</option>
          {(shiftDaftar ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!userId || !formKey.trim() || tambah.isPending}
          onClick={() =>
            tambah.mutate(
              { userId, formKey: formKey.trim(), lokasiId: lokasiId || null, outletId: outletId || null, shiftId: shiftId || null },
              { onSuccess: () => setFormKey('') },
            )
          }
          className="border px-4 py-2"
          style={gayaTombol}
        >
          Tambah penugasan
        </button>
        {tambah.isError && <p style={{ color: 'var(--merah)' }}>{(tambah.error as Error).message}</p>}
      </div>

      <ul className="flex flex-col gap-1">
        {(daftar ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between border p-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
            <span>
              {a.userNama} -- {a.formKey}
              {a.lokasiNama ? ` · ${a.lokasiNama}` : ''}
              {a.outletNama ? ` · ${a.outletNama}` : ''}
              {a.shiftNama ? ` · ${a.shiftNama}` : ''}
            </span>
            <button
              type="button"
              onClick={() => hapus.mutate(a.id)}
              className="border px-2 py-1"
              style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
            >
              Hapus
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabPolicy() {
  const { data: daftar } = useDaftarPolicyAdmin();
  const ubah = useUbahPolicy();
  const [draf, setDraf] = useState<Record<string, string>>({});

  return (
    <div className="flex flex-col gap-3">
      {(daftar ?? []).map((p) => {
        const nilaiDraf = draf[p.key] ?? JSON.stringify(p.value);
        return (
          <div key={p.key} className="border p-3" style={{ borderColor: 'var(--garis)' }}>
            <p style={{ fontFamily: 'var(--mono)' }}>{p.key}</p>
            <textarea
              value={nilaiDraf}
              onChange={(e) => setDraf((d) => ({ ...d, [p.key]: e.target.value }))}
              className="w-full border p-2"
              style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
              rows={2}
            />
            <button
              type="button"
              disabled={ubah.isPending}
              onClick={() => {
                try {
                  const value = JSON.parse(nilaiDraf);
                  ubah.mutate({ key: p.key, value });
                } catch {
                  alert('Nilai bukan JSON yang valid.');
                }
              }}
              className="mt-2 border px-4 py-2"
              style={gayaTombol}
            >
              Simpan
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TabPengguna() {
  const { data: daftar } = useDaftarProfilDenganRole();
  const tambahRole = useTambahRole();
  const hapusRole = useHapusRole();
  const buatPengguna = useBuatPengguna();
  const aturUlang = useAturUlangKataSandi();

  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [divisi, setDivisi] = useState('');
  const [rolesBaru, setRolesBaru] = useState<string[]>([]);
  // Password baru ditampilkan SEKALI, per baris pengguna -- ditutup manual
  // atau begitu reset lain dijalankan. Tidak pernah disimpan ke state lain,
  // tidak pernah dikirim ke mana pun selain kotak ini.
  const [passwordBaruUntuk, setPasswordBaruUntuk] = useState<{ userId: string; password: string } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>Tambah pengguna baru</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border p-2" style={gayaInput} />
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama" className="border p-2" style={gayaInput} />
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Password awal otomatis &quot;admin123&quot; -- pengguna wajib menggantinya saat login pertama.
        </p>
        <input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Jabatan (opsional)" className="border p-2" style={gayaInput} />
        <input value={divisi} onChange={(e) => setDivisi(e.target.value)} placeholder="Divisi (opsional)" className="border p-2" style={gayaInput} />
        <div className="flex flex-wrap gap-2">
          {DAFTAR_ROLE.map((r) => (
            <label key={r} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={rolesBaru.includes(r)}
                onChange={(e) => setRolesBaru((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))}
              />
              {r}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!email.trim() || !nama.trim() || buatPengguna.isPending}
          onClick={() =>
            buatPengguna.mutate(
              { email: email.trim(), nama: nama.trim(), jabatan: jabatan.trim() || undefined, divisi: divisi.trim() || undefined, roles: rolesBaru },
              {
                onSuccess: () => {
                  setEmail('');
                  setNama('');
                  setJabatan('');
                  setDivisi('');
                  setRolesBaru([]);
                },
              },
            )
          }
          className="border px-4 py-2"
          style={gayaTombol}
        >
          {buatPengguna.isPending ? 'Membuat…' : 'Buat pengguna'}
        </button>
        {buatPengguna.isError && <p style={{ color: 'var(--merah)' }}>{(buatPengguna.error as Error).message}</p>}
      </div>

      <ul className="flex flex-col gap-2">
        {(daftar ?? []).map((p) => (
          <li key={p.id} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>
              {p.nama} {p.jabatan ? `-- ${p.jabatan}` : ''} {p.divisi ? `(${p.divisi})` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {DAFTAR_ROLE.map((r) => {
                const aktif = p.roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => (aktif ? hapusRole.mutate({ userId: p.id, role: r }) : tambahRole.mutate({ userId: p.id, role: r }))}
                    className="border px-2 py-1"
                    style={{
                      borderColor: aktif ? 'var(--biru)' : 'var(--garis)',
                      background: aktif ? 'var(--biru)' : 'transparent',
                      color: aktif ? 'var(--kertas-2)' : 'var(--tinta)',
                      minHeight: 44,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={aturUlang.isPending}
              onClick={() => {
                if (!confirm(`Atur ulang kata sandi ${p.nama}? Kata sandi lamanya langsung tidak berlaku.`)) return;
                setPasswordBaruUntuk(null);
                aturUlang.mutate(p.id, {
                  onSuccess: (hasil) => setPasswordBaruUntuk({ userId: p.id, password: hasil.password }),
                  onError: (err) => alert((err as Error).message),
                });
              }}
              className="mt-2 border px-2 py-1"
              style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
            >
              {aturUlang.isPending ? 'Mengatur ulang…' : 'Atur ulang kata sandi'}
            </button>
            {passwordBaruUntuk?.userId === p.id && (
              <div className="mt-2 border p-2" style={{ borderColor: 'var(--hijau)', background: 'var(--kertas-2)' }}>
                <p>
                  Kata sandi baru untuk <strong>{p.nama}</strong> (salin & berikan langsung ke orangnya sekarang --
                  tidak akan ditampilkan lagi setelah kotak ini ditutup):
                </p>
                <p className="mt-1 select-all border px-2 py-1" style={{ fontFamily: 'var(--mono)', borderColor: 'var(--garis)', background: 'var(--kertas)' }}>
                  {passwordBaruUntuk.password}
                </p>
                <button
                  type="button"
                  onClick={() => setPasswordBaruUntuk(null)}
                  className="mt-2 border px-3 py-1"
                  style={gayaTombol}
                >
                  Sudah disalin, tutup
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabTitikAbsen() {
  const { data: titik } = useDaftarLokasiAbsenAdmin();
  const { data: penugasan } = useDaftarPenugasanAbsenAdmin();
  const { data: profil } = useDaftarProfilDenganRole();
  const { data: policy } = usePolicy();
  const tambahTitik = useTambahLokasiAbsen();
  const ubahTitik = useUbahLokasiAbsen();
  const tambahPenugasan = useTambahPenugasanAbsen();
  const hapusPenugasan = useHapusPenugasanAbsen();
  const aturJam = useAturJamKerja();

  // Radius default dari policy.absen_radius_default_meter (CLAUDE.md #4 --
  // angka aturan bisnis dari tabel policy, bukan hardcode) -- state KOSONG
  // sampai admin ketik sendiri, placeholder-nya yang menunjukkan defaultnya.
  const radiusDefault = String(policy?.absen_radius_default_meter ?? 200);
  const [nama, setNama] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('');

  const [userIdBaru, setUserIdBaru] = useState('');
  const [titikIdBaru, setTitikIdBaru] = useState('');

  const [draf, setDraf] = useState<Record<string, { nama: string; lat: string; lon: string; radius: string; aktif: boolean }>>({});
  const [drafJam, setDrafJam] = useState<Record<string, { jamMasuk: string; jamPulang: string }>>({});

  function kunciPenugasan(userId: string, lokasiAbsenId: string) {
    return `${userId}|${lokasiAbsenId}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>Tambah titik absen</p>
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama titik (mis. Kantor Pusat)" className="border p-2" style={gayaInput} />
        <div className="flex gap-2">
          <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude, mis. -6.914744" className="flex-1 border p-2" style={gayaInput} />
          <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude, mis. 107.609810" className="flex-1 border p-2" style={gayaInput} />
        </div>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Buka Google Maps, tekan lama di titiknya, salin dua angka yang muncul.
        </p>
        <input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder={`Radius (meter) -- default ${radiusDefault}`} className="border p-2" style={gayaInput} />
        <button
          type="button"
          disabled={!nama.trim() || !lat || !lon || tambahTitik.isPending}
          onClick={() =>
            tambahTitik.mutate(
              { nama: nama.trim(), latitude: Number(lat), longitude: Number(lon), radiusMeter: Number(radius || radiusDefault) },
              { onSuccess: () => { setNama(''); setLat(''); setLon(''); setRadius(''); } },
            )
          }
          className="border px-4 py-2"
          style={gayaTombol}
        >
          Tambah titik
        </button>
        {tambahTitik.isError && <p style={{ color: 'var(--merah)' }}>{(tambahTitik.error as Error).message}</p>}
      </div>

      <ul className="flex flex-col gap-2">
        {(titik ?? []).map((t) => {
          const d = draf[t.id] ?? { nama: t.nama, lat: String(t.latitude), lon: String(t.longitude), radius: String(t.radiusMeter), aktif: t.aktif };
          return (
            <li key={t.id} className="flex flex-col gap-2 border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <input
                value={d.nama}
                onChange={(e) => setDraf((s) => ({ ...s, [t.id]: { ...d, nama: e.target.value } }))}
                className="border p-2"
                style={gayaInput}
              />
              <div className="flex gap-2">
                <input
                  value={d.lat}
                  onChange={(e) => setDraf((s) => ({ ...s, [t.id]: { ...d, lat: e.target.value } }))}
                  className="flex-1 border p-2"
                  style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
                />
                <input
                  value={d.lon}
                  onChange={(e) => setDraf((s) => ({ ...s, [t.id]: { ...d, lon: e.target.value } }))}
                  className="flex-1 border p-2"
                  style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
                />
                <input
                  value={d.radius}
                  onChange={(e) => setDraf((s) => ({ ...s, [t.id]: { ...d, radius: e.target.value } }))}
                  className="w-24 border p-2"
                  style={gayaInput}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraf((s) => ({ ...s, [t.id]: { ...d, aktif: !d.aktif } }))}
                  className="border px-2 py-1"
                  style={{ borderColor: d.aktif ? 'var(--hijau)' : 'var(--kosong)', color: d.aktif ? 'var(--hijau)' : 'var(--kosong)', minHeight: 44 }}
                >
                  {d.aktif ? 'Aktif' : 'Nonaktif'}
                </button>
                <button
                  type="button"
                  disabled={ubahTitik.isPending}
                  onClick={() =>
                    ubahTitik.mutate({ id: t.id, nama: d.nama.trim(), latitude: Number(d.lat), longitude: Number(d.lon), radiusMeter: Number(d.radius), aktif: d.aktif })
                  }
                  className="border px-3 py-1"
                  style={gayaTombol}
                >
                  Simpan
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>Siapa absen di mana</p>
        <select value={userIdBaru} onChange={(e) => setUserIdBaru(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Pilih pengguna --</option>
          {(profil ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
        <select value={titikIdBaru} onChange={(e) => setTitikIdBaru(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Pilih titik absen --</option>
          {(titik ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nama}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!userIdBaru || !titikIdBaru || tambahPenugasan.isPending}
          onClick={() =>
            tambahPenugasan.mutate({ userId: userIdBaru, lokasiAbsenId: titikIdBaru }, { onSuccess: () => { setUserIdBaru(''); setTitikIdBaru(''); } })
          }
          className="border px-4 py-2"
          style={gayaTombol}
        >
          Tugaskan
        </button>
        {tambahPenugasan.isError && <p style={{ color: 'var(--merah)' }}>{(tambahPenugasan.error as Error).message}</p>}
      </div>

      <ul className="flex flex-col gap-2">
        {(penugasan ?? []).map((pn) => {
          const kunci = kunciPenugasan(pn.userId, pn.lokasiAbsenId);
          const dj = drafJam[kunci] ?? { jamMasuk: pn.jamMasuk ?? '', jamPulang: pn.jamPulang ?? '' };
          return (
            <li key={kunci} className="flex flex-col gap-2 border p-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <div className="flex items-center justify-between">
                <span>
                  {pn.userNama} -- {pn.lokasiAbsenNama}
                </span>
                <button
                  type="button"
                  onClick={() => hapusPenugasan.mutate({ userId: pn.userId, lokasiAbsenId: pn.lokasiAbsenId })}
                  className="border px-2 py-1"
                  style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
                >
                  Hapus
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--kosong)' }}>Jam:</span>
                <input
                  value={dj.jamMasuk}
                  onChange={(e) => setDrafJam((s) => ({ ...s, [kunci]: { ...dj, jamMasuk: e.target.value } }))}
                  placeholder="masuk (kosong = default)"
                  className="w-32 border p-1"
                  style={{ ...gayaInput, minHeight: 40 }}
                />
                <input
                  value={dj.jamPulang}
                  onChange={(e) => setDrafJam((s) => ({ ...s, [kunci]: { ...dj, jamPulang: e.target.value } }))}
                  placeholder="pulang (kosong = default)"
                  className="w-32 border p-1"
                  style={{ ...gayaInput, minHeight: 40 }}
                />
                <button
                  type="button"
                  disabled={aturJam.isPending}
                  onClick={() =>
                    aturJam.mutate({ userId: pn.userId, lokasiAbsenId: pn.lokasiAbsenId, jamMasuk: dj.jamMasuk.trim() || null, jamPulang: dj.jamPulang.trim() || null })
                  }
                  className="border px-2 py-1"
                  style={gayaTombol}
                >
                  Simpan jam
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Kelola Shift (30 Agustus 2026, migrasi 0033_tabel_shift.sql) -- CEO
 * mengatur nama/jam/batas lapor tanpa migrasi. `jam_mulai`/`jam_selesai`
 * SENGAJA diseed kosong (keputusan eksplisit user -- nilai `batas_lapor`
 * lama BUKAN jam pulang sungguhan, tidak boleh dipakai sebagai tebakan) --
 * baris dengan jam kosong menampilkan "Jam kerja belum diisi" jelas,
 * BUKAN placeholder yang terlihat seperti data asli.
 */
function TabShift() {
  const { data: daftar } = useDaftarShiftAdmin();
  const tambah = useTambahShift();
  const ubah = useUbahShift();
  const [namaBaru, setNamaBaru] = useState('');

  const [draf, setDraf] = useState<Record<string, { nama: string; jamMulai: string; jamSelesai: string; batasLapor: string; aktif: boolean }>>({});

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} placeholder="Nama shift baru (mis. Pagi)" className="flex-1 border p-2" style={gayaInput} />
        <button
          type="button"
          disabled={!namaBaru.trim() || tambah.isPending}
          onClick={() => tambah.mutate(namaBaru.trim(), { onSuccess: () => setNamaBaru('') })}
          className="border px-4"
          style={gayaTombol}
        >
          Tambah
        </button>
      </div>
      {tambah.isError && <p style={{ color: 'var(--merah)' }}>{(tambah.error as Error).message}</p>}

      <ul className="flex flex-col gap-2">
        {(daftar ?? []).map((s) => {
          const d = draf[s.id] ?? { nama: s.nama, jamMulai: s.jamMulai ?? '', jamSelesai: s.jamSelesai ?? '', batasLapor: s.batasLapor ?? '', aktif: s.aktif };
          const jamBelumDiisi = !s.jamMulai || !s.jamSelesai;
          return (
            <li key={s.id} className="flex flex-col gap-2 border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <input value={d.nama} onChange={(e) => setDraf((v) => ({ ...v, [s.id]: { ...d, nama: e.target.value } }))} className="border p-2" style={gayaInput} />
              {jamBelumDiisi && (
                <p style={{ color: 'var(--kuning)' }}>⚠️ Jam kerja belum diisi -- isi jam mulai/selesai di bawah.</p>
              )}
              <div className="flex gap-2">
                <input
                  value={d.jamMulai}
                  onChange={(e) => setDraf((v) => ({ ...v, [s.id]: { ...d, jamMulai: e.target.value } }))}
                  placeholder="Jam mulai (HH:mm)"
                  className="flex-1 border p-2"
                  style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
                />
                <input
                  value={d.jamSelesai}
                  onChange={(e) => setDraf((v) => ({ ...v, [s.id]: { ...d, jamSelesai: e.target.value } }))}
                  placeholder="Jam selesai (HH:mm)"
                  className="flex-1 border p-2"
                  style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
                />
              </div>
              <input
                value={d.batasLapor}
                onChange={(e) => setDraf((v) => ({ ...v, [s.id]: { ...d, batasLapor: e.target.value } }))}
                placeholder="Batas jam lapor (HH:mm) -- dipakai form 'per_shift' (mis. security)"
                className="border p-2"
                style={{ ...gayaInput, fontFamily: 'var(--mono)' }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraf((v) => ({ ...v, [s.id]: { ...d, aktif: !d.aktif } }))}
                  className="border px-2 py-1"
                  style={{ borderColor: d.aktif ? 'var(--hijau)' : 'var(--kosong)', color: d.aktif ? 'var(--hijau)' : 'var(--kosong)', minHeight: 44 }}
                >
                  {d.aktif ? 'Aktif' : 'Nonaktif'}
                </button>
                <button
                  type="button"
                  disabled={ubah.isPending}
                  onClick={() =>
                    ubah.mutate({
                      id: s.id,
                      nama: d.nama.trim(),
                      jamMulai: d.jamMulai.trim() || null,
                      jamSelesai: d.jamSelesai.trim() || null,
                      batasLapor: d.batasLapor.trim() || null,
                      aktif: d.aktif,
                    })
                  }
                  className="border px-3 py-1"
                  style={gayaTombol}
                >
                  Simpan
                </button>
              </div>
              {ubah.isError && <p style={{ color: 'var(--merah)' }}>{(ubah.error as Error).message}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Isi() {
  const [tab, setTab] = useState<Tab>('lokasi');
  const TAB: { key: Tab; label: string }[] = [
    { key: 'lokasi', label: 'Lokasi' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'assignment', label: 'Penugasan' },
    { key: 'policy', label: 'Policy' },
    { key: 'pengguna', label: 'Pengguna' },
    { key: 'titik-absen', label: 'Titik Absen' },
    { key: 'shift', label: 'Shift' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {TAB.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="border px-3 py-2"
            style={{
              borderColor: 'var(--biru)',
              background: tab === t.key ? 'var(--biru)' : 'transparent',
              color: tab === t.key ? 'var(--kertas-2)' : 'var(--biru)',
              minHeight: 44,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'lokasi' && <TabLokasi />}
      {tab === 'outlet' && <TabOutlet />}
      {tab === 'assignment' && <TabAssignment />}
      {tab === 'policy' && <TabPolicy />}
      {tab === 'pengguna' && <TabPengguna />}
      {tab === 'titik-absen' && <TabTitikAbsen />}
      {tab === 'shift' && <TabShift />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Terlindungi peran="ceo">
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Admin
        </h1>
        <Isi />
      </main>
    </Terlindungi>
  );
}
