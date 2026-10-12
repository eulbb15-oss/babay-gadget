import { DAFTAR_DIVISI } from './types';
import type {
  BarisJurnal, BarisPayroll, Divisi, Karyawan, Penjualan, Pengaturan, RefTipe, Ringkasan,
} from './types';

export class GasError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'GasError';
  }
}

/** Membuka amplop {ok, data|error} dari Apps Script. Melempar GasError untuk semua kegagalan. */
export function parseEnvelope(raw: string): unknown {
  const teks = (raw ?? '').trim();
  if (!teks || teks.startsWith('<')) {
    throw new GasError('NOT_JSON', 'Apps Script tidak mengembalikan JSON. Periksa deployment: akses harus "Anyone" dan URL harus berakhiran /exec.');
  }
  let json: unknown;
  try { json = JSON.parse(teks); } catch { throw new GasError('NOT_JSON', 'Respons Apps Script bukan JSON yang valid.'); }
  if (!json || typeof json !== 'object' || Array.isArray(json) || typeof (json as { ok?: unknown }).ok !== 'boolean') {
    throw new GasError('BAD_ENVELOPE', 'Format respons Apps Script tidak dikenali.');
  }
  const env = json as { ok: boolean; data?: unknown; error?: { code?: unknown; message?: unknown } };
  if (!env.ok) {
    throw new GasError(typeof env.error?.code === 'string' ? env.error.code : 'GAS_ERROR', typeof env.error?.message === 'string' ? env.error.message : 'Terjadi kesalahan di Apps Script.');
  }
  return env.data;
}

const gagal = (msg: string): never => { throw new GasError('PARSE_ERROR', msg); };
const rec = (v: unknown, nama: string): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : gagal(`${nama}: bukan objek.`);
const arr = (v: unknown, nama: string): unknown[] => (Array.isArray(v) ? v : gagal(`${nama}: bukan array.`));

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}
function tgl(v: unknown): string { return str(v).slice(0, 10); }
function num(v: unknown, nama: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return gagal(`${nama}: bukan angka (${JSON.stringify(v)}).`);
}
function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return ['true', 'aktif', 'ya', '1'].includes(str(v).trim().toLowerCase());
}

export function parseKaryawanList(data: unknown): Karyawan[] {
  return arr(data, 'karyawan').map((x, i) => {
    const o = rec(x, `karyawan[${i}]`);
    const divisi = str(o.divisi) as Divisi;
    if (!DAFTAR_DIVISI.includes(divisi)) gagal(`karyawan[${i}]: divisi tidak dikenal (${divisi}).`);
    return { id: str(o.id), nama: str(o.nama), divisi, jabatan: str(o.jabatan), rekening: str(o.rekening), kontak: str(o.kontak), gajiPokok: num(o.gajiPokok, 'gajiPokok'), aktif: bool(o.aktif) };
  });
}

export function parsePenjualanList(data: unknown): Penjualan[] {
  return arr(data, 'penjualan').map((x, i) => {
    const o = rec(x, `penjualan[${i}]`);
    const kondisi = str(o.kondisi); const metode = str(o.metodeBayar);
    if (kondisi !== 'Baru' && kondisi !== 'Second') gagal(`penjualan[${i}]: kondisi tidak dikenal (${kondisi}).`);
    if (metode !== 'Kas' && metode !== 'Transfer') gagal(`penjualan[${i}]: metode bayar tidak dikenal (${metode}).`);
    return {
      id: str(o.id), tanggal: tgl(o.tanggal), periode: str(o.periode).slice(0, 7) || tgl(o.tanggal).slice(0, 7), merkModel: str(o.merkModel),
      kondisi: kondisi as Penjualan['kondisi'], imei: str(o.imei), hpp: num(o.hpp, 'hpp'), hargaJual: num(o.hargaJual, 'hargaJual'),
      margin: num(o.margin, 'margin'), metodeBayar: metode as Penjualan['metodeBayar'], idSales: str(o.idSales), namaSales: str(o.namaSales),
      komisi: num(o.komisi, 'komisi'), catatan: str(o.catatan),
    };
  });
}

export function parsePayrollList(data: unknown): BarisPayroll[] {
  return arr(data, 'payroll').map((x, i) => {
    const o = rec(x, `payroll[${i}]`);
    return {
      id: str(o.id), periode: str(o.periode).slice(0, 7), idKaryawan: str(o.idKaryawan), nama: str(o.nama), divisi: str(o.divisi), jabatan: str(o.jabatan),
      gajiPokok: num(o.gajiPokok, 'gajiPokok'), unitTerjual: num(o.unitTerjual, 'unitTerjual'), totalKomisi: num(o.totalKomisi, 'totalKomisi'),
      potongan: num(o.potongan, 'potongan'), gajiBersih: num(o.gajiBersih, 'gajiBersih'), dibuatPada: str(o.dibuatPada),
    };
  });
}

const REF: RefTipe[] = ['PENJUALAN', 'HPP', 'PAYROLL', 'BEBAN'];
export function parseJurnalList(data: unknown): BarisJurnal[] {
  return arr(data, 'jurnal').map((x, i) => {
    const o = rec(x, `jurnal[${i}]`);
    const refTipe = str(o.refTipe) as RefTipe;
    if (!REF.includes(refTipe)) gagal(`jurnal[${i}]: refTipe tidak dikenal (${refTipe}).`);
    return {
      id: str(o.id), tanggal: tgl(o.tanggal), periode: str(o.periode).slice(0, 7), refTipe, refId: str(o.refId), keterangan: str(o.keterangan),
      kodeAkun: str(o.kodeAkun), namaAkun: str(o.namaAkun), debet: num(o.debet, 'debet'), kredit: num(o.kredit, 'kredit'),
    };
  });
}

export function parsePengaturan(data: unknown): Pengaturan {
  const o = rec(data, 'pengaturan'); const k = rec(o.komisi, 'pengaturan.komisi');
  const mode = str(k.mode);
  if (mode !== 'FIXED' && mode !== 'PERSEN_MARGIN') gagal(`pengaturan.komisi.mode tidak dikenal (${mode}).`);
  return { namaUsaha: str(o.namaUsaha), komisi: { mode: mode as 'FIXED' | 'PERSEN_MARGIN', nominalPerUnit: num(k.nominalPerUnit, 'nominalPerUnit'), persenMargin: num(k.persenMargin, 'persenMargin') } };
}

export function parseRingkasan(data: unknown): Ringkasan {
  const o = rec(data, 'ringkasan');
  return {
    periode: str(o.periode).slice(0, 7), pengaturan: parsePengaturan(o.pengaturan), karyawan: parseKaryawanList(o.karyawan),
    penjualan: parsePenjualanList(o.penjualan), payroll: parsePayrollList(o.payroll), jurnal: parseJurnalList(o.jurnal),
  };
}
