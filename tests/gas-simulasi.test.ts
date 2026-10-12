// Simulasi gas/Code.gs di VM Node dengan mock SpreadsheetApp/PropertiesService/LockService/dll.
// Memverifikasi token, validasi, penulisan sheet, idempotensi payroll, dan PARITAS dengan fungsi TypeScript.
// @ts-nocheck
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { hitungKomisi, buatJurnalPenjualan, hitungLabaRugi } from '@/lib/accounting';
import { hitungPayroll, buatJurnalPayroll } from '@/lib/payroll';

const SECRET = 'x'.repeat(8) + 'secret-test-token-1234567890';
const CODE = fs.readFileSync(path.resolve(process.cwd(), 'gas/Code.gs'), 'utf8');

function makeSheet() {
  const d = [];
  const get = (r, c) => (d[r - 1] && d[r - 1][c - 1] !== undefined ? d[r - 1][c - 1] : '');
  return {
    _d: d,
    getLastRow: () => { for (let i = d.length - 1; i >= 0; i--) if ((d[i] || []).some(v => v !== '' && v !== undefined)) return i + 1; return 0; },
    getMaxRows: () => 1000, setFrozenRows() {},
    getRange(r, c, nr = 1, nc = 1) {
      const rng = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
        setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { (d[r - 1 + i] ||= [])[c - 1 + j] = x; })); return rng; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (d[r - 1 + i]) d[r - 1 + i][c - 1 + j] = ''; return rng; },
        setNumberFormat: () => rng, setFontWeight: () => rng,
      };
      return rng;
    },
  };
}

function boot({ secret = SECRET } = {}) {
  const sheets = {};
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet()) };
  const props = secret === null ? {} : { API_SECRET: secret };
  const fmt = (date, tz, f) => {
    const s = date.toLocaleString('sv-SE', { timeZone: tz }); // "2026-10-10 14:03:22"
    return f.startsWith('yyyy-MM-dd\'T') ? s.replace(' ', 'T') : s.slice(0, 10);
  };
  const ctx = {
    console, Date, Math, JSON, Object, Array, String, Number, parseInt, isFinite, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ getContent: () => t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { formatDate: fmt },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const call = (action, payload, token = SECRET) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, token, payload }) } }).getContent());
  const get = (params) => JSON.parse(ctx.doGet({ parameter: params }).getContent());
  return { ctx, sheets, call, get };
}

const sale = (o = {}) => ({ tanggal: '2026-10-10', merkModel: 'iPhone 13', kondisi: 'Second', imei: '356938035643809', hpp: 4_200_000, hargaJual: 5_000_000, metodeBayar: 'Kas', idSales: 'EMP-001', catatan: '', ...o });

describe('GAS: keamanan', () => {
  it('tanpa token / token salah / secret belum diset / secret pendek → UNAUTHORIZED', () => {
    const a = boot(); a.ctx.setupSheets();
    assert.equal(a.call('getEmployees', {}, null).error.code, 'UNAUTHORIZED');
    assert.equal(a.call('getEmployees', {}, 'salah').error.code, 'UNAUTHORIZED');
    assert.equal(a.call('getEmployees', {}, SECRET + 'x').error.code, 'UNAUTHORIZED');
    assert.equal(a.get({ action: 'getEmployees' }).error.code, 'UNAUTHORIZED');
    assert.equal(a.call('addSale', sale(), 'salah').error.code, 'UNAUTHORIZED');
    assert.equal(boot({ secret: null }).call('getEmployees', {}).error.code, 'UNAUTHORIZED');
    assert.equal(boot({ secret: 'pendek' }).call('getEmployees', {}, 'pendek').error.code, 'UNAUTHORIZED');
  });
  it('token salah tidak menulis apa pun', () => {
    const a = boot(); a.ctx.setupSheets();
    a.call('addSale', sale(), 'salah');
    assert.equal(a.sheets.Transaksi_Penjualan.getLastRow(), 1);
  });
  it('aksi tulis lewat GET ditolak; aksi tak dikenal ditolak; body bukan JSON ditolak', () => {
    const a = boot(); a.ctx.setupSheets();
    assert.equal(a.get({ action: 'addSale', token: SECRET }).error.code, 'METHOD_NOT_ALLOWED');
    assert.equal(a.call('hapusSemua', {}).error.code, 'UNKNOWN_ACTION');
    assert.equal(a.call('constructor', {}).error.code, 'UNKNOWN_ACTION');
    assert.equal(JSON.parse(a.ctx.doPost({ postData: { contents: 'bukan json' } }).getContent()).error.code, 'BAD_REQUEST');
  });
  it('doGet baca dengan token valid berfungsi (sesuai spesifikasi)', () => {
    const a = boot(); a.ctx.setupSheets();
    assert.equal(a.get({ action: 'getEmployees', token: SECRET }).data.length, 10);
  });
});

describe('GAS: setup & baca', () => {
  it('setupSheets membuat 5 tab, 10 karyawan (3 Sales), pengaturan default', () => {
    const a = boot(); a.ctx.setupSheets();
    assert.deepEqual(Object.keys(a.sheets).sort(), ['Jurnal_Akuntansi', 'Master_Karyawan', 'Payroll_Bulanan', 'Pengaturan_Sistem', 'Transaksi_Penjualan']);
    const emp = a.call('getEmployees', {}).data;
    assert.equal(emp.length, 10);
    assert.equal(emp.filter(e => e.divisi === 'Sales').length, 3);
    assert.deepEqual(a.call('getSettings', {}).data.komisi, { mode: 'FIXED', nominalPerUnit: 50000, persenMargin: 10 });
  });
  it('setupSheets idempoten (jalankan dua kali tidak menggandakan data)', () => {
    const a = boot(); a.ctx.setupSheets(); a.ctx.setupSheets();
    assert.equal(a.call('getEmployees', {}).data.length, 10);
  });
  it('sel tanggal berupa objek Date dinormalisasi ke YYYY-MM-DD', () => {
    const a = boot(); a.ctx.setupSheets(); a.call('addSale', sale());
    a.sheets.Transaksi_Penjualan._d[1][1] = new Date('2026-10-10T05:00:00Z');
    assert.equal(a.call('getSales', { periode: '2026-10' }).data[0].tanggal, '2026-10-10');
  });
});

describe('GAS: addSale', () => {
  let a; beforeEach(() => { a = boot(); a.ctx.setupSheets(); });
  it('menghitung margin & komisi di server, abaikan nilai dari client', () => {
    const r = a.call('addSale', { ...sale(), margin: 99, komisi: 99_999_999 });
    assert.equal(r.ok, true);
    assert.equal(r.data.sale.margin, 800_000);
    assert.equal(r.data.sale.komisi, 50_000);
    assert.equal(r.data.sale.id, 'TRX-20261010-001');
    assert.equal(r.data.jurnal.length, 4);
  });
  it('ID berurutan per hari; IMEI sama di hari sama ditolak (DUPLICATE)', () => {
    assert.equal(a.call('addSale', sale()).data.sale.id, 'TRX-20261010-001');
    assert.equal(a.call('addSale', sale({ imei: 'ABC12345' })).data.sale.id, 'TRX-20261010-002');
    assert.equal(a.call('addSale', sale()).error.code, 'DUPLICATE');
    assert.equal(a.call('addSale', sale({ tanggal: '2026-10-11' })).ok, true);
  });
  it('menolak sales non-Sales / tidak ada / nonaktif', () => {
    assert.equal(a.call('addSale', sale({ idSales: 'EMP-004' })).error.code, 'VALIDATION');
    assert.equal(a.call('addSale', sale({ idSales: 'EMP-999' })).error.code, 'VALIDATION');
    const e = a.call('getEmployees', {}).data[0];
    a.call('updateEmployee', { ...e, aktif: false });
    assert.equal(a.call('addSale', sale()).error.code, 'VALIDATION');
  });
  it('menolak input tidak valid', () => {
    for (const bad of [{ tanggal: '2026-02-31' }, { merkModel: '' }, { kondisi: 'Rusak' }, { imei: '12-34' }, { hpp: -1 }, { hpp: 1.5 }, { hargaJual: 0 }, { hargaJual: '5000000' }, { metodeBayar: 'Kredit' }]) {
      assert.equal(a.call('addSale', sale(bad)).error?.code, 'VALIDATION', JSON.stringify(bad));
    }
    assert.equal(a.sheets.Transaksi_Penjualan.getLastRow(), 1);
  });
  it('penjualan rugi: margin negatif, komisi 0', () => {
    const r = a.call('addSale', sale({ hargaJual: 4_000_000 }));
    assert.deepEqual([r.data.sale.margin, r.data.sale.komisi], [-200_000, 0]);
  });
  it('mode PERSEN_MARGIN memakai persen dari margin', () => {
    a.call('updateSettings', { namaUsaha: 'Babay Gadget', komisi: { mode: 'PERSEN_MARGIN', nominalPerUnit: 0, persenMargin: 12.5 } });
    assert.equal(a.call('addSale', sale({ hpp: 4_900_001 })).data.sale.komisi, 12_500 /* 99.999 × 12,5% = 12.499,875 → 12.500 */);
  });
});

describe('GAS: payroll, beban, karyawan, settings', () => {
  let a; beforeEach(() => { a = boot(); a.ctx.setupSheets(); a.call('addSale', sale()); a.call('addSale', sale({ imei: 'ABC12345', hargaJual: 3_000_000, hpp: 2_500_000, idSales: 'EMP-002', metodeBayar: 'Transfer' })); });

  it('generatePayroll: gaji + komisi - potongan, jurnal seimbang', () => {
    const r = a.call('generatePayroll', { periode: '2026-10', potongan: { 'EMP-001': 200_000 } });
    assert.equal(r.ok, true);
    const e1 = r.data.payroll.find(x => x.idKaryawan === 'EMP-001');
    assert.deepEqual([e1.totalKomisi, e1.potongan, e1.gajiBersih, e1.unitTerjual], [50_000, 200_000, 2_350_000, 1]);
    const d = r.data.jurnal.reduce((s, x) => s + x.debet, 0), k = r.data.jurnal.reduce((s, x) => s + x.kredit, 0);
    assert.equal(d, k);
  });
  it('generatePayroll idempoten: ulang tidak menggandakan baris payroll/jurnal', () => {
    a.call('generatePayroll', { periode: '2026-10', potongan: {} });
    a.call('generatePayroll', { periode: '2026-10', potongan: { 'EMP-003': 100_000 } });
    const s = a.call('getSummary', { periode: '2026-10' }).data;
    assert.equal(s.payroll.length, 10);
    assert.equal(s.jurnal.filter(j => j.refTipe === 'PAYROLL').length, 4);
    assert.equal(s.payroll.find(p => p.idKaryawan === 'EMP-003').potongan, 100_000);
    assert.equal(s.jurnal.filter(j => j.refTipe === 'PENJUALAN').length, 4); // jurnal penjualan utuh
  });
  it('generatePayroll menolak gaji negatif, karyawan tak dikenal, periode salah', () => {
    assert.equal(a.call('generatePayroll', { periode: '2026-10', potongan: { 'EMP-001': 9_000_000 } }).error.code, 'VALIDATION');
    assert.equal(a.call('generatePayroll', { periode: '2026-10', potongan: { 'EMP-999': 1 } }).error.code, 'VALIDATION');
    assert.equal(a.call('generatePayroll', { periode: '2026-13', potongan: {} }).error.code, 'VALIDATION');
    assert.equal(a.call('getSummary', { periode: '2026-10' }).data.payroll.length, 0);
  });
  it('payroll bulan lain tidak tersentuh', () => {
    a.call('generatePayroll', { periode: '2026-09', potongan: {} });
    a.call('generatePayroll', { periode: '2026-10', potongan: {} });
    assert.equal(a.call('getPayroll', {}).data.length, 20);
  });
  it('addExpense: Dr Beban Lainnya / Cr Kas, ID berurutan', () => {
    const r = a.call('addExpense', { tanggal: '2026-10-05', keterangan: 'Listrik', jumlah: 50_000, metodeBayar: 'Kas' });
    assert.deepEqual(r.data.jurnal.map(x => [x.kodeAkun, x.debet, x.kredit]), [['6-9000', 50_000, 0], ['1-1100', 0, 50_000]]);
    assert.equal(a.call('addExpense', { tanggal: '2026-10-05', keterangan: 'Air', jumlah: 10_000, metodeBayar: 'Transfer' }).data.jurnal[0].refId, 'BBN-20261005-002');
    assert.equal(a.call('addExpense', { tanggal: '2026-10-05', keterangan: '', jumlah: 1, metodeBayar: 'Kas' }).error.code, 'VALIDATION');
  });
  it('updateEmployee: edit di tempat (urutan tetap), tambah baru → EMP-011, validasi', () => {
    const e = a.call('getEmployees', {}).data;
    a.call('updateEmployee', { ...e[1], nama: 'Budi', gajiPokok: 2_800_000 });
    const after = a.call('getEmployees', {}).data;
    assert.deepEqual(after.map(x => x.id), e.map(x => x.id));
    assert.deepEqual([after[1].nama, after[1].gajiPokok], ['Budi', 2_800_000]);
    const baru = a.call('updateEmployee', { id: '', nama: 'Baru', divisi: 'Marketing', jabatan: 'Staf', rekening: '', kontak: '', gajiPokok: 1, aktif: true });
    assert.equal(baru.data.id, 'EMP-011');
    assert.equal(a.call('updateEmployee', { ...e[0], divisi: 'Gudang' }).error.code, 'VALIDATION');
    assert.equal(a.call('updateEmployee', { ...e[0], id: 'EMP-999' }).error.code, 'NOT_FOUND');
  });
  it('updateSettings: validasi & persist', () => {
    assert.equal(a.call('updateSettings', { namaUsaha: 'X', komisi: { mode: 'ZZ', nominalPerUnit: 0, persenMargin: 0 } }).error.code, 'VALIDATION');
    assert.equal(a.call('updateSettings', { namaUsaha: 'X', komisi: { mode: 'FIXED', nominalPerUnit: 0, persenMargin: 101 } }).error.code, 'VALIDATION');
    const ok = a.call('updateSettings', { namaUsaha: 'Toko Baru', komisi: { mode: 'FIXED', nominalPerUnit: 75_000, persenMargin: 10 } });
    assert.deepEqual([ok.data.namaUsaha, ok.data.komisi.nominalPerUnit], ['Toko Baru', 75_000]);
    assert.equal(a.call('getSettings', {}).data.komisi.nominalPerUnit, 75_000);
  });
});

describe('PARITAS GAS ↔ TypeScript', () => {
  it('komisi, jurnal penjualan, payroll, dan laba rugi identik', () => {
    const a = boot(); a.ctx.setupSheets();
    const aturan = { mode: 'PERSEN_MARGIN', nominalPerUnit: 0, persenMargin: 7.5 };
    a.call('updateSettings', { namaUsaha: 'B', komisi: aturan });
    const kasus = [[5_000_000, 4_200_000, 'Kas'], [333_333, 100_000, 'Transfer'], [1_000_000, 1_200_000, 'Kas'], [9_999_999, 9_000_001, 'Transfer'], [2_500_000, 2_500_000, 'Kas']];
    kasus.forEach(([hj, hpp, m], i) => {
      const r = a.call('addSale', sale({ hargaJual: hj, hpp, metodeBayar: m, imei: `IMEI${1000 + i}`, idSales: `EMP-00${(i % 3) + 1}` }));
      assert.equal(r.data.sale.komisi, hitungKomisi(aturan, hj - hpp), `komisi kasus ${i}`);
      assert.deepEqual(r.data.jurnal, buatJurnalPenjualan(r.data.sale), `jurnal kasus ${i}`);
    });
    const pot = { 'EMP-002': 120_000 };
    const gen = a.call('generatePayroll', { periode: '2026-10', potongan: pot }).data;
    const sum = a.call('getSummary', { periode: '2026-10' }).data;
    const ts = hitungPayroll({ karyawan: sum.karyawan, penjualan: sum.penjualan, periode: '2026-10', potongan: pot });
    assert.deepEqual(gen.payroll.map(p => [p.id, p.gajiPokok, p.unitTerjual, p.totalKomisi, p.potongan, p.gajiBersih]),
      ts.map(p => [p.id, p.gajiPokok, p.unitTerjual, p.totalKomisi, p.potongan, p.gajiBersih]));
    const tsJurnal = buatJurnalPayroll('2026-10', '2026-10-31', ts);
    assert.deepEqual(gen.jurnal.map(j => [j.kodeAkun, j.debet, j.kredit, j.tanggal]), tsJurnal.map(j => [j.kodeAkun, j.debet, j.kredit, j.tanggal]));
    const lr = hitungLabaRugi(sum.jurnal.concat(gen.jurnal.filter(() => false)));
    const pendapatan = kasus.reduce((s, k) => s + k[0], 0), hppT = kasus.reduce((s, k) => s + k[1], 0);
    assert.equal(lr.pendapatanPenjualan, pendapatan);
    assert.equal(lr.bebanPokokPenjualan, hppT);
    assert.equal(lr.bebanKomisi, ts.reduce((s, p) => s + p.totalKomisi, 0));
    assert.equal(lr.bebanGaji, ts.reduce((s, p) => s + p.gajiPokok, 0));
  });
});
