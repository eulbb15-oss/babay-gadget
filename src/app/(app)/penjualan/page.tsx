'use client';
import { useMemo, useState } from 'react';
import { api, pesanError } from '@/lib/gas-client';
import { hitungKomisi, hitungMargin, ringkasHarian } from '@/lib/accounting';
import { formatRupiah, hariIniJakarta, periodeDari } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { validasiInputPenjualan } from '@/lib/validasi';
import type { InputPenjualan } from '@/lib/types';
import { Angka, Catatan, InputTeks, InputUang, Judul, Kartu, Kosong, Memuat, Metrik, Pilihan, TabelGulir, Tombol, useNotice } from '@/components/ui';

const kosong = (tanggal: string, idSales = ''): InputPenjualan => ({ tanggal, merkModel: '', kondisi: 'Baru', imei: '', hpp: 0, hargaJual: 0, metodeBayar: 'Kas', idSales, catatan: '' });

export default function Penjualan() {
  const [tglLaporan, setTglLaporan] = useState(hariIniJakarta());
  const { data, error, loading, reload } = useAsync(() => api.ringkasan(periodeDari(tglLaporan)), [tglLaporan]);
  const [f, setF] = useState<InputPenjualan>(() => kosong(hariIniJakarta()));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [proses, setProses] = useState(false);
  const { notice, ok, err, hapus } = useNotice();

  const sales = useMemo(() => (data?.karyawan ?? []).filter(k => k.divisi === 'Sales' && k.aktif), [data]);
  const idSales = f.idSales || sales[0]?.id || '';
  const margin = hitungMargin(f.hargaJual, f.hpp);
  const komisi = data ? hitungKomisi(data.pengaturan.komisi, margin) : 0;
  const harian = data ? ringkasHarian(data.penjualan, tglLaporan) : null;
  const daftar = (data?.penjualan ?? []).filter(p => p.tanggal === tglLaporan);
  const set = <K extends keyof InputPenjualan>(k: K, v: InputPenjualan[K]) => setF(s => ({ ...s, [k]: v }));

  async function simpan(e: React.FormEvent) {
    e.preventDefault(); hapus();
    const v = validasiInputPenjualan({ ...f, idSales });
    if (!v.ok) { setGalat(v.errors); return; }
    setGalat({}); setProses(true);
    try {
      await api.tambahPenjualan(v.value);
      ok(`${v.value.merkModel} (${v.value.imei}) tercatat. Margin ${formatRupiah(margin)}, komisi ${formatRupiah(komisi)}.`);
      setF({ ...kosong(f.tanggal, idSales), metodeBayar: f.metodeBayar });
      setTglLaporan(f.tanggal); reload();
    } catch (x) { err(pesanError(x)); } finally { setProses(false); }
  }

  return (
    <>
      <Judul>Penjualan gadget</Judul>
      {notice ? <Catatan jenis={notice.jenis}>{notice.teks}</Catatan> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Kartu judul="Catat transaksi">
          <form onSubmit={simpan} noValidate className="grid gap-4 sm:grid-cols-2">
            <InputTeks label="Tanggal" type="date" value={f.tanggal} onChange={v => set('tanggal', v)} error={galat.tanggal} />
            <Pilihan label="Sales yang menangani" value={idSales} onChange={v => set('idSales', v)} error={galat.idSales} opsi={sales.length ? sales.map(s => ({ nilai: s.id, teks: s.nama })) : [{ nilai: '', teks: 'Belum ada sales aktif' }]} />
            <div className="sm:col-span-2"><InputTeks label="Merk / model" placeholder="iPhone 13 128GB" value={f.merkModel} onChange={v => set('merkModel', v)} error={galat.merkModel} /></div>
            <Pilihan label="Kondisi" value={f.kondisi} onChange={v => set('kondisi', v as InputPenjualan['kondisi'])} opsi={[{ nilai: 'Baru', teks: 'Baru' }, { nilai: 'Second', teks: 'Second' }]} error={galat.kondisi} />
            <InputTeks label="IMEI / SN" value={f.imei} onChange={v => set('imei', v.replace(/\s/g, ''))} error={galat.imei} className="angka" autoComplete="off" />
            <InputUang label="HPP / harga beli" value={f.hpp} onChange={v => set('hpp', v)} error={galat.hpp} />
            <InputUang label="Harga jual" value={f.hargaJual} onChange={v => set('hargaJual', v)} error={galat.hargaJual} />
            <Pilihan label="Metode bayar" value={f.metodeBayar} onChange={v => set('metodeBayar', v as InputPenjualan['metodeBayar'])} opsi={[{ nilai: 'Kas', teks: 'Kas (tunai)' }, { nilai: 'Transfer', teks: 'Transfer bank' }]} error={galat.metodeBayar} />
            <InputTeks label="Catatan (opsional)" value={f.catatan} onChange={v => set('catatan', v)} error={galat.catatan} />
            <dl className="grid grid-cols-2 gap-px border-2 border-black bg-black sm:col-span-2">
              <div className="bg-abu-100 p-3"><dt className="text-sm text-abu-500">Margin kotor</dt><dd className="angka text-lg font-semibold">{formatRupiah(margin)}</dd></div>
              <div className="bg-abu-100 p-3"><dt className="text-sm text-abu-500">Komisi sales</dt><dd className="angka text-lg font-semibold">{formatRupiah(komisi)}</dd></div>
            </dl>
            <div className="sm:col-span-2"><Tombol type="submit" disabled={proses || !sales.length} className="w-full">{proses ? 'Menyimpan…' : 'Simpan transaksi'}</Tombol></div>
          </form>
        </Kartu>

        <div className="space-y-6">
          <Kartu judul="Laporan harian" aksi={<input aria-label="Tanggal laporan" type="date" value={tglLaporan} onChange={e => e.target.value && setTglLaporan(e.target.value)} className="angka border-2 border-black px-2 py-1 text-sm" />}>
            {error ? <Catatan jenis="error">{error}</Catatan> : null}
            {loading && !data ? <Memuat /> : null}
            {harian ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metrik label="Omset" nilai={harian.omset} />
                  <Metrik label="Unit terjual" nilai={harian.unit} tipe="angka" />
                  <Metrik label="Estimasi margin kotor" nilai={harian.margin} />
                </div>
                <h3 className="mb-2 mt-6 font-semibold">Per sales</h3>
                <TabelGulir>
                  <thead><tr><th>Sales</th><th className="kanan">Unit</th><th className="kanan">Omset</th><th className="kanan">Margin</th><th className="kanan">Komisi</th></tr></thead>
                  <tbody>{harian.perSales.map(s => <tr key={s.idSales}><td>{s.namaSales}</td><td className="kanan angka">{s.unit}</td><td className="kanan"><Angka nilai={s.omset} /></td><td className="kanan"><Angka nilai={s.margin} /></td><td className="kanan"><Angka nilai={s.komisi} /></td></tr>)}</tbody>
                </TabelGulir>
                {!harian.perSales.length ? <Kosong>Tidak ada transaksi pada tanggal ini.</Kosong> : null}
              </>
            ) : null}
          </Kartu>

          <Kartu judul="Rincian transaksi">
            <TabelGulir>
              <thead><tr><th>ID</th><th>Gadget</th><th>IMEI/SN</th><th>Sales</th><th>Bayar</th><th className="kanan">HPP</th><th className="kanan">Harga jual</th><th className="kanan">Margin</th></tr></thead>
              <tbody>
                {daftar.map(p => (
                  <tr key={p.id}>
                    <td className="angka">{p.id}</td><td>{p.merkModel} <span className="text-abu-500">({p.kondisi})</span></td><td className="angka">{p.imei}</td><td>{p.namaSales}</td><td>{p.metodeBayar}</td>
                    <td className="kanan"><Angka nilai={p.hpp} /></td><td className="kanan"><Angka nilai={p.hargaJual} /></td><td className="kanan"><Angka nilai={p.margin} /></td>
                  </tr>
                ))}
              </tbody>
            </TabelGulir>
            {!daftar.length && !loading ? <Kosong>Belum ada transaksi.</Kosong> : null}
          </Kartu>
        </div>
      </div>
    </>
  );
}
