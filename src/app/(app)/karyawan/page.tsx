'use client';
import { useState } from 'react';
import { api, pesanError } from '@/lib/gas-client';
import { formatRupiah } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { validasiKaryawan } from '@/lib/validasi';
import { DAFTAR_DIVISI, type Divisi, type Karyawan } from '@/lib/types';
import { Catatan, InputTeks, InputUang, Judul, Kartu, Memuat, Pilihan, TabelGulir, Tombol, useNotice } from '@/components/ui';

const baru = (): Karyawan => ({ id: '', nama: '', divisi: 'Sales', jabatan: '', rekening: '', kontak: '', gajiPokok: 0, aktif: true });

export default function HalamanKaryawan() {
  const { data, error, loading, reload } = useAsync(() => api.karyawan(), []);
  const [edit, setEdit] = useState<Karyawan | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [proses, setProses] = useState(false);
  const { notice, ok, err, hapus } = useNotice();
  const ubah = <K extends keyof Karyawan>(k: K, v: Karyawan[K]) => setEdit(s => (s ? { ...s, [k]: v } : s));

  async function simpan(e: React.FormEvent) {
    e.preventDefault(); if (!edit) return; hapus();
    const v = validasiKaryawan(edit);
    if (!v.ok) { setGalat(v.errors); return; }
    setGalat({}); setProses(true);
    try { await api.simpanKaryawan(v.value); ok(`Data ${v.value.nama} disimpan.`); setEdit(null); reload(); }
    catch (x) { err(pesanError(x)); } finally { setProses(false); }
  }

  const aktifCount = data?.filter(k => k.aktif).length ?? 0;
  const totalGaji = data?.filter(k => k.aktif).reduce((s, k) => s + k.gajiPokok, 0) ?? 0;

  return (
    <>
      <Judul aksi={<Tombol onClick={() => { setEdit(baru()); setGalat({}); }}>Tambah karyawan</Tombol>}>Karyawan</Judul>
      {notice ? <Catatan jenis={notice.jenis}>{notice.teks}</Catatan> : null}
      {error ? <Catatan jenis="error">{error}</Catatan> : null}

      {edit ? (
        <Kartu judul={edit.id ? `Ubah ${edit.id}` : 'Karyawan baru'} className="mb-6">
          <form onSubmit={simpan} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputTeks label="Nama" value={edit.nama} onChange={v => ubah('nama', v)} error={galat.nama} />
            <Pilihan label="Divisi" value={edit.divisi} onChange={v => ubah('divisi', v as Divisi)} opsi={DAFTAR_DIVISI.map(d => ({ nilai: d, teks: d }))} error={galat.divisi} />
            <InputTeks label="Jabatan" value={edit.jabatan} onChange={v => ubah('jabatan', v)} error={galat.jabatan} />
            <InputTeks label="Nomor rekening" value={edit.rekening} onChange={v => ubah('rekening', v)} className="angka" inputMode="numeric" />
            <InputTeks label="Kontak (HP/email)" value={edit.kontak} onChange={v => ubah('kontak', v)} />
            <InputUang label="Gaji pokok / bulan" value={edit.gajiPokok} onChange={v => ubah('gajiPokok', v)} error={galat.gajiPokok} />
            <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={edit.aktif} onChange={e => ubah('aktif', e.target.checked)} className="h-5 w-5 accent-black" />Karyawan aktif (ikut payroll)</label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Tombol type="submit" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</Tombol>
              <Tombol type="button" varian="garis" onClick={() => setEdit(null)}>Batal</Tombol>
            </div>
          </form>
        </Kartu>
      ) : null}

      {loading && !data ? <Memuat /> : null}
      {data ? (
        <Kartu judul={`${aktifCount} karyawan aktif · gaji pokok ${formatRupiah(totalGaji)}/bulan`}>
          <TabelGulir>
            <thead><tr><th>ID</th><th>Nama</th><th>Divisi</th><th>Jabatan</th><th>Rekening</th><th>Kontak</th><th className="kanan">Gaji pokok</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              {data.map(k => (
                <tr key={k.id} className={k.aktif ? '' : 'text-abu-500'}>
                  <td className="angka">{k.id}</td><td className="font-medium">{k.nama}</td><td>{k.divisi}</td><td>{k.jabatan}</td><td className="angka">{k.rekening || '–'}</td><td>{k.kontak || '–'}</td>
                  <td className="kanan angka">{formatRupiah(k.gajiPokok)}</td><td>{k.aktif ? 'Aktif' : 'Nonaktif'}</td>
                  <td><Tombol varian="teks" onClick={() => { setEdit(k); setGalat({}); window.scrollTo({ top: 0 }); }} aria-label={`Ubah ${k.nama}`}>Ubah</Tombol></td>
                </tr>
              ))}
            </tbody>
          </TabelGulir>
        </Kartu>
      ) : null}
    </>
  );
}
