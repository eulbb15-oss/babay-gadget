import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hitungMargin, hitungKomisi, buatJurnalPenjualan, buatJurnalBeban,
  hitungLabaRugi, ringkasHarian, jurnalSeimbang,
} from '@/lib/accounting';
import { buatJurnalPayroll } from '@/lib/payroll';
import type { AturanKomisi, Penjualan, BarisPayroll } from '@/lib/types';

const FIXED: AturanKomisi = { mode: 'FIXED', nominalPerUnit: 50_000, persenMargin: 0 };
const PERSEN = (p: number): AturanKomisi => ({ mode: 'PERSEN_MARGIN', nominalPerUnit: 0, persenMargin: p });

const jual = (o: Partial<Penjualan> = {}): Penjualan => ({
  id: 'TRX-20261010-001', tanggal: '2026-10-10', periode: '2026-10', merkModel: 'iPhone 13 128GB',
  kondisi: 'Second', imei: '356938035643809', hpp: 4_200_000, hargaJual: 5_000_000, margin: 800_000,
  metodeBayar: 'Kas', idSales: 'EMP-001', namaSales: 'Sales 1', komisi: 50_000, catatan: '', ...o,
});

describe('hitungMargin', () => {
  it('harga jual dikurangi HPP', () => assert.equal(hitungMargin(5_000_000, 4_200_000), 800_000));
  it('boleh negatif saat rugi', () => assert.equal(hitungMargin(3_000_000, 3_150_000), -150_000));
});

describe('hitungKomisi', () => {
  it('FIXED: nominal tetap per unit', () => assert.equal(hitungKomisi(FIXED, 800_000), 50_000));
  it('FIXED: 0 saat margin nol atau rugi', () => {
    assert.equal(hitungKomisi(FIXED, 0), 0);
    assert.equal(hitungKomisi(FIXED, -1), 0);
  });
  it('PERSEN_MARGIN: 10% dari margin', () => assert.equal(hitungKomisi(PERSEN(10), 800_000), 80_000));
  it('PERSEN_MARGIN: dibulatkan ke Rupiah terdekat', () => {
    assert.equal(hitungKomisi(PERSEN(10), 333_333), 33_333);
    assert.equal(hitungKomisi(PERSEN(12.5), 100_001), 12_500);
    assert.equal(hitungKomisi(PERSEN(7.5), 100_000), 7_500);
  });
  it('PERSEN_MARGIN: 0 saat rugi', () => assert.equal(hitungKomisi(PERSEN(10), -500_000), 0));
});

describe('buatJurnalPenjualan', () => {
  it('Kas: Dr Kas / Cr Penjualan, Dr HPP / Cr Persediaan', () => {
    const j = buatJurnalPenjualan(jual());
    assert.equal(j.length, 4);
    assert.deepEqual(j.map(x => [x.kodeAkun, x.debet, x.kredit]), [
      ['1-1100', 5_000_000, 0], ['4-1000', 0, 5_000_000],
      ['5-1000', 4_200_000, 0], ['1-1300', 0, 4_200_000],
    ]);
    assert.deepEqual(j.map(x => x.refTipe), ['PENJUALAN', 'PENJUALAN', 'HPP', 'HPP']);
  });
  it('Transfer memakai akun Bank', () => {
    assert.equal(buatJurnalPenjualan(jual({ metodeBayar: 'Transfer' }))[0]?.kodeAkun, '1-1200');
  });
  it('selalu seimbang, termasuk saat rugi', () => {
    assert.ok(jurnalSeimbang(buatJurnalPenjualan(jual({ hpp: 6_000_000 }))));
  });
});

describe('buatJurnalBeban', () => {
  it('Dr Beban Lainnya / Cr Kas', () => {
    const j = buatJurnalBeban({ id: 'BBN-1', periode: '2026-10', tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 50_000, metodeBayar: 'Kas' });
    assert.deepEqual(j.map(x => [x.kodeAkun, x.debet, x.kredit]), [['6-9000', 50_000, 0], ['1-1100', 0, 50_000]]);
    assert.ok(jurnalSeimbang(j));
  });
});

describe('buatJurnalPayroll', () => {
  const rows = [
    { gajiPokok: 3_000_000, totalKomisi: 100_000, potongan: 200_000, gajiBersih: 2_900_000 },
    { gajiPokok: 2_500_000, totalKomisi: 0, potongan: 0, gajiBersih: 2_500_000 },
  ] as BarisPayroll[];
  it('Dr Gaji + Dr Komisi / Cr Kas (neto) + Cr Piutang Karyawan (potongan)', () => {
    const j = buatJurnalPayroll('2026-10', '2026-10-31', rows);
    assert.deepEqual(j.map(x => [x.kodeAkun, x.debet, x.kredit]), [
      ['6-1000', 5_500_000, 0], ['6-1100', 100_000, 0], ['1-1100', 0, 5_400_000], ['1-1400', 0, 200_000],
    ]);
    assert.ok(jurnalSeimbang(j));
  });
  it('baris bernilai nol tidak dibuat', () => {
    const j = buatJurnalPayroll('2026-10', '2026-10-31', [{ gajiPokok: 1_000_000, totalKomisi: 0, potongan: 0, gajiBersih: 1_000_000 }] as BarisPayroll[]);
    assert.deepEqual(j.map(x => x.kodeAkun), ['6-1000', '1-1100']);
  });
});

describe('hitungLabaRugi', () => {
  it('menyusun laba rugi dari jurnal', () => {
    const lines = [
      ...buatJurnalPenjualan(jual()),
      ...buatJurnalPenjualan(jual({ id: 'TRX-20261010-002', hargaJual: 3_000_000, hpp: 2_500_000, metodeBayar: 'Transfer' })),
      ...buatJurnalPayroll('2026-10', '2026-10-31', [{ gajiPokok: 1_000_000, totalKomisi: 100_000, potongan: 0, gajiBersih: 1_100_000 }] as BarisPayroll[]),
      ...buatJurnalBeban({ id: 'BBN-1', periode: '2026-10', tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 50_000, metodeBayar: 'Kas' }),
    ];
    assert.deepEqual(hitungLabaRugi(lines), {
      pendapatanPenjualan: 8_000_000, bebanPokokPenjualan: 6_700_000, labaKotor: 1_300_000,
      bebanGaji: 1_000_000, bebanKomisi: 100_000, bebanLainnya: 50_000,
      totalBebanOperasional: 1_150_000, labaBersih: 150_000,
    });
  });
  it('semua nol jika jurnal kosong', () => assert.equal(hitungLabaRugi([]).labaBersih, 0));
  it('laba bersih bisa negatif', () => {
    const lr = hitungLabaRugi(buatJurnalBeban({ id: 'B', periode: '2026-10', tanggal: '2026-10-01', keterangan: 'x', jumlah: 10_000, metodeBayar: 'Kas' }));
    assert.equal(lr.labaBersih, -10_000);
  });
});

describe('ringkasHarian', () => {
  const data = [
    jual({ id: 'A', idSales: 'EMP-001', namaSales: 'Sales 1', hargaJual: 5_000_000, margin: 800_000, komisi: 50_000 }),
    jual({ id: 'B', idSales: 'EMP-002', namaSales: 'Sales 2', hargaJual: 9_000_000, margin: 700_000, komisi: 50_000 }),
    jual({ id: 'C', idSales: 'EMP-001', namaSales: 'Sales 1', hargaJual: 2_000_000, margin: 100_000, komisi: 50_000 }),
    jual({ id: 'D', tanggal: '2026-10-09', hargaJual: 99_000_000, margin: 9_000_000 }),
  ];
  it('menjumlahkan omset, unit, margin untuk tanggal terpilih saja', () => {
    const r = ringkasHarian(data, '2026-10-10');
    assert.equal(r.omset, 16_000_000);
    assert.equal(r.unit, 3);
    assert.equal(r.margin, 1_600_000);
  });
  it('rincian per sales, urut omset terbesar', () => {
    const r = ringkasHarian(data, '2026-10-10');
    assert.deepEqual(r.perSales.map(s => [s.idSales, s.unit, s.omset, s.komisi]), [
      ['EMP-002', 1, 9_000_000, 50_000], ['EMP-001', 2, 7_000_000, 100_000],
    ]);
  });
  it('hari tanpa transaksi bernilai nol', () => {
    const r = ringkasHarian(data, '2026-10-11');
    assert.deepEqual([r.omset, r.unit, r.margin, r.perSales.length], [0, 0, 0, 0]);
  });
});
