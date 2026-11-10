/* =====================================================================
   LAYANAN: sinkronisasi, metadata jarak jauh, AI, pemindai QR,
   ekspor/impor, data contoh — dan pengendali aplikasi (App)
   ===================================================================== */
const withTimeout = (p, ms, v = null) => Promise.race([p, new Promise(r => setTimeout(() => r(v), ms))]);
const cap = name => (window.claude && typeof window.claude.use === 'function') ? withTimeout(window.claude.use(name).catch(() => null), 10000) : Promise.resolve(null);

/* ---------- Adapter server. Tambah adapter baru (mis. server KKP) di sini. ---------- */
const Adapters = {
  artifactDb: {
    name: 'Server aplikasi (database artifact)',
    async connect() {
      const db = await cap('db'); if (!db) return null;
      const col = db.collection(META.sync.collection);
      return {
        async getOne(id) { const s = await col.doc(id).get(); return s.exists ? s.data() : null; },
        async put(rec) { await col.doc(rec.id).set(rec); },
        async pullMain() { const s = await col.where('type', 'in', ['survey', 'observation', 'sample']).get(); return s.docs.map(d => d.data()); },
        async pullPhotos(parentIds) { const out = []; for (let i = 0; i < parentIds.length; i += 30) { const s = await col.where('type', '==', 'photo').where('parentId', 'in', parentIds.slice(i, i + 30)).get(); out.push(...s.docs.map(d => d.data())); } return out; },
        async getMeta() { const s = await db.doc(META.sync.configDoc).get(); return s.exists ? s.data() : null; },
        async putMeta(doc) { await db.doc(META.sync.configDoc).set(doc); },
        async findCode(code) { const s = await col.where('type', '==', 'sample').where('data.sampleCode', '==', code).get().catch(() => null); if (s && s.docs.length) return s.docs[0].data(); const all = await col.where('type', '==', 'sample').get(); const d = all.docs.map(x => x.data()).find(r => r.data?.sampleCode === code); return d || null; }
      };
    }
  },
  rest: {
    get name() { return 'REST ' + META.sync.restEndpoint; },
    async connect() {
      const base = META.sync.restEndpoint; if (!base) return null;
      const j = async (path, opt) => { const r = await fetch(base.replace(/\/$/, '') + path, { headers: { 'Content-Type': 'application/json' }, ...opt }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.json(); };
      return {
        getOne: id => j('/records/' + encodeURIComponent(id)).catch(() => null),
        put: rec => j('/records/' + encodeURIComponent(rec.id), { method: 'PUT', body: JSON.stringify(rec) }),
        pullMain: () => j('/records?type=survey,observation,sample'),
        pullPhotos: ids => j('/records?type=photo&parent=' + ids.join(',')),
        getMeta: () => j('/metadata').catch(() => null),
        putMeta: doc => j('/metadata', { method: 'PUT', body: JSON.stringify(doc) }),
        findCode: code => j('/samples/' + encodeURIComponent(code)).catch(() => null)
      };
    }
  }
};

Adapters.supabase = SupabaseAdapter;

const Sync = {
  conn: null, available: false, running: false, which: null, needLogin: false,
  reset() { this.conn = null; this.which = null; this.available = false; },
  async connect() {
    if (this.conn) return this.conn;
    const order = { rest: ['rest'], artifactDb: ['artifactDb'], supabase: ['supabase'] }[META.sync.mode] || ['supabase', 'rest', 'artifactDb'];
    for (const k of order) { try { const c = await Adapters[k].connect(); if (c) { this.conn = c; this.which = k; this.available = true; return c; } } catch (e) { } }
    this.available = false; return null;
  },
  adapterName() { return this.which ? Adapters[this.which].name : Auth.configured() ? SupabaseAdapter.name + (Auth.session ? '' : ' (belum masuk)') : (META.sync.restEndpoint ? Adapters.rest.name : 'belum terhubung — data tetap aman di perangkat'); },
  lastText() { const t = Settings.v.lastSync; return t ? `Sinkron terakhir ${fmtDT(t)}.` : 'Belum pernah disinkronkan.'; },
  async run({ silent = false } = {}) {
    if (this.running) return; if (!navigator.onLine) { if (!silent) toast('Sedang offline. Data tersimpan di perangkat dan akan dikirim saat ada sinyal.', 'warn'); return; }
    this.running = true; App.updateTop();
    try {
      const c = await this.connect();
      if (!c && this.needLogin) { if (!silent) toast('Masuk ke akun tim di menu Data agar data bisa dikirim ke server.', 'warn'); return; }
      if (!c) { if (!silent) toast('Server sinkronisasi belum terhubung di tampilan ini. Data aman di perangkat; gunakan Ekspor JSON untuk memindahkan data.', 'warn'); return; }
      let pushed = 0, pulled = 0, merged = 0;
      const pending = Store.all().filter(r => r.meta.syncStatus !== 'synced').sort((a, b) => (a.type === 'photo') - (b.type === 'photo'));
      for (const rec of pending) {
        const remote = await c.getOne(rec.id);
        let out = rec;
        if (remote && remote.meta && remote.meta.updatedAt > rec.meta.updatedAt && remote.meta.hash !== rec.meta.hash) { out = mergeRecords(rec, remote); merged++; }
        const at = nowISO(); const payload = clone(out); payload.meta.syncStatus = 'synced'; payload.meta.syncedAt = at;
        await c.put(payload); await Store.put(payload); pushed++;
      }
      const main = await c.pullMain();
      for (const r of main || []) {
        if (!r || !r.id) continue; const l = Store.get(r.id);
        if (!l || (l.meta.syncStatus === 'synced' && r.meta.updatedAt > l.meta.updatedAt)) { r.meta.syncStatus = 'synced'; await Store.put(r); pulled++; }
      }
      const parents = Store.all().filter(r => r.type !== 'photo').map(r => r.id);
      const have = new Set(Store.all('photo').map(p => p.id));
      if (parents.length) { const ph = await c.pullPhotos(parents); for (const p of ph || []) if (p && !have.has(p.id)) { p.meta.syncStatus = 'synced'; await Store.put(p); pulled++; } }
      await this.checkMeta(c, silent);
      Settings.v.lastSync = nowISO(); await Settings.save();
      if (!silent || pushed || pulled) toast(`Sinkron selesai: ${pushed} terkirim, ${pulled} diterima${merged ? `, ${merged} digabung` : ''}.`);
    } catch (e) {
      if (e && e.code === 'auth') this.reset();
      const m = e && e.code === 'auth' ? 'Sesi akun tim berakhir. Masuk ulang di menu Data.' : e && e.code === 'forbidden' ? 'Akun ini tidak punya izin menulis data. Hubungi admin.' : e && e.code === 'quota_exceeded' ? 'Kapasitas server penuh. Hubungi admin aplikasi.' : e && e.code === 'invalid_argument' ? 'Akun ini belum punya izin menulis ke server (minta akses Contributor).' : 'Sinkron terhenti: ' + (e.message || e.code || e);
      toast(m, 'err');
    } finally { this.running = false; App.onDataChanged(true); }
  },
  async checkMeta(c, silent) {
    try {
      const doc = await c.getMeta(); if (!doc || !doc.json) return;
      if (verCmp(doc.version, META.app.metadataVersion) <= 0) return;
      const m = JSON.parse(doc.json); const errs = validateMeta(m);
      if (errs.length) { if (!silent) toast('Metadata dari server diabaikan karena tidak valid.', 'warn'); return; }
      await applyMeta(m, 'server'); toast(`Metadata diperbarui ke versi ${m.app.metadataVersion}.`);
    } catch (e) { }
  },
  async lookup(code) { const c = await this.connect(); if (!c) return null; return c.findCode(code); }
};
function mergeRecords(local, remote) {
  const winner = clone(remote.meta.updatedAt >= local.meta.updatedAt ? remote : local);
  const loser = winner === remote ? local : remote;
  const seen = new Set(); const hist = [...(remote.history || []), ...(local.history || [])].filter(h => { const k = h.at + h.by + h.rev; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.at.localeCompare(b.at));
  winner.history = hist; winner.meta.rev = Math.max(local.meta.rev, remote.meta.rev) + 1;
  winner.history.push({ rev: winner.meta.rev, at: nowISO(), by: userName(), device: Settings.v.deviceId, action: 'digabung saat sinkron', note: `Dua perangkat mengubah data ini. Versi ${loser.meta.updatedBy} (${fmtDT(loser.meta.updatedAt)}) digantikan versi yang lebih baru.`, changes: trimChanges(diffData(loser.data, winner.data)) });
  return winner;
}
async function applyMeta(m, source) { META = m; META_SOURCE = source; await Store.kvSet('meta', { json: JSON.stringify(m), source }); App.render(); }

/* ---------- AI identifikasi jenis ---------- */
async function blobFromFile(file, maxPx = 1100) {
  const img = await loadBitmap(file); const s = Math.min(1, maxPx / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
}
async function aiIdentify(ecoCode, file, notes, out) {
  const eco = ecoBy(ecoCode);
  if (!navigator.onLine) { out.innerHTML = issuesHTML([{ level: 'warning', msg: 'Bantuan AI butuh internet. Gunakan kunci ciri di atas, simpan foto spesimen, lalu coba lagi saat ada sinyal.' }]); return; }
  if (!file && !notes.trim()) { out.innerHTML = issuesHTML([{ level: 'warning', msg: 'Tambahkan foto atau catatan ciri terlebih dahulu.' }]); return; }
  const sample = Auth.configured() ? null : await cap('sample');
  if (!sample && !Auth.configured()) { out.innerHTML = issuesHTML([{ level: 'warning', msg: 'Bantuan AI tidak tersedia di tampilan ini. Kunci ciri tetap bisa dipakai.' }]); return; }
  out.innerHTML = '<p class="small muted">Menganalisis…</p>';
  let images; if (sample) { try { const lim = sample.limits ? await sample.limits() : null; if (file && lim && lim.images) images = [await blobFromFile(file)]; } catch (e) { } } else if (file) images = [file];
  const cands = eco.species.map(s => `- ${s.name}${s.local ? ` (${s.local})` : ''}: ${s.keys.join('; ')}. Habitat: ${s.habitat}`).join('\n');
  const prompt = `Anda membantu tim survei ${eco.label} Kementerian Kelautan dan Perikanan di Indonesia mengidentifikasi jenis di lapangan.
Daftar jenis kandidat dan ciri kuncinya (dari metadata aplikasi):
${cands}

Catatan petugas: ${notes.trim() || '(tidak ada)'}
${images ? 'Foto terlampir.' : 'Tidak ada foto; gunakan catatan saja.'}

Tentukan hingga 3 kandidat paling mungkin dari daftar di atas. Jika ciri tidak cocok dengan daftar atau foto bukan ${eco.label.toLowerCase()}, katakan di "note". Jangan mengarang jenis di luar daftar kecuali sangat yakin, dan tandai bila demikian.
Balas HANYA JSON dengan bentuk:
{"candidates":[{"name":"nama ilmiah","confidence":0.0-1.0,"reasons":["ciri yang terlihat"]}],"checkNext":["ciri yang perlu dicek langsung di lapangan untuk memastikan"],"photoQuality":"baik|cukup|buruk","note":"catatan singkat"}
Gunakan bahasa Indonesia.`;
  try {
    const r = sample ? await sample.json(prompt, { images, modelTier: 'default' }) : await aiViaSupabase(prompt, file);
    const cs = (r && r.candidates) || [];
    out.innerHTML = `<div class="ai-out">${cs.length ? cs.map(c => `<div><div class="spread"><i style="font-weight:650">${esc(c.name)}</i><span class="small">${fmtNum((c.confidence || 0) * 100, 0)}%</span></div><div class="meter"><i style="width:${Math.max(3, (c.confidence || 0) * 100)}%"></i></div><div class="tiny" style="margin-top:4px">${(c.reasons || []).map(esc).join(' · ')}</div></div>`).join('') : '<p class="small">Tidak ada kandidat yang cukup meyakinkan.</p>'}
      ${r?.checkNext?.length ? `<div><b class="small">Cek di lapangan:</b><ul class="small" style="margin:4px 0 0;padding-left:18px">${r.checkNext.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r?.note ? `<p class="small muted" style="margin:0">${esc(r.note)}</p>` : ''}${r?.photoQuality ? `<p class="tiny" style="margin:0">Kualitas foto: ${esc(r.photoQuality)}</p>` : ''}
      <p class="tiny" style="margin:0">Hasil AI adalah saran. Konfirmasi dengan ciri kunci sebelum dicatat.</p></div>`;
  } catch (e) {
    out.innerHTML = issuesHTML([{ level: 'warning', msg: e?.code === 'auth' ? e.message : e?.code === 'not_granted' ? 'Izin AI belum diberikan untuk halaman ini.' : e?.code === 'rate_limited' ? 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.' : 'AI gagal menjawab: ' + (e?.message || e) }]);
  }
}

/* ---------- Pemindai QR ---------- */
let jsqrLoading = null;
function loadJsQR() { if (window.jsQR) return Promise.resolve(); return jsqrLoading ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload = res; s.onerror = () => { jsqrLoading = null; rej(new Error('pemindai belum termuat')); }; document.head.appendChild(s); }); }
async function decodeQR(file) {
  const img = await loadBitmap(file);
  if ('BarcodeDetector' in window) { try { const det = new BarcodeDetector({ formats: ['qr_code'] }); const r = await det.detect(img); if (r && r[0]) return r[0].rawValue; } catch (e) { } }
  await loadJsQR();
  for (const px of [1000, 700, 1400, 500]) {
    const s = Math.min(1, px / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height); const code = window.jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;
  }
  return null;
}
async function openSampleByCode(code) {
  code = (code || '').trim().toUpperCase(); if (!code) return;
  if (live('sample').find(s => s.data.sampleCode === code)) { go('sample-' + code); return; }
  if (navigator.onLine) { const r = await Sync.lookup(code).catch(() => null); if (r) { r.meta.syncStatus = 'synced'; await Store.put(r); go('sample-' + code); toast('Sampel diambil dari server'); return; } }
  go('sample-' + code);
}

/* ---------- Ekspor / impor ---------- */
async function deliver(filename, text, title) {
  const dl = await cap('downloads');
  if (dl) { try { await dl.save({ filename, data: text }); toast('Berkas disiapkan: ' + filename); return; } catch (e) { if (e?.code === 'cancelled' || e?.code === 'declined') return; } }
  const s = openSheet({ title: title || filename, body: `<p class="small">Unduhan tidak tersedia di tampilan ini. Salin isi berikut lalu simpan sebagai <b>${esc(filename)}</b>.</p><textarea class="input mono" style="min-height:300px" readonly>${esc(text.length > 400000 ? text.slice(0, 400000) + '\n…(terpotong, gunakan unduhan)' : text)}</textarea>`, footer: `<button class="btn" data-close>Tutup</button><button class="btn primary" data-copy>${I('copy', 18)} Salin</button>` });
  s.el.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Tersalin'); } catch (e) { s.el.querySelector('textarea').select(); toast('Tekan tahan lalu salin', 'warn'); } };
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
function exportJSON() {
  const data = { format: 'bcfa-backup', formatVersion: 1, exportedAt: nowISO(), exportedBy: userName(), deviceId: Settings.v.deviceId, app: META.app, metadata: META, records: Store.all() };
  deliver(`bcfa-cadangan-${stamp()}.json`, JSON.stringify(data, null, 1), 'Cadangan lengkap');
}
function csvCell(v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function exportCSV() {
  const cols = ['sampleCode', 'ecosystem', 'sampleType', 'siteCode', 'siteName', 'survey', 'lat', 'lon', 'gpsAccuracy_m', 'collectedAt', 'teamLeader', 'depthTop_cm', 'depthBottom_cm', 'penetration_cm', 'recovered_cm', 'treatment', 'labStatus', 'labName', 'bulkDensity_gcm3', 'corg_pct', 'carbon_MgC_ha', 'co2e_Mg_ha', 'dryWeight_g', 'photos', 'errors', 'warnings', 'rev', 'hash'];
  const rows = live('sample').map(x => { const s = surveyOf(x) || { data: {} }; const st = sampleTypeOf(x); const c = st?.carbon && COMPUTE[st.carbon.formula]?.(x.data); const iss = countIssues(validate(x)); const d = x.data;
    return [d.sampleCode, d.ecosystem, d.sampleType, d.siteCode, s.data.siteName, s.data.title, d.gps?.lat, d.gps?.lon, d.gps?.acc, d.collectedAt, s.data.teamLeader, d.depthTop, d.depthBottom, d.penetrationDepth, d.recoveredLength, (d.treatment || []).join(' | '), labLabel(d.labStatus), d.labName, d.bulkDensity, d.corgPercent, c ? c.value.toFixed(3) : '', c ? c.co2e.toFixed(3) : '', d.dryWeight, live('photo').filter(p => p.parentId === x.id).length, iss.e, iss.w, x.meta.rev, x.meta.hash]; });
  deliver(`bcfa-sampel-${stamp()}.csv`, '﻿' + [cols, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'Tabel sampel');
}
function exportMRV() {
  const evidence = r => ({ photos: live('photo').filter(p => p.parentId === r.id).length, rev: r.meta.rev, hash: r.meta.hash, recordedBy: r.meta.createdBy, deviceId: r.meta.deviceId, synced: r.meta.syncStatus === 'synced', validationErrors: countIssues(validate(r)).e });
  const sites = live('survey').map(s => ({ surveyId: s.id, title: s.data.title, ecosystem: s.data.ecosystem, siteCode: s.data.siteCode, siteName: s.data.siteName, regency: s.data.regency, province: s.data.province, startDate: s.data.startDate, endDate: s.data.endDate || null, teamLeader: s.data.teamLeader }));
  const smp = live('sample');
  const soilCores = smp.filter(x => x.data.sampleType === 'CORE').map(x => { const d = x.data, c = COMPUTE.soilCarbon(d); return { sampleCode: d.sampleCode, surveyId: x.parentId, ecosystem: d.ecosystem, siteCode: d.siteCode, lat: d.gps?.lat ?? null, lon: d.gps?.lon ?? null, gpsAccuracy_m: d.gps?.acc ?? null, collectedAt: d.collectedAt, penetration_cm: num(d.penetrationDepth), recovered_cm: num(d.recoveredLength), compaction_pct: COMPUTE.compaction(d)?.value ?? null, depthTop_cm: num(d.depthTop), depthBottom_cm: num(d.depthBottom), bulkDensity_gcm3: num(d.bulkDensity), corg_pct: num(d.corgPercent), corgMethod: d.corgMethod || null, carbonStock_MgC_ha: c ? +c.value.toFixed(4) : null, labStatus: d.labStatus, verified: d.labStatus === 'VERIFIED', evidence: evidence(x) }; });
  const biomass = smp.filter(x => x.data.sampleType === 'BIO').map(x => { const d = x.data, c = COMPUTE.biomassCarbon(d); return { sampleCode: d.sampleCode, surveyId: x.parentId, ecosystem: d.ecosystem, lat: d.gps?.lat ?? null, lon: d.gps?.lon ?? null, fraction: d.fraction, species: d.species || null, quadratArea_m2: num(d.quadratArea), wetWeight_g: num(d.wetWeight), dryWeight_g: num(d.dryWeight), carbonFraction_pct: num(d.carbonFraction), carbonStock_MgC_ha: c ? +c.value.toFixed(5) : null, labStatus: d.labStatus, verified: d.labStatus === 'VERIFIED', evidence: evidence(x) }; });
  const vegetation = live('observation').filter(o => Array.isArray(o.data.trees)).flatMap(o => o.data.trees.map((t, i) => ({ plotCode: o.data.plotCode, surveyId: o.parentId, plotSize: o.data.plotSize, lat: o.data.gps?.lat ?? null, lon: o.data.gps?.lon ?? null, row: i + 1, species: t.species, category: t.category, dbh_cm: num(t.dbh), height_m: num(t.height), condition: t.condition })));
  const seagrassCover = live('observation').filter(o => Array.isArray(o.data.speciesCover)).map(o => ({ station: o.data.stationCode, transect: o.data.transect, surveyId: o.parentId, lat: o.data.gps?.lat ?? null, lon: o.data.gps?.lon ?? null, quadratSize: o.data.quadratSize, totalCover_pct: num(o.data.totalCover), species: o.data.speciesCover.map(s => ({ species: s.species, cover_pct: num(s.cover), shoots: num(s.shoots) })), evidence: evidence(o) }));
  const out = { format: 'mrv-calculator-input', formatVersion: '1.0', source: META.app.name, appVersion: META.app.version, metadataVersion: META.app.metadataVersion, generatedAt: nowISO(), generatedBy: userName(), units: { carbonStock: 'Mg C/ha', co2Factor: 44 / 12, soilCarbonFormula: 'BD (g/cm3) × tebal interval (cm) × Corg (%)' }, sites, soilCores, biomass, seagrassCover, vegetation };
  deliver(`mrv-input-${stamp()}.json`, JSON.stringify(out, null, 2), 'Ekspor MRV Calculator');
}
async function importJSON(file) {
  try {
    const d = JSON.parse(await file.text()); if (d.format !== 'bcfa-backup' || !Array.isArray(d.records)) throw new Error('bukan berkas cadangan Blue Carbon Field App');
    let n = 0; for (const r of d.records) { const l = Store.get(r.id); if (!l || r.meta.updatedAt > l.meta.updatedAt) { r.meta.syncStatus = 'pending'; await Store.put(r); n++; } }
    toast(`${n} data diimpor (${d.records.length - n} sudah ada dan lebih baru di perangkat).`); App.onDataChanged(true);
  } catch (e) { toast('Impor gagal: ' + e.message, 'err'); }
}
function labelSVG(x) {
  const s = surveyOf(x); const st = sampleTypeOf(x); const qr = qrSVG(qrPayload(x.data.sampleCode)).replace('<svg ', '<svg x="430" y="30" width="190" height="190" ');
  const t = (str, y, sz, w = 500) => `<text x="60" y="${y}" font-family="Archivo, Arial Narrow, Arial, sans-serif" font-size="${sz}" font-weight="${w}" fill="#2A2100">${esc(str)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="650" height="250" viewBox="0 0 650 250"><rect width="650" height="250" rx="16" fill="#FFD43B"/><circle cx="28" cy="125" r="11" fill="#fff" stroke="#C99A00" stroke-width="3"/><line x1="46" y1="16" x2="46" y2="234" stroke="#2A2100" stroke-opacity=".3" stroke-width="2" stroke-dasharray="6 5"/>${t(x.data.sampleCode, 88, 46, 800)}${t(`${st?.label || ''} · ${ecoBy(x.data.ecosystem)?.label || ''}`, 130, 22)}${t(s?.data.siteName || '', 160, 22)}${t(fmtDT(x.data.collectedAt), 190, 22)}${t(gpsText(x.data.gps), 220, 18)}<rect x="420" y="20" width="210" height="210" rx="10" fill="#fff"/>${qr}</svg>`;
}

/* ---------- Data contoh (hanya di perangkat, ditandai demo) ---------- */
function demoImage(label, hue) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 480); grd.addColorStop(0, `hsl(${hue} 35% 62%)`); grd.addColorStop(1, `hsl(${hue} 40% 28%)`); g.fillStyle = grd; g.fillRect(0, 0, 640, 480);
  g.strokeStyle = `hsl(${hue} 45% 22%)`; g.lineWidth = 6; for (let i = 0; i < 40; i++) { const x = 20 + i * 16 + (i % 3) * 3; g.beginPath(); g.moveTo(x, 480); g.quadraticCurveTo(x + 12, 300 - (i % 5) * 20, x + 4 + (i % 4) * 6, 140 + (i % 7) * 18); g.stroke(); }
  g.strokeStyle = '#FFD43B'; g.lineWidth = 8; g.strokeRect(90, 70, 460, 340);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 420, 640, 60); g.fillStyle = '#fff'; g.font = '600 26px Archivo, sans-serif'; g.fillText('Foto contoh · ' + label, 20, 460);
  return new Promise(r => c.toBlob(b => r(new File([b], 'contoh.jpg', { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', 0.8));
}
async function loadDemo() {
  const mk = async (type, data, parent) => { const r = newRecord(type, data, parent); r.meta.demo = true; await saveRecord(r, data, 'dibuat'); return r; };
  const photo = async (parent, cat, label, hue, gps) => { const p = await processPhoto(await demoImage(label, hue), cat, parent.id, gps); p.meta.demo = true; await Store.put(p); };
  const d0 = new Date(); d0.setDate(d0.getDate() - 3); const day = d0.toISOString().slice(0, 10);
  const at = (h, m) => `${day}T${pad(h, 2)}:${pad(m, 2)}`;
  const sv = await mk('survey', { title: 'Contoh – Survei lamun Teluk Kabola', ecosystem: 'LM', program: 'Inventarisasi baseline', province: 'Nusa Tenggara Timur', regency: 'Alor', siteName: 'Teluk Kabola (contoh)', siteCode: 'ALOR', startDate: day, endDate: '', teamLeader: userName(), teamMembers: 'Anggota tim A\nAnggota tim B', institution: 'Direktorat Konservasi Ekosistem – KKP', notes: 'Data contoh untuk mencoba aplikasi.' });
  const g1 = { lat: -8.2047, lon: 124.4891, acc: 4.2, source: 'device', at: new Date(at(8, 40)).toISOString() };
  const g2 = { lat: -8.2052, lon: 124.4903, acc: 21, source: 'device', at: new Date(at(9, 25)).toISOString() };
  const o1 = await mk('observation', { ecosystem: 'LM', stationCode: 'ST1', transect: 'T1', quadratPos: 10, quadratSize: '50 × 50 cm', observedAt: at(8, 40), gps: g1, waterDepth: 0.6, tide: 'Surut', substrate: 'Pasir berlumpur', totalCover: 65, speciesCover: [{ species: 'Enhalus acoroides', cover: 40, shoots: 18 }, { species: 'Thalassia hemprichii', cover: 25, shoots: 52 }], canopyHeight: 38, epiphyte: 'Sedikit', notes: '' }, sv.id);
  await photo(o1, 'plot', 'kuadran ST1-T1', 140, g1);
  const o2 = await mk('observation', { ecosystem: 'LM', stationCode: 'ST1', transect: 'T1', quadratPos: 20, quadratSize: '50 × 50 cm', observedAt: at(9, 25), gps: g2, waterDepth: 0.8, tide: 'Surut', substrate: 'Pasir', totalCover: 30, speciesCover: [{ species: 'Cymodocea rotundata', cover: 15, shoots: 70 }, { species: 'Halodule uninervis', cover: 6, shoots: 40 }], epiphyte: 'Tidak ada' }, sv.id);
  const core = (code, top, bot, extra) => ({ ecosystem: 'LM', sampleType: 'CORE', sampleCode: code, siteCode: 'ALOR', linkedObs: o1.id, collectedAt: at(10, 5), gps: g1, corerType: 'Pipa PVC', coreDiameter: 5, penetrationDepth: 52, recoveredLength: 46, depthTop: top, depthBottom: bot, sedimentType: 'Pasir berlumpur', treatment: ['Dilabel ganda (dalam & luar)', 'Kantong ziplock', 'Didinginkan 4 °C (cool box)', 'Dipotong per interval di lapangan'], storageTemp: 'Cool box ±4 °C', labStatus: 'FIELD', ...extra });
  const s1 = await mk('sample', core('LM-2026-ALOR-001', 0, 15, {}), sv.id);
  await photo(s1, 'sediment', 'core 0–15 cm', 30, g1);
  for (const [ch, act] of [[{ labStatus: 'TRANSIT' }, 'status lab diperbarui'], [{ labStatus: 'RECEIVED', labName: 'Laboratorium mitra (contoh)', labReceivedAt: day }, 'status lab diperbarui'], [{ labStatus: 'RESULT', corgMethod: 'Loss on Ignition (LOI)', bulkDensity: 0.92, corgPercent: 1.84, labAnalyst: 'Analis contoh' }, 'hasil lab diisi']]) await saveRecord(s1, { ...s1.data, ...ch }, act);
  const s2 = await mk('sample', core('LM-2026-ALOR-002', 15, 30, { labStatus: 'ANALYSIS', labName: 'Laboratorium mitra (contoh)' }), sv.id);
  await photo(s2, 'sediment', 'core 15–30 cm', 30, g1);
  await mk('sample', { ecosystem: 'LM', sampleType: 'BIO', sampleCode: 'LM-2026-ALOR-003', siteCode: 'ALOR', linkedObs: o1.id, collectedAt: at(10, 30), gps: g1, quadratArea: '0.0625', fraction: 'Atas substrat (daun)', species: 'Enhalus acoroides', wetWeight: 48.2, treatment: ['Kantong ziplock', 'Dibilas air tawar'], labStatus: 'TRANSIT' }, sv.id);
  const mv = await mk('survey', { title: 'Contoh – Plot mangrove pesisir', ecosystem: 'MG', program: 'Monitoring berkala', province: 'Jawa Tengah', regency: 'Demak', siteName: 'Pesisir contoh', siteCode: 'DMK', startDate: day, teamLeader: userName(), institution: 'Direktorat Konservasi Ekosistem – KKP' });
  const gm = { lat: -6.8711, lon: 110.5362, acc: 6, source: 'device', at: new Date(at(13, 10)).toISOString() };
  const p1 = await mk('observation', { ecosystem: 'MG', plotCode: 'P1', transect: 'T1', zone: 'Depan (laut)', plotSize: '10 × 10 m (pohon)', observedAt: at(13, 10), gps: gm, substrate: 'Lumpur', salinity: 28, canopyCover: 70, trees: [{ species: 'Avicennia marina', category: 'Pohon', dbh: 18.4, height: 9.5, condition: 'Hidup' }, { species: 'Rhizophora mucronata', category: 'Pohon', dbh: 8.2, height: 6, condition: 'Hidup' }, { species: 'Rhizophora mucronata', category: 'Pancang', dbh: 4.1, height: 2.6, condition: 'Hidup' }] }, mv.id);
  await photo(p1, 'plot', 'plot P1', 95, gm);
  await mk('sample', { ecosystem: 'MG', sampleType: 'CORE', sampleCode: 'MG-2026-DMK-001', siteCode: 'DMK', linkedObs: p1.id, collectedAt: at(13, 45), gps: gm, corerType: 'Russian peat corer', coreDiameter: 5.2, penetrationDepth: 100, recoveredLength: 94, depthTop: 0, depthBottom: 15, sedimentType: 'Lumpur', treatment: ['Dilabel ganda (dalam & luar)', 'Kantong ziplock'], labStatus: 'FIELD' }, mv.id);
  Store.all().forEach(r => { if (!r.meta.demo && (r.parentId && Store.get(r.parentId)?.meta.demo)) { r.meta.demo = true; Store.put(r); } });
  toast('Data contoh dimuat. Coba buka sampel LM-2026-ALOR-001.');
}

/* =====================================================================
   APP: router, top bar, aksi
   ===================================================================== */
function go(route) { if (location.hash.slice(1) === route) App.render(); else location.hash = route; }
const App = {
  state: { q: '', stab: 'obs', labf: '', spEco: null, spf: {} }, lastRoute: null, renderT: null, aiFile: null,
  route() { return decodeURIComponent(location.hash.slice(1)) || 'home'; },
  render() {
    const r = this.route();
    if (r !== this.lastRoute) { if (this.lastRoute && this.lastRoute.split('-')[0] !== r.split('-')[0]) { this.state.q = ''; this.aiFile = null; } if (!r.startsWith('survey-')) this.state.stab = this.state.stab; }
    let html;
    if (r.startsWith('survey-')) html = V.survey(r.slice(7));
    else if (r.startsWith('obs-')) html = V.obs(r.slice(4));
    else if (r.startsWith('sample-')) html = V.sample(r.slice(7).toUpperCase());
    else html = (V[r] || V.home)();
    const view = $('#view'); view.innerHTML = html;
    const sec = r.startsWith('survey') ? 'surveys' : r.startsWith('obs') ? 'surveys' : r.startsWith('sample') ? 'samples' : (V[r] ? r : 'home');
    $$('.nav a').forEach(a => a.dataset.sec === sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    if (r !== this.lastRoute) { window.scrollTo(0, 0); const h = view.querySelector('h1'); if (h) { h.tabIndex = -1; } }
    document.title = `${META.app.name}`;
    this.lastRoute = r; this.updateTop();
    if (r === 'home' && location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
  },
  updateTop() {
    const pending = Store.all().filter(x => x.meta.syncStatus !== 'synced').length;
    const net = $('#net'); net.classList.toggle('off', !navigator.onLine); net.querySelector('span').textContent = navigator.onLine ? 'Online' : 'Offline';
    const sb = $('#syncBtn'); sb.classList.toggle('spin', Sync.running); sb.querySelector('.dot').hidden = !pending; sb.querySelector('.dot').textContent = pending > 99 ? '99+' : pending;
    sb.setAttribute('aria-label', `Sinkronkan, ${pending} data belum terkirim`);
  },
  onDataChanged(now) { this.updateTop(); clearTimeout(this.renderT); this.renderT = setTimeout(() => this.render(), now ? 0 : 120); }
};

const ACTIONS = {
  'sb-save': async () => { Settings.v.sbUrl = $('#sbUrl').value.trim(); Settings.v.sbKey = $('#sbKey').value.trim(); await Settings.save(); Sync.reset(); toast(Auth.configured() ? 'Server Supabase disimpan. Silakan masuk.' : 'Server dikosongkan'); App.render(); },
  'sb-login': async b => { const em = $('#sbEmail').value.trim(), pw = $('#sbPw').value; if (!em || !pw) { toast('Isi email dan kata sandi.', 'warn'); return; } b.disabled = true; try { await Auth.signIn(em, pw); toast('Masuk sebagai ' + em); App.render(); Sync.run({ silent: true }); } catch (e) { b.disabled = false; toast('Gagal masuk: ' + e.message, 'err'); } },
  'sb-chpw': async b => { const a = $('#sbNewPw').value, c = $('#sbNewPw2').value; if (a.length < 8) { toast('Kata sandi minimal 8 karakter.', 'warn'); return; } if (a !== c) { toast('Kedua kata sandi tidak sama.', 'warn'); return; } b.disabled = true; try { await Auth.changePassword(a); toast('Kata sandi baru tersimpan. Pakai ini untuk masuk berikutnya.'); App.render(); } catch (e) { b.disabled = false; toast('Gagal mengubah kata sandi: ' + e.message, 'err'); } },
  'sb-showpw': () => { const i = $('#sbPw'); if (i) i.type = i.type === 'password' ? 'text' : 'password'; },
  'sb-logout': async () => { const p = Store.all().filter(r => r.meta.syncStatus !== 'synced').length; if (p && !await confirmDialog('Keluar dari akun tim?', `${p} data belum terkirim. Data tetap aman di perangkat dan dikirim setelah masuk lagi.`, 'Keluar')) return; await Auth.signOut(); toast('Sudah keluar'); App.render(); },
  'new-survey': () => { const rec = newRecord('survey', {}, null); openForm({ title: 'Survei baru', rec, fields: META.surveyForm.fields, isNew: true, saveLabel: 'Buat survei', onSaved: r => go('survey-' + r.id) }); },
  'edit-survey': b => { const rec = Store.get(b.dataset.id); const kids = live('observation').concat(live('sample')).some(x => x.parentId === rec.id); openForm({ title: 'Ubah survei', rec, fields: META.surveyForm.fields, ctx: { lockEco: kids } }); },
  'new-obs': b => { const s = Store.get(b.dataset.id); const eco = ecoBy(s.data.ecosystem); const rec = newRecord('observation', { ecosystem: s.data.ecosystem }, s.id); openForm({ title: `${eco.observation.label} baru`, rec, fields: eco.observation.fields, isNew: true, onSaved: r => go('obs-' + r.id) }); },
  'edit-obs': b => { const rec = Store.get(b.dataset.id); openForm({ title: `Ubah ${ecoBy(rec.data.ecosystem).observation.label.toLowerCase()}`, rec, fields: ecoBy(rec.data.ecosystem).observation.fields }); },
  'new-sample': b => {
    const s = Store.get(b.dataset.id); const eco = ecoBy(s.data.ecosystem); const st = eco.sampleTypes.find(x => x.code === b.dataset.st);
    if (!s.data.siteCode) { toast('Isi kode lokasi survei terlebih dahulu.', 'warn'); return; }
    const code = nextSampleCode(eco.code, s.data.siteCode, (s.data.startDate || today()).slice(0, 4), st.code);
    const o = b.dataset.obs ? Store.get(b.dataset.obs) : null;
    const rec = newRecord('sample', { ecosystem: eco.code, sampleType: st.code, sampleCode: code, siteCode: s.data.siteCode, labStatus: 'FIELD', linkedObs: o ? o.id : '', gps: o?.data.gps?.lat != null ? { ...o.data.gps, note: 'disalin dari observasi' } : null }, s.id);
    openForm({ title: `${st.label} · ${code}`, rec, fields: st.fields, isNew: true, saveLabel: 'Simpan & buat label', onSaved: r => go('sample-' + r.data.sampleCode) });
  },
  'edit-sample': b => { const rec = Store.get(b.dataset.id); openForm({ title: `Data lapangan · ${rec.data.sampleCode}`, rec, fields: sampleTypeOf(rec).fields }); },
  'edit-lab': b => { const rec = Store.get(b.dataset.id); openForm({ title: `Laboratorium · ${rec.data.sampleCode}`, rec, fields: sampleTypeOf(rec).labFields || [], ctx: { action: 'status/hasil lab diperbarui' } }); },
  delete: async b => {
    const rec = Store.get(b.dataset.id);
    if (rec.type === 'survey' && live('observation').concat(live('sample')).some(x => x.parentId === rec.id)) { toast('Hapus dulu plot dan sampel di dalam survei ini.', 'warn'); return; }
    if (!await confirmDialog('Hapus data ini?', 'Data ditandai terhapus dan disinkronkan, sehingga jejaknya tetap tercatat untuk audit MRV.', 'Hapus', true)) return;
    rec.meta.deleted = true; rec.meta.rev += 1; rec.history.push({ rev: rec.meta.rev, at: nowISO(), by: userName(), device: Settings.v.deviceId, action: 'dihapus' });
    await saveRecord(rec, null); toast('Data dihapus');
    go(rec.type === 'survey' ? 'surveys' : rec.type === 'sample' ? 'survey-' + rec.parentId : 'survey-' + rec.parentId);
  },
  stab: b => { App.state.stab = b.dataset.v; App.render(); },
  labf: b => { App.state.labf = b.dataset.v; App.render(); },
  spEco: b => { App.state.spEco = b.dataset.v; App.render(); },
  spf: b => { const ek = App.state.spEco || ecoList().find(e => e.species?.length).code; const f = App.state.spf[ek] ||= {}; f[b.dataset.t] = f[b.dataset.t] === b.dataset.v ? '' : b.dataset.v; App.render(); },
  'spf-reset': () => { const ek = App.state.spEco || ecoList().find(e => e.species?.length).code; App.state.spf[ek] = {}; App.render(); },
  'ai-id': b => aiIdentify(b.dataset.eco, App.aiFile, ($('[data-ai-notes]') || {}).value || '', $('[data-ai-out]')),
  sync: () => Sync.run(),
  'export-json': exportJSON, 'export-csv': exportCSV, 'export-mrv': exportMRV,
  label: b => { const x = Store.get(b.dataset.id); deliver(`label-${x.data.sampleCode}.svg`, labelSVG(x), 'Label sampel (SVG)'); },
  'view-photo': b => viewPhoto(b.dataset.id),
  'remote-lookup': async b => { b.disabled = true; await openSampleByCode(b.dataset.v); },
  demo: async b => { if (b) b.disabled = true; await loadDemo(); go('home'); },
  'demo-clear': async () => { if (!await confirmDialog('Hapus data contoh?', 'Hanya data yang ditandai contoh yang dihapus dari perangkat ini.', 'Hapus data contoh', true)) return; for (const r of Store.all().filter(r => r.meta.demo)) await Store.del(r.id); App.onDataChanged(true); toast('Data contoh dihapus'); },
  wipe: async () => { const p = Store.all().filter(r => r.meta.syncStatus !== 'synced' && !r.meta.demo).length; if (!await confirmDialog('Hapus semua data di perangkat?', p ? `<b>${p} data belum terkirim ke server</b> dan akan hilang permanen. Ekspor cadangan JSON dulu bila ragu.` : 'Data yang sudah tersinkron tetap ada di server.', 'Hapus semua', true)) return; for (const r of Store.all()) await Store.del(r.id); App.onDataChanged(true); toast('Perangkat dikosongkan'); },
  'meta-reset': async () => { await Store.kvSet('meta', null); META = EMBEDDED_META; META_SOURCE = 'tertanam'; App.render(); toast('Memakai metadata tertanam'); },
  'meta-edit': async () => {
    let canPublish = false; if (Auth.configured() && Auth.session) canPublish = await Auth.isAdmin(); else { const user = await cap('user'); canPublish = !!(user && (user.canEdit ? await user.canEdit() : false)); }
    const s = openSheet({ title: 'Metadata aplikasi', body: `<p class="small">Ubah form, daftar jenis, aturan validasi, status lab, atau pola kode. Naikkan <span class="mono">app.metadataVersion</span> setiap perubahan agar perangkat lain menerimanya.</p><textarea class="input mono" data-meta style="min-height:52vh;font-size:12.5px" spellcheck="false">${esc(JSON.stringify(META, null, 2))}</textarea><div data-meta-out style="margin-top:10px"></div>`, footer: `<button class="btn" data-check>Periksa</button><button class="btn" data-apply>Terapkan di perangkat ini</button><button class="btn primary" data-publish ${canPublish ? '' : 'disabled title="Hanya admin"'}>Terbitkan ke semua perangkat</button>` });
    const read = () => { const out = $('[data-meta-out]', s.el); try { const m = JSON.parse($('[data-meta]', s.el).value); const errs = validateMeta(m); out.innerHTML = errs.length ? issuesHTML(errs.map(e => ({ level: 'error', msg: e }))) : issuesHTML([], `Metadata valid · versi ${m.app.metadataVersion}`); return errs.length ? null : m; } catch (e) { out.innerHTML = issuesHTML([{ level: 'error', msg: 'JSON tidak valid: ' + e.message }]); return null; } };
    $('[data-check]', s.el).onclick = read;
    $('[data-apply]', s.el).onclick = async () => { const m = read(); if (m) { await applyMeta(m, 'lokal'); s.close(true); toast('Metadata diterapkan di perangkat ini'); } };
    $('[data-publish]', s.el).onclick = async () => { const m = read(); if (!m) return; if (verCmp(m.app.metadataVersion, META.app.metadataVersion) <= 0 && JSON.stringify(m) !== JSON.stringify(META)) { $('[data-meta-out]', s.el).innerHTML = issuesHTML([{ level: 'error', msg: 'Naikkan app.metadataVersion sebelum menerbitkan.' }]); return; } const c = await Sync.connect(); if (!c) { toast('Server tidak tersedia.', 'err'); return; } try { await c.putMeta({ json: JSON.stringify(m), version: m.app.metadataVersion, updatedAt: nowISO(), by: userName() }); await applyMeta(m, 'server'); s.close(true); toast(`Metadata ${m.app.metadataVersion} diterbitkan`); } catch (e) { toast('Gagal menerbitkan: ' + (e.message || e.code), 'err'); } };
  }
};

document.addEventListener('click', e => {
  if (e.target.closest('.scrim')) return;
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACTIONS[b.dataset.act]; if (fn) { if (b.type !== 'checkbox') e.preventDefault(); fn(b, e); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.ph[role=button]') && !e.target.closest('.scrim')) { e.preventDefault(); viewPhoto(e.target.dataset.id); } });
document.addEventListener('input', e => {
  const el = e.target; if (el.closest('.scrim')) return;
  if (el.matches('[data-search]')) { App.state.q = el.value; const pos = el.selectionStart; App.render(); const n = $('[data-search]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }
  if (el.matches('[data-setting]')) { Settings.v[el.dataset.setting] = el.value; clearTimeout(App._st); App._st = setTimeout(() => Settings.save(), 400); }
});
document.addEventListener('change', async e => {
  const el = e.target; if (el.closest('.scrim')) return;
  if (el.matches('[data-scan-in]')) {
    const f = el.files[0]; el.value = ''; if (!f) return; const out = $('[data-scan-out]'); out.innerHTML = '<p class="small">Membaca QR…</p>';
    try { const txt = await decodeQR(f); const code = parseQr(txt); if (code) { out.innerHTML = `<p class="small">Terbaca: <b class="code">${esc(code)}</b></p>`; openSampleByCode(code); } else out.innerHTML = issuesHTML([{ level: 'warning', msg: txt ? `QR terbaca (“${txt.slice(0, 60)}”) tetapi bukan label sampel aplikasi ini.` : 'QR tidak terbaca. Ambil foto lebih dekat, terang, dan tidak buram, atau ketik kode.' }]); }
    catch (err) { out.innerHTML = issuesHTML([{ level: 'warning', msg: 'Pemindai belum termuat (butuh internet sekali). Ketik kode sampel di bawah.' }]); }
  }
  if (el.matches('[data-ai-in]')) { App.aiFile = el.files[0] || null; el.value = ''; const l = $('[data-ai-file]'); if (l) l.textContent = App.aiFile ? `Foto: ${App.aiFile.name || 'kamera'}` : 'Belum ada foto'; }
  if (el.matches('[data-import]')) { const f = el.files[0]; el.value = ''; if (f) importJSON(f); }
});
document.addEventListener('submit', e => { if (e.target.matches('[data-manual]')) { e.preventDefault(); const v = $('#manualCode').value; const code = parseQr(v) || v.trim().toUpperCase(); openSampleByCode(code); } });
window.addEventListener('hashchange', () => App.render());
window.addEventListener('online', () => { App.updateTop(); toast('Kembali online'); if (Store.all().some(r => r.meta.syncStatus !== 'synced')) Sync.run({ silent: true }); loadJsQR().catch(() => { }); });
window.addEventListener('offline', () => { App.updateTop(); toast('Offline. Data tetap tersimpan di perangkat.', 'warn'); });

(async function boot() {
  $$('[data-ic]').forEach(el => { el.outerHTML = el.dataset.ic === 'mark' ? MARK : I(el.dataset.ic, el.dataset.ic === 'scan' ? 26 : 24); });
  await Store.init(); await Settings.load(); await Auth.load(); registerSW();
  try { const c = await Store.kvGet('meta'); if (c && c.json) { const m = JSON.parse(c.json); if (!validateMeta(m).length && verCmp(m.app.metadataVersion, EMBEDDED_META.app.metadataVersion) >= 0) { META = m; META_SOURCE = c.source || 'lokal'; } } } catch (e) { }
  App.render();
  setTimeout(() => { if (navigator.onLine) { loadJsQR().catch(() => { }); Sync.run({ silent: true }); } }, 1500);
})();
