import { AKUN } from './akun';
import type { BarisJurnal, BarisPayroll, Karyawan, Penjualan } from './types';

export function hitungGajiBersih(gajiPokok: number, totalKomisi: number, potongan: number): number {
  return gajiPokok + totalKomisi - potongan;
}

export function hitungPayroll(args: {
  karyawan: Karyawan[];
  penjualan: Penjualan[];
  periode: string;
  potongan?: Record<string, number>;
}): BarisPayroll[] {
  const { karyawan, penjualan, periode, potongan = {} } = args;
  const kode = periode.replace('-', '');
  return karyawan
    .filter(k => k.aktif)
    .map(k => {
      const jual = penjualan.filter(p => p.periode === periode && p.idSales === k.id);
      const totalKomisi = jual.reduce((s, p) => s + p.komisi, 0);
      const pot = potongan[k.id] ?? 0;
      return {
        id: `PAY-${kode}-${k.id}`, periode, idKaryawan: k.id, nama: k.nama, divisi: k.divisi, jabatan: k.jabatan,
        gajiPokok: k.gajiPokok, unitTerjual: jual.length, totalKomisi, potongan: pot,
        gajiBersih: hitungGajiBersih(k.gajiPokok, totalKomisi, pot), dibuatPada: '',
      };
    });
}

export function ringkasPayroll(rows: BarisPayroll[]) {
  const jumlah = (f: (r: BarisPayroll) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    gajiPokok: jumlah(r => r.gajiPokok),
    unitTerjual: jumlah(r => r.unitTerjual),
    totalKomisi: jumlah(r => r.totalKomisi),
    potongan: jumlah(r => r.potongan),
    gajiBersih: jumlah(r => r.gajiBersih),
    adaNegatif: rows.some(r => r.gajiBersih < 0),
  };
}

/** Jurnal payroll: Dr Beban Gaji, Dr Beban Komisi / Cr Kas (neto), Cr Piutang Karyawan (potongan/kasbon). */
export function buatJurnalPayroll(periode: string, tanggal: string, rows: BarisPayroll[]): BarisJurnal[] {
  const t = ringkasPayroll(rows);
  const refId = `PAY-${periode.replace('-', '')}`;
  const garis: [{ kode: string; nama: string }, number, number][] = [
    [AKUN.BEBAN_GAJI, t.gajiPokok, 0],
    [AKUN.BEBAN_KOMISI, t.totalKomisi, 0],
    [AKUN.KAS, 0, t.gajiBersih],
    [AKUN.PIUTANG_KARYAWAN, 0, t.potongan],
  ];
  return garis
    .filter(([, d, k]) => d !== 0 || k !== 0)
    .map(([a, debet, kredit], i) => ({
      id: `${refId}-J${i + 1}`, tanggal, periode, refTipe: 'PAYROLL' as const, refId,
      keterangan: `Payroll ${periode}`, kodeAkun: a.kode, namaAkun: a.nama, debet, kredit,
    }));
}
