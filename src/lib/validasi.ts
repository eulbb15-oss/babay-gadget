import { DAFTAR_DIVISI } from './types';
import type { Divisi, InputBeban, InputPenjualan, Karyawan, Kondisi, KomisiMode, MetodeBayar, Pengaturan } from './types';

export type Hasil<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const MAKS_UANG = 10_000_000_000;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function tanggalValid(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export const periodeValid = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function uang(v: unknown, opsi: { min: number }): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= opsi.min && v <= MAKS_UANG ? v : null;
}

export function validasiInputPenjualan(raw: unknown): Hasil<InputPenjualan> {
  const o = obj(raw); const errors: Record<string, string> = {};
  if (!tanggalValid(o.tanggal)) errors.tanggal = 'Tanggal tidak valid (YYYY-MM-DD).';
  const merkModel = teks(o.merkModel);
  if (!merkModel || merkModel.length > 120) errors.merkModel = 'Merk/model wajib diisi (maks. 120 karakter).';
  if (o.kondisi !== 'Baru' && o.kondisi !== 'Second') errors.kondisi = 'Kondisi harus Baru atau Second.';
  const imei = teks(o.imei);
  if (!/^[A-Za-z0-9]{5,30}$/.test(imei)) errors.imei = 'IMEI/SN wajib, 5–30 huruf/angka tanpa spasi atau simbol.';
  const hpp = uang(o.hpp, { min: 0 });
  if (hpp === null) errors.hpp = 'HPP harus bilangan bulat Rupiah ≥ 0.';
  const hargaJual = uang(o.hargaJual, { min: 1 });
  if (hargaJual === null) errors.hargaJual = 'Harga jual harus bilangan bulat Rupiah > 0.';
  if (o.metodeBayar !== 'Kas' && o.metodeBayar !== 'Transfer') errors.metodeBayar = 'Metode bayar harus Kas atau Transfer.';
  const idSales = teks(o.idSales);
  if (!idSales) errors.idSales = 'Pilih sales yang menangani.';
  const catatan = teks(o.catatan);
  if (catatan.length > 300) errors.catatan = 'Catatan maks. 300 karakter.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: {
    tanggal: o.tanggal as string, merkModel, kondisi: o.kondisi as Kondisi, imei, hpp: hpp!, hargaJual: hargaJual!,
    metodeBayar: o.metodeBayar as MetodeBayar, idSales, catatan,
  } };
}

export function validasiInputBeban(raw: unknown): Hasil<InputBeban> {
  const o = obj(raw); const errors: Record<string, string> = {};
  if (!tanggalValid(o.tanggal)) errors.tanggal = 'Tanggal tidak valid.';
  const keterangan = teks(o.keterangan);
  if (!keterangan || keterangan.length > 150) errors.keterangan = 'Keterangan wajib diisi (maks. 150 karakter).';
  const jumlah = uang(o.jumlah, { min: 1 });
  if (jumlah === null) errors.jumlah = 'Jumlah harus bilangan bulat Rupiah > 0.';
  if (o.metodeBayar !== 'Kas' && o.metodeBayar !== 'Transfer') errors.metodeBayar = 'Metode bayar harus Kas atau Transfer.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { tanggal: o.tanggal as string, keterangan, jumlah: jumlah!, metodeBayar: o.metodeBayar as MetodeBayar } };
}

export function validasiKaryawan(raw: unknown): Hasil<Karyawan> {
  const o = obj(raw); const errors: Record<string, string> = {};
  const nama = teks(o.nama);
  if (!nama || nama.length > 80) errors.nama = 'Nama wajib diisi (maks. 80 karakter).';
  if (!DAFTAR_DIVISI.includes(o.divisi as Divisi)) errors.divisi = 'Divisi tidak dikenal.';
  const jabatan = teks(o.jabatan);
  if (!jabatan || jabatan.length > 80) errors.jabatan = 'Jabatan wajib diisi.';
  const gajiPokok = uang(o.gajiPokok, { min: 0 });
  if (gajiPokok === null) errors.gajiPokok = 'Gaji pokok harus bilangan bulat Rupiah ≥ 0.';
  if (typeof o.aktif !== 'boolean') errors.aktif = 'Status aktif tidak valid.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: {
    id: teks(o.id), nama, divisi: o.divisi as Divisi, jabatan, rekening: teks(o.rekening), kontak: teks(o.kontak),
    gajiPokok: gajiPokok!, aktif: o.aktif as boolean,
  } };
}

export function validasiPengaturan(raw: unknown): Hasil<Pengaturan> {
  const o = obj(raw); const k = obj(o.komisi); const errors: Record<string, string> = {};
  const namaUsaha = teks(o.namaUsaha);
  if (!namaUsaha || namaUsaha.length > 80) errors.namaUsaha = 'Nama usaha wajib diisi.';
  if (k.mode !== 'FIXED' && k.mode !== 'PERSEN_MARGIN') errors.mode = 'Mode komisi tidak dikenal.';
  const nominal = uang(k.nominalPerUnit, { min: 0 });
  if (nominal === null) errors.nominalPerUnit = 'Nominal harus bilangan bulat Rupiah ≥ 0.';
  const persen = k.persenMargin;
  if (typeof persen !== 'number' || !Number.isFinite(persen) || persen < 0 || persen > 100) errors.persenMargin = 'Persen harus 0–100.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { namaUsaha, komisi: { mode: k.mode as KomisiMode, nominalPerUnit: nominal!, persenMargin: persen as number } } };
}
