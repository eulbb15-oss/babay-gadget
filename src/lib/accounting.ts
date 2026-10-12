import { AKUN } from './akun';
import type {
  AturanKomisi, BarisJurnal, InputBeban, LabaRugi, Penjualan, RingkasanHarian, RingkasanSales,
} from './types';

export function hitungMargin(hargaJual: number, hpp: number): number {
  return hargaJual - hpp;
}

/**
 * Komisi per unit. Margin <= 0 → 0 (tidak ada komisi untuk penjualan rugi/impas).
 * FIXED: nominal tetap. PERSEN_MARGIN: persen × margin, dibulatkan ke Rupiah.
 */
export function hitungKomisi(aturan: AturanKomisi, margin: number): number {
  if (margin <= 0) return 0;
  if (aturan.mode === 'FIXED') return Math.max(0, Math.round(aturan.nominalPerUnit));
  return Math.max(0, Math.round((margin * aturan.persenMargin) / 100));
}

type SumberJurnalJual = Pick<Penjualan, 'id' | 'tanggal' | 'periode' | 'merkModel' | 'hpp' | 'hargaJual' | 'metodeBayar'>;

export function buatJurnalPenjualan(p: SumberJurnalJual): BarisJurnal[] {
  const kas = p.metodeBayar === 'Transfer' ? AKUN.BANK : AKUN.KAS;
  const dasar = { tanggal: p.tanggal, periode: p.periode, refId: p.id };
  const baris = (n: number, refTipe: 'PENJUALAN' | 'HPP', ket: string, a: { kode: string; nama: string }, debet: number, kredit: number): BarisJurnal =>
    ({ ...dasar, id: `${p.id}-J${n}`, refTipe, keterangan: ket, kodeAkun: a.kode, namaAkun: a.nama, debet, kredit });
  const jual = `Penjualan ${p.merkModel}`;
  const pokok = `HPP ${p.merkModel}`;
  return [
    baris(1, 'PENJUALAN', jual, kas, p.hargaJual, 0),
    baris(2, 'PENJUALAN', jual, AKUN.PENJUALAN, 0, p.hargaJual),
    baris(3, 'HPP', pokok, AKUN.HPP, p.hpp, 0),
    baris(4, 'HPP', pokok, AKUN.PERSEDIAAN, 0, p.hpp),
  ];
}

export function buatJurnalBeban(b: InputBeban & { id: string; periode: string }): BarisJurnal[] {
  const kas = b.metodeBayar === 'Transfer' ? AKUN.BANK : AKUN.KAS;
  const dasar = { tanggal: b.tanggal, periode: b.periode, refTipe: 'BEBAN' as const, refId: b.id, keterangan: b.keterangan };
  return [
    { ...dasar, id: `${b.id}-J1`, kodeAkun: AKUN.BEBAN_LAIN.kode, namaAkun: AKUN.BEBAN_LAIN.nama, debet: b.jumlah, kredit: 0 },
    { ...dasar, id: `${b.id}-J2`, kodeAkun: kas.kode, namaAkun: kas.nama, debet: 0, kredit: b.jumlah },
  ];
}

export function jurnalSeimbang(baris: BarisJurnal[]): boolean {
  const d = baris.reduce((s, x) => s + x.debet, 0);
  const k = baris.reduce((s, x) => s + x.kredit, 0);
  return d === k;
}

/** Laba rugi dari jurnal (satu sumber kebenaran): 4-xxxx pendapatan, 5-xxxx HPP, 6-xxxx beban operasional. */
export function hitungLabaRugi(jurnal: BarisJurnal[]): LabaRugi {
  const saldo = (cocok: (kode: string) => boolean, sisi: 'kredit' | 'debet') =>
    jurnal.filter(j => cocok(j.kodeAkun)).reduce((s, j) => s + (sisi === 'kredit' ? j.kredit - j.debet : j.debet - j.kredit), 0);

  const pendapatanPenjualan = saldo(k => k.startsWith('4-'), 'kredit');
  const bebanPokokPenjualan = saldo(k => k.startsWith('5-'), 'debet');
  const bebanGaji = saldo(k => k === AKUN.BEBAN_GAJI.kode, 'debet');
  const bebanKomisi = saldo(k => k === AKUN.BEBAN_KOMISI.kode, 'debet');
  const bebanLainnya = saldo(k => k.startsWith('6-') && k !== AKUN.BEBAN_GAJI.kode && k !== AKUN.BEBAN_KOMISI.kode, 'debet');
  const labaKotor = pendapatanPenjualan - bebanPokokPenjualan;
  const totalBebanOperasional = bebanGaji + bebanKomisi + bebanLainnya;
  return { pendapatanPenjualan, bebanPokokPenjualan, labaKotor, bebanGaji, bebanKomisi, bebanLainnya, totalBebanOperasional, labaBersih: labaKotor - totalBebanOperasional };
}

/** Agregasi per sales (unit, omset, margin, komisi), urut omset terbesar. */
export function ringkasPerSales(penjualan: Penjualan[]): RingkasanSales[] {
  const peta = new Map<string, RingkasanSales>();
  for (const p of penjualan) {
    const r = peta.get(p.idSales) ?? { idSales: p.idSales, namaSales: p.namaSales, unit: 0, omset: 0, margin: 0, komisi: 0 };
    r.unit += 1; r.omset += p.hargaJual; r.margin += p.margin; r.komisi += p.komisi;
    peta.set(p.idSales, r);
  }
  return [...peta.values()].sort((a, b) => b.omset - a.omset);
}

export function ringkasHarian(penjualan: Penjualan[], tanggal: string): RingkasanHarian {
  const hariIni = penjualan.filter(p => p.tanggal === tanggal);
  return {
    tanggal,
    omset: hariIni.reduce((s, p) => s + p.hargaJual, 0),
    unit: hariIni.length,
    margin: hariIni.reduce((s, p) => s + p.margin, 0),
    perSales: ringkasPerSales(hariIni),
  };
}

/** Omset per tanggal (untuk grafik batang). */
export function omsetPerHari(penjualan: Penjualan[]): { tanggal: string; omset: number }[] {
  const peta = new Map<string, number>();
  for (const p of penjualan) peta.set(p.tanggal, (peta.get(p.tanggal) ?? 0) + p.hargaJual);
  return [...peta.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tanggal, omset]) => ({ tanggal, omset }));
}
