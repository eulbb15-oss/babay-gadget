import 'server-only';
import { GasError, parseEnvelope } from './gas-parser';

/**
 * Satu-satunya tempat yang memegang GAS_API_SECRET. Berkas ini hanya boleh diimpor dari
 * route handler / kode server ("server-only" membuat build gagal bila terimpor ke client).
 * Semua panggilan memakai POST agar token tidak pernah muncul di URL.
 */
export async function panggilGas(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_GAS_API_URL;
  const secret = process.env.GAS_API_SECRET;
  if (!url || !secret) {
    throw new GasError('CONFIG', 'NEXT_PUBLIC_GAS_API_URL atau GAS_API_SECRET belum diisi di environment server.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      // text/plain menghindari preflight CORS; Apps Script tetap menerima body mentah.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: secret, payload }),
      redirect: 'follow', // Apps Script membalas lewat redirect 302 ke googleusercontent.com
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new GasError('NETWORK', 'Tidak dapat menghubungi Apps Script (jaringan/timeout).');
  }
  const teks = await res.text();
  const data = parseEnvelope(teks);
  return data;
}
