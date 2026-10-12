'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from './ui';

const MENU = [
  { href: '/', teks: 'Ringkasan' },
  { href: '/penjualan', teks: 'Penjualan' },
  { href: '/karyawan', teks: 'Karyawan' },
  { href: '/payroll', teks: 'Payroll' },
  { href: '/laporan', teks: 'Laporan' },
  { href: '/pengaturan', teks: 'Pengaturan' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const aktif = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));

  async function kunci() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/lock');
    router.refresh();
  }

  return (
    <div className="md:flex md:min-h-screen">
      <aside className="gelap bg-black text-white print:hidden md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
          <p className="text-xl font-semibold leading-none tracking-tight">Babay<br className="hidden md:block" /> Gadget</p>
          <button onClick={kunci} className="border-2 border-white px-3 py-1.5 text-sm font-semibold hover:bg-white hover:text-black md:mt-6 md:w-full">Kunci</button>
        </div>
        <nav aria-label="Menu utama" className="flex gap-1 overflow-x-auto px-2 pb-2 md:block md:px-3 md:pb-6">
          {MENU.map(m => (
            <Link
              key={m.href} href={m.href} aria-current={aktif(m.href) ? 'page' : undefined}
              className={cx('block whitespace-nowrap px-3 py-2 text-sm font-medium md:mb-1', aktif(m.href) ? 'bg-white text-black' : 'hover:bg-abu-700')}
            >
              {m.teks}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
