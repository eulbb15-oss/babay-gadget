'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/gas-client';
import { hitungLabaRugi, omsetPerHari, ringkasHarian, ringkasPerSales } from '@/lib/accounting';
import { hariIniJakarta, namaPeriode, periodeDari } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { Angka, Catatan, GrafikBatang, Judul, Kartu, Kosong, Memuat, Metrik, PemilihPeriode, TabelGulir } from '@/components/ui';

export default function Ringkasan() {
  const hariIni = hariIniJakarta();
  const [periode, setPeriode] = useState(periodeDari(hariIni));
  const { data, error, loading, reload } = useAsync(() => api.ringkasan(periode), [periode]);

  const lr = data ? hitungLabaRugi(data.jurnal) : null;
  const unit = data?.penjualan.length ?? 0;
  const margin = data?.penjualan.reduce((s, p) => s + p.margin, 0) ?? 0;
  const harian = data && periode === periodeDari(hariIni) ? ringkasHarian(data.penjualan, hariIni) : null;

  return (
    <>
      <Judul aksi={<PemilihPeriode value={periode} onChange={setPeriode} />}>Ringkasan {namaPeriode(periode)}</Judul>
      {error ? <Catatan jenis="error">{error} <button className="underline" onClick={reload}>Coba lagi</button></Catatan> : null}
      {loading && !data ? <Memuat /> : null}

      {data && lr ? (
        <div className="space-y-6">
          {data.payroll.length === 0 ? (
            <Catatan>Payroll {namaPeriode(periode)} belum dibuat, jadi laba bersih di bawah belum memuat gaji dan komisi. <Link href="/payroll" className="font-semibold underline">Buat payroll</Link></Catatan>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <Metrik gelap label="Laba bersih usaha" nilai={lr.labaBersih} />
            <Metrik label="Omset penjualan" nilai={lr.pendapatanPenjualan} />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <Metrik label="Unit terjual" nilai={unit} tipe="angka" />
              <Metrik label="Margin kotor" nilai={margin} />
            </div>
          </div>

          {harian ? (
            <Kartu judul="Hari ini">
              <dl className="grid grid-cols-3 gap-4">
                <div><dt className="text-sm text-abu-500">Omset</dt><dd className="mt-1 text-lg font-semibold"><Angka nilai={harian.omset} /></dd></div>
                <div><dt className="text-sm text-abu-500">Unit</dt><dd className="mt-1 text-lg font-semibold"><Angka nilai={harian.unit} tipe="angka" /></dd></div>
                <div><dt className="text-sm text-abu-500">Margin kotor</dt><dd className="mt-1 text-lg font-semibold"><Angka nilai={harian.margin} /></dd></div>
              </dl>
            </Kartu>
          ) : null}

          <Kartu judul="Omset per hari"><GrafikBatang data={omsetPerHari(data.penjualan)} /></Kartu>

          <Kartu judul="Kinerja sales">
            <TabelGulir>
              <thead><tr><th>Sales</th><th className="kanan">Unit</th><th className="kanan">Omset</th><th className="kanan">Margin kotor</th><th className="kanan">Komisi</th></tr></thead>
              <tbody>
                {ringkasPerSales(data.penjualan).map(s => (
                  <tr key={s.idSales}><td>{s.namaSales}</td><td className="kanan angka">{s.unit}</td><td className="kanan"><Angka nilai={s.omset} /></td><td className="kanan"><Angka nilai={s.margin} /></td><td className="kanan"><Angka nilai={s.komisi} /></td></tr>
                ))}
              </tbody>
            </TabelGulir>
            {data.penjualan.length === 0 ? <Kosong>Belum ada transaksi. <Link href="/penjualan" className="font-semibold underline">Catat penjualan pertama</Link></Kosong> : null}
          </Kartu>
        </div>
      ) : null}
    </>
  );
}
