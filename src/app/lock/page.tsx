'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { amankanRedirect } from '@/lib/auth';

function FormKunci() {
  const router = useRouter();
  const next = amankanRedirect(useSearchParams().get('next'));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [proses, setProses] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setProses(true); setError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) { router.replace(next); router.refresh(); return; }
      setError(j.error ?? 'Gagal membuka kunci.'); setPin('');
    } catch { setError('Tidak ada koneksi ke server.'); }
    finally { setProses(false); }
  }

  return (
    <form onSubmit={kirim} className="w-full max-w-sm" aria-describedby={error ? 'galat' : undefined}>
      <h1 className="text-5xl font-semibold leading-[0.95] tracking-tight">Babay<br />Gadget</h1>
      <p className="mt-4 text-abu-300">Khusus pemilik. Masukkan PIN untuk membuka.</p>
      <label htmlFor="pin" className="mb-1 mt-8 block text-sm font-medium">PIN / kata sandi</label>
      <input
        id="pin" type="password" autoFocus autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)}
        className="angka w-full border-2 border-white bg-black px-4 py-3 text-xl tracking-widest text-white placeholder:text-abu-500"
      />
      {error ? <p id="galat" role="alert" className="mt-3 border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-black">{error}</p> : null}
      <button type="submit" disabled={proses || !pin} className="mt-5 min-h-12 w-full border-2 border-white bg-white px-4 py-3 text-base font-semibold text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40">
        {proses ? 'Memeriksa…' : 'Buka'}
      </button>
    </form>
  );
}

export default function HalamanKunci() {
  return (
    <main className="gelap flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <Suspense fallback={null}><FormKunci /></Suspense>
    </main>
  );
}
