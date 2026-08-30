/**
 * Pola "keadaan gagal" -- ditambahkan 30 Agustus 2026 (koreksi eksplisit
 * user atas DESIGN.md §16, yang cuma membahas "kosong": memang tidak ada
 * data, bukan gagal DIMUAT). Dua keadaan itu TIDAK BOLEH terlihat sama --
 * §16 sendiri bilang keadaan kosong harus menjawab "apakah ini memang
 * kosong, atau sistem bermasalah?", tapi sebelumnya tidak ada jawaban
 * visual untuk sisi "sistem bermasalah"-nya. Beda dari pesan error field
 * (§17, ditempel dekat field) -- ini untuk SATU BAGIAN LAYAR yang gagal
 * dimuat (query gagal), dengan tombol coba lagi eksplisit.
 */
export function KeadaanGagal({ pesan = 'Gagal memuat data.', onCoba }: { pesan?: string; onCoba: () => void }) {
  return (
    <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--merah)', background: 'rgba(166,43,43,0.06)', borderRadius: 'var(--radius-besar)' }}>
      <p style={{ color: 'var(--merah)' }}>{pesan}</p>
      <button
        type="button"
        onClick={onCoba}
        className="w-fit border px-3 py-1"
        style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
      >
        Coba lagi
      </button>
    </div>
  );
}
