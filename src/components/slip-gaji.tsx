import { formatRupiah, namaPeriode } from '@/lib/format';
import type { BarisPayroll } from '@/lib/types';

/** Slip gaji monokrom. Dicetak dari browser (Ctrl/Cmd+P → Simpan sebagai PDF). */
export function SlipGaji({ namaUsaha, baris }: { namaUsaha: string; baris: BarisPayroll }) {
  const r = (label: string, nilai: string, tebal?: boolean) => (
    <tr><td className="py-1.5 pr-4">{label}</td><td className={`angka py-1.5 text-right ${tebal ? 'font-semibold' : ''}`}>{nilai}</td></tr>
  );
  return (
    <article className="mx-auto max-w-xl border-2 border-black bg-white p-6 print:border print:p-4" aria-label={`Slip gaji ${baris.nama}`}>
      <header className="border-b-2 border-black pb-3">
        <p className="text-2xl font-semibold">{namaUsaha}</p>
        <p className="text-sm">Slip gaji · {namaPeriode(baris.periode)}</p>
      </header>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1 py-4 text-sm">
        <dt className="text-abu-500">Nama</dt><dd className="font-medium">{baris.nama}</dd>
        <dt className="text-abu-500">ID karyawan</dt><dd className="angka">{baris.idKaryawan}</dd>
        <dt className="text-abu-500">Divisi / jabatan</dt><dd>{baris.divisi} / {baris.jabatan}</dd>
      </dl>
      <table className="w-full border-t-2 border-black text-sm">
        <tbody>
          {r('Gaji pokok', formatRupiah(baris.gajiPokok))}
          {r(`Komisi penjualan (${baris.unitTerjual} unit)`, formatRupiah(baris.totalKomisi))}
          {r('Potongan / kasbon', baris.potongan ? `-${formatRupiah(baris.potongan)}` : formatRupiah(0))}
        </tbody>
      </table>
      <div className="total-ganda mt-1 flex items-baseline justify-between border-t-2 border-black pb-2 pt-2">
        <span className="font-semibold">Gaji bersih diterima</span>
        <span className="angka text-xl font-semibold">{formatRupiah(baris.gajiBersih)}</span>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
        <div><div className="h-14 border-b border-black" /><p className="mt-1">Pemilik</p></div>
        <div><div className="h-14 border-b border-black" /><p className="mt-1">Penerima</p></div>
      </div>
    </article>
  );
}
