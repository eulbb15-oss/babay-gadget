export type Divisi = 'Sales' | 'Finance' | 'Media Sosial' | 'E-commerce' | 'Marketing';
export const DAFTAR_DIVISI: readonly Divisi[] = ['Sales', 'Finance', 'Media Sosial', 'E-commerce', 'Marketing'];
export type Kondisi = 'Baru' | 'Second';
export type MetodeBayar = 'Kas' | 'Transfer';
export type KomisiMode = 'FIXED' | 'PERSEN_MARGIN';

export interface Karyawan {
  id: string;
  nama: string;
  divisi: Divisi;
  jabatan: string;
  rekening: string;
  kontak: string;
  gajiPokok: number;
  aktif: boolean;
}

export interface AturanKomisi {
  mode: KomisiMode;
  nominalPerUnit: number;
  persenMargin: number;
}

export interface Pengaturan {
  namaUsaha: string;
  komisi: AturanKomisi;
}

export interface InputPenjualan {
  tanggal: string;
  merkModel: string;
  kondisi: Kondisi;
  imei: string;
  hpp: number;
  hargaJual: number;
  metodeBayar: MetodeBayar;
  idSales: string;
  catatan: string;
}

export interface Penjualan extends InputPenjualan {
  id: string;
  periode: string;
  margin: number;
  namaSales: string;
  komisi: number;
}

export interface BarisPayroll {
  id: string;
  periode: string;
  idKaryawan: string;
  nama: string;
  divisi: string;
  jabatan: string;
  gajiPokok: number;
  unitTerjual: number;
  totalKomisi: number;
  potongan: number;
  gajiBersih: number;
  dibuatPada: string;
}

export type RefTipe = 'PENJUALAN' | 'HPP' | 'PAYROLL' | 'BEBAN';

export interface BarisJurnal {
  id: string;
  tanggal: string;
  periode: string;
  refTipe: RefTipe;
  refId: string;
  keterangan: string;
  kodeAkun: string;
  namaAkun: string;
  debet: number;
  kredit: number;
}

export interface InputBeban {
  tanggal: string;
  keterangan: string;
  jumlah: number;
  metodeBayar: MetodeBayar;
}

export interface LabaRugi {
  pendapatanPenjualan: number;
  bebanPokokPenjualan: number;
  labaKotor: number;
  bebanGaji: number;
  bebanKomisi: number;
  bebanLainnya: number;
  totalBebanOperasional: number;
  labaBersih: number;
}

export interface RingkasanSales {
  idSales: string;
  namaSales: string;
  unit: number;
  omset: number;
  margin: number;
  komisi: number;
}

export interface RingkasanHarian {
  tanggal: string;
  omset: number;
  unit: number;
  margin: number;
  perSales: RingkasanSales[];
}

export interface Ringkasan {
  periode: string;
  pengaturan: Pengaturan;
  karyawan: Karyawan[];
  penjualan: Penjualan[];
  payroll: BarisPayroll[];
  jurnal: BarisJurnal[];
}
