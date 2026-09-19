// Pengaman bersama untuk skrip uji "LIVE" -- skrip yang HARUS menulis sungguhan
// ke database (bukan di dalam transaksi) karena server Next.js / browser yang
// diuji membaca lewat koneksi LAIN dan tidak melihat perubahan yang belum
// di-commit. Transaksi + ROLLBACK mustahil untuk kelas skrip ini, jadi
// jaminannya diganti: pemulihan idempoten yang dijalankan tepat SEKALI dari
// SEMUA jalur keluar, bukan cuma dari `finally`.
//
// Kenapa `finally` saja tidak cukup: Ctrl-C (SIGINT), SIGTERM, dan galat yang
// lolos dari try/catch tidak selalu menjalankan `finally`. Modul ini memasang
// penangan untuk semuanya. YANG TIDAK BISA DITANGKAP (kill -9 / TerminateProcess
// di Windows / listrik mati): pulihkan dengan `node scripts/pulihkan-akun-uji.mjs`.
//
// Pemakaian:
//   const pulihkan = pasangPemulih('nama-skrip', async () => { ...kembalikan keadaan... });
//   try { ...ubah keadaan, jalankan uji... } finally { await pulihkan(); }

/**
 * @param {string} nama    label untuk log
 * @param {() => Promise<void>} pulihkan  harus idempoten; dijalankan sekali
 * @returns {() => Promise<void>}  panggil di `finally` -- aman dipanggil berkali-kali
 */
export function pasangPemulih(nama, pulihkan) {
  let janji = null;
  const jalankan = (sebab) => {
    if (!janji) {
      if (sebab !== 'selesai') console.error(`\n[pengaman-uji:${nama}] menghentikan uji (${sebab}) -- memulihkan keadaan dulu...`);
      janji = Promise.resolve()
        .then(pulihkan)
        .catch((e) => {
          console.error(`🛑 [pengaman-uji:${nama}] GAGAL memulihkan: ${e?.message ?? e}. Jalankan: node scripts/pulihkan-akun-uji.mjs`);
          process.exitCode = 1;
        });
    }
    return janji;
  };

  for (const sinyal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.once(sinyal, async () => {
      await jalankan(sinyal);
      process.exit(130);
    });
  }
  process.once('uncaughtException', async (e) => {
    console.error(e);
    await jalankan('galat tak tertangkap');
    process.exit(1);
  });
  process.once('unhandledRejection', async (e) => {
    console.error(e);
    await jalankan('promise ditolak tak tertangkap');
    process.exit(1);
  });

  return () => jalankan('selesai');
}
