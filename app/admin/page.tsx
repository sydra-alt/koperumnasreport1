'use client';

import { useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
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
  DAFTAR_ROLE,
} from '../../lib/api/admin';

type Tab = 'lokasi' | 'outlet' | 'assignment' | 'policy' | 'pengguna';

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
  const tambah = useTambahAssignment();
  const hapus = useHapusAssignment();

  const [userId, setUserId] = useState('');
  const [formKey, setFormKey] = useState('');
  const [lokasiId, setLokasiId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [shift, setShift] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)' }}>Tambah penugasan</p>
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
        <select value={shift} onChange={(e) => setShift(e.target.value)} className="border p-2" style={gayaInput}>
          <option value="">-- Tanpa shift --</option>
          <option value="pagi">Pagi</option>
          <option value="siang">Siang</option>
          <option value="malam">Malam</option>
        </select>
        <button
          type="button"
          disabled={!userId || !formKey.trim() || tambah.isPending}
          onClick={() =>
            tambah.mutate(
              { userId, formKey: formKey.trim(), lokasiId: lokasiId || null, outletId: outletId || null, shift: shift || null },
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
              {a.shift ? ` · ${a.shift}` : ''}
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [divisi, setDivisi] = useState('');
  const [rolesBaru, setRolesBaru] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)' }}>Tambah pengguna baru</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border p-2" style={gayaInput} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password awal" type="text" className="border p-2" style={gayaInput} />
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama" className="border p-2" style={gayaInput} />
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
          disabled={!email.trim() || !password || !nama.trim() || buatPengguna.isPending}
          onClick={() =>
            buatPengguna.mutate(
              { email: email.trim(), password, nama: nama.trim(), jabatan: jabatan.trim() || undefined, divisi: divisi.trim() || undefined, roles: rolesBaru },
              {
                onSuccess: () => {
                  setEmail('');
                  setPassword('');
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
            <p style={{ fontFamily: 'var(--display)' }}>
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
          </li>
        ))}
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
