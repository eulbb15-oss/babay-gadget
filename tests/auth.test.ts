import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buatTokenSesi, verifikasiTokenSesi, pinCocok, amankanRedirect } from '@/lib/auth';

const SECRET = 'rahasia-sesi-minimal-32-karakter-xxxxxxxx';
const NOW = 1_800_000_000_000;

describe('token sesi', () => {
  it('token valid lolos sebelum kedaluwarsa', async () => {
    const t = await buatTokenSesi(SECRET, 3600, NOW);
    assert.equal(await verifikasiTokenSesi(t, SECRET, NOW + 1000), true);
  });
  it('kedaluwarsa ditolak', async () => {
    const t = await buatTokenSesi(SECRET, 3600, NOW);
    assert.equal(await verifikasiTokenSesi(t, SECRET, NOW + 3601 * 1000), false);
  });
  it('secret berbeda atau token diubah ditolak', async () => {
    const t = await buatTokenSesi(SECRET, 3600, NOW);
    assert.equal(await verifikasiTokenSesi(t, 'secret-lain-yang-juga-panjang-sekali-xx', NOW), false);
    const [exp, sig] = t.split('.');
    assert.equal(await verifikasiTokenSesi(`${Number(exp) + 999999}.${sig}`, SECRET, NOW), false);
  });
  it('sampah / kosong / secret kosong ditolak', async () => {
    assert.equal(await verifikasiTokenSesi('', SECRET, NOW), false);
    assert.equal(await verifikasiTokenSesi('abc', SECRET, NOW), false);
    assert.equal(await verifikasiTokenSesi('1.2.3', SECRET, NOW), false);
    const t = await buatTokenSesi(SECRET, 3600, NOW);
    assert.equal(await verifikasiTokenSesi(t, '', NOW), false);
  });
});

describe('pinCocok', () => {
  it('cocok hanya untuk PIN yang sama persis', async () => {
    assert.equal(await pinCocok('123456', '123456'), true);
    assert.equal(await pinCocok('123457', '123456'), false);
    assert.equal(await pinCocok('', '123456'), false);
  });
  it('PIN terkonfigurasi kosong → selalu false (fail closed)', async () => {
    assert.equal(await pinCocok('', ''), false);
    assert.equal(await pinCocok('x', ''), false);
  });
});

describe('amankanRedirect', () => {
  it('hanya path relatif internal', () => {
    assert.equal(amankanRedirect('/payroll'), '/payroll');
    assert.equal(amankanRedirect('//evil.com'), '/');
    assert.equal(amankanRedirect('https://evil.com'), '/');
    assert.equal(amankanRedirect('/\\evil.com'), '/');
    assert.equal(amankanRedirect(null), '/');
  });
});
