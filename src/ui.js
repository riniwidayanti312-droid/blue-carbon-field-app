/* =====================================================================
   UI — ikon, komponen, form engine, tampilan
   ===================================================================== */
const I = (name, size = 22, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  survey: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
  sample: '<path d="M7 3h10l-2 5v11a3 3 0 0 1-6 0V8z"/><path d="M9 13h6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 16h3"/>',
  leaf: '<path d="M12 21c0-7 0-12 6-17-1 7-3 11-6 13"/><path d="M12 21c0-6-1-9-6-13 0 6 2 9 6 11"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 3l9 17H3z"/><path d="M12 10v4M12 17v.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'
};
const MARK = `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="28" height="20" rx="4" fill="#FFD43B"/><circle cx="8" cy="16" r="2.2" fill="#0F2B2E"/><path d="M14 22c0-5 1-8 4-11M18 22c0-4 2-7 6-9M14 22c-1-3-2-5-4-6" stroke="#1C5A36" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

const GLYPHS = {
  strap: '<path d="M10 30V8M16 30V4M22 30V10" stroke-width="3.2"/>',
  cylinder: '<path d="M9 30C9 18 7 10 6 5M16 30V4M23 30c0-12 2-20 3-25" stroke-width="1.6"/>',
  oval: '<path d="M4 30h26" stroke-width="1.5"/><path d="M10 30v-8M22 30v-8"/><ellipse cx="7" cy="17" rx="3" ry="5"/><ellipse cx="13" cy="17" rx="3" ry="5"/><ellipse cx="19" cy="17" rx="3" ry="5"/><ellipse cx="25" cy="17" rx="3" ry="5"/>',
  stem: '<path d="M17 31V8"/><path d="M17 10c-4-2-7-1-9 1M17 10c4-2 7-1 9 1M17 17c-4-2-7-1-9 1M17 17c4-2 7-1 9 1M17 24c-3-2-6-1-8 1M17 24c3-2 6-1 8 1"/>',
  stilt: '<path d="M17 3v15"/><path d="M17 14c-6 2-9 8-11 16M17 14c6 2 9 8 11 16M17 16c-3 3-4 8-5 14M17 16c3 3 4 8 5 14"/><path d="M2 30h30" stroke-width="1.2"/>',
  pencil: '<path d="M2 22h30" stroke-width="1.2"/><path d="M6 22v-7M11 22v-9M16 22v-6M21 22v-10M26 22v-7"/><path d="M4 26h26" stroke-dasharray="2 2" stroke-width="1"/>',
  cone: '<path d="M2 26h30" stroke-width="1.2"/><path d="M5 26l3-12 3 12M14 26l3-16 3 16M23 26l3-11 3 11"/>',
  knee: '<path d="M2 24h30" stroke-width="1.2"/><path d="M3 24c2-10 5-10 7 0s5-10 7 0 5-10 7 0 5-10 7 0"/>',
  plank: '<path d="M17 3v10"/><path d="M17 13c-3 3-6 2-8 6s-4 5-7 6M17 13c3 3 6 2 8 6s4 5 7 6"/><path d="M2 28h30" stroke-width="1.2"/>',
  none: '<path d="M17 4v24"/><path d="M17 10c-5-3-9-2-11 0M17 10c5-3 9-2 11 0"/><path d="M2 28h30" stroke-width="1.2"/>'
};
const glyph = (g, cls = 'glyph') => g && GLYPHS[g] ? `<svg class="${cls}" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${GLYPHS[g]}</svg>` : '';

/* ---------- toast & dialog ---------- */
function toast(msg, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.setAttribute('role', 'status'); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3400); }
function openSheet({ title, body, footer, small, onClose }) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet ${small ? 'small' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Tutup" style="color:var(--ink)">${I('close')}</button></header><div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  document.body.appendChild(scrim); document.body.style.overflow = 'hidden';
  const close = (v) => { scrim.remove(); if (!$('.scrim')) document.body.style.overflow = ''; onClose && onClose(v); };
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) close(false); });
  scrim.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
  setTimeout(() => { const f = scrim.querySelector('.body input, .body select, .body textarea, footer .btn'); f && f.focus({ preventScroll: true }); }, 30);
  return { el: scrim, close };
}
function confirmDialog(title, text, okLabel = 'Lanjutkan', danger = false) {
  return new Promise(res => {
    const s = openSheet({ title, small: true, body: `<p>${text}</p>`, footer: `<button class="btn" data-close>Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>`, onClose: v => res(!!v) });
    s.el.querySelector('[data-ok]').onclick = () => s.close(true);
  });
}

/* ---------- display helpers ---------- */
const live = type => Store.all(type).filter(r => !r.meta.deleted);
const surveyOf = rec => rec.type === 'survey' ? rec : Store.get(rec.parentId);
const obsTitle = o => { const sp = ecoBy(o.data.ecosystem)?.observation; if (!sp) return 'Observasi'; return [o.data[sp.titleField], ...(sp.subtitleFields || []).map(k => o.data[k])].filter(v => !isEmpty(v)).join(' · ') || 'Observasi'; };
const gpsText = g => g && g.lat != null ? `${(+g.lat).toFixed(6)}, ${(+g.lon).toFixed(6)}` : '–';
function syncBadge(rec) { return rec.meta.syncStatus === 'synced' ? `<span class="badge ok" title="Tersinkron ${esc(fmtDT(rec.meta.syncedAt))}">${I('check', 14, 2.4)} Tersinkron</span>` : `<span class="badge pend">Belum terkirim</span>`; }
function issueBadge(rec) { const c = countIssues(validate(rec)); if (c.e) return `<span class="badge err">${c.e} galat</span>`; if (c.w) return `<span class="badge warn">${c.w} peringatan</span>`; return `<span class="badge ok">Lengkap</span>`; }
function fmtField(f, v, d) {
  if (f.type === 'computed') { const r = COMPUTE[f.formula]?.(d); return r ? esc(r.text) : '–'; }
  if (isEmpty(v)) return '<span class="muted">–</span>';
  switch (f.type) {
    case 'gps': return `${esc(gpsText(v))}${v.acc != null ? ` <span class="tiny">±${fmtNum(v.acc, 0)} m</span>` : ''} <span class="tiny">(${v.source === 'device' ? 'GPS perangkat' : 'input manual'})</span>`;
    case 'select': return esc(optLabel(f, v));
    case 'multiselect': return (v || []).map(esc).join('<br>');
    case 'datetime': return esc(fmtDT(v));
    case 'date': return esc(fmtD(v));
    case 'species': return `<i>${esc(v)}</i>`;
    case 'number': return `${fmtNum(v, 3)} ${esc(f.unit || '')}`;
    case 'ecosystem': return esc(ecoBy(v)?.label || v);
    case 'obsRef': { const o = Store.get(v); return o ? `<a href="#obs-${o.id}">${esc(obsTitle(o))}</a>` : '–'; }
    case 'textarea': return esc(v).replace(/\n/g, '<br>');
    default: return esc(v);
  }
}
function kvHTML(fields, d) {
  const rows = fields.filter(f => f.type !== 'photos' && f.type !== 'repeatTable').map(f => `<dt>${esc(f.label)}</dt><dd>${fmtField(f, d[f.key], d)}</dd>`).join('');
  const tables = fields.filter(f => f.type === 'repeatTable').map(f => {
    const rowsD = d[f.key] || [];
    return `<h3 style="margin:16px 0 8px">${esc(f.label)} <span class="tiny">(${rowsD.length})</span></h3>` + (rowsD.length ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${f.columns.map(c => `<th style="text-align:left;padding:6px 8px;border-bottom:1.5px solid var(--line-2);font-weight:650">${esc(c.label)}${c.unit ? ` <span class="tiny">${esc(c.unit)}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${rowsD.map(r => `<tr>${f.columns.map(c => `<td style="padding:6px 8px;border-bottom:1px solid var(--line)">${fmtField(c, r[c.key], r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Belum ada baris.</p>');
  }).join('');
  return `<dl class="kv">${rows}</dl>${tables}`;
}
function issuesHTML(iss, okText = 'Data lengkap dan konsisten.') {
  if (!iss.length) return `<ul class="issues"><li class="ok">${I('check', 18)} ${esc(okText)}</li></ul>`;
  return `<ul class="issues">${iss.sort((a, b) => a.level === b.level ? 0 : a.level === 'error' ? -1 : 1).map(i => `<li class="${i.level}">${I(i.level === 'error' ? 'alert' : 'alert', 18)}<span>${esc(i.msg)}</span></li>`).join('')}</ul>`;
}
function historyHTML(rec) {
  const allFields = specFor(rec).fields || [];
  const lbl = k => (allFields.find(f => f.key === k) || {}).label || k;
  const v = x => x == null || x === '' ? '∅' : typeof x === 'object' ? (x.lat != null ? gpsText(x) : Array.isArray(x) ? `${x.length} item` : '…') : String(x);
  return `<ul class="hist">${[...rec.history].reverse().map(h => `<li><div class="spread"><b>Rev ${h.rev} · ${esc(h.action)}</b><span class="tiny">${esc(fmtDT(h.at))}</span></div><div class="tiny">${esc(h.by || '–')} · ${esc(h.device || '')}</div>${h.changes ? `<div class="chg">${Object.entries(h.changes).map(([k, [a, b]]) => `${esc(lbl(k))}: <s>${esc(v(a))}</s> → <ins>${esc(v(b))}</ins>`).join('<br>')}</div>` : ''}${h.note ? `<div class="chg">${esc(h.note)}</div>` : ''}</li>`).join('')}</ul>`;
}
function photosHTML(parentId, removable = false) {
  const ps = live('photo').filter(p => p.parentId === parentId);
  if (!ps.length) return '<p class="muted small">Belum ada foto.</p>';
  return `<div class="photos">${ps.map(p => `<div class="ph" role="button" tabindex="0" data-act="view-photo" data-id="${p.id}"><img src="${p.data.thumb}" alt="Foto ${esc(photoCatLabel(p.data.category))}"><span class="cap">${esc(photoCatLabel(p.data.category))}</span>${removable ? `<button class="x" type="button" data-act="del-photo" data-id="${p.id}" aria-label="Hapus foto">${I('close', 16)}</button>` : ''}</div>`).join('')}</div>`;
}
function tagHTML(s, { mini = false, cls = '' } = {}) {
  const sv = surveyOf(s); const st = sampleTypeOf(s);
  return `<div class="tagcard ${mini ? 'mini' : ''} ${cls}"><div><div class="id code">${esc(s.data.sampleCode)}</div>${mini ? '' : `<div class="meta"><div>${esc(st?.label || s.data.sampleType)} · ${esc(ecoBy(s.data.ecosystem)?.label || '')}</div><div>${esc(sv?.data.siteName || s.data.siteCode || '')}</div><div>${esc(fmtDT(s.data.collectedAt))}</div></div>`}</div>${mini ? '' : `<div class="qr">${qrSVG(qrPayload(s.data.sampleCode))}</div>`}</div>`;
}

/* =====================================================================
   FORM ENGINE — merender form apa pun dari definisi field di metadata
   ===================================================================== */
function fieldDefault(f) {
  if (f.default === 'today') return today();
  if (f.default === 'now') return localDT();
  if (f.default === 'user') return userName();
  if (f.default != null) return f.default;
  if (f.type === 'multiselect' || f.type === 'repeatTable') return [];
  return '';
}
function inputHTML(f, v, ctx, name) {
  const nm = name || f.key; const id = 'f_' + nm.replace(/\W/g, '_');
  const common = `id="${id}" data-k="${esc(nm)}"`;
  switch (f.type) {
    case 'textarea': return `<textarea class="input" ${common} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    case 'select': case 'ecosystem': case 'species': case 'obsRef': {
      let opts;
      if (f.type === 'ecosystem') opts = ecoList().map(e => ({ value: e.code, label: e.label }));
      else if (f.type === 'species') opts = (ecoBy(ctx.eco)?.species || []).map(s => ({ value: s.name, label: s.name + (s.local ? ` – ${s.local}` : '') })).concat([{ value: 'Belum teridentifikasi', label: 'Belum teridentifikasi' }]);
      else if (f.type === 'obsRef') opts = live('observation').filter(o => o.parentId === ctx.surveyId).map(o => ({ value: o.id, label: obsTitle(o) }));
      else opts = fieldOptions(f);
      return `<select class="input" ${common}${ctx.lockEco && f.type === 'ecosystem' ? ' disabled' : ''}><option value="">— pilih —</option>${opts.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    }
    case 'multiselect': return `<div class="chips" role="group" aria-label="${esc(f.label)}">${fieldOptions(f).map(o => `<button type="button" class="chip" data-ms="${esc(nm)}" data-v="${esc(o.value)}" aria-pressed="${(v || []).includes(o.value)}">${esc(o.label)}</button>`).join('')}</div>`;
    case 'date': return `<input class="input" type="date" ${common} value="${esc(v)}">`;
    case 'datetime': return `<input class="input" type="datetime-local" ${common} value="${esc(v)}">`;
    case 'number': {
      const inp = `<input class="input" type="number" inputmode="decimal" ${common} value="${esc(v ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}">`;
      return f.unit ? `<div class="unitwrap">${inp}<span class="u">${esc(f.unit)}</span></div>` : inp;
    }
    default: return `<input class="input" type="text" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.uppercase ? 'autocapitalize="characters"' : ''} autocomplete="off">`;
  }
}
function gpsBoxHTML(f, g) {
  return `<div class="gpsbox" data-gps="${esc(f.key)}">
    <div class="spread"><div><div class="val">${g && g.lat != null ? esc(gpsText(g)) : 'Belum ada koordinat'}</div><div class="tiny">${g && g.lat != null ? `${g.acc != null ? `Akurasi ±${fmtNum(g.acc, 0)} m · ` : ''}${g.source === 'device' ? 'GPS perangkat' : 'Input manual'} · ${esc(fmtDT(g.at))}` : 'Ketuk “Ambil GPS”, atau isi manual dari GPS genggam.'}</div></div>
    <button type="button" class="btn sm dark" data-act="gps-get" data-k="${esc(f.key)}">${I('pin', 18)} Ambil GPS</button></div>
    <div class="gpsrow"><label class="tiny">Lintang (desimal)<input class="input" inputmode="decimal" data-gpsm="lat" data-k="${esc(f.key)}" value="${g && g.lat != null ? g.lat : ''}" placeholder="-8.2345"></label><label class="tiny">Bujur (desimal)<input class="input" inputmode="decimal" data-gpsm="lon" data-k="${esc(f.key)}" value="${g && g.lon != null ? g.lon : ''}" placeholder="124.5678"></label></div>
  </div>`;
}
function rtHTML(f, rows, ctx) {
  return `<div class="rt" data-rt="${esc(f.key)}">${(rows || []).map((r, i) => `<div class="rt-row"><span class="n">${i + 1}</span><div class="rt-cells">${f.columns.map(c => `<label>${esc(c.label)}${c.unit ? ` (${esc(c.unit)})` : ''}${inputHTML(c, r[c.key] ?? '', ctx, `${f.key}.${i}.${c.key}`)}</label>`).join('')}</div><button type="button" class="btn sm ghost rt-del" data-act="rt-del" data-k="${esc(f.key)}" data-i="${i}">${I('trash', 16)} Hapus baris</button></div>`).join('')}<div class="rt-foot"><button type="button" class="btn sm" data-act="rt-add" data-k="${esc(f.key)}">${I('plus', 18)} ${esc(f.addLabel || 'Tambah baris')}</button></div></div>`;
}
function photoFieldHTML(f, recId) {
  const cats = f.categories || META.photoCategories.map(c => c.code);
  return `<div data-photos="${recId}"><div class="row" style="margin-bottom:10px"><select class="input" data-photocat style="max-width:220px" aria-label="Kategori foto">${cats.map(c => `<option value="${c}">${esc(photoCatLabel(c))}</option>`).join('')}</select>
    <label class="btn sm dark">${I('camera', 18)} Kamera<input type="file" accept="image/*" capture="environment" data-photo-in hidden multiple></label>
    <label class="btn sm">${I('image', 18)} Galeri<input type="file" accept="image/*" data-photo-in hidden multiple></label></div>
    <div data-photolist>${photosHTML(recId, true)}</div></div>`;
}
function fieldHTML(f, d, ctx) {
  const v = d[f.key] ?? '';
  const lab = `${esc(f.label)}${f.required ? '<span class="req" aria-hidden="true">*</span>' : ''}`;
  let inner;
  if (f.type === 'gps') inner = gpsBoxHTML(f, d[f.key]);
  else if (f.type === 'repeatTable') inner = rtHTML(f, d[f.key] || [], ctx);
  else if (f.type === 'photos') inner = photoFieldHTML(f, ctx.recId);
  else if (f.type === 'computed') { const r = COMPUTE[f.formula]?.(d); inner = `<div class="computed" data-computed="${esc(f.key)}">${r ? esc(r.text) : 'Terhitung otomatis setelah data terisi'}</div>`; }
  else inner = inputHTML(f, v, ctx);
  const labelTag = ['gps', 'repeatTable', 'photos', 'computed', 'multiselect'].includes(f.type) ? `<span class="lbl">${lab}</span>` : `<label for="f_${f.key.replace(/\W/g, '_')}">${lab}</label>`;
  return `<div class="field" data-field="${esc(f.key)}">${labelTag}${inner}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
}

/* openForm: rec = record (baru atau lama), fields = daftar field metadata */
function openForm({ title, rec, fields, isNew, ctx, saveLabel = 'Simpan', onSaved }) {
  const draft = clone(rec.data);
  fields.forEach(f => { if (isNew && draft[f.key] === undefined && f.type !== 'computed' && f.type !== 'photos') draft[f.key] = fieldDefault(f); });
  ctx = Object.assign({ recId: rec.id, eco: draft.ecosystem, surveyId: rec.parentId }, ctx || {});
  const createdPhotos = [];
  const body = `<div class="form-issues" data-issues></div>${fields.map(f => fieldHTML(f, draft, ctx)).join('')}<p class="tiny">Tanda <span class="req">*</span> wajib diisi. Data tetap bisa disimpan walau belum lengkap; kekurangannya akan ditandai.</p>`;
  const sheet = openSheet({
    title, body, footer: `<button class="btn" data-close>Batal</button><button class="btn primary" data-save>${esc(saveLabel)}</button>`,
    onClose: async saved => { if (!saved && isNew) for (const id of createdPhotos) await Store.del(id); }
  });
  const root = sheet.el;
  const tmpRec = () => ({ ...rec, data: draft });
  const refresh = () => {
    $$('[data-computed]', root).forEach(el => { const f = fields.find(x => x.key === el.dataset.computed); const r = COMPUTE[f.formula]?.(draft); el.textContent = r ? r.text : 'Terhitung otomatis setelah data terisi'; });
    const fieldsSpec = specFor(tmpRec()); const keys = new Set(fields.map(f => f.key));
    const iss = validate(tmpRec()).filter(i => !i.field || keys.has(i.field));
    const c = countIssues(iss);
    $('[data-issues]', root).innerHTML = iss.length ? `<details ${c.e ? '' : ''}><summary class="small" style="cursor:pointer;font-weight:650">${c.e ? `<span class="badge err">${c.e} galat</span>` : ''} ${c.w ? `<span class="badge warn">${c.w} peringatan</span>` : ''} Lihat pemeriksaan data</summary><div style="margin-top:8px">${issuesHTML(iss)}</div></details>` : `<span class="badge ok">${I('check', 14, 2.4)} Pemeriksaan otomatis: lengkap</span>`;
    void fieldsSpec;
  };
  let t; const refreshSoon = () => { clearTimeout(t); t = setTimeout(refresh, 250); };
  const setPath = (path, val) => {
    const p = path.split('.');
    if (p.length === 3) { draft[p[0]][+p[1]][p[2]] = val; } else draft[path] = val;
  };
  const colOf = path => { const p = path.split('.'); const f = fields.find(x => x.key === p[0]); return p.length === 3 ? f.columns.find(c => c.key === p[2]) : f; };
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.gpsm) {
      const k = el.dataset.k; const g = Object.assign({}, draft[k] || {});
      const v = el.value.trim().replace(',', '.');
      g[el.dataset.gpsm] = v === '' || isNaN(+v) ? null : +v; g.source = 'manual'; g.acc = null; g.at = nowISO();
      draft[k] = (g.lat == null && g.lon == null) ? null : g;
      const box = el.closest('.gpsbox'); const val = box.querySelector('.val'); val.textContent = draft[k]?.lat != null && draft[k]?.lon != null ? gpsText(draft[k]) : 'Belum lengkap';
      refreshSoon(); return;
    }
    if (!el.dataset.k || el.matches('select')) return;
    const f = colOf(el.dataset.k); let v = el.value;
    if (f?.uppercase) { v = v.toUpperCase(); if (el.value !== v) el.value = v; }
    if (f?.type === 'number') v = v === '' ? '' : (isNaN(+v) ? v : +v);
    setPath(el.dataset.k, v); refreshSoon();
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('select[data-k]')) {
      setPath(el.dataset.k, el.value);
      const f = colOf(el.dataset.k);
      if (f?.type === 'obsRef' && el.value) { const o = Store.get(el.value); const gk = fields.find(x => x.type === 'gps')?.key; if (o && gk && !(draft[gk]?.lat != null) && o.data.gps?.lat != null) { draft[gk] = { ...o.data.gps, note: 'disalin dari observasi' }; const box = $(`[data-gps="${gk}"]`, root); box.outerHTML = gpsBoxHTML(fields.find(x => x.key === gk), draft[gk]); toast('Koordinat disalin dari ' + obsTitle(o)); } }
      if (f?.type === 'ecosystem') { ctx.eco = el.value; draft.ecosystem = el.value; }
      refreshSoon();
    }
    if (el.matches('[data-photo-in]')) {
      const cat = $('[data-photocat]', el.closest('[data-photos]')).value;
      const files = [...el.files]; el.value = '';
      (async () => {
        for (const file of files) { try { const p = await processPhoto(file, cat, rec.id, draft.gps); createdPhotos.push(p.id); } catch (err) { toast('Foto gagal diproses: ' + err.message, 'err'); } }
        $('[data-photolist]', root).innerHTML = photosHTML(rec.id, true); refresh();
      })();
    }
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act],[data-ms],[data-save]'); if (!b || !root.contains(b)) return;
    if (b.dataset.ms) { const arr = draft[b.dataset.ms] || []; const v = b.dataset.v; const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); draft[b.dataset.ms] = arr; b.setAttribute('aria-pressed', i < 0); refreshSoon(); return; }
    if ('save' in b.dataset) {
      b.disabled = true;
      try { await saveRecord(rec, draft, isNew ? 'dibuat' : (ctx.action || 'diubah')); sheet.close(true); toast(isNew ? 'Tersimpan di perangkat' : 'Perubahan tersimpan'); onSaved && onSaved(rec); }
      catch (err) { b.disabled = false; toast('Gagal menyimpan: ' + err.message, 'err'); }
      return;
    }
    const act = b.dataset.act;
    if (act === 'rt-add') { const f = fields.find(x => x.key === b.dataset.k); const row = {}; f.columns.forEach(c => row[c.key] = fieldDefault(c)); (draft[f.key] = draft[f.key] || []).push(row); $(`[data-rt="${f.key}"]`, root).outerHTML = rtHTML(f, draft[f.key], ctx); const rows = $$(`[data-rt="${f.key}"] .rt-row`, root); rows[rows.length - 1]?.querySelector('select,input')?.focus(); refreshSoon(); }
    if (act === 'rt-del') { const f = fields.find(x => x.key === b.dataset.k); draft[f.key].splice(+b.dataset.i, 1); $(`[data-rt="${f.key}"]`, root).outerHTML = rtHTML(f, draft[f.key], ctx); refreshSoon(); }
    if (act === 'gps-get') {
      const k = b.dataset.k; b.disabled = true; b.innerHTML = `${I('pin', 18)} Mencari sinyal…`;
      try { draft[k] = await getGPS(); toast(`Koordinat diambil, akurasi ±${fmtNum(draft[k].acc, 0)} m`); }
      catch (err) { toast(err.message, 'warn'); }
      const box = $(`[data-gps="${k}"]`, root); box.outerHTML = gpsBoxHTML(fields.find(x => x.key === k), draft[k]); refreshSoon();
    }
    if (act === 'del-photo') { e.stopPropagation(); const p = Store.get(b.dataset.id); if (p && await confirmDialog('Hapus foto?', 'Foto ditandai terhapus dan tetap tercatat di riwayat.', 'Hapus foto', true)) { if (createdPhotos.includes(p.id)) await Store.del(p.id); else { p.meta.deleted = true; await saveRecord(p, null); } $('[data-photolist]', root).innerHTML = photosHTML(rec.id, true); refresh(); } }
    if (act === 'view-photo') viewPhoto(b.dataset.id);
  });
  refresh();
  return sheet;
}

/* ---------- GPS ---------- */
function getGPS() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Perangkat tidak menyediakan GPS. Isi koordinat manual.'));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: +p.coords.latitude.toFixed(7), lon: +p.coords.longitude.toFixed(7), acc: Math.round(p.coords.accuracy * 10) / 10, alt: p.coords.altitude, source: 'device', at: new Date(p.timestamp).toISOString() }),
      err => rej(new Error(err.code === 1 ? 'Akses lokasi ditolak di tampilan ini. Isi koordinat manual dari GPS genggam, atau buka aplikasi di browser langsung.' : 'Sinyal GPS belum didapat. Coba lagi di tempat terbuka atau isi manual.')),
      { enableHighAccuracy: true, timeout: META.gps.timeoutMs || 20000, maximumAge: 5000 });
  });
}

/* ---------- foto: kompres + metadata ---------- */
async function loadBitmap(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { } }
  return await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { res(im); URL.revokeObjectURL(u); }; im.onerror = () => rej(new Error('format gambar tidak didukung')); im.src = u; });
}
function encode(img, maxPx, q) {
  const w0 = img.width, h0 = img.height, s = Math.min(1, maxPx / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', q), w: c.width, h: c.height };
}
async function processPhoto(file, category, parentId, gps) {
  const img = await loadBitmap(file);
  let q = META.sync.photoQuality, px = META.sync.photoMaxPx, out = encode(img, px, q);
  while (out.url.length > 200000 && q > 0.35) { q -= 0.08; out = encode(img, px, q); }
  while (out.url.length > 200000 && px > 500) { px -= 150; out = encode(img, px, q); }
  const thumb = encode(img, META.sync.thumbPx, 0.6).url;
  const rec = newRecord('photo', { category, caption: '', dataUrl: out.url, thumb, takenAt: new Date(file.lastModified || Date.now()).toISOString(), gps: gps && gps.lat != null ? gps : null, width: out.w, height: out.h, originalName: file.name, originalBytes: file.size, bytes: Math.round(out.url.length * 0.75) }, parentId);
  await saveRecord(rec, null);
  return rec;
}
function viewPhoto(id) {
  const p = Store.get(id); if (!p) return; const d = p.data;
  openSheet({ title: photoCatLabel(d.category), body: `<div class="viewer"><img src="${d.dataUrl}" alt="Foto ${esc(photoCatLabel(d.category))}"></div><dl class="kv" style="margin-top:12px"><dt>Waktu foto</dt><dd>${esc(fmtDT(d.takenAt))}</dd><dt>Koordinat</dt><dd>${esc(gpsText(d.gps))}</dd><dt>Diambil oleh</dt><dd>${esc(p.meta.createdBy)} · ${esc(p.meta.deviceId)}</dd><dt>Ukuran</dt><dd>${d.width}×${d.height} px · ${fmtNum(d.bytes / 1024, 0)} KB (asli ${fmtNum((d.originalBytes || 0) / 1024, 0)} KB)</dd><dt>Nama berkas asli</dt><dd>${esc(d.originalName || '–')}</dd><dt>Hash SHA-256</dt><dd class="mono" style="word-break:break-all">${esc(p.meta.hash || '–')}</dd><dt>Sinkron</dt><dd>${syncBadge(p)}</dd></dl>` });
}
