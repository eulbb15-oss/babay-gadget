/**
 * Autentikasi single-owner. Hanya memakai Web Crypto sehingga berjalan di Edge (middleware) maupun Node.
 * Token sesi: "<exp-ms>.<hmac-sha256-hex>" yang ditandatangani SESSION_SECRET.
 */
export const NAMA_COOKIE = 'bg_session';
export const DURASI_SESI_DETIK = 8 * 60 * 60;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Perbandingan waktu-konstan untuk dua string heksadesimal/teks dengan panjang apa pun. */
function samaKonstan(a: string, b: string): boolean {
  const x = enc.encode(a); const y = enc.encode(b);
  let selisih = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) selisih |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return selisih === 0;
}

export async function buatTokenSesi(secret: string, detik = DURASI_SESI_DETIK, sekarang = Date.now()): Promise<string> {
  const exp = String(sekarang + detik * 1000);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function verifikasiTokenSesi(token: string | undefined | null, secret: string | undefined, sekarang = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const bagian = token.split('.');
  if (bagian.length !== 2) return false;
  const [exp, sig] = bagian as [string, string];
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum <= sekarang) return false;
  return samaKonstan(sig, await hmac(secret, exp));
}

/** Membandingkan PIN lewat hash agar panjang input tidak bocor. Jika PIN server kosong → selalu false. */
export async function pinCocok(input: string, pinServer: string | undefined): Promise<boolean> {
  if (!pinServer) return false;
  const h = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return samaKonstan(await h(input), await h(pinServer));
}

/** Cegah open redirect: hanya path internal yang diterima. */
export function amankanRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
