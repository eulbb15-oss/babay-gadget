/**
 * Babay Gadget – Backend (Google Apps Script Web App)
 * ----------------------------------------------------
 * Pasang sebagai script TERIKAT pada Google Spreadsheet (Extensions → Apps Script).
 *
 * KEAMANAN
 *  - Web App di-deploy "Anyone" karena dipanggil dari server Vercel tanpa login Google.
 *    Satu-satunya pagar adalah API_SECRET (Script Properties). Tanpa token valid → UNAUTHORIZED.
 *  - Apps Script TIDAK bisa membaca header HTTP kustom, jadi token dikirim sebagai field "token"
 *    (body JSON untuk POST). Jangan pernah memanggil endpoint ini dari browser.
 *  - Secret TIDAK ditulis di kode. Set di: Project Settings → Script properties → API_SECRET (≥ 24 karakter acak).
 *  - Gagal-tertutup: jika API_SECRET belum diset / terlalu pendek, semua request ditolak.
 *  - Semua input divalidasi ulang di sini; margin & komisi dihitung server, bukan dipercaya dari client.
 *
 * SETUP: jalankan fungsi setupSheets() sekali dari editor, lalu Deploy → New deployment → Web app.
 */

var TZ = 'Asia/Jakarta';

var SHEET = {
  KARYAWAN: 'Master_Karyawan',
  PENJUALAN: 'Transaksi_Penjualan',
  PAYROLL: 'Payroll_Bulanan',
  JURNAL: 'Jurnal_Akuntansi',
  SETTINGS: 'Pengaturan_Sistem'
};

var HEADERS = {};
HEADERS[SHEET.KARYAWAN] = ['ID_Karyawan', 'Nama', 'Divisi', 'Jabatan', 'No_Rekening', 'Kontak', 'Gaji_Pokok', 'Status_Aktif'];
HEADERS[SHEET.PENJUALAN] = ['ID_Transaksi', 'Tanggal', 'Periode', 'Merk_Model', 'Kondisi', 'IMEI_SN', 'HPP', 'Harga_Jual', 'Margin_Kotor', 'Metode_Bayar', 'ID_Sales', 'Nama_Sales', 'Komisi', 'Catatan', 'Dibuat_Pada'];
HEADERS[SHEET.PAYROLL] = ['ID_Payroll', 'Periode', 'ID_Karyawan', 'Nama', 'Divisi', 'Jabatan', 'Gaji_Pokok', 'Unit_Terjual', 'Total_Komisi', 'Potongan_Kasbon', 'Gaji_Bersih', 'Dibuat_Pada'];
HEADERS[SHEET.JURNAL] = ['ID_Jurnal', 'Tanggal', 'Periode', 'Ref_Tipe', 'Ref_ID', 'Keterangan', 'Kode_Akun', 'Nama_Akun', 'Debet', 'Kredit'];
HEADERS[SHEET.SETTINGS] = ['Kunci', 'Nilai', 'Keterangan'];

// Kolom yang HARUS berformat teks agar IMEI tidak jadi notasi ilmiah & tanggal tidak berubah jadi objek Date.
var TEXT_COLS = {};
TEXT_COLS[SHEET.KARYAWAN] = [1, 5, 6];
TEXT_COLS[SHEET.PENJUALAN] = [1, 2, 3, 6, 15];
TEXT_COLS[SHEET.PAYROLL] = [1, 2, 3, 12];
TEXT_COLS[SHEET.JURNAL] = [1, 2, 3, 5];

// Bagan akun – harus sama dengan src/lib/akun.ts
var AKUN = {
  KAS: ['1-1100', 'Kas'],
  BANK: ['1-1200', 'Bank'],
  PERSEDIAAN: ['1-1300', 'Persediaan Gadget'],
  PIUTANG_KARYAWAN: ['1-1400', 'Piutang Karyawan (Kasbon)'],
  PENJUALAN: ['4-1000', 'Penjualan Gadget'],
  HPP: ['5-1000', 'Beban Pokok Penjualan (HPP Gadget)'],
  BEBAN_GAJI: ['6-1000', 'Beban Gaji'],
  BEBAN_KOMISI: ['6-1100', 'Beban Komisi Sales'],
  BEBAN_LAIN: ['6-9000', 'Beban Lainnya']
};

var DIVISI = ['Sales', 'Finance', 'Media Sosial', 'E-commerce', 'Marketing'];
var MAKS_UANG = 10000000000;

// ============================================================ ENTRY POINTS

function doGet(e) {
  return route_('GET', (e && e.parameter) || {});
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return respond_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Body harus JSON.' } });
  }
  return route_('POST', body && typeof body === 'object' ? body : {});
}

var READ_ACTIONS = {
  getSummary: getSummary_, getEmployees: getEmployees_, getSales: getSales_,
  getPayroll: getPayroll_, getJournal: getJournal_, getSettings: getSettings_
};
var WRITE_ACTIONS = {
  addSale: addSale_, updateEmployee: updateEmployee_, generatePayroll: generatePayroll_,
  addExpense: addExpense_, updateSettings: updateSettings_
};

function route_(method, req) {
  try {
    if (!authorized_(req.token)) {
      return respond_({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token tidak valid.' } });
    }
    var action = String(req.action || '');
    var params = method === 'GET' ? req : (req.payload && typeof req.payload === 'object' ? req.payload : {});
    // Baca boleh lewat GET/POST (proxy memakai POST agar token tidak masuk URL); tulis hanya POST.
    if (Object.prototype.hasOwnProperty.call(READ_ACTIONS, action)) {
      return respond_({ ok: true, data: READ_ACTIONS[action](params) });
    }
    if (Object.prototype.hasOwnProperty.call(WRITE_ACTIONS, action)) {
      if (method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 'Aksi tulis hanya lewat POST.');
      return respond_({ ok: true, data: withLock_(function () { return WRITE_ACTIONS[action](params); }) });
    }
    throw new ApiError('UNKNOWN_ACTION', 'Aksi tidak dikenal.');
  } catch (err) {
    if (err instanceof ApiError) return respond_({ ok: false, error: { code: err.code, message: err.message } });
    console.error(err && err.stack ? err.stack : String(err)); // jangan bocorkan detail ke client
    return respond_({ ok: false, error: { code: 'SERVER', message: 'Terjadi kesalahan internal.' } });
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ApiError(code, message) { this.code = code; this.message = message; }
ApiError.prototype = Object.create(Error.prototype);

// ============================================================ KEAMANAN

function authorized_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || '';
  if (secret.length < 24 || typeof token !== 'string') return false; // fail closed
  return safeEqual_(token, secret);
}

function safeEqual_(a, b) {
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new ApiError('BUSY', 'Server sedang sibuk, coba lagi sebentar.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ============================================================ UTIL SHEET

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('Script tidak terikat ke Spreadsheet dan SHEET_ID belum diset.');
    ss = SpreadsheetApp.openById(id);
  }
  return ss;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" tidak ada. Jalankan setupSheets().');
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v;
}

/** Baris data (tanpa header) sebagai array-of-array; baris kosong dilewati. */
function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = HEADERS[name].length;
  return sh.getRange(2, 1, last - 1, width).getValues()
    .map(function (r) { return r.map(cell_); })
    .filter(function (r) { return String(r[0]) !== ''; });
}

function appendRows_(name, rows) {
  if (!rows.length) return;
  var sh = sheet_(name);
  var start = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(start, 1, rows.length, HEADERS[name].length).setValues(rows);
}

/** Ganti seluruh isi data: pertahankan baris yang lolos keep(), lalu tambahkan newRows. */
function replaceRows_(name, keep, newRows) {
  var sh = sheet_(name);
  var kept = rows_(name).filter(keep).concat(newRows);
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, HEADERS[name].length).clearContent();
  if (kept.length) sh.getRange(2, 1, kept.length, HEADERS[name].length).setValues(kept);
}

/** Ubah baris dengan kunci (kolom 1) yang sama di tempat; jika belum ada, tambahkan di akhir. */
function upsertRow_(name, row) {
  var all = rows_(name), key = str_(row[0]), done = false;
  var next = all.map(function (r) { if (str_(r[0]) === key) { done = true; return row; } return r; });
  if (!done) next.push(row);
  replaceRows_(name, function () { return false; }, next);
}

function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function str_(v) { return v === null || v === undefined ? '' : String(v); }
function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function isDate_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function isPeriode_(s) { return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function isInt_(v, min) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= MAKS_UANG; }
function fail_(msg) { throw new ApiError('VALIDATION', msg); }

function akhirBulan_(periode) {
  var p = periode.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  return periode + '-' + (d < 10 ? '0' : '') + d;
}

// ============================================================ MAPPER

function mapKaryawan_(r) {
  return { id: str_(r[0]), nama: str_(r[1]), divisi: str_(r[2]), jabatan: str_(r[3]), rekening: str_(r[4]), kontak: str_(r[5]),
    gajiPokok: num_(r[6]), aktif: str_(r[7]).toLowerCase() === 'aktif' };
}
function mapPenjualan_(r) {
  return { id: str_(r[0]), tanggal: str_(r[1]), periode: str_(r[2]), merkModel: str_(r[3]), kondisi: str_(r[4]), imei: str_(r[5]),
    hpp: num_(r[6]), hargaJual: num_(r[7]), margin: num_(r[8]), metodeBayar: str_(r[9]), idSales: str_(r[10]), namaSales: str_(r[11]),
    komisi: num_(r[12]), catatan: str_(r[13]) };
}
function mapPayroll_(r) {
  return { id: str_(r[0]), periode: str_(r[1]), idKaryawan: str_(r[2]), nama: str_(r[3]), divisi: str_(r[4]), jabatan: str_(r[5]),
    gajiPokok: num_(r[6]), unitTerjual: num_(r[7]), totalKomisi: num_(r[8]), potongan: num_(r[9]), gajiBersih: num_(r[10]), dibuatPada: str_(r[11]) };
}
function mapJurnal_(r) {
  return { id: str_(r[0]), tanggal: str_(r[1]), periode: str_(r[2]), refTipe: str_(r[3]), refId: str_(r[4]), keterangan: str_(r[5]),
    kodeAkun: str_(r[6]), namaAkun: str_(r[7]), debet: num_(r[8]), kredit: num_(r[9]) };
}

// ============================================================ PENGATURAN

function getSettings_() {
  var kv = {};
  rows_(SHEET.SETTINGS).forEach(function (r) { kv[str_(r[0])] = r[1]; });
  var mode = str_(kv.KOMISI_MODE);
  return {
    namaUsaha: str_(kv.NAMA_USAHA) || 'Babay Gadget',
    komisi: {
      mode: mode === 'PERSEN_MARGIN' ? 'PERSEN_MARGIN' : 'FIXED',
      nominalPerUnit: kv.KOMISI_NOMINAL_PER_UNIT === undefined ? 50000 : num_(kv.KOMISI_NOMINAL_PER_UNIT),
      persenMargin: kv.KOMISI_PERSEN_MARGIN === undefined ? 10 : num_(kv.KOMISI_PERSEN_MARGIN)
    }
  };
}

function updateSettings_(p) {
  var mode = p && p.komisi && p.komisi.mode;
  if (mode !== 'FIXED' && mode !== 'PERSEN_MARGIN') fail_('Mode komisi tidak dikenal.');
  var nama = str_(p.namaUsaha).trim();
  if (!nama || nama.length > 80) fail_('Nama usaha wajib diisi (maks. 80 karakter).');
  if (!isInt_(p.komisi.nominalPerUnit, 0)) fail_('Nominal komisi harus bilangan bulat ≥ 0.');
  var persen = p.komisi.persenMargin;
  if (typeof persen !== 'number' || !isFinite(persen) || persen < 0 || persen > 100) fail_('Persen komisi harus 0–100.');
  var pairs = [['NAMA_USAHA', nama, 'Nama usaha'], ['KOMISI_MODE', mode, 'FIXED atau PERSEN_MARGIN'],
    ['KOMISI_NOMINAL_PER_UNIT', p.komisi.nominalPerUnit, 'Rupiah per unit (mode FIXED)'],
    ['KOMISI_PERSEN_MARGIN', persen, 'Persen dari margin kotor (mode PERSEN_MARGIN)']];
  pairs.forEach(function (x) { upsertRow_(SHEET.SETTINGS, x); });
  return getSettings_();
}

// ============================================================ PERHITUNGAN (cermin src/lib/accounting.ts)

function hitungKomisi_(aturan, margin) {
  if (margin <= 0) return 0;
  if (aturan.mode === 'FIXED') return Math.max(0, Math.round(aturan.nominalPerUnit));
  return Math.max(0, Math.round(margin * aturan.persenMargin / 100));
}

function jurnalRow_(id, tgl, periode, tipe, refId, ket, akun, debet, kredit) {
  return [id, tgl, periode, tipe, refId, ket, akun[0], akun[1], debet, kredit];
}

function jurnalPenjualan_(s) {
  var kas = s.metodeBayar === 'Transfer' ? AKUN.BANK : AKUN.KAS;
  var jual = 'Penjualan ' + s.merkModel, pokok = 'HPP ' + s.merkModel;
  return [
    jurnalRow_(s.id + '-J1', s.tanggal, s.periode, 'PENJUALAN', s.id, jual, kas, s.hargaJual, 0),
    jurnalRow_(s.id + '-J2', s.tanggal, s.periode, 'PENJUALAN', s.id, jual, AKUN.PENJUALAN, 0, s.hargaJual),
    jurnalRow_(s.id + '-J3', s.tanggal, s.periode, 'HPP', s.id, pokok, AKUN.HPP, s.hpp, 0),
    jurnalRow_(s.id + '-J4', s.tanggal, s.periode, 'HPP', s.id, pokok, AKUN.PERSEDIAAN, 0, s.hpp)
  ];
}

function seimbang_(rows) {
  var d = 0, k = 0;
  rows.forEach(function (r) { d += r[8]; k += r[9]; });
  if (d !== k) throw new Error('Jurnal tidak seimbang: debet ' + d + ' ≠ kredit ' + k);
}

function nextSeq_(prefix, ids) {
  var max = 0;
  ids.forEach(function (id) {
    if (id.indexOf(prefix) === 0) { var n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n; }
  });
  return prefix + ('00' + (max + 1)).slice(-3);
}

// ============================================================ READ

function getEmployees_() { return rows_(SHEET.KARYAWAN).map(mapKaryawan_); }

function getSales_(p) {
  var list = rows_(SHEET.PENJUALAN).map(mapPenjualan_);
  if (p.periode !== undefined) {
    if (!isPeriode_(p.periode)) fail_('Periode tidak valid (YYYY-MM).');
    return list.filter(function (x) { return x.periode === p.periode; });
  }
  if (p.from !== undefined || p.to !== undefined) {
    if (!isDate_(p.from) || !isDate_(p.to)) fail_('Parameter from/to harus YYYY-MM-DD.');
    return list.filter(function (x) { return x.tanggal >= p.from && x.tanggal <= p.to; });
  }
  return list;
}

function getPayroll_(p) {
  var list = rows_(SHEET.PAYROLL).map(mapPayroll_);
  if (p.periode === undefined) return list;
  if (!isPeriode_(p.periode)) fail_('Periode tidak valid (YYYY-MM).');
  return list.filter(function (x) { return x.periode === p.periode; });
}

function getJournal_(p) {
  var list = rows_(SHEET.JURNAL).map(mapJurnal_);
  if (p.periode === undefined) return list;
  if (!isPeriode_(p.periode)) fail_('Periode tidak valid (YYYY-MM).');
  return list.filter(function (x) { return x.periode === p.periode; });
}

function getSummary_(p) {
  var periode = p.periode === undefined ? today_().slice(0, 7) : p.periode;
  if (!isPeriode_(periode)) fail_('Periode tidak valid (YYYY-MM).');
  return {
    periode: periode,
    pengaturan: getSettings_(),
    karyawan: getEmployees_(),
    penjualan: getSales_({ periode: periode }),
    payroll: getPayroll_({ periode: periode }),
    jurnal: getJournal_({ periode: periode })
  };
}

// ============================================================ WRITE

function addSale_(p) {
  var tanggal = p.tanggal, merk = str_(p.merkModel).trim(), imei = str_(p.imei).trim();
  if (!isDate_(tanggal)) fail_('Tanggal tidak valid.');
  if (!merk || merk.length > 120) fail_('Merk/model wajib diisi (maks. 120 karakter).');
  if (p.kondisi !== 'Baru' && p.kondisi !== 'Second') fail_('Kondisi harus Baru atau Second.');
  if (!/^[A-Za-z0-9]{5,30}$/.test(imei)) fail_('IMEI/SN wajib, 5–30 huruf/angka tanpa spasi atau simbol.');
  if (!isInt_(p.hpp, 0)) fail_('HPP harus bilangan bulat Rupiah ≥ 0.');
  if (!isInt_(p.hargaJual, 1)) fail_('Harga jual harus bilangan bulat Rupiah > 0.');
  if (p.metodeBayar !== 'Kas' && p.metodeBayar !== 'Transfer') fail_('Metode bayar harus Kas atau Transfer.');
  var catatan = str_(p.catatan).trim();
  if (catatan.length > 300) fail_('Catatan maks. 300 karakter.');

  var sales = getEmployees_().filter(function (k) { return k.id === p.idSales; })[0];
  if (!sales || sales.divisi !== 'Sales' || !sales.aktif) fail_('Sales tidak ditemukan atau tidak aktif.');

  var existing = rows_(SHEET.PENJUALAN);
  if (existing.some(function (r) { return str_(r[5]) === imei && str_(r[1]) === tanggal; })) {
    throw new ApiError('DUPLICATE', 'IMEI/SN ini sudah dicatat pada tanggal yang sama.');
  }

  var tgl8 = tanggal.replace(/-/g, '');
  var id = nextSeq_('TRX-' + tgl8 + '-', existing.map(function (r) { return str_(r[0]); }));
  var margin = p.hargaJual - p.hpp;
  var komisi = hitungKomisi_(getSettings_().komisi, margin);
  var periode = tanggal.slice(0, 7);

  var sale = { id: id, tanggal: tanggal, periode: periode, merkModel: merk, kondisi: p.kondisi, imei: imei, hpp: p.hpp, hargaJual: p.hargaJual,
    margin: margin, metodeBayar: p.metodeBayar, idSales: sales.id, namaSales: sales.nama, komisi: komisi, catatan: catatan };
  var jurnal = jurnalPenjualan_(sale);
  seimbang_(jurnal);

  appendRows_(SHEET.PENJUALAN, [[id, tanggal, periode, merk, p.kondisi, imei, p.hpp, p.hargaJual, margin, p.metodeBayar, sales.id, sales.nama, komisi, catatan, nowIso_()]]);
  appendRows_(SHEET.JURNAL, jurnal);
  return { sale: sale, jurnal: jurnal.map(mapJurnal_) };
}

function updateEmployee_(p) {
  var nama = str_(p.nama).trim(), jabatan = str_(p.jabatan).trim();
  if (!nama || nama.length > 80) fail_('Nama wajib diisi (maks. 80 karakter).');
  if (DIVISI.indexOf(p.divisi) < 0) fail_('Divisi tidak dikenal.');
  if (!jabatan || jabatan.length > 80) fail_('Jabatan wajib diisi.');
  if (!isInt_(p.gajiPokok, 0)) fail_('Gaji pokok harus bilangan bulat Rupiah ≥ 0.');
  if (typeof p.aktif !== 'boolean') fail_('Status aktif tidak valid.');
  var rekening = str_(p.rekening).trim(), kontak = str_(p.kontak).trim();
  if (rekening.length > 60 || kontak.length > 60) fail_('Rekening/kontak maks. 60 karakter.');

  var all = rows_(SHEET.KARYAWAN);
  var id = str_(p.id).trim();
  var isNew = !id;
  if (isNew) {
    id = nextSeq_('EMP-', all.map(function (r) { return str_(r[0]); }));
  } else if (!all.some(function (r) { return str_(r[0]) === id; })) {
    throw new ApiError('NOT_FOUND', 'Karyawan tidak ditemukan.');
  }
  var row = [id, nama, p.divisi, jabatan, rekening, kontak, p.gajiPokok, p.aktif ? 'Aktif' : 'Nonaktif'];
  upsertRow_(SHEET.KARYAWAN, row);
  return mapKaryawan_(row);
}

function generatePayroll_(p) {
  if (!isPeriode_(p.periode)) fail_('Periode tidak valid (YYYY-MM).');
  var periode = p.periode;
  var potongan = p.potongan && typeof p.potongan === 'object' ? p.potongan : {};
  var aktif = getEmployees_().filter(function (k) { return k.aktif; });
  var ids = aktif.map(function (k) { return k.id; });
  Object.keys(potongan).forEach(function (id) {
    if (ids.indexOf(id) < 0) fail_('Potongan untuk karyawan yang tidak aktif/tidak ada: ' + id);
    if (!isInt_(potongan[id], 0)) fail_('Potongan harus bilangan bulat Rupiah ≥ 0 (' + id + ').');
  });

  var sales = getSales_({ periode: periode });
  var kode = periode.replace('-', ''), ts = nowIso_();
  var out = [], tot = { pokok: 0, komisi: 0, bersih: 0, potong: 0 };
  aktif.forEach(function (k) {
    var jual = sales.filter(function (s) { return s.idSales === k.id; });
    var komisi = jual.reduce(function (a, s) { return a + s.komisi; }, 0);
    var pot = potongan[k.id] || 0;
    var bersih = k.gajiPokok + komisi - pot;
    if (bersih < 0) fail_('Gaji bersih ' + k.nama + ' negatif. Potongan melebihi gaji + komisi.');
    out.push(['PAY-' + kode + '-' + k.id, periode, k.id, k.nama, k.divisi, k.jabatan, k.gajiPokok, jual.length, komisi, pot, bersih, ts]);
    tot.pokok += k.gajiPokok; tot.komisi += komisi; tot.bersih += bersih; tot.potong += pot;
  });
  if (!out.length) fail_('Tidak ada karyawan aktif.');

  var tgl = akhirBulan_(periode), ref = 'PAY-' + kode, ket = 'Payroll ' + periode;
  var garis = [[AKUN.BEBAN_GAJI, tot.pokok, 0], [AKUN.BEBAN_KOMISI, tot.komisi, 0], [AKUN.KAS, 0, tot.bersih], [AKUN.PIUTANG_KARYAWAN, 0, tot.potong]]
    .filter(function (g) { return g[1] !== 0 || g[2] !== 0; });
  var jurnal = garis.map(function (g, i) { return jurnalRow_(ref + '-J' + (i + 1), tgl, periode, 'PAYROLL', ref, ket, g[0], g[1], g[2]); });
  seimbang_(jurnal);

  // Idempoten: generate ulang menimpa payroll & jurnal payroll periode yang sama.
  replaceRows_(SHEET.PAYROLL, function (r) { return str_(r[1]) !== periode; }, out);
  replaceRows_(SHEET.JURNAL, function (r) { return !(str_(r[3]) === 'PAYROLL' && str_(r[2]) === periode); }, jurnal);
  return { payroll: out.map(mapPayroll_), jurnal: jurnal.map(mapJurnal_) };
}

function addExpense_(p) {
  if (!isDate_(p.tanggal)) fail_('Tanggal tidak valid.');
  var ket = str_(p.keterangan).trim();
  if (!ket || ket.length > 150) fail_('Keterangan wajib diisi (maks. 150 karakter).');
  if (!isInt_(p.jumlah, 1)) fail_('Jumlah harus bilangan bulat Rupiah > 0.');
  if (p.metodeBayar !== 'Kas' && p.metodeBayar !== 'Transfer') fail_('Metode bayar harus Kas atau Transfer.');
  var periode = p.tanggal.slice(0, 7);
  var refs = rows_(SHEET.JURNAL).map(function (r) { return str_(r[4]); });
  var id = nextSeq_('BBN-' + p.tanggal.replace(/-/g, '') + '-', refs);
  var kas = p.metodeBayar === 'Transfer' ? AKUN.BANK : AKUN.KAS;
  var jurnal = [
    jurnalRow_(id + '-J1', p.tanggal, periode, 'BEBAN', id, ket, AKUN.BEBAN_LAIN, p.jumlah, 0),
    jurnalRow_(id + '-J2', p.tanggal, periode, 'BEBAN', id, ket, kas, 0, p.jumlah)
  ];
  seimbang_(jurnal);
  appendRows_(SHEET.JURNAL, jurnal);
  return { jurnal: jurnal.map(mapJurnal_) };
}

// ============================================================ SETUP (jalankan manual sekali)

function setupSheets() {
  var ss = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var h = HEADERS[name];
    (TEXT_COLS[name] || []).forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });

  if (!rows_(SHEET.SETTINGS).length) {
    appendRows_(SHEET.SETTINGS, [
      ['NAMA_USAHA', 'Babay Gadget', 'Nama usaha'],
      ['KOMISI_MODE', 'FIXED', 'FIXED atau PERSEN_MARGIN'],
      ['KOMISI_NOMINAL_PER_UNIT', 50000, 'Rupiah per unit (mode FIXED)'],
      ['KOMISI_PERSEN_MARGIN', 10, 'Persen dari margin kotor (mode PERSEN_MARGIN)']
    ]);
  }

  if (!rows_(SHEET.KARYAWAN).length) {
    // DATA CONTOH – ganti nama & gaji lewat menu Karyawan di aplikasi.
    appendRows_(SHEET.KARYAWAN, [
      ['EMP-001', 'Sales 1', 'Sales', 'Sales Executive', '', '', 2500000, 'Aktif'],
      ['EMP-002', 'Sales 2', 'Sales', 'Sales Executive', '', '', 2500000, 'Aktif'],
      ['EMP-003', 'Sales 3', 'Sales', 'Sales Executive', '', '', 2500000, 'Aktif'],
      ['EMP-004', 'Finance 1', 'Finance', 'Staf Keuangan', '', '', 3500000, 'Aktif'],
      ['EMP-005', 'Media Sosial 1', 'Media Sosial', 'Content Creator', '', '', 3000000, 'Aktif'],
      ['EMP-006', 'Media Sosial 2', 'Media Sosial', 'Content Creator', '', '', 3000000, 'Aktif'],
      ['EMP-007', 'E-commerce 1', 'E-commerce', 'Admin Marketplace', '', '', 3000000, 'Aktif'],
      ['EMP-008', 'E-commerce 2', 'E-commerce', 'Admin Marketplace', '', '', 3000000, 'Aktif'],
      ['EMP-009', 'Marketing 1', 'Marketing', 'Staf Marketing', '', '', 3000000, 'Aktif'],
      ['EMP-010', 'Marketing 2', 'Marketing', 'Staf Marketing', '', '', 3000000, 'Aktif']
    ]);
  }

  var secret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || '';
  console.log(secret.length >= 24
    ? 'Setup selesai. API_SECRET sudah terpasang.'
    : 'Setup selesai, TETAPI API_SECRET belum diset / < 24 karakter. Semua request akan ditolak sampai diset.');
}
