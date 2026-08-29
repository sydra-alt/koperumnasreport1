/**
 * Ikon PWA dibuat dari kode lewat `next/og` (satori) -- proyek ini belum
 * punya aset logo resmi dari klien, jadi dibuat sederhana memakai warna
 * token yang sudah ada (`--biru`/`--kertas-2`, `04-CATATAN-TEKNIS.md` §6)
 * daripada menaruh berkas gambar sembarangan. Satori cuma mendukung subset
 * CSS (flexbox, tanpa Tailwind/CSS eksternal) -- gaya ditulis inline murni.
 */
export function elemenIkon(ukuran: number) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#123A56',
        color: '#F1F3EE',
        fontSize: ukuran * 0.42,
        fontWeight: 700,
        letterSpacing: -2,
      }}
    >
      KG
    </div>
  );
}
