import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanPermintaan } from '@/lib/permintaan';
import { PembatasLogin } from '@/lib/rate-limit';
import { ringkasPerSales } from '@/lib/accounting';
import type { Penjualan } from '@/lib/types';

const jual = { tanggal: '2026-10-10', merkModel: 'iPhone 13', kondisi: 'Second', imei: '356938035643809', hpp: 4_200_000, hargaJual: 5_000_000, metodeBayar: 'Kas', idSales: 'EMP-001', catatan: '' };

describe('siapkanPermintaan (whitelist & sanitasi proxy)', () => {
  it('menolak aksi di luar whitelist, termasuk nama bawaan Object', () => {
    for (const action of ['hapusSemua', '__proto__', 'constructor', 'toString', '', 123, null]) {
      assert.equal(siapkanPermintaan({ action, payload: {} }).ok, false, String(action));
    }
    assert.equal(siapkanPermintaan(null).ok, false);
    assert.equal(siapkanPermintaan('x').ok, false);
  });
  it('aksi baca: hanya periode / from-to valid yang diteruskan', () => {
    const a = siapkanPermintaan({ action: 'getSummary', payload: { periode: '2026-10', token: 'curian', x: 1 } });
    assert.deepEqual(a.ok && a.value, { action: 'getSummary', payload: { periode: '2026-10' } });
    assert.equal(siapkanPermintaan({ action: 'getSummary', payload: { periode: '2026-13' } }).ok, false);
    const b = siapkanPermintaan({ action: 'getSales', payload: { from: '2026-10-01', to: '2026-10-10' } });
    assert.deepEqual(b.ok && b.value.payload, { from: '2026-10-01', to: '2026-10-10' });
    assert.equal(siapkanPermintaan({ action: 'getSales', payload: { from: 'kemarin', to: '2026-10-10' } }).ok, false);
    assert.equal(siapkanPermintaan({ action: 'getEmployees' }).ok, true);
  });
  it('addSale: tervalidasi, margin/komisi/token dari client dibuang', () => {
    const r = siapkanPermintaan({ action: 'addSale', payload: { ...jual, margin: 1, komisi: 9e9, token: 'x', id: 'TRX-HACK' } });
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(Object.keys(r.value.payload).sort(), ['catatan', 'hargaJual', 'hpp', 'idSales', 'imei', 'kondisi', 'merkModel', 'metodeBayar', 'tanggal']);
    }
    assert.equal(siapkanPermintaan({ action: 'addSale', payload: { ...jual, hargaJual: -5 } }).ok, false);
  });
  it('generatePayroll: periode valid, potongan bilangan bulat >= 0 dengan ID wajar', () => {
    assert.ok(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: '2026-10', potongan: { 'EMP-001': 100_000 } } }).ok);
    assert.ok(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: '2026-10' } }).ok);
    assert.equal(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: '2026-10', potongan: { 'EMP-001': -1 } } }).ok, false);
    assert.equal(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: '2026-10', potongan: { 'EMP-001': 1.5 } } }).ok, false);
    assert.equal(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: '2026-10', potongan: { '../x': 1 } } }).ok, false);
    assert.equal(siapkanPermintaan({ action: 'generatePayroll', payload: { periode: 'Oktober' } }).ok, false);
  });
  it('addExpense, updateEmployee, updateSettings divalidasi', () => {
    assert.ok(siapkanPermintaan({ action: 'addExpense', payload: { tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 5000, metodeBayar: 'Kas' } }).ok);
    assert.equal(siapkanPermintaan({ action: 'addExpense', payload: { tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 0, metodeBayar: 'Kas' } }).ok, false);
    assert.ok(siapkanPermintaan({ action: 'updateEmployee', payload: { id: 'EMP-001', nama: 'A', divisi: 'Sales', jabatan: 'S', rekening: '', kontak: '', gajiPokok: 1, aktif: true } }).ok);
    assert.equal(siapkanPermintaan({ action: 'updateEmployee', payload: { nama: '' } }).ok, false);
    assert.ok(siapkanPermintaan({ action: 'updateSettings', payload: { namaUsaha: 'B', komisi: { mode: 'FIXED', nominalPerUnit: 1, persenMargin: 0 } } }).ok);
  });
});

describe('PembatasLogin', () => {
  it('mengunci setelah 5 gagal, terbuka setelah masa kunci, sukses mereset', () => {
    const p = new PembatasLogin(5, 15 * 60_000);
    for (let i = 0; i < 4; i++) p.catatGagal('ip1', 1000);
    assert.equal(p.terkunci('ip1', 1000), false);
    p.catatGagal('ip1', 1000);
    assert.equal(p.terkunci('ip1', 2000), true);
    assert.equal(p.terkunci('ip2', 2000), false);
    assert.equal(p.terkunci('ip1', 1000 + 15 * 60_000 + 1), false);
    p.catatGagal('ip3', 0); p.reset('ip3');
    for (let i = 0; i < 4; i++) p.catatGagal('ip3', 0);
    assert.equal(p.terkunci('ip3', 0), false);
  });
});

describe('ringkasPerSales', () => {
  it('agregasi per sales untuk seluruh periode', () => {
    const mk = (id: string, s: string, jualan: number, m: number, k: number) => ({ id, idSales: s, namaSales: s, hargaJual: jualan, margin: m, komisi: k }) as Penjualan;
    const r = ringkasPerSales([mk('1', 'A', 100, 10, 1), mk('2', 'B', 300, 30, 3), mk('3', 'A', 50, 5, 1)]);
    assert.deepEqual(r.map(x => [x.idSales, x.unit, x.omset, x.margin, x.komisi]), [['B', 1, 300, 30, 3], ['A', 2, 150, 15, 2]]);
  });
});
