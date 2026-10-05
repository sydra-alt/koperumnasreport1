import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tanggalWIB } from '@/lib/tanggal';
import { bulanValid } from '@/lib/asetPersediaan';
import { buatTokenPnlBridge, type AksesPos } from '@/lib/posHandoff';
import {
  hitungHppThrift,
  type BadgesKualitas,
  type CategorySalesHpp,
  type ControlLineOpname,
  type KategoriBiaya,
  type LabaRugiKonsolidasi,
  type OutletPnlView,
  type StatusLaporanBulanan,
  type SumberLaporan,
} from '@/lib/labaRugi';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADER = { 'Cache-Control': 'no-store' };
const TIMEOUT_POS_MS = 25_000;

function emptyCategory(): CategorySalesHpp {
  return {
    omzet: 0,
    penjualanBersih: 0,
    diskon: 0,
    hpp: 0,
    labaKotor: 0,
    marginPersen: 0,
    jumlahItem: 0,
    itemTanpaResep: 0,
    itemBiayaBelumLengkap: 0,
  };
}

function emptyControlLine(): ControlLineOpname {
  return {
    stokAwal: null,
    stokAwalAda: false,
    pembelianDanTransfer: 0,
    stokAkhir: null,
    stokAkhirAda: false,
    pemakaianAktual: null,
    selisihVsHpp: null,
    selisihPersen: null,
    status: 'data_belum_lengkap',
    keterangan: 'Data opname stok belum tersedia.',
  };
}

/**
 * GET /api/laba-rugi?bulan=yyyy-MM
 * Mengagregasi laporan Laba Rugi Bulanan dari pos-fnb (omzet, HPP resep, kontrol line)
 * dan database laporan (biaya operasional, status alur, mode manual).
 */
export async function GET(request: Request) {
  const bulan = new URL(request.url).searchParams.get('bulan') ?? '';
  if (!bulanValid(bulan, tanggalWIB())) {
    return NextResponse.json({ ok: false, error: 'Bulan tidak valid.' }, { status: 400, headers: NO_CACHE_HEADER });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Silakan login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADER });
  }

  const { data: boleh, error: galatHak } = await supabase.rpc('boleh_lihat_laba_rugi');
  if (galatHak || !boleh) {
    return NextResponse.json(
      { ok: false, error: 'Laba Rugi Bulanan hanya dapat diakses oleh CEO, Admin, Ita, dan Accounting.' },
      { status: 403, headers: NO_CACHE_HEADER }
    );
  }

  // Cek apakah user CEO murni (bukan admin)
  const [{ data: isCeo }, { data: isAdmin }, { data: profile }, { data: aksesPos }] = await Promise.all([
    supabase.rpc('has_role', { role_name: 'ceo' }),
    supabase.rpc('is_admin'),
    supabase.from('profile').select('nama').eq('id', auth.user.id).maybeSingle(),
    supabase.rpc('akses_pos_saya'),
  ]);

  const isCeoOnly = Boolean(isCeo && !isAdmin);

  // 1. Ambil daftar outlet & pemetaan POS
  const [{ data: outletRows }, { data: mapRows }, { data: kategoriRows }, { data: biayaRows }, { data: statusRows }, { data: manualRows }] =
    await Promise.all([
      supabase.from('outlet').select('id, nama, slug').order('nama'),
      supabase.from('outlet_pos_map').select('outlet_id, pos_outlet_id, pos_outlet_nama').eq('diabaikan', false),
      supabase.from('kategori_biaya').select('id, nama, urutan, aktif').eq('aktif', true).order('urutan'),
      supabase.from('biaya_bulanan').select('*').eq('bulan', bulan),
      supabase.from('laporan_bulanan').select('*').eq('bulan', bulan),
      supabase.from('laporan_bulanan_manual').select('*').eq('bulan', bulan),
    ]);

  const outlets = outletRows ?? [];
  const posMap = new Map((mapRows ?? []).map((m) => [m.outlet_id, m.pos_outlet_id]));
  const kategoriList = (kategoriRows ?? []) as KategoriBiaya[];
  const statusMap = new Map((statusRows ?? []).map((s) => [s.outlet_id, s]));
  const manualMap = new Map((manualRows ?? []).map((m) => [m.outlet_id, m]));

  // Biaya map: outlet_id -> BiayaBulananItem[]
  const biayaMap = new Map<string, typeof biayaRows>();
  for (const b of biayaRows ?? []) {
    const list = biayaMap.get(b.outlet_id) ?? [];
    list.push(b);
    biayaMap.set(b.outlet_id, list);
  }

  // 2. Tarik data agregat POS lewat Signed Bridge
  let posDataMap = new Map<string, any>(); // posOutletId -> OutletPnlData
  const posUrl = process.env.POS_INTEGRASI_URL;
  const posSecret = process.env.POS_HANDOFF_SECRET;

  if (posUrl && posSecret) {
    try {
      const token = buatTokenPnlBridge(
        { id: auth.user.id, email: auth.user.email ?? '' },
        { nama: profile?.nama ?? null, akses: (aksesPos as AksesPos) ?? null }
      );

      const res = await fetch(`${posUrl.replace(/\/+$/, '')}/api/integrasi/pnl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'get_pnl_data',
          args: { month: bulan },
        }),
        signal: AbortSignal.timeout(TIMEOUT_POS_MS),
        cache: 'no-store',
      });

      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data && Array.isArray(json.data.outlets)) {
          for (const ot of json.data.outlets) {
            posDataMap.set(ot.outletId, ot);
          }
        }
      } else {
        console.warn('[laba-rugi/route] POS bridge returned HTTP', res.status);
      }
    } catch (err) {
      console.warn('[laba-rugi/route] POS bridge error:', err);
    }
  }

  // 3. Susun data per outlet
  const outletResults: OutletPnlView[] = [];

  for (const ot of outlets) {
    const st = statusMap.get(ot.id);
    const status: StatusLaporanBulanan = (st?.status as StatusLaporanBulanan) ?? 'draft';
    const sumber: SumberLaporan = (st?.sumber as SumberLaporan) ?? 'pos';
    const posOutletId = posMap.get(ot.id) ?? null;

    // Biaya operasional outlet ini
    const outletBiayaItems = biayaMap.get(ot.id) ?? [];
    const biayaPerKatMap = new Map(outletBiayaItems.map((b) => [b.kategori_id, b]));

    const biayaOperasional = kategoriList.map((kat) => {
      const item = biayaPerKatMap.get(kat.id);
      return {
        kategoriId: kat.id,
        kategoriNama: kat.nama,
        jumlah: item ? Number(item.jumlah) : 0,
        catatan: item?.catatan ?? '',
        buktiPath: item?.bukti_path ?? null,
      };
    });

    const totalBiayaOperasional = biayaOperasional.reduce((acc, b) => acc + b.jumlah, 0);

    let makanan = emptyCategory();
    let minuman = emptyCategory();
    let thrift = emptyCategory();
    let totalPenjualan = {
      omzet: 0,
      penjualanBersih: 0,
      diskon: 0,
      hpp: 0,
      labaKotor: 0,
      marginPersen: 0,
    };
    let controlLine = emptyControlLine();
    let badges: BadgesKualitas = {
      persenTanpaResep: 0,
      jumlahBahanTanpaHarga: 0,
      jumlahStokMinus: 0,
      pesanPeringatan: [],
    };
    let isFrozen = false;
    let frozenAt: string | null = null;
    let frozenBy: string | null = null;
    let lastOpnameDate: string | null = null;
    let isOpnameTooOld = false;

    if (sumber === 'manual') {
      // ─── MODE MANUAL ───
      const man = manualMap.get(ot.id);
      const omzetMakanan = man ? Number(man.omzet_makanan) : 0;
      const omzetMinuman = man ? Number(man.omzet_minuman) : 0;
      const omzetThrift = man ? Number(man.omzet_thrift) : 0;

      const hppMakanan = man ? Number(man.hpp_makanan) : 0;
      const hppMinuman = man ? Number(man.hpp_minuman) : 0;

      const stokAwalThrift = man ? Number(man.stok_awal_thrift) : 0;
      const pembelianThrift = man ? Number(man.pembelian_thrift) : 0;
      const stokAkhirThrift = man ? Number(man.stok_akhir_thrift) : 0;
      const hppThrift = man && man.hpp_thrift ? Number(man.hpp_thrift) : hitungHppThrift(stokAwalThrift, pembelianThrift, stokAkhirThrift);

      makanan = {
        omzet: omzetMakanan,
        penjualanBersih: omzetMakanan,
        diskon: 0,
        hpp: hppMakanan,
        labaKotor: omzetMakanan - hppMakanan,
        marginPersen: omzetMakanan > 0 ? ((omzetMakanan - hppMakanan) / omzetMakanan) * 100 : 0,
        jumlahItem: 0,
        itemTanpaResep: 0,
        itemBiayaBelumLengkap: 0,
      };

      minuman = {
        omzet: omzetMinuman,
        penjualanBersih: omzetMinuman,
        diskon: 0,
        hpp: hppMinuman,
        labaKotor: omzetMinuman - hppMinuman,
        marginPersen: omzetMinuman > 0 ? ((omzetMinuman - hppMinuman) / omzetMinuman) * 100 : 0,
        jumlahItem: 0,
        itemTanpaResep: 0,
        itemBiayaBelumLengkap: 0,
      };

      thrift = {
        omzet: omzetThrift,
        penjualanBersih: omzetThrift,
        diskon: 0,
        hpp: hppThrift,
        labaKotor: omzetThrift - hppThrift,
        marginPersen: omzetThrift > 0 ? ((omzetThrift - hppThrift) / omzetThrift) * 100 : 0,
        jumlahItem: 0,
        itemTanpaResep: 0,
        itemBiayaBelumLengkap: 0,
      };

      const totalOmzet = omzetMakanan + omzetMinuman + omzetThrift;
      const totalHpp = hppMakanan + hppMinuman + hppThrift;
      const totalLabaKotor = totalOmzet - totalHpp;

      totalPenjualan = {
        omzet: totalOmzet,
        penjualanBersih: totalOmzet,
        diskon: 0,
        hpp: totalHpp,
        labaKotor: totalLabaKotor,
        marginPersen: totalOmzet > 0 ? (totalLabaKotor / totalOmzet) * 100 : 0,
      };

      badges = {
        persenTanpaResep: 0,
        jumlahBahanTanpaHarga: 0,
        jumlahStokMinus: 0,
        pesanPeringatan: ['Sumber: manual (input langsung oleh Akunting)'],
      };

      if (man?.catatan) {
        badges.pesanPeringatan.push(`Catatan manual: ${man.catatan}`);
      }
    } else {
      // ─── MODE POS ───
      const posData = posOutletId ? posDataMap.get(posOutletId) : undefined;
      if (posData) {
        makanan = posData.makanan;
        minuman = posData.minuman;
        thrift = posData.thrift;
        totalPenjualan = posData.total;
        controlLine = posData.controlLine;
        badges = posData.badges;
        isFrozen = posData.isFrozen;
        frozenAt = posData.frozenAt;
        frozenBy = posData.frozenBy;
        lastOpnameDate = posData.lastOpnameDate;
        isOpnameTooOld = posData.isOpnameTooOld;
      }
    }

    const labaRugiBersih = totalPenjualan.labaKotor - totalBiayaOperasional;
    const marginBersihPersen =
      totalPenjualan.penjualanBersih > 0 ? (labaRugiBersih / totalPenjualan.penjualanBersih) * 100 : 0;

    // CEO HANYA MELIHAT FINAL AKUNTING:
    // Jika user CEO murni dan status belum final, jangan tampilkan data numerik
    const tampilkanData = !isCeoOnly || status === 'final_akunting';

    outletResults.push({
      outletId: ot.id,
      outletNama: ot.nama,
      posOutletId,
      posMode: ot.slug.includes('thrift') ? 'thrifting' : 'fnb',
      sumber,
      status,
      isFrozen,
      frozenAt,
      frozenBy,
      lastOpnameDate,
      isOpnameTooOld,
      makanan: tampilkanData ? makanan : emptyCategory(),
      minuman: tampilkanData ? minuman : emptyCategory(),
      thrift: tampilkanData ? thrift : emptyCategory(),
      totalPenjualan: tampilkanData
        ? totalPenjualan
        : { omzet: 0, penjualanBersih: 0, diskon: 0, hpp: 0, labaKotor: 0, marginPersen: 0 },
      biayaOperasional: tampilkanData
        ? biayaOperasional
        : kategoriList.map((k) => ({
            kategoriId: k.id,
            kategoriNama: k.nama,
            jumlah: 0,
            catatan: '',
            buktiPath: null,
          })),
      totalBiayaOperasional: tampilkanData ? totalBiayaOperasional : 0,
      labaRugiBersih: tampilkanData ? labaRugiBersih : 0,
      marginBersihPersen: tampilkanData ? marginBersihPersen : 0,
      controlLine: tampilkanData ? controlLine : emptyControlLine(),
      badges,
      catatanIta: st?.catatan_ita ?? '',
      catatanAkunting: st?.catatan_akunting ?? '',
      catatanKualitasData: st?.catatan_kualitas_data ?? '',
      alasanBukaKembali: st?.alasan_buka_kembali ?? null,
    });
  }

  // 4. Hitung Konsolidasi Seluruh Outlet
  const kMakanan = emptyCategory();
  const kMinuman = emptyCategory();
  const kThrift = emptyCategory();

  let kTotalOmzet = 0;
  let kTotalNet = 0;
  let kTotalDiskon = 0;
  let kTotalHpp = 0;
  let kTotalLabaKotor = 0;
  let kTotalBiaya = 0;

  const biayaKonsolidasiMap = new Map<string, number>(); // kategoriId -> sum(jumlah)
  for (const k of kategoriList) biayaKonsolidasiMap.set(k.id, 0);

  const kPeringatan = new Set<string>();

  for (const ot of outletResults) {
    kMakanan.omzet += ot.makanan.omzet;
    kMakanan.penjualanBersih += ot.makanan.penjualanBersih;
    kMakanan.diskon += ot.makanan.diskon;
    kMakanan.hpp += ot.makanan.hpp;
    kMakanan.labaKotor += ot.makanan.labaKotor;
    kMakanan.jumlahItem += ot.makanan.jumlahItem;
    kMakanan.itemTanpaResep += ot.makanan.itemTanpaResep;
    kMakanan.itemBiayaBelumLengkap += ot.makanan.itemBiayaBelumLengkap;

    kMinuman.omzet += ot.minuman.omzet;
    kMinuman.penjualanBersih += ot.minuman.penjualanBersih;
    kMinuman.diskon += ot.minuman.diskon;
    kMinuman.hpp += ot.minuman.hpp;
    kMinuman.labaKotor += ot.minuman.labaKotor;
    kMinuman.jumlahItem += ot.minuman.jumlahItem;
    kMinuman.itemTanpaResep += ot.minuman.itemTanpaResep;
    kMinuman.itemBiayaBelumLengkap += ot.minuman.itemBiayaBelumLengkap;

    kThrift.omzet += ot.thrift.omzet;
    kThrift.penjualanBersih += ot.thrift.penjualanBersih;
    kThrift.diskon += ot.thrift.diskon;
    kThrift.hpp += ot.thrift.hpp;
    kThrift.labaKotor += ot.thrift.labaKotor;
    kThrift.jumlahItem += ot.thrift.jumlahItem;

    kTotalOmzet += ot.totalPenjualan.omzet;
    kTotalNet += ot.totalPenjualan.penjualanBersih;
    kTotalDiskon += ot.totalPenjualan.diskon;
    kTotalHpp += ot.totalPenjualan.hpp;
    kTotalLabaKotor += ot.totalPenjualan.labaKotor;
    kTotalBiaya += ot.totalBiayaOperasional;

    for (const b of ot.biayaOperasional) {
      const cur = biayaKonsolidasiMap.get(b.kategoriId) ?? 0;
      biayaKonsolidasiMap.set(b.kategoriId, cur + b.jumlah);
    }

    for (const p of ot.badges.pesanPeringatan) {
      kPeringatan.add(`${ot.outletNama}: ${p}`);
    }
  }

  kMakanan.marginPersen = kMakanan.penjualanBersih > 0 ? (kMakanan.labaKotor / kMakanan.penjualanBersih) * 100 : 0;
  kMinuman.marginPersen = kMinuman.penjualanBersih > 0 ? (kMinuman.labaKotor / kMinuman.penjualanBersih) * 100 : 0;
  kThrift.marginPersen = kThrift.penjualanBersih > 0 ? (kThrift.labaKotor / kThrift.penjualanBersih) * 100 : 0;

  const kMarginLabaKotor = kTotalNet > 0 ? (kTotalLabaKotor / kTotalNet) * 100 : 0;
  const kLabaBersih = kTotalLabaKotor - kTotalBiaya;
  const kMarginBersih = kTotalNet > 0 ? (kLabaBersih / kTotalNet) * 100 : 0;

  const kBiayaList = kategoriList.map((kat) => ({
    kategoriId: kat.id,
    kategoriNama: kat.nama,
    jumlah: biayaKonsolidasiMap.get(kat.id) ?? 0,
  }));

  const payload: LabaRugiKonsolidasi = {
    bulan,
    outlets: outletResults,
    konsolidasi: {
      makanan: kMakanan,
      minuman: kMinuman,
      thrift: kThrift,
      totalPenjualan: {
        omzet: kTotalOmzet,
        penjualanBersih: kTotalNet,
        diskon: kTotalDiskon,
        hpp: kTotalHpp,
        labaKotor: kTotalLabaKotor,
        marginPersen: kMarginLabaKotor,
      },
      biayaOperasional: kBiayaList,
      totalBiayaOperasional: kTotalBiaya,
      labaRugiBersih: kLabaBersih,
      marginBersihPersen: kMarginBersih,
      controlLine: emptyControlLine(),
      badges: {
        persenTanpaResep: 0,
        jumlahBahanTanpaHarga: 0,
        jumlahStokMinus: 0,
        pesanPeringatan: Array.from(kPeringatan),
      },
    },
  };

  return NextResponse.json(
    {
      ok: true,
      data: payload,
      isCeoOnly,
      kategoriBiaya: kategoriList,
    },
    { status: 200, headers: NO_CACHE_HEADER }
  );
}

/**
 * POST /api/laba-rugi
 * Aksi: simpan_biaya, hapus_biaya, simpan_manual, tinjau, finalkan, buka_kembali, ambil_snapshot, hitung_ulang_hpp
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Silakan login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADER });
  }

  let body: {
    action?: string;
    outletId?: string;
    bulan?: string;
    args?: Record<string, any>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Format JSON tidak valid.' }, { status: 400, headers: NO_CACHE_HEADER });
  }

  const { action, outletId, bulan, args = {} } = body;
  if (!action || !bulan || !bulanValid(bulan, tanggalWIB())) {
    return NextResponse.json({ ok: false, error: 'Parameter action dan bulan wajib valid.' }, { status: 400, headers: NO_CACHE_HEADER });
  }

  // Helper panggil POS Signed Bridge
  const panggilPosBridge = async (act: string, a: Record<string, any>) => {
    const posUrl = process.env.POS_INTEGRASI_URL;
    const posSecret = process.env.POS_HANDOFF_SECRET;
    if (!posUrl || !posSecret) throw new Error('POS_INTEGRASI_URL atau POS_HANDOFF_SECRET belum diset.');

    const [{ data: prof }, { data: aks }] = await Promise.all([
      supabase.from('profile').select('nama').eq('id', auth.user.id).maybeSingle(),
      supabase.rpc('akses_pos_saya'),
    ]);

    const token = buatTokenPnlBridge(
      { id: auth.user.id, email: auth.user.email ?? '' },
      { nama: prof?.nama ?? null, akses: (aks as AksesPos) ?? null }
    );

    const res = await fetch(`${posUrl.replace(/\/+$/, '')}/api/integrasi/pnl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: act, args: a }),
      signal: AbortSignal.timeout(TIMEOUT_POS_MS),
      cache: 'no-store',
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? `POS menjawab HTTP ${res.status}`);
    }
    return json.data;
  };

  try {
    switch (action) {
      // ─── 1. SIMPAN BIAYA BULANAN ───
      case 'simpan_biaya': {
        const { data: boleh } = await supabase.rpc('boleh_ubah_biaya_bulanan');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Akunting dan Admin yang dapat menginput biaya bulanan.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        if (!outletId) return NextResponse.json({ ok: false, error: 'outletId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const kategoriId = args.kategoriId as string;
        const jumlah = Number(args.jumlah ?? 0);
        const catatan = (args.catatan as string) || '';
        const buktiPath = (args.buktiPath as string) || null;

        if (!kategoriId || jumlah < 0) {
          return NextResponse.json({ ok: false, error: 'kategoriId dan jumlah valid wajib diisi.' }, { status: 400, headers: NO_CACHE_HEADER });
        }

        // Ambil data lama untuk riwayat
        const { data: lama } = await supabase
          .from('biaya_bulanan')
          .select('id, jumlah, catatan')
          .eq('outlet_id', outletId)
          .eq('bulan', bulan)
          .eq('kategori_id', kategoriId)
          .maybeSingle();

        // Ambil nama kategori
        const { data: kat } = await supabase.from('kategori_biaya').select('nama').eq('id', kategoriId).single();

        // Upsert biaya_bulanan
        const { data: baru, error: errUpsert } = await supabase
          .from('biaya_bulanan')
          .upsert(
            {
              outlet_id: outletId,
              bulan,
              kategori_id: kategoriId,
              jumlah,
              catatan,
              bukti_path: buktiPath,
              created_by: auth.user.id,
              updated_by: auth.user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'outlet_id,bulan,kategori_id' }
          )
          .select('id')
          .single();

        if (errUpsert) throw new Error(errUpsert.message);

        // Catat riwayat
        await supabase.from('biaya_bulanan_riwayat').insert({
          biaya_id: baru.id,
          outlet_id: outletId,
          bulan,
          kategori_nama: kat?.nama ?? 'Kategori',
          jumlah_lama: lama?.jumlah ?? null,
          jumlah_baru: jumlah,
          catatan_lama: lama?.catatan ?? null,
          catatan_baru: catatan,
          diubah_oleh: auth.user.id,
        });

        return NextResponse.json({ ok: true, data: { id: baru.id } }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 2. HAPUS BIAYA BULANAN ───
      case 'hapus_biaya': {
        const { data: boleh } = await supabase.rpc('boleh_ubah_biaya_bulanan');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Akunting dan Admin yang dapat menghapus biaya.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        const biayaId = args.biayaId as string;
        if (!biayaId) return NextResponse.json({ ok: false, error: 'biayaId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const { error } = await supabase.from('biaya_bulanan').delete().eq('id', biayaId);
        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 3. SIMPAN MANUAL MODE ───
      case 'simpan_manual': {
        const { data: boleh } = await supabase.rpc('boleh_ubah_biaya_bulanan');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Akunting dan Admin yang dapat mengisi data manual.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        if (!outletId) return NextResponse.json({ ok: false, error: 'outletId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const {
          omzetMakanan = 0,
          omzetMinuman = 0,
          omzetThrift = 0,
          hppMakanan = 0,
          hppMinuman = 0,
          hppThrift = 0,
          stokAwalThrift = 0,
          pembelianThrift = 0,
          stokAkhirThrift = 0,
          catatan = '',
        } = args;

        if (!catatan.trim()) {
          return NextResponse.json({ ok: false, error: 'Catatan wajib diisi untuk entri mode manual.' }, { status: 400, headers: NO_CACHE_HEADER });
        }

        // Upsert laporan_bulanan_manual
        const { error: errMan } = await supabase.from('laporan_bulanan_manual').upsert(
          {
            outlet_id: outletId,
            bulan,
            omzet_makanan: omzetMakanan,
            omzet_minuman: omzetMinuman,
            omzet_thrift: omzetThrift,
            hpp_makanan: hppMakanan,
            hpp_minuman: hppMinuman,
            hpp_thrift: hppThrift,
            stok_awal_thrift: stokAwalThrift,
            pembelian_thrift: pembelianThrift,
            stok_akhir_thrift: stokAkhirThrift,
            catatan,
            diisi_oleh: auth.user.id,
            diisi_pada: new Date().toISOString(),
          },
          { onConflict: 'outlet_id,bulan' }
        );

        if (errMan) throw new Error(errMan.message);

        // Tandai sumber = 'manual' di laporan_bulanan
        await supabase.from('laporan_bulanan').upsert(
          {
            outlet_id: outletId,
            bulan,
            sumber: 'manual',
          },
          { onConflict: 'outlet_id,bulan' }
        );

        return NextResponse.json({ ok: true }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 4. ALUR STATUS: DITINJAU ITA ───
      case 'tinjau': {
        const { data: boleh } = await supabase.rpc('boleh_tinjau_laba_rugi');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Ita dan Admin yang dapat menandai Ditinjau.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        if (!outletId) return NextResponse.json({ ok: false, error: 'outletId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const catatanIta = (args.catatanIta as string) || '';

        const { data: oldSt } = await supabase.from('laporan_bulanan').select('status').eq('outlet_id', outletId).eq('bulan', bulan).maybeSingle();

        const { error } = await supabase.from('laporan_bulanan').upsert(
          {
            outlet_id: outletId,
            bulan,
            status: 'ditinjau_ita',
            catatan_ita: catatanIta,
            ditinjau_oleh: auth.user.id,
            ditinjau_pada: new Date().toISOString(),
          },
          { onConflict: 'outlet_id,bulan' }
        );

        if (error) throw new Error(error.message);

        // Catat riwayat status
        await supabase.from('laporan_bulanan_riwayat_status').insert({
          outlet_id: outletId,
          bulan,
          status_sebelum: oldSt?.status ?? 'draft',
          status_sesudah: 'ditinjau_ita',
          alasan: catatanIta,
          diubah_oleh: auth.user.id,
        });

        return NextResponse.json({ ok: true }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 5. ALUR STATUS: FINAL AKUNTING ───
      case 'finalkan': {
        const { data: boleh } = await supabase.rpc('boleh_finalkan_laba_rugi');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Akunting dan Admin yang dapat menetapkan Final.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        if (!outletId) return NextResponse.json({ ok: false, error: 'outletId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const catatanAkunting = (args.catatanAkunting as string) || '';
        const catatanKualitasData = (args.catatanKualitasData as string) || '';

        const { data: oldSt } = await supabase.from('laporan_bulanan').select('status').eq('outlet_id', outletId).eq('bulan', bulan).maybeSingle();

        const { error } = await supabase.from('laporan_bulanan').upsert(
          {
            outlet_id: outletId,
            bulan,
            status: 'final_akunting',
            catatan_akunting: catatanAkunting,
            catatan_kualitas_data: catatanKualitasData,
            difinalkan_oleh: auth.user.id,
            difinalkan_pada: new Date().toISOString(),
          },
          { onConflict: 'outlet_id,bulan' }
        );

        if (error) throw new Error(error.message);

        // Bekukan snapshot di pos-fnb via signed bridge
        try {
          await panggilPosBridge('freeze_snapshot', { month: bulan });
        } catch (bridgeErr) {
          console.warn('[finalkan] POS freeze warning:', bridgeErr);
        }

        // Catat riwayat status
        await supabase.from('laporan_bulanan_riwayat_status').insert({
          outlet_id: outletId,
          bulan,
          status_sebelum: oldSt?.status ?? 'ditinjau_ita',
          status_sesudah: 'final_akunting',
          alasan: catatanAkunting,
          diubah_oleh: auth.user.id,
        });

        return NextResponse.json({ ok: true }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 6. BUKA KEMBALI BULAN FINAL ───
      case 'buka_kembali': {
        const { data: boleh } = await supabase.rpc('boleh_buka_kembali_laba_rugi');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Membuka kembali bulan Final hanya dapat dilakukan oleh CEO atau Admin.' }, { status: 403, headers: NO_CACHE_HEADER });
        }
        if (!outletId) return NextResponse.json({ ok: false, error: 'outletId wajib.' }, { status: 400, headers: NO_CACHE_HEADER });

        const alasan = (args.alasan as string) || '';
        if (!alasan.trim()) {
          return NextResponse.json({ ok: false, error: 'Alasan pembukaan kembali bulan Final wajib diisi.' }, { status: 400, headers: NO_CACHE_HEADER });
        }

        const { data: oldSt } = await supabase.from('laporan_bulanan').select('status').eq('outlet_id', outletId).eq('bulan', bulan).maybeSingle();

        const { error } = await supabase.from('laporan_bulanan').upsert(
          {
            outlet_id: outletId,
            bulan,
            status: 'ditinjau_ita',
            dibuka_kembali_oleh: auth.user.id,
            dibuka_kembali_pada: new Date().toISOString(),
            alasan_buka_kembali: alasan,
          },
          { onConflict: 'outlet_id,bulan' }
        );

        if (error) throw new Error(error.message);

        // Cairkan snapshot di pos-fnb via signed bridge
        try {
          await panggilPosBridge('unfreeze_snapshot', { month: bulan, reason: alasan });
        } catch (bridgeErr) {
          console.warn('[buka_kembali] POS unfreeze warning:', bridgeErr);
        }

        // Catat riwayat status
        await supabase.from('laporan_bulanan_riwayat_status').insert({
          outlet_id: outletId,
          bulan,
          status_sebelum: oldSt?.status ?? 'final_akunting',
          status_sesudah: 'ditinjau_ita',
          alasan,
          diubah_oleh: auth.user.id,
        });

        return NextResponse.json({ ok: true }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 7. AMBIL SNAPSHOT (MANUAL TRIGGER) ───
      case 'ambil_snapshot': {
        const { data: boleh } = await supabase.rpc('boleh_tinjau_laba_rugi');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Ita dan Admin yang dapat mengambil snapshot persediaan.' }, { status: 403, headers: NO_CACHE_HEADER });
        }

        const posOutletId = args.posOutletId as string | undefined;
        const res = await panggilPosBridge('take_snapshot', { month: bulan, outletId: posOutletId });
        return NextResponse.json({ ok: true, data: res }, { status: 200, headers: NO_CACHE_HEADER });
      }

      // ─── 8. HITUNG ULANG HPP (DRAFT ONLY) ───
      case 'hitung_ulang_hpp': {
        const { data: boleh } = await supabase.rpc('boleh_ubah_biaya_bulanan');
        if (!boleh) {
          return NextResponse.json({ ok: false, error: 'Hanya Akunting dan Admin yang dapat menghitung ulang HPP.' }, { status: 403, headers: NO_CACHE_HEADER });
        }

        const posOutletId = args.posOutletId as string | undefined;
        const res = await panggilPosBridge('recalculate_hpp', { month: bulan, outletId: posOutletId });
        return NextResponse.json({ ok: true, data: res }, { status: 200, headers: NO_CACHE_HEADER });
      }

      default:
        return NextResponse.json({ ok: false, error: `Aksi tidak dikenal: ${action}` }, { status: 400, headers: NO_CACHE_HEADER });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Kesalahan server';
    console.error('[laba-rugi/POST] error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE_HEADER });
  }
}
