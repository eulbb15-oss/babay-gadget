'use client';
import { useEffect, useState } from 'react';
import { api, pesanError } from '@/lib/gas-client';
import { useAsync } from '@/lib/use-async';
import { validasiPengaturan } from '@/lib/validasi';
import { formatRupiah } from '@/lib/format';
import { hitungKomisi } from '@/lib/accounting';
import type { Pengaturan } from '@/lib/types';
import { Catatan, Field, InputTeks, InputUang, Judul, Kartu, Memuat, Tombol, useNotice } from '@/components/ui';

export default function HalamanPengaturan() {
  const { data, error, loading } = useAsync(() => api.pengaturan(), []);
  const [f, setF] = useState<Pengaturan | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [proses, setProses] = useState(false);
  const { notice, ok, err, hapus } = useNotice();
  useEffect(() => { if (data) setF(data); }, [data]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault(); if (!f) return; hapus();
    const v = validasiPengaturan(f);
    if (!v.ok) { setGalat(v.errors); return; }
    setGalat({}); setProses(true);
    try { setF(await api.simpanPengaturan(v.value)); ok('Pengaturan disimpan. Berlaku untuk transaksi baru; komisi transaksi lama tidak berubah.'); }
    catch (x) { err(pesanError(x)); } finally { setProses(false); }
  }

  return (
    <>
      <Judul>Pengaturan</Judul>
      {notice ? <Catatan jenis={notice.jenis}>{notice.teks}</Catatan> : null}
      {error ? <Catatan jenis="error">{error}</Catatan> : null}
      {loading && !f ? <Memuat /> : null}
      {f ? (
        <form onSubmit={simpan} noValidate className="max-w-2xl space-y-6">
          <Kartu judul="Usaha"><InputTeks label="Nama usaha (tampil di slip gaji & laporan)" value={f.namaUsaha} onChange={v => setF({ ...f, namaUsaha: v })} error={galat.namaUsaha} /></Kartu>
          <Kartu judul="Aturan komisi sales">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Dasar perhitungan per unit terjual</legend>
              {([['FIXED', 'Nominal tetap per unit'], ['PERSEN_MARGIN', 'Persentase dari margin kotor']] as const).map(([nilai, teks]) => (
                <label key={nilai} className="flex items-center gap-3"><input type="radio" name="mode" className="h-5 w-5 accent-black" checked={f.komisi.mode === nilai} onChange={() => setF({ ...f, komisi: { ...f.komisi, mode: nilai } })} />{teks}</label>
              ))}
            </fieldset>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputUang label="Nominal per unit" value={f.komisi.nominalPerUnit} onChange={v => setF({ ...f, komisi: { ...f.komisi, nominalPerUnit: v } })} error={galat.nominalPerUnit} disabled={f.komisi.mode !== 'FIXED'} />
              <InputTeks label="Persen dari margin (%)" type="number" min={0} max={100} step="0.5" value={String(f.komisi.persenMargin)} onChange={v => setF({ ...f, komisi: { ...f.komisi, persenMargin: Number(v) } })} error={galat.persenMargin} disabled={f.komisi.mode !== 'PERSEN_MARGIN'} className="angka" />
            </div>
            <p className="mt-4 text-sm text-abu-500">Contoh: penjualan dengan margin {formatRupiah(800_000)} → komisi <span className="angka font-semibold text-black">{formatRupiah(hitungKomisi(f.komisi, 800_000))}</span>. Penjualan dengan margin nol atau rugi tidak mendapat komisi.</p>
          </Kartu>
          <Tombol type="submit" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan pengaturan'}</Tombol>
        </form>
      ) : null}
    </>
  );
}
