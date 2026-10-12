'use client';
import { useMemo, useState } from 'react';
import { api, pesanError } from '@/lib/gas-client';
import { hitungLabaRugi, jurnalSeimbang, ringkasPerSales } from '@/lib/accounting';
import { formatRupiah, formatTanggal, hariIniJakarta, namaPeriode, periodeDari } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { validasiInputBeban } from '@/lib/validasi';
import type { InputBeban } from '@/lib/types';
import { Angka, Catatan, InputTeks, InputUang, Judul, Kartu, Kosong, Memuat, Pilihan, PemilihPeriode, TabelGulir, Tombol, useNotice } from '@/components/ui';

function BarisLR({ label, nilai, indent, tebal, ganda }: { label: string; nilai: number; indent?: boolean; tebal?: boolean; ganda?: boolean }) {
  return (
    <tr className={tebal ? 'font-semibold' : ''}>
      <td className={indent ? 'pl-8' : ''}>{label}</td>
      <td className={`kanan ${ganda ? 'total-ganda' : ''}`}><Angka nilai={nilai} /></td>
    </tr>
  );
}

export default function Laporan() {
  const [periode, setPeriode] = useState(periodeDari(hariIniJakarta()));
  const { data, error, loading, reload } = useAsync(() => api.ringkasan(periode), [periode]);
  const [b, setB] = useState<InputBeban>({ tanggal: hariIniJakarta(), keterangan: '', jumlah: 0, metodeBayar: 'Kas' });
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [proses, setProses] = useState(false);
  const { notice, ok, err, hapus } = useNotice();

  const lr = useMemo(() => (data ? hitungLabaRugi(data.jurnal) : null), [data]);
  const jurnal = useMemo(() => [...(data?.jurnal ?? [])].sort((x, y) => x.tanggal.localeCompare(y.tanggal)), [data]);
  const totalD = jurnal.reduce((s, j) => s + j.debet, 0);
  const totalK = jurnal.reduce((s, j) => s + j.kredit, 0);

  async function simpanBeban(e: React.FormEvent) {
    e.preventDefault(); hapus();
    const v = validasiInputBeban(b);
    if (!v.ok) { setGalat(v.errors); return; }
    setGalat({}); setProses(true);
    try {
      await api.tambahBeban(v.value);
      ok(`Beban "${v.value.keterangan}" ${formatRupiah(v.value.jumlah)} dicatat.`);
      setB({ ...b, keterangan: '', jumlah: 0 });
      if (periodeDari(v.value.tanggal) !== periode) setPeriode(periodeDari(v.value.tanggal)); else reload();
    } catch (x) { err(pesanError(x)); } finally { setProses(false); }
  }

  return (
    <>
      <Judul aksi={<><PemilihPeriode value={periode} onChange={setPeriode} /><Tombol varian="garis" onClick={() => window.print()}>Cetak</Tombol></>}>Laporan {namaPeriode(periode)}</Judul>
      {notice ? <Catatan jenis={notice.jenis}>{notice.teks}</Catatan> : null}
      {error ? <Catatan jenis="error">{error}</Catatan> : null}
      {loading && !data ? <Memuat /> : null}

      {data && lr ? (
        <div className="space-y-6">
          {data.payroll.length === 0 ? <Catatan>Payroll periode ini belum disimpan, sehingga beban gaji dan komisi masih Rp 0 di laba rugi.</Catatan> : null}

          <Kartu judul={`Laporan laba rugi · ${data.pengaturan.namaUsaha}`}>
            <TabelGulir>
              <tbody>
                <BarisLR label="Pendapatan penjualan gadget" nilai={lr.pendapatanPenjualan} tebal />
                <BarisLR label="Beban pokok penjualan (HPP gadget)" nilai={lr.bebanPokokPenjualan} />
                <BarisLR label="Laba kotor penjualan" nilai={lr.labaKotor} tebal />
                <tr><td colSpan={2} className="pt-4 font-semibold">Beban operasional</td></tr>
                <BarisLR label="Beban gaji" nilai={lr.bebanGaji} indent />
                <BarisLR label="Beban komisi sales" nilai={lr.bebanKomisi} indent />
                <BarisLR label="Beban lainnya" nilai={lr.bebanLainnya} indent />
                <BarisLR label="Total beban operasional" nilai={lr.totalBebanOperasional} tebal />
                <BarisLR label="Laba bersih usaha" nilai={lr.labaBersih} tebal ganda />
              </tbody>
            </TabelGulir>
          </Kartu>

          <Kartu judul="Rekap penjualan per sales">
            <TabelGulir>
              <thead><tr><th>Sales</th><th className="kanan">Unit</th><th className="kanan">Omset</th><th className="kanan">Margin kotor</th><th className="kanan">Komisi</th></tr></thead>
              <tbody>{ringkasPerSales(data.penjualan).map(s => <tr key={s.idSales}><td>{s.namaSales}</td><td className="kanan angka">{s.unit}</td><td className="kanan"><Angka nilai={s.omset} /></td><td className="kanan"><Angka nilai={s.margin} /></td><td className="kanan"><Angka nilai={s.komisi} /></td></tr>)}</tbody>
            </TabelGulir>
            {!data.penjualan.length ? <Kosong>Tidak ada penjualan pada periode ini.</Kosong> : null}
          </Kartu>

          <Kartu judul="Jurnal umum" aksi={<span className="text-sm font-semibold">{jurnalSeimbang(data.jurnal) ? 'Seimbang' : 'TIDAK SEIMBANG – periksa data'}</span>}>
            <TabelGulir>
              <thead><tr><th>Tanggal</th><th>Ref</th><th>Akun / keterangan</th><th className="kanan">Debet</th><th className="kanan">Kredit</th></tr></thead>
              <tbody>
                {jurnal.map(j => (
                  <tr key={j.id}>
                    <td className="angka">{formatTanggal(j.tanggal)}</td><td className="angka">{j.refId}</td>
                    <td className={j.kredit > 0 ? 'pl-8' : ''}>{j.kodeAkun} {j.namaAkun}{j.debet > 0 ? <span className="block text-abu-500">{j.keterangan}</span> : null}</td>
                    <td className="kanan angka">{j.debet ? formatRupiah(j.debet) : ''}</td><td className="kanan angka">{j.kredit ? formatRupiah(j.kredit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="kanan angka">{formatRupiah(totalD)}</td><td className="kanan angka total-ganda">{formatRupiah(totalK)}</td></tr></tfoot>
            </TabelGulir>
            {!jurnal.length ? <Kosong>Belum ada jurnal pada periode ini.</Kosong> : null}
          </Kartu>

          <Kartu judul="Catat beban lainnya" className="print:hidden">
            <form onSubmit={simpanBeban} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InputTeks label="Tanggal" type="date" value={b.tanggal} onChange={v => setB({ ...b, tanggal: v })} error={galat.tanggal} />
              <InputTeks label="Keterangan" placeholder="Listrik, sewa, internet…" value={b.keterangan} onChange={v => setB({ ...b, keterangan: v })} error={galat.keterangan} />
              <InputUang label="Jumlah" value={b.jumlah} onChange={v => setB({ ...b, jumlah: v })} error={galat.jumlah} />
              <Pilihan label="Dibayar lewat" value={b.metodeBayar} onChange={v => setB({ ...b, metodeBayar: v as InputBeban['metodeBayar'] })} opsi={[{ nilai: 'Kas', teks: 'Kas' }, { nilai: 'Transfer', teks: 'Transfer bank' }]} />
              <div className="sm:col-span-2 lg:col-span-4"><Tombol type="submit" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan beban'}</Tombol></div>
            </form>
          </Kartu>
        </div>
      ) : null}
    </>
  );
}
