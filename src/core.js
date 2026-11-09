'use strict';
/* =====================================================================
   BLUE CARBON FIELD APP — CORE
   Semua isi aplikasi (form, spesies, aturan validasi, kode sampel)
   berasal dari METADATA (blok <script id="app-metadata">).
   Pengembang cukup mengubah metadata; kode di bawah ini adalah mesin
   generik yang membaca metadata tersebut.
   ===================================================================== */
const EMBEDDED_META = JSON.parse(document.getElementById('app-metadata').textContent);
let META = EMBEDDED_META;
let META_SOURCE = 'tertanam';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
const nowISO = () => new Date().toISOString();
const clone = o => JSON.parse(JSON.stringify(o));
const isEmpty = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const pad = (n, w) => String(n).padStart(w, '0');
const fmtNum = (v, d = 2) => v == null ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d });
const fmtDT = iso => { if (!iso) return '–'; const d = new Date(iso); if (isNaN(d)) return esc(iso); return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const fmtD = iso => { if (!iso) return '–'; const d = new Date(iso.length === 10 ? iso + 'T00:00' : iso); return isNaN(d) ? esc(iso) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
const localDT = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
const today = () => localDT().slice(0, 10);

/* ---------- metadata lookups ---------- */
const ecoList = (all = false) => META.ecosystems.filter(e => all || e.enabled);
const ecoBy = code => META.ecosystems.find(e => e.code === code);
const listOptions = name => {
  if (name === 'labStatus') return META.labStatus.map(s => ({ value: s.code, label: s.label }));
  return (META.lists[name] || []).map(v => typeof v === 'object' ? v : ({ value: v, label: v }));
};
const fieldOptions = f => f.optionsFrom ? listOptions(f.optionsFrom) : (f.options || []).map(o => typeof o === 'object' ? o : ({ value: o, label: o }));
const optLabel = (f, v) => { const o = fieldOptions(f).find(o => String(o.value) === String(v)); return o ? o.label : v; };
const photoCatLabel = c => (META.photoCategories.find(p => p.code === c) || {}).label || c;
const labLabel = c => (META.labStatus.find(s => s.code === c) || {}).label || c || '–';
const labIndex = c => META.labStatus.findIndex(s => s.code === c);

/* Spesifikasi (fields + rules) untuk setiap record */
function specFor(rec, part) {
  if (!rec) return { fields: [], rules: [] };
  if (rec.type === 'survey') return META.surveyForm;
  const eco = ecoBy(rec.data.ecosystem);
  if (!eco) return { fields: [], rules: [] };
  if (rec.type === 'observation') return eco.observation;
  if (rec.type === 'sample') {
    const st = eco.sampleTypes.find(s => s.code === rec.data.sampleType);
    if (!st) return { fields: [], rules: [] };
    if (part === 'field') return { fields: st.fields, rules: st.rules };
    if (part === 'lab') return { fields: st.labFields || [], rules: st.rules };
    return { fields: st.fields.concat(st.labFields || []), rules: st.rules, carbon: st.carbon, label: st.label };
  }
  return { fields: [], rules: [] };
}
const sampleTypeOf = rec => { const e = ecoBy(rec.data.ecosystem); return e && e.sampleTypes.find(s => s.code === rec.data.sampleType); };

/* =====================================================================
   PENYIMPANAN LOKAL (IndexedDB, cadangan: memori)
   ===================================================================== */
const Store = {
  idb: null, mem: new Map(), persistent: false,
  async init() {
    try {
      this.idb = await new Promise((res, rej) => {
        const r = indexedDB.open('bcfa', 1);
        r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('records', { keyPath: 'id' }); d.createObjectStore('kv'); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
      const all = await this._req(this._os('records').getAll());
      (all || []).forEach(r => this.mem.set(r.id, r));
      this.persistent = true;
    } catch (e) { this.idb = null; this.persistent = false; }
  },
  _os(name, mode = 'readonly') { return this.idb.transaction(name, mode).objectStore(name); },
  _req(q) { return new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  all(type) { const a = [...this.mem.values()]; return type ? a.filter(r => r.type === type) : a; },
  get(id) { return this.mem.get(id); },
  async put(rec) {
    this.mem.set(rec.id, rec);
    if (this.idb) { try { await this._req(this._os('records', 'readwrite').put(rec)); } catch (e) { toast('Gagal menyimpan ke perangkat: ' + e.message, 'err'); } }
  },
  async del(id) {
    this.mem.delete(id);
    if (this.idb) { try { await this._req(this._os('records', 'readwrite').delete(id)); } catch (e) { } }
  },
  async kvGet(k) { if (!this.idb) return this['kv_' + k]; try { return await this._req(this._os('kv').get(k)); } catch (e) { return undefined; } },
  async kvSet(k, v) { if (!this.idb) { this['kv_' + k] = v; return; } try { await this._req(this._os('kv', 'readwrite').put(v, k)); } catch (e) { } }
};

/* ---------- pengaturan perangkat ---------- */
const Settings = {
  v: { userName: '', deviceId: '' },
  async load() { const s = await Store.kvGet('settings'); if (s) Object.assign(this.v, s); if (!this.v.deviceId) { this.v.deviceId = 'DEV-' + uuid().slice(0, 8).toUpperCase(); await this.save(); } },
  async save() { await Store.kvSet('settings', clone(this.v)); }
};
const userName = () => Settings.v.userName || 'Petugas lapangan';

/* =====================================================================
   RECORD + METADATA (envelope) + RIWAYAT PERUBAHAN
   Setiap data disimpan bersama metadata: siapa, kapan, perangkat,
   versi aplikasi & metadata, koordinat, status sinkron, hash integritas,
   dan riwayat perubahan per kolom.
   ===================================================================== */
async function sha256(str) {
  try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return 'fnv' + (h >>> 0).toString(16); }
}
function newRecord(type, data, parentId, id) {
  const at = nowISO();
  return {
    id: id || uuid(), type, parentId: parentId || null, data: data || {},
    meta: {
      createdAt: at, createdBy: userName(), updatedAt: at, updatedBy: userName(),
      deviceId: Settings.v.deviceId, appVersion: META.app.version, metadataVersion: META.app.metadataVersion,
      rev: 1, syncStatus: 'pending', syncedAt: null, gps: null, hash: null, userAgent: navigator.userAgent.slice(0, 120)
    },
    history: [{ rev: 1, at, by: userName(), device: Settings.v.deviceId, action: 'dibuat' }]
  };
}
function diffData(a, b) {
  const ch = {}; const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) { if (k === 'dataUrl' || k === 'thumb') continue; const x = JSON.stringify(a?.[k] ?? null), y = JSON.stringify(b?.[k] ?? null); if (x !== y) ch[k] = [a?.[k] ?? null, b?.[k] ?? null]; }
  return ch;
}
async function saveRecord(rec, newData, action = 'diubah') {
  if (newData) {
    const changes = diffData(rec.data, newData);
    if (!Object.keys(changes).length && action !== 'dibuat') return rec;
    rec.data = newData;
    if (action !== 'dibuat') {
      rec.meta.rev += 1;
      rec.history.push({ rev: rec.meta.rev, at: nowISO(), by: userName(), device: Settings.v.deviceId, action, changes: trimChanges(changes) });
    }
  }
  rec.meta.updatedAt = nowISO(); rec.meta.updatedBy = userName();
  rec.meta.metadataVersion = META.app.metadataVersion; rec.meta.appVersion = META.app.version;
  rec.meta.syncStatus = 'pending';
  const g = rec.data.gps; rec.meta.gps = g && g.lat != null ? g : rec.meta.gps;
  rec.meta.hash = await sha256(JSON.stringify(rec.data));
  await Store.put(rec);
  App.onDataChanged();
  return rec;
}
function trimChanges(ch) { const o = {}; for (const k in ch) o[k] = ch[k].map(v => { const s = JSON.stringify(v); return s && s.length > 400 ? '[data panjang]' : v; }); return o; }

/* ---------- kode sampel ---------- */
function buildCode(eco, site, year, typeCode, seq) {
  return META.sampleCode.pattern.replace('{ECO}', eco).replace('{YEAR}', year).replace('{SITE}', site).replace('{TYPE}', typeCode || '').replace('{SEQ}', pad(seq, META.sampleCode.seqPad)).replace(/--+/g, '-');
}
function nextSampleCode(eco, site, year, typeCode) {
  const prefix = buildCode(eco, site, year, typeCode, 0).replace(/0+$/, '');
  let max = 0;
  Store.all('sample').forEach(s => { const c = s.data.sampleCode || ''; if (c.startsWith(prefix)) { const n = parseInt(c.slice(prefix.length), 10); if (!isNaN(n)) max = Math.max(max, n); } });
  return buildCode(eco, site, year, typeCode, max + 1);
}
const qrPayload = code => META.app.publicUrl ? `${META.app.publicUrl.replace(/#.*$/, '')}#sample-${code}` : `${META.sampleCode.qrPrefix}:${code}`;
function parseQr(text) {
  if (!text) return null; text = text.trim();
  let m = text.match(/#sample-([A-Za-z0-9-]+)/); if (m) return m[1].toUpperCase();
  m = text.match(new RegExp('^' + META.sampleCode.qrPrefix + ':([A-Za-z0-9-]+)', 'i')); if (m) return m[1].toUpperCase();
  if (/^[A-Za-z0-9-]{6,}$/.test(text)) return text.toUpperCase();
  return null;
}

/* =====================================================================
   KALKULASI (formula yang dipakai field "computed" di metadata)
   Tambah formula baru di sini, lalu rujuk namanya dari metadata.
   ===================================================================== */
const COMPUTE = {
  compaction(d) { const p = num(d.penetrationDepth), r = num(d.recoveredLength); if (!p || r == null) return null; return { value: (1 - r / p) * 100, unit: '%', text: `${fmtNum((1 - r / p) * 100, 1)} %` }; },
  thickness(d) { const t = num(d.depthTop), b = num(d.depthBottom); if (t == null || b == null) return null; return { value: b - t, unit: 'cm', text: `${fmtNum(b - t, 1)} cm` }; },
  /* Stok karbon sedimen per interval: BD (g/cm³) × tebal (cm) × Corg (%) = Mg C/ha */
  soilCarbon(d) {
    const bd = num(d.bulkDensity), c = num(d.corgPercent), t = num(d.depthTop), b = num(d.depthBottom);
    if (bd == null || c == null || t == null || b == null || b <= t) return null;
    const mgc = bd * (b - t) * c; return { value: mgc, unit: 'Mg C/ha', co2e: mgc * 44 / 12, text: `${fmtNum(mgc, 2)} Mg C/ha · ${fmtNum(mgc * 44 / 12, 2)} Mg CO₂e/ha` };
  },
  /* Karbon biomassa: berat kering (g) / luas (m²) × fraksi C × 0,01 = Mg C/ha */
  biomassCarbon(d) {
    const w = num(d.dryWeight), a = num(d.quadratArea), cf = num(d.carbonFraction);
    if (w == null || !a || cf == null) return null;
    const mgc = (w / a) * (cf / 100) * 0.01; return { value: mgc, unit: 'Mg C/ha', co2e: mgc * 44 / 12, text: `${fmtNum(mgc, 3)} Mg C/ha · ${fmtNum(mgc * 44 / 12, 3)} Mg CO₂e/ha` };
  }
};

/* =====================================================================
   MESIN VALIDASI
   Jenis aturan yang tersedia untuk metadata:
   compare, sumCompare, minRows, rowRule, requiredWhen, gpsPresent,
   gpsInBounds, gpsAccuracy, photoMin, notFuture.
   Setiap aturan boleh punya "when" (field, equals | in | gt | lt).
   ===================================================================== */
const OPS = {
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
  '==': (a, b) => a == b, '!=': (a, b) => a != b
};
const cmpVal = v => (v !== '' && v != null && !isNaN(+v)) ? +v : v;
function whenOk(when, d) {
  if (!when) return true;
  const v = d[when.field];
  if ('equals' in when) return String(v) === String(when.equals);
  if (when.in) return when.in.includes(v);
  if ('gt' in when) return num(v) != null && num(v) > when.gt;
  if ('lt' in when) return num(v) != null && num(v) < when.lt;
  return true;
}
const fill = (msg, vars) => String(msg || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const photosOf = id => Store.all('photo').filter(p => p.parentId === id);

const RULES = {
  compare(r, d) {
    const a = cmpVal(d[r.a]); const b = 'value' in r ? r.value : cmpVal(d[r.b]);
    if (isEmpty(a) || isEmpty(b)) return null;
    return OPS[r.op](a, b) ? null : { value: a, target: b };
  },
  sumCompare(r, d) {
    const rows = d[r.table] || []; if (!rows.length) return null;
    const sum = rows.reduce((s, x) => s + (num(x[r.column]) || 0), 0);
    const target = 'value' in r ? r.value : num(d[r.field]); if (target == null) return null;
    const ok = r.op === 'approx' ? Math.abs(sum - target) <= (r.tolerance || 0) : OPS[r.op](sum, target);
    return ok ? null : { sum: fmtNum(sum, 1), target: fmtNum(target, 1) };
  },
  minRows(r, d) { const n = (d[r.table] || []).length; return n >= r.min ? null : { count: n }; },
  rowRule(r, d) {
    const bad = [];
    (d[r.table] || []).forEach((row, i) => {
      const w = r.when; if (w) { const v = row[w.column]; if ('equals' in w && String(v) !== String(w.equals)) return; if (w.in && !w.in.includes(v)) return; }
      const v = row[r.column];
      if (r.op === 'present') { if (isEmpty(v)) bad.push(i + 1); return; }
      if (isEmpty(v)) return;
      if (!OPS[r.op](cmpVal(v), r.value)) bad.push(i + 1);
    });
    return bad.length ? { rows: bad.join(', ') } : null;
  },
  requiredWhen(r, d) { return isEmpty(d[r.field]) ? { status: labLabel(d[r.when?.field]) } : null; },
  gpsPresent(r, d) { const g = d[r.field]; return g && g.lat != null && g.lon != null ? null : {}; },
  gpsInBounds(r, d) {
    const g = d[r.field]; if (!g || g.lat == null) return null; const b = META.gps.bounds;
    return (g.lat >= b.latMin && g.lat <= b.latMax && g.lon >= b.lonMin && g.lon <= b.lonMax) ? null : { bounds: META.gps.boundsLabel };
  },
  gpsAccuracy(r, d) { const g = d[r.field]; if (!g || g.acc == null) return null; return g.acc <= r.max ? null : { value: fmtNum(g.acc, 0), max: r.max }; },
  photoMin(r, d, rec) { const n = photosOf(rec.id).filter(p => !r.category || p.data.category === r.category).length; return n >= r.min ? null : { count: n }; },
  notFuture(r, d) { const v = d[r.field]; if (!v) return null; return new Date(v).getTime() > Date.now() + 5 * 60000 ? {} : null; }
};

function validateFields(fields, d, issues) {
  for (const f of fields) {
    const v = d[f.key];
    if (f.type === 'computed' || f.type === 'photos') continue;
    if (f.required) {
      const empty = f.type === 'gps' ? !(v && v.lat != null) : isEmpty(v);
      if (empty && f.type !== 'gps') issues.push({ level: 'error', field: f.key, msg: `${f.label} wajib diisi.` });
    }
    if (isEmpty(v)) continue;
    if (f.type === 'number') {
      const n = num(v);
      if (n == null) issues.push({ level: 'error', field: f.key, msg: `${f.label} harus berupa angka.` });
      else if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) issues.push({ level: 'error', field: f.key, msg: `${f.label} ${fmtNum(n, 3)} di luar rentang ${f.min ?? '…'}–${f.max ?? '…'} ${f.unit || ''}.` });
    }
    if (f.pattern && typeof v === 'string' && !new RegExp(f.pattern).test(v)) issues.push({ level: 'error', field: f.key, msg: `${f.label}: format tidak sesuai (${f.patternHint || f.pattern}).` });
    if (f.type === 'repeatTable') {
      (v || []).forEach((row, i) => f.columns.forEach(c => {
        const cv = row[c.key];
        if (c.required && isEmpty(cv)) issues.push({ level: 'error', field: f.key, msg: `${f.label} baris ${i + 1}: ${c.label} wajib diisi.` });
        if (c.type === 'number' && !isEmpty(cv)) { const n = num(cv); if (n == null || (c.min != null && n < c.min) || (c.max != null && n > c.max)) issues.push({ level: 'error', field: f.key, msg: `${f.label} baris ${i + 1}: ${c.label} di luar rentang ${c.min ?? '…'}–${c.max ?? '…'}.` }); }
      }));
    }
  }
}
function validate(rec) {
  if (!rec || rec.type === 'photo') return [];
  const spec = specFor(rec); const d = rec.data || {}; const issues = [];
  validateFields(spec.fields || [], d, issues);
  for (const r of spec.rules || []) {
    if (!whenOk(r.when, d)) continue;
    const fn = RULES[r.type]; if (!fn) { issues.push({ level: 'warning', msg: `Aturan "${r.type}" belum dikenal mesin validasi (cek metadata).` }); continue; }
    let res = null; try { res = fn(r, d, rec); } catch (e) { res = null; }
    if (res) issues.push({ level: r.level || 'error', rule: r.id, msg: fill(r.message, { ...r, ...res }) });
  }
  if (rec.type === 'sample' && d.sampleCode) {
    const dup = Store.all('sample').filter(s => s.id !== rec.id && s.data.sampleCode === d.sampleCode);
    if (dup.length) issues.push({ level: 'error', rule: 'unique-code', msg: `Kode ${d.sampleCode} juga dipakai sampel lain (kemungkinan dibuat di dua perangkat saat offline). Ubah kode salah satunya.` });
  }
  if (rec.type === 'observation' || rec.type === 'sample') { if (!Store.get(rec.parentId)) issues.push({ level: 'warning', msg: 'Survei induk tidak ditemukan di perangkat ini.' }); }
  return issues;
}
const countIssues = iss => ({ e: iss.filter(i => i.level === 'error').length, w: iss.filter(i => i.level === 'warning').length });

/* ---------- validasi metadata (sebelum diterapkan) ---------- */
const FIELD_TYPES = ['text', 'number', 'select', 'multiselect', 'date', 'datetime', 'textarea', 'gps', 'repeatTable', 'photos', 'species', 'computed', 'obsRef', 'ecosystem'];
function validateMeta(m) {
  const errs = [];
  if (!m || typeof m !== 'object') return ['Bukan objek JSON.'];
  if (!m.app?.metadataVersion) errs.push('app.metadataVersion wajib ada.');
  if (!m.sampleCode?.pattern?.includes('{SEQ}')) errs.push('sampleCode.pattern harus memuat {SEQ}.');
  if (!Array.isArray(m.labStatus) || !m.labStatus.length) errs.push('labStatus wajib berisi daftar status.');
  if (!Array.isArray(m.ecosystems) || !m.ecosystems.length) errs.push('ecosystems wajib berisi daftar.');
  const checkFields = (fields, where) => (fields || []).forEach(f => {
    if (!f.key) errs.push(`${where}: field tanpa key.`);
    if (!FIELD_TYPES.includes(f.type)) errs.push(`${where}.${f.key}: tipe "${f.type}" tidak dikenal.`);
    if (f.type === 'computed' && !COMPUTE[f.formula]) errs.push(`${where}.${f.key}: formula "${f.formula}" belum ada di COMPUTE.`);
    if (f.optionsFrom && f.optionsFrom !== 'labStatus' && !m.lists?.[f.optionsFrom]) errs.push(`${where}.${f.key}: lists.${f.optionsFrom} tidak ada.`);
    if (f.type === 'repeatTable') checkFields(f.columns, `${where}.${f.key}`);
  });
  const checkRules = (rules, where) => (rules || []).forEach(r => { if (!RULES[r.type]) errs.push(`${where}: aturan "${r.type}" tidak dikenal.`); });
  checkFields(m.surveyForm?.fields, 'surveyForm'); checkRules(m.surveyForm?.rules, 'surveyForm');
  const codes = new Set();
  (m.ecosystems || []).forEach(e => {
    if (!/^[A-Z]{2,3}$/.test(e.code || '')) errs.push(`Ekosistem "${e.label}": code harus 2–3 huruf kapital.`);
    if (codes.has(e.code)) errs.push(`Kode ekosistem ${e.code} ganda.`); codes.add(e.code);
    checkFields(e.observation?.fields, `${e.code}.observation`); checkRules(e.observation?.rules, `${e.code}.observation`);
    (e.sampleTypes || []).forEach(s => { checkFields(s.fields, `${e.code}.${s.code}`); checkFields(s.labFields, `${e.code}.${s.code}.lab`); checkRules(s.rules, `${e.code}.${s.code}`); });
  });
  return errs;
}
const verCmp = (a, b) => { const pa = String(a).split(/[.\-]/).map(Number), pb = String(b).split(/[.\-]/).map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y ? 1 : -1; } return 0; };

/* ---------- QR (encoder lokal, berfungsi offline) ---------- */
function qrSVG(text) {
  const qr = new QRLib.QRCode(-1, QRLib.ECL.M); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + q * 2} ${n + q * 2}" shape-rendering="crispEdges" role="img" aria-label="QR ${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
