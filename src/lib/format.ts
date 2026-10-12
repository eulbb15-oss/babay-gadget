/** Format Rupiah tanpa bergantung pada data locale ICU: "Rp 1.234.567", negatif "-Rp 150.000". */
export function formatRupiah(n: number): string {
  const bulat = Math.round(n);
  const digit = Math.abs(bulat).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${bulat < 0 ? '-' : ''}Rp ${digit}`;
}

export function formatAngka(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function periodeDari(tanggal: string): string {
  return tanggal.slice(0, 7);
}

export function akhirBulan(periode: string): string {
  const [y, m] = periode.split('-').map(Number) as [number, number];
  const hari = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periode}-${String(hari).padStart(2, '0')}`;
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu Asia/Jakarta, bukan zona perangkat. */
export function hariIniJakarta(sekarang: Date = new Date()): string {
  const wib = new Date(sekarang.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function namaPeriode(periode: string): string {
  const [y, m] = periode.split('-');
  return `${NAMA_BULAN[Number(m) - 1] ?? m} ${y}`;
}

export function formatTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split('-');
  return `${d}/${m}/${y}`;
}
