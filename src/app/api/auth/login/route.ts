import { NextResponse, type NextRequest } from 'next/server';
import { DURASI_SESI_DETIK, NAMA_COOKIE, buatTokenSesi, pinCocok } from '@/lib/auth';
import { PembatasLogin } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pembatas = new PembatasLogin(5, 15 * 60_000);
const tunggu = (ms: number) => new Promise(r => setTimeout(r, ms));
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  const pin = process.env.OWNER_PIN;
  const secret = process.env.SESSION_SECRET;
  if (!pin || !secret || secret.length < 32) {
    return json({ ok: false, error: 'Server belum dikonfigurasi: isi OWNER_PIN dan SESSION_SECRET (≥ 32 karakter).' }, 500);
  }

  const kunci = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'tak-dikenal';
  if (pembatas.terkunci(kunci)) return json({ ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, 429);

  const body: unknown = await req.json().catch(() => null);
  const input = body && typeof body === 'object' && typeof (body as { pin?: unknown }).pin === 'string' ? (body as { pin: string }).pin : '';

  if (!(await pinCocok(input, pin))) {
    pembatas.catatGagal(kunci);
    await tunggu(600); // memperlambat tebakan beruntun
    return json({ ok: false, error: 'PIN salah.' }, 401);
  }

  pembatas.reset(kunci);
  const res = json({ ok: true });
  res.cookies.set(NAMA_COOKIE, await buatTokenSesi(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: DURASI_SESI_DETIK,
  });
  return res;
}
