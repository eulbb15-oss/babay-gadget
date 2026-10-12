/** Pembatas percobaan login (in-memory). Best-effort di serverless: state hilang saat instance di-recycle. */
export class PembatasLogin {
  private gagal = new Map<string, { jumlah: number; kunciSampai: number }>();
  constructor(private maks = 5, private masaKunciMs = 15 * 60_000) {}

  terkunci(kunci: string, sekarang = Date.now()): boolean {
    const e = this.gagal.get(kunci);
    if (!e) return false;
    if (e.kunciSampai && e.kunciSampai <= sekarang) { this.gagal.delete(kunci); return false; }
    return e.kunciSampai > sekarang;
  }
  catatGagal(kunci: string, sekarang = Date.now()): void {
    const e = this.gagal.get(kunci) ?? { jumlah: 0, kunciSampai: 0 };
    e.jumlah += 1;
    if (e.jumlah >= this.maks) e.kunciSampai = sekarang + this.masaKunciMs;
    this.gagal.set(kunci, e);
    if (this.gagal.size > 500) this.gagal.delete(this.gagal.keys().next().value as string); // batasi memori
  }
  reset(kunci: string): void { this.gagal.delete(kunci); }
}
