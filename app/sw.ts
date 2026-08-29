/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * PWA (§2 06-RENCANA-PRESENSI-MOBILE.md) -- installable + `display:standalone`,
 * BUKAN aplikasi offline penuh (tidak diminta dokumen). `defaultCache` dari
 * Serwist sendiri (strategi cache yang sudah disetel untuk pola Next.js:
 * font/gambar/JS/CSS `CacheFirst`/`StaleWhileRevalidate`, HALAMAN
 * `NetworkFirst` -- selalu coba jaringan dulu, cache cuma jaring pengaman
 * saat benar-benar offline). SENGAJA TIDAK menambah `fallbacks`/halaman
 * offline khusus -- di luar cakupan yang diminta.
 *
 * ⚠️ Catatan yang perlu diingat (bukan bug, tapi risiko yang wajar untuk
 * PWA mana pun): karena cache service worker per PERANGKAT/browser, bukan
 * per SESI, kalau dua orang berbeda login bergantian di HP/komputer yang
 * SAMA, `NetworkFirst` di atas berarti isi HALAMAN nyaris selalu diambil
 * baru dari jaringan (jadi RLS server tetap yang menentukan apa yang
 * terlihat) -- cache lama cuma terpakai kalau perangkat itu benar-benar
 * offline saat itu juga. Risikonya kecil untuk 35 orang yang pakai HP
 * pribadi masing-masing, tapi kalau nanti ada perangkat kantor yang
 * dipakai bergantian, ini layak ditinjau ulang.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
