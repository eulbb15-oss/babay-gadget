import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validasiInputPenjualan, validasiInputBeban, validasiKaryawan, validasiPengaturan } from '@/lib/validasi';
import { formatRupiah, periodeDari, akhirBulan, hariIniJakarta } from '@/lib/format';

const valid = {
  tanggal: '2026-10-10', merkModel: ' iPhone 13 ', kondisi: 'Second', imei: ' 356938035643809 ',
  hpp: 4_200_000, hargaJual: 5_000_000, metodeBayar: 'Kas', idSales: 'EMP-001', catatan: '',
};

describe('validasiInputPenjualan', () => {
  it('menerima input valid dan merapikan spasi', () => {
    const r = validasiInputPenjualan(valid);
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.merkModel, 'iPhone 13'); assert.equal(r.value.imei, '356938035643809'); }
  });
  it('menolak tanggal tidak nyata', () => {
    const r = validasiInputPenjualan({ ...valid, tanggal: '2026-02-31' });
    assert.ok(!r.ok && r.errors.tanggal);
  });
  it('menolak IMEI kosong / berisi simbol', () => {
    assert.ok(!validasiInputPenjualan({ ...valid, imei: '' }).ok);
    assert.ok(!validasiInputPenjualan({ ...valid, imei: '1234-5678' }).ok);
  });
  it('menolak harga jual <= 0, HPP negatif, dan nilai bukan bilangan bulat', () => {
    const r1 = validasiInputPenjualan({ ...valid, hargaJual: 0 });
    const r2 = validasiInputPenjualan({ ...valid, hpp: -1 });
    const r3 = validasiInputPenjualan({ ...valid, hpp: 1000.5 });
    assert.ok(!r1.ok && r1.errors.hargaJual);
    assert.ok(!r2.ok && r2.errors.hpp);
    assert.ok(!r3.ok && r3.errors.hpp);
  });
  it('menolak kondisi / metode di luar daftar, dan input bukan objek', () => {
    assert.ok(!validasiInputPenjualan({ ...valid, kondisi: 'Rusak' }).ok);
    assert.ok(!validasiInputPenjualan({ ...valid, metodeBayar: 'Kredit' }).ok);
    assert.ok(!validasiInputPenjualan(null).ok);
  });
});

describe('validasiInputBeban / Karyawan / Pengaturan', () => {
  it('beban: jumlah harus > 0', () => {
    assert.ok(validasiInputBeban({ tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 50_000, metodeBayar: 'Kas' }).ok);
    assert.ok(!validasiInputBeban({ tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 0, metodeBayar: 'Kas' }).ok);
  });
  it('karyawan: divisi harus dari daftar, gaji >= 0', () => {
    const base = { id: '', nama: 'Budi', divisi: 'Sales', jabatan: 'Sales', rekening: '', kontak: '', gajiPokok: 3_000_000, aktif: true };
    assert.ok(validasiKaryawan(base).ok);
    assert.ok(!validasiKaryawan({ ...base, divisi: 'Gudang' }).ok);
    assert.ok(!validasiKaryawan({ ...base, gajiPokok: -1 }).ok);
  });
  it('pengaturan: persen 0..100', () => {
    const base = { namaUsaha: 'Babay Gadget', komisi: { mode: 'PERSEN_MARGIN', nominalPerUnit: 0, persenMargin: 10 } };
    assert.ok(validasiPengaturan(base).ok);
    assert.ok(!validasiPengaturan({ ...base, komisi: { ...base.komisi, persenMargin: 101 } }).ok);
    assert.ok(!validasiPengaturan({ ...base, komisi: { ...base.komisi, mode: 'XX' } }).ok);
  });
});

describe('format', () => {
  it('formatRupiah', () => {
    assert.equal(formatRupiah(1_234_567), 'Rp 1.234.567');
    assert.equal(formatRupiah(0), 'Rp 0');
    assert.equal(formatRupiah(-150_000), '-Rp 150.000');
  });
  it('periodeDari / akhirBulan (termasuk Februari kabisat)', () => {
    assert.equal(periodeDari('2026-10-10'), '2026-10');
    assert.equal(akhirBulan('2026-10'), '2026-10-31');
    assert.equal(akhirBulan('2028-02'), '2028-02-29');
    assert.equal(akhirBulan('2026-02'), '2026-02-28');
  });
  it('hariIniJakarta memakai WIB (UTC+7)', () => {
    assert.equal(hariIniJakarta(new Date('2026-10-10T20:00:00Z')), '2026-10-11');
    assert.equal(hariIniJakarta(new Date('2026-10-10T16:59:00Z')), '2026-10-10');
  });
});
