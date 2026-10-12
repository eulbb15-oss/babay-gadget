import { NextResponse, type NextRequest } from 'next/server';
import { NAMA_COOKIE, verifikasiTokenSesi } from '@/lib/auth';

const TERBUKA = new Set(['/lock', '/api/auth/login']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (TERBUKA.has(pathname)) return NextResponse.next();

  if (await verifikasiTokenSesi(req.cookies.get(NAMA_COOKIE)?.value, process.env.SESSION_SECRET)) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sesi berakhir. Buka kunci lagi.' } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/lock';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
