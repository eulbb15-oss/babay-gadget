'use client';
import { useId, useState } from 'react';
import { formatAngka, formatRupiah, formatTanggal } from '@/lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Judul({ children, aksi }: { children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:mb-3">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{children}</h1>
      {aksi ? <div className="flex flex-wrap items-center gap-2 print:hidden">{aksi}</div> : null}
    </div>
  );
}

export function Kartu({ judul, aksi, children, className }: { judul?: string; aksi?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('border-2 border-black bg-white', className)}>
      {judul ? (
        <header className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-2.5">
          <h2 className="text-lg font-semibold">{judul}</h2>
          {aksi}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Angka({ nilai, className, tipe = 'rupiah' }: { nilai: number; className?: string; tipe?: 'rupiah' | 'angka' }) {
  return <span className={cx('angka whitespace-nowrap', className)}>{tipe === 'rupiah' ? formatRupiah(nilai) : formatAngka(nilai)}</span>;
}

export function Metrik({ label, nilai, tipe = 'rupiah', gelap }: { label: string; nilai: number; tipe?: 'rupiah' | 'angka'; gelap?: boolean }) {
  return (
    <div className={cx('border-2 border-black p-4', gelap ? 'gelap bg-black text-white' : 'bg-white')}>
      <p className={cx('text-sm', gelap ? 'text-abu-300' : 'text-abu-500')}>{label}</p>
      <p className={cx('angka mt-1 break-words text-2xl font-semibold leading-tight', gelap && 'sm:text-4xl')}>
        {tipe === 'rupiah' ? formatRupiah(nilai) : formatAngka(nilai)}
      </p>
    </div>
  );
}

type TombolProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { varian?: 'isi' | 'garis' | 'teks' };
export function Tombol({ varian = 'isi', className, ...p }: TombolProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        varian === 'isi' && 'border-2 border-black bg-black text-white hover:bg-white hover:text-black',
        varian === 'garis' && 'border-2 border-black bg-white text-black hover:bg-black hover:text-white',
        varian === 'teks' && 'underline underline-offset-4 hover:no-underline',
        className,
      )}
    />
  );
}

const inputCls = 'w-full min-h-10 border-2 border-black bg-white px-3 py-2 text-base placeholder:text-abu-500 disabled:bg-abu-100';

export function Field({ label, error, bantuan, sembunyikanLabel, children }: { label: string; error?: string; bantuan?: string; sembunyikanLabel?: boolean; children: (id: string, aria: Record<string, string | boolean | undefined>) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={cx('block text-sm font-medium', sembunyikanLabel ? 'sr-only' : 'mb-1')}>{label}</label>
      {children(id, { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-e` : bantuan ? `${id}-b` : undefined })}
      {error ? <p id={`${id}-e`} className="mt-1 text-sm font-semibold underline decoration-2 underline-offset-2">{error}</p> : null}
      {!error && bantuan ? <p id={`${id}-b`} className="mt-1 text-sm text-abu-500">{bantuan}</p> : null}
    </div>
  );
}

export function InputTeks({ label, value, onChange, error, bantuan, ...p }: { label: string; value: string; onChange: (v: string) => void; error?: string; bantuan?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <Field label={label} error={error} bantuan={bantuan}>
      {(id, aria) => <input id={id} {...aria} {...p} value={value} onChange={e => onChange(e.target.value)} className={cx(inputCls, p.className)} />}
    </Field>
  );
}

/** Input Rupiah: tampil "1.234.567", menyimpan bilangan bulat. */
export function InputUang({ label, value, onChange, error, bantuan, disabled, sembunyikanLabel }: { label: string; value: number; onChange: (v: number) => void; error?: string; bantuan?: string; disabled?: boolean; sembunyikanLabel?: boolean }) {
  return (
    <Field label={label} error={error} bantuan={bantuan} sembunyikanLabel={sembunyikanLabel}>
      {(id, aria) => (
        <div className="flex">
          <span className="angka flex items-center border-2 border-r-0 border-black bg-abu-100 px-3 text-sm">Rp</span>
          <input
            id={id} {...aria} disabled={disabled} inputMode="numeric" autoComplete="off"
            value={value ? formatAngka(value) : ''} placeholder="0"
            onChange={e => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 11)) || 0)}
            className={cx(inputCls, 'angka text-right')}
          />
        </div>
      )}
    </Field>
  );
}

export function Pilihan({ label, value, onChange, opsi, error }: { label: string; value: string; onChange: (v: string) => void; opsi: { nilai: string; teks: string }[]; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id, aria) => (
        <select id={id} {...aria} value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
          {opsi.map(o => <option key={o.nilai} value={o.nilai}>{o.teks}</option>)}
        </select>
      )}
    </Field>
  );
}

export function Catatan({ jenis = 'info', children }: { jenis?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  return (
    <div
      role={jenis === 'error' ? 'alert' : 'status'}
      className={cx('mb-4 border-2 border-black px-4 py-3 text-sm', jenis === 'error' ? 'bg-black text-white' : jenis === 'ok' ? 'bg-abu-100' : 'bg-white')}
    >
      <strong className="font-semibold">{jenis === 'error' ? 'Gagal: ' : jenis === 'ok' ? 'Berhasil: ' : ''}</strong>
      {children}
    </div>
  );
}

export function Memuat({ teks = 'Memuat data dari Google Sheets…' }: { teks?: string }) {
  return <p className="border-2 border-dashed border-black p-6 text-center text-abu-500" aria-live="polite">{teks}</p>;
}

export function Kosong({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-6 text-center text-abu-500">{children}</p>;
}

export function TabelGulir({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="tabel w-full min-w-max border-collapse text-sm">{children}</table></div>;
}

export function PemilihPeriode({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="periode" className="text-sm font-medium">Periode</label>
      <input id="periode" type="month" value={value} onChange={e => e.target.value && onChange(e.target.value)} className={cx(inputCls, 'angka w-auto')} />
    </div>
  );
}

export function useNotice() {
  const [n, setN] = useState<{ jenis: 'info' | 'error' | 'ok'; teks: string } | null>(null);
  return { notice: n, ok: (teks: string) => setN({ jenis: 'ok', teks }), err: (teks: string) => setN({ jenis: 'error', teks }), hapus: () => setN(null) };
}

/** Grafik batang SVG hitam-putih: omset per hari. */
export function GrafikBatang({ data }: { data: { tanggal: string; omset: number }[] }) {
  if (!data.length) return <Kosong>Belum ada penjualan pada periode ini.</Kosong>;
  const maks = Math.max(...data.map(d => d.omset), 1);
  const lebar = 28, jarak = 8, tinggi = 140;
  const W = data.length * (lebar + jarak) + jarak;
  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-label="Omset per hari" width={Math.max(W, 320)} height={tinggi + 28} className="block">
        <line x1="0" y1={tinggi} x2={Math.max(W, 320)} y2={tinggi} stroke="#000" strokeWidth="2" />
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.omset / maks) * (tinggi - 8)));
          const x = jarak + i * (lebar + jarak);
          return (
            <g key={d.tanggal}>
              <title>{`${formatTanggal(d.tanggal)}: ${formatRupiah(d.omset)}`}</title>
              <rect x={x} y={tinggi - h} width={lebar} height={h} fill="#000" />
              <text x={x + lebar / 2} y={tinggi + 16} textAnchor="middle" fontSize="11" fill="#000" className="angka">{d.tanggal.slice(8)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
