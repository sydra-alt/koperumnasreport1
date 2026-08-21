/** Kompres gambar di browser lewat canvas (tanpa library tambahan). */
export async function kompresGambar(file: File, sisiTerpanjangMaks: number, kualitas: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, sisiTerpanjangMaks / Math.max(bitmap.width, bitmap.height));
  const lebar = Math.max(1, Math.round(bitmap.width * skala));
  const tinggi = Math.max(1, Math.round(bitmap.height * skala));

  const canvas = document.createElement('canvas');
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Kanvas tidak didukung di perangkat ini.');
  }
  ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal mengompres gambar.'))),
      'image/jpeg',
      kualitas,
    );
  });
}
