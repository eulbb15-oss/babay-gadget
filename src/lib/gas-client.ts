import { GasError, parseEnvelope, parseKaryawanList, parsePengaturan, parseRingkasan } from './gas-parser';
import type { InputBeban, InputPenjualan, Karyawan, Pengaturan, Ringkasan } from './types';

/**
 * Pembungkus fetch untuk browser. Hanya berbicara dengan /api/gas (same-origin) –
 * tidak ada URL Apps Script maupun secret di sisi client.
 */
async function minta(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch('/api/gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new GasError('NETWORK', 'Tidak ada koneksi ke server.');
  }
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.assign('/lock');
    throw new GasError('UNAUTHORIZED', 'Sesi berakhir. Buka kunci lagi.');
  }
  return parseEnvelope(await res.text());
}

export const api = {
  ringkasan: async (periode: string): Promise<Ringkasan> => parseRingkasan(await minta('getSummary', { periode })),
  karyawan: async (): Promise<Karyawan[]> => parseKaryawanList(await minta('getEmployees')),
  pengaturan: async (): Promise<Pengaturan> => parsePengaturan(await minta('getSettings')),
  tambahPenjualan: (input: InputPenjualan) => minta('addSale', { ...input }),
  simpanKaryawan: (k: Karyawan) => minta('updateEmployee', { ...k }),
  generatePayroll: (periode: string, potongan: Record<string, number>) => minta('generatePayroll', { periode, potongan }),
  tambahBeban: (b: InputBeban) => minta('addExpense', { ...b }),
  simpanPengaturan: async (p: Pengaturan): Promise<Pengaturan> => parsePengaturan(await minta('updateSettings', { ...p })),
};

export const pesanError = (e: unknown): string => (e instanceof GasError || e instanceof Error ? e.message : 'Terjadi kesalahan.');
