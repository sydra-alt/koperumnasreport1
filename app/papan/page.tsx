'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { PapanKartu } from '../../components/PapanKartu';
import { PemilihTanggal } from '../../components/PemilihTanggal';
import { useAuth } from '../../lib/auth/AuthProvider';
import { usePolicy } from '../../lib/api/policy';
import { usePapanUntukTanggal, useTagihLaporan, type PapanRow } from '../../lib/api/papan';
import { hariIsoDariTanggal, tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';
import { formRegistry } from '../../forms';

function PapanKontrolIsi() {
  const { roles } = useAuth();
  const { data: policy } = usePolicy();
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const { data: baris, isLoading } = usePapanUntukTanggal(tanggal);
  const tagih = useTagihLaporan();
  const [sedangDitagih, setSedangDitagih] = useState<string | null>(null);

  const bolehTagih = roles.includes('pusat') && tanggal === tanggalWIB();

  async function tanganiTagih(assignmentId: string) {
    setSedangDitagih(assignmentId);
    try {
      await tagih.mutateAsync(assignmentId);
    } finally {
      setSedangDitagih(null);
    }
  }

  // "Laporan yang ditunggu" DIHITUNG dari `assignment` lewat RPC
  // `papan_untuk_tanggal` (03-CALC-SPEC.md §4.1, migrasi 0020) -- bukan
  // daftar tetap. Menambah baris assignment baru (Task 23) langsung
  // menambah kartu di sini tanpa ubah kode, sama seperti tab "Lapor" dinamis
  // (lib/navLapor.ts).
  const kelompok = useMemo(() => {
    const peta = new Map<string, PapanRow[]>();
    for (const b of baris ?? []) {
      const daftar = peta.get(b.formKey) ?? [];
      daftar.push(b);
      peta.set(b.formKey, daftar);
    }
    return Array.from(peta.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [baris]);

  const totalSudah = (baris ?? []).filter((b) => b.reportId).length;
  const totalSemua = (baris ?? []).length;

  const workdays = (policy?.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5, 6];
  const tanggalBukanHariKerja = !workdays.includes(hariIsoDariTanggal(tanggal));

  return (
    <div className="flex flex-col gap-6">
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />

      {!policy || isLoading ? (
        <p>Memuat…</p>
      ) : tanggalBukanHariKerja ? (
        <div className="border p-6 text-center" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', color: 'var(--kosong)' }}>Bukan hari kerja</p>
          <p className="text-sm" style={{ color: 'var(--kosong)' }}>
            {tanggalIndonesiaDariYmd(tanggal)} bukan hari wajib lapor, jadi tidak ada laporan yang ditunggu.
          </p>
        </div>
      ) : (
        <>
          <div className="border p-3" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)' }}>
            {totalSudah} / {totalSemua} PIC sudah melapor
          </div>

          {totalSemua === 0 && <p style={{ color: 'var(--kosong)' }}>Belum ada penugasan yang tercatat.</p>}

          {kelompok.map(([formKey, daftar]) => {
            const formNama = formRegistry[formKey]?.nama ?? formKey;
            const sudah = daftar.filter((b) => b.reportId).length;
            return (
              <div key={formKey} className="flex flex-col gap-2">
                <p style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
                  {formNama} ({sudah}/{daftar.length})
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                  {daftar.map((b) => (
                    <PapanKartu
                      key={b.assignmentId}
                      baris={b}
                      formNama={formNama}
                      bolehTagih={bolehTagih}
                      menagih={sedangDitagih === b.assignmentId}
                      onTagih={() => void tanganiTagih(b.assignmentId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function PapanPage() {
  return (
    <Terlindungi peran={['ceo', 'pusat']}>
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Papan Kontrol
        </h1>
        <PapanKontrolIsi />
      </main>
    </Terlindungi>
  );
}
