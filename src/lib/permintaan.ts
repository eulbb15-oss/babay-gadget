import {
  periodeValid, tanggalValid, validasiInputBeban, validasiInputPenjualan, validasiKaryawan, validasiPengaturan, type Hasil,
} from './validasi';

export const AKSI_BACA = ['getSummary', 'getEmployees', 'getSales', 'getPayroll', 'getJournal', 'getSettings'] as const;
export const AKSI_TULIS = ['addSale', 'updateEmployee', 'generatePayroll', 'addExpense', 'updateSettings'] as const;

export interface PermintaanGas { action: string; payload: Record<string, unknown> }

const punya = (daftar: readonly string[], a: unknown): a is string => typeof a === 'string' && daftar.includes(a);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const gagal = (pesan: string): Hasil<PermintaanGas> => ({ ok: false, errors: { _: pesan } });

/**
 * Gerbang sebelum meneruskan ke Apps Script: aksi harus ada di whitelist dan payload
 * dibangun ulang dari nilai yang sudah divalidasi (field asing, termasuk "token", dibuang).
 */
export function siapkanPermintaan(raw: unknown): Hasil<PermintaanGas> {
  const o = obj(raw);
  const action = o.action;
  const p = obj(o.payload);

  if (punya(AKSI_BACA, action)) {
    const out: Record<string, unknown> = {};
    if (p.periode !== undefined) {
      if (!periodeValid(p.periode)) return gagal('Periode tidak valid.');
      out.periode = p.periode;
    }
    if (p.from !== undefined || p.to !== undefined) {
      if (!tanggalValid(p.from) || !tanggalValid(p.to)) return gagal('Rentang tanggal tidak valid.');
      out.from = p.from; out.to = p.to;
    }
    return { ok: true, value: { action, payload: out } };
  }

  if (!punya(AKSI_TULIS, action)) return gagal('Aksi tidak dikenal.');

  const bungkus = <T>(h: Hasil<T>): Hasil<PermintaanGas> =>
    h.ok ? { ok: true, value: { action, payload: h.value as unknown as Record<string, unknown> } } : h;

  switch (action) {
    case 'addSale': return bungkus(validasiInputPenjualan(p));
    case 'addExpense': return bungkus(validasiInputBeban(p));
    case 'updateEmployee': return bungkus(validasiKaryawan(p));
    case 'updateSettings': return bungkus(validasiPengaturan(p));
    default: {
      if (!periodeValid(p.periode)) return gagal('Periode tidak valid.');
      const potongan: Record<string, number> = {};
      for (const [id, v] of Object.entries(obj(p.potongan))) {
        if (!/^[A-Za-z0-9-]{1,20}$/.test(id)) return gagal('ID karyawan pada potongan tidak valid.');
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10_000_000_000) return gagal('Potongan harus bilangan bulat Rupiah ≥ 0.');
        potongan[id] = v;
      }
      return { ok: true, value: { action, payload: { periode: p.periode, potongan } } };
    }
  }
}
