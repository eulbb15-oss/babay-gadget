import { NextResponse, type NextRequest } from 'next/server';
import { NAMA_COOKIE, verifikasiTokenSesi } from '@/lib/auth';
import { GasError } from '@/lib/gas-parser';
import { panggilGas } from '@/lib/gas-server';
import { siapkanPermintaan } from '@/lib/permintaan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<string, number> = {
  VALIDATION: 400, DUPLICATE: 409, NOT_FOUND: 404, BUSY: 503, BAD_REQUEST: 400,
};
// Kode internal yang tidak perlu/aman ditampilkan apa adanya ke browser.
const PESAN_UMUM: Record<string, string> = {
  UNAUTHORIZED: 'Koneksi ke Apps Script ditolak: GAS_API_SECRET tidak cocok dengan API_SECRET di Script Properties.',
  CONFIG: 'Server belum dikonfigurasi: isi NEXT_PUBLIC_GAS_API_URL dan GAS_API_SECRET.',
  SERVER: 'Apps Script mengalami kesalahan internal. Lihat Executions di editor Apps Script.',
  METHOD_NOT_ALLOWED: 'Permintaan tidak diizinkan.',
  UNKNOWN_ACTION: 'Aksi tidak dikenal.',
};

const galat = (code: string, message: string, status: number) =>
  NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  // Defense in depth: jangan hanya mengandalkan middleware (pernah ada bypass middleware di versi Next lama).
  const sesiValid = await verifikasiTokenSesi(req.cookies.get(NAMA_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!sesiValid) return galat('UNAUTHORIZED', 'Sesi berakhir. Buka kunci lagi.', 401);

  // Wajib JSON: memaksa preflight CORS pada request lintas-origin.
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return galat('BAD_REQUEST', 'Content-Type harus application/json.', 415);
  }
  const body: unknown = await req.json().catch(() => null);
  const siap = siapkanPermintaan(body);
  if (!siap.ok) return galat('VALIDATION', Object.values(siap.errors)[0] ?? 'Permintaan tidak valid.', 400);

  try {
    const data = await panggilGas(siap.value.action, siap.value.payload);
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof GasError) {
      const status = STATUS[e.code] ?? 502;
      const pesan = status < 500 && e.code in STATUS ? e.message : PESAN_UMUM[e.code] ?? e.message;
      return galat(e.code === 'UNAUTHORIZED' ? 'CONFIG' : e.code, pesan, status);
    }
    console.error('[api/gas] galat tak terduga'); // jangan log payload/secret
    return galat('SERVER', 'Terjadi kesalahan di server.', 500);
  }
}
