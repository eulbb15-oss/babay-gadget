import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GasError, parseEnvelope, parseKaryawanList, parsePenjualanList, parsePayrollList, parseJurnalList, parsePengaturan, parseRingkasan,
} from '@/lib/gas-parser';

const err = (code: string) => (e: unknown) => e instanceof GasError && e.code === code;

describe('parseEnvelope', () => {
  it('mengembalikan data saat ok', () => assert.deepEqual(parseEnvelope('{"ok":true,"data":{"a":1}}'), { a: 1 }));
  it('melempar GasError dengan kode dari GAS saat ok=false', () => {
    assert.throws(() => parseEnvelope('{"ok":false,"error":{"code":"VALIDATION","message":"IMEI wajib"}}'), err('VALIDATION'));
  });
  it('HTML (mis. halaman login Google) → NOT_JSON', () => {
    assert.throws(() => parseEnvelope('<!DOCTYPE html><html>Sign in</html>'), err('NOT_JSON'));
  });
  it('teks kosong / JSON rusak → NOT_JSON', () => {
    assert.throws(() => parseEnvelope(''), err('NOT_JSON'));
    assert.throws(() => parseEnvelope('{oops'), err('NOT_JSON'));
  });
  it('JSON valid tapi bukan amplop → BAD_ENVELOPE', () => {
    assert.throws(() => parseEnvelope('[1,2]'), err('BAD_ENVELOPE'));
    assert.throws(() => parseEnvelope('{"data":1}'), err('BAD_ENVELOPE'));
  });
});

describe('parseKaryawanList', () => {
  it('mengonversi tipe longgar dari Sheets (angka string, boolean teks, sel kosong)', () => {
    const [a, b] = parseKaryawanList([
      { id: 'EMP-001', nama: 'A', divisi: 'Sales', jabatan: 'S', rekening: 1234567890, kontak: '', gajiPokok: '3000000', aktif: 'TRUE' },
      { id: 'EMP-002', nama: 'B', divisi: 'Finance', jabatan: 'F', rekening: '', kontak: '', gajiPokok: '', aktif: false },
    ]);
    assert.deepEqual([a!.gajiPokok, a!.aktif, a!.rekening], [3_000_000, true, '1234567890']);
    assert.deepEqual([b!.gajiPokok, b!.aktif], [0, false]);
  });
  it('angka tidak valid → PARSE_ERROR', () => {
    assert.throws(() => parseKaryawanList([{ id: 'x', nama: 'x', divisi: 'Sales', gajiPokok: 'abc', aktif: true }]), err('PARSE_ERROR'));
  });
  it('bukan array → PARSE_ERROR', () => assert.throws(() => parseKaryawanList({}), err('PARSE_ERROR')));
});

describe('parser lain', () => {
  it('parsePenjualanList: mengambil 10 karakter pertama untuk tanggal ISO', () => {
    const [x] = parsePenjualanList([{ id: 'T1', tanggal: '2026-10-10T00:00:00.000Z', periode: '2026-10', merkModel: 'X', kondisi: 'Baru',
      imei: '356938035643809', hpp: 1, hargaJual: 3, margin: 2, metodeBayar: 'Transfer', idSales: 'EMP-001', namaSales: 'S', komisi: 5, catatan: null }]);
    assert.deepEqual([x!.tanggal, x!.catatan, x!.metodeBayar], ['2026-10-10', '', 'Transfer']);
  });
  it('parsePenjualanList menolak kondisi tak dikenal', () => {
    assert.throws(() => parsePenjualanList([{ id: 'T', tanggal: '2026-10-10', kondisi: 'Rusak', metodeBayar: 'Kas' }]), err('PARSE_ERROR'));
  });
  it('parseJurnalList & parsePayrollList', () => {
    const j = parseJurnalList([{ id: 'J', tanggal: '2026-10-10', periode: '2026-10', refTipe: 'HPP', refId: 'T', keterangan: 'k', kodeAkun: '5-1000', namaAkun: 'HPP', debet: '10', kredit: 0 }]);
    assert.equal(j[0]!.debet, 10);
    const p = parsePayrollList([{ id: 'P', periode: '2026-10', idKaryawan: 'E', nama: 'N', divisi: 'Sales', jabatan: 'J', gajiPokok: 1, unitTerjual: 2, totalKomisi: 3, potongan: 0, gajiBersih: 4, dibuatPada: '' }]);
    assert.equal(p[0]!.unitTerjual, 2);
  });
  it('parsePengaturan', () => {
    const s = parsePengaturan({ namaUsaha: 'Babay Gadget', komisi: { mode: 'PERSEN_MARGIN', nominalPerUnit: '0', persenMargin: '10' } });
    assert.deepEqual(s.komisi, { mode: 'PERSEN_MARGIN', nominalPerUnit: 0, persenMargin: 10 });
    assert.throws(() => parsePengaturan({ namaUsaha: 'x', komisi: { mode: 'ZZ' } }), err('PARSE_ERROR'));
  });
  it('parseRingkasan menggabungkan semua bagian', () => {
    const r = parseRingkasan({
      periode: '2026-10',
      pengaturan: { namaUsaha: 'B', komisi: { mode: 'FIXED', nominalPerUnit: 50000, persenMargin: 0 } },
      karyawan: [], penjualan: [], payroll: [], jurnal: [],
    });
    assert.equal(r.periode, '2026-10');
    assert.equal(r.pengaturan.komisi.nominalPerUnit, 50_000);
  });
});
