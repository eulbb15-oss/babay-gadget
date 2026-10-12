'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, pesanError } from '@/lib/gas-client';
import { hitungPayroll, ringkasPayroll } from '@/lib/payroll';
import { formatRupiah, hariIniJakarta, namaPeriode, periodeDari } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { Angka, Catatan, InputUang, Judul, Kartu, Memuat, PemilihPeriode, TabelGulir, Tombol, useNotice } from '@/components/ui';
import { SlipGaji } from '@/components/slip-gaji';

export default function Payroll() {
  const [periode, setPeriode] = useState(periodeDari(hariIniJakarta()));
  const { data, error, loading, reload } = useAsync(() => api.ringkasan(periode), [periode]);
  const [potongan, setPotongan] = useState<Record<string, number>>({});
  const [slipId, setSlipId] = useState<string | null>(null);
  const [proses, setProses] = useState(false);
  const { notice, ok, err, hapus } = useNotice();

  useEffect(() => {
    if (data) setPotongan(Object.fromEntries(data.payroll.map(p => [p.idKaryawan, p.potongan])));
  }, [data]);

  const baris = useMemo(() => (data ? hitungPayroll({ karyawan: data.karyawan, penjualan: data.penjualan, periode, potongan }) : []), [data, periode, potongan]);
  const total = ringkasPayroll(baris);
  const tersimpan = data?.payroll ?? [];
  const beda = tersimpan.length > 0 && (tersimpan.length !== baris.length || baris.some(b => tersimpan.find(t => t.idKaryawan === b.idKaryawan)?.gajiBersih !== b.gajiBersih));
  const slip = baris.find(b => b.idKaryawan === slipId);

  async function generate() {
    if (tersimpan.length && !window.confirm(`Payroll ${namaPeriode(periode)} sudah ada. Timpa dengan hitungan terbaru?`)) return;
    hapus(); setProses(true);
    try { await api.generatePayroll(periode, potongan); ok(`Payroll ${namaPeriode(periode)} disimpan dan jurnal beban gaji dibuat.`); reload(); }
    catch (x) { err(pesanError(x)); } finally { setProses(false); }
  }

  return (
    <>
      <Judul aksi={<PemilihPeriode value={periode} onChange={p => { setPeriode(p); setSlipId(null); }} />}>Payroll {namaPeriode(periode)}</Judul>
      {notice ? <Catatan jenis={notice.jenis}>{notice.teks}</Catatan> : null}
      {error ? <Catatan jenis="error">{error}</Catatan> : null}
      {loading && !data ? <Memuat /> : null}

      {data ? (
        <div className="space-y-6">
          {tersimpan.length === 0 ? <Catatan>Payroll periode ini belum disimpan. Angka di bawah masih pratinjau.</Catatan> : null}
          {beda ? <Catatan>Hitungan sekarang berbeda dari payroll yang tersimpan (ada penjualan/gaji/potongan yang berubah). Simpan ulang untuk memperbarui.</Catatan> : null}
          {total.adaNegatif ? <Catatan jenis="error">Ada gaji bersih negatif: potongan melebihi gaji + komisi. Kurangi potongan sebelum menyimpan.</Catatan> : null}

          <Kartu judul="Rekap gaji bulanan" className="print:hidden">
            <TabelGulir>
              <thead><tr><th>Karyawan</th><th>Divisi</th><th className="kanan">Gaji pokok</th><th className="kanan">Unit</th><th className="kanan">Komisi</th><th className="kanan">Potongan / kasbon</th><th className="kanan">Gaji bersih</th><th><span className="sr-only">Slip</span></th></tr></thead>
              <tbody>
                {baris.map(b => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.nama}</td><td>{b.divisi}</td>
                    <td className="kanan"><Angka nilai={b.gajiPokok} /></td><td className="kanan angka">{b.unitTerjual}</td><td className="kanan"><Angka nilai={b.totalKomisi} /></td>
                    <td className="kanan"><div className="ml-auto w-44"><InputUang sembunyikanLabel label={`Potongan ${b.nama}`} value={potongan[b.idKaryawan] ?? 0} onChange={v => setPotongan(s => ({ ...s, [b.idKaryawan]: v }))} /></div></td>
                    <td className={`kanan font-semibold ${b.gajiBersih < 0 ? 'underline decoration-2' : ''}`}><Angka nilai={b.gajiBersih} /></td>
                    <td><Tombol varian="teks" onClick={() => setSlipId(b.idKaryawan)}>Slip</Tombol></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>Total</td><td className="kanan"><Angka nilai={total.gajiPokok} /></td><td className="kanan angka">{total.unitTerjual}</td><td className="kanan"><Angka nilai={total.totalKomisi} /></td><td className="kanan"><Angka nilai={total.potongan} /></td><td className="kanan total-ganda"><Angka nilai={total.gajiBersih} /></td><td /></tr>
              </tfoot>
            </TabelGulir>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Tombol onClick={generate} disabled={proses || total.adaNegatif || !baris.length}>{proses ? 'Menyimpan…' : tersimpan.length ? 'Simpan ulang payroll' : 'Simpan payroll'}</Tombol>
              <p className="text-sm text-abu-500">Komisi diambil dari transaksi penjualan periode ini. Total kas keluar: <span className="angka">{formatRupiah(total.gajiBersih)}</span></p>
            </div>
          </Kartu>

          {slip ? (
            <div>
              <div className="mb-3 flex gap-2 print:hidden">
                <Tombol onClick={() => window.print()}>Cetak slip</Tombol>
                <Tombol varian="garis" onClick={() => setSlipId(null)}>Tutup slip</Tombol>
              </div>
              <SlipGaji namaUsaha={data.pengaturan.namaUsaha} baris={slip} />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
