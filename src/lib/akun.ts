/** Bagan akun sederhana. Harus sama dengan konstanta AKUN di gas/Code.gs. */
export const AKUN = {
  KAS: { kode: '1-1100', nama: 'Kas' },
  BANK: { kode: '1-1200', nama: 'Bank' },
  PERSEDIAAN: { kode: '1-1300', nama: 'Persediaan Gadget' },
  PIUTANG_KARYAWAN: { kode: '1-1400', nama: 'Piutang Karyawan (Kasbon)' },
  PENJUALAN: { kode: '4-1000', nama: 'Penjualan Gadget' },
  HPP: { kode: '5-1000', nama: 'Beban Pokok Penjualan (HPP Gadget)' },
  BEBAN_GAJI: { kode: '6-1000', nama: 'Beban Gaji' },
  BEBAN_KOMISI: { kode: '6-1100', nama: 'Beban Komisi Sales' },
  BEBAN_LAIN: { kode: '6-9000', nama: 'Beban Lainnya' },
} as const;
