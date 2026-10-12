import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hitungGajiBersih, hitungPayroll, ringkasPayroll } from '@/lib/payroll';
import type { Karyawan, Penjualan } from '@/lib/types';

const k = (o: Partial<Karyawan>): Karyawan => ({
  id: 'EMP-001', nama: 'Sales 1', divisi: 'Sales', jabatan: 'Sales Executive', rekening: '', kontak: '',
  gajiPokok: 3_000_000, aktif: true, ...o,
});
const p = (o: Partial<Penjualan>): Penjualan => ({
  id: 'T', tanggal: '2026-10-10', periode: '2026-10', merkModel: 'X', kondisi: 'Baru', imei: '123456789012345',
  hpp: 1, hargaJual: 2, margin: 1, metodeBayar: 'Kas', idSales: 'EMP-001', namaSales: 'Sales 1', komisi: 50_000, catatan: '', ...o,
});

describe('hitungGajiBersih', () => {
  it('gaji pokok + komisi - potongan', () => assert.equal(hitungGajiBersih(3_000_000, 150_000, 500_000), 2_650_000));
});

describe('hitungPayroll', () => {
  const karyawan = [
    k({}),
    k({ id: 'EMP-002', nama: 'Sales 2', gajiPokok: 3_000_000 }),
    k({ id: 'EMP-004', nama: 'Fin', divisi: 'Finance', jabatan: 'Finance', gajiPokok: 4_000_000 }),
    k({ id: 'EMP-099', nama: 'Resign', aktif: false }),
  ];
  const penjualan = [
    p({ id: '1', idSales: 'EMP-001', komisi: 50_000 }),
    p({ id: '2', idSales: 'EMP-001', komisi: 80_000 }),
    p({ id: '3', idSales: 'EMP-002', komisi: 50_000 }),
    p({ id: '4', idSales: 'EMP-001', komisi: 999_000, periode: '2026-09', tanggal: '2026-09-30' }),
  ];

  it('menjumlahkan komisi snapshot hanya untuk periode terpilih', () => {
    const r = hitungPayroll({ karyawan, penjualan, periode: '2026-10' });
    const s1 = r.find(x => x.idKaryawan === 'EMP-001')!;
    assert.equal(s1.unitTerjual, 2);
    assert.equal(s1.totalKomisi, 130_000);
    assert.equal(s1.gajiBersih, 3_130_000);
  });
  it('hanya karyawan aktif; non-sales tanpa komisi', () => {
    const r = hitungPayroll({ karyawan, penjualan, periode: '2026-10' });
    assert.deepEqual(r.map(x => x.idKaryawan), ['EMP-001', 'EMP-002', 'EMP-004']);
    const fin = r.find(x => x.idKaryawan === 'EMP-004')!;
    assert.deepEqual([fin.unitTerjual, fin.totalKomisi, fin.gajiBersih], [0, 0, 4_000_000]);
  });
  it('potongan/kasbon mengurangi gaji bersih', () => {
    const r = hitungPayroll({ karyawan, penjualan, periode: '2026-10', potongan: { 'EMP-002': 500_000 } });
    assert.equal(r.find(x => x.idKaryawan === 'EMP-002')!.gajiBersih, 2_550_000);
  });
  it('ID payroll deterministik per periode & karyawan', () => {
    assert.equal(hitungPayroll({ karyawan, penjualan, periode: '2026-10' })[0]!.id, 'PAY-202610-EMP-001');
  });
});

describe('ringkasPayroll', () => {
  it('total seluruh kolom, dan penanda gaji bersih negatif', () => {
    const rows = hitungPayroll({ karyawan: [k({}), k({ id: 'EMP-002' })], penjualan: [], periode: '2026-10', potongan: { 'EMP-002': 3_500_000 } });
    const t = ringkasPayroll(rows);
    assert.equal(t.gajiPokok, 6_000_000);
    assert.equal(t.potongan, 3_500_000);
    assert.equal(t.gajiBersih, 2_500_000);
    assert.equal(t.adaNegatif, true);
  });
});
