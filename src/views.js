/* =====================================================================
   TAMPILAN (VIEWS)
   ===================================================================== */
const V = {};
const ecoBadge = code => { const e = ecoBy(code); return e ? `<span class="badge eco-${esc(code)}">${esc(e.label)}</span>` : ''; };
const ecoColor = code => ecoBy(code)?.color || '#999';
const LAB_COLORS = ['#B7C7C2', '#8FB3C4', '#1D5F7A', '#C99A00', '#2E7D4F', '#1C5A36'];

V.home = () => {
  const surveys = live('survey'), obs = live('observation'), samples = live('sample');
  const pending = Store.all().filter(r => r.meta.syncStatus !== 'synced').length;
  const withErr = [...obs, ...samples, ...surveys].filter(r => countIssues(validate(r)).e > 0).length;
  const latest = [...samples].sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt))[0];
  const labCounts = META.labStatus.map(s => samples.filter(x => (x.data.labStatus || 'FIELD') === s.code).length);
  const name = Settings.v.userName;
  return `
  ${!Store.persistent ? `<div class="banner">${I('alert', 20)}<div>Penyimpanan perangkat tidak tersedia di tampilan ini. Data hanya ada selama halaman terbuka. Ekspor JSON sebelum menutup halaman, atau buka aplikasi di browser biasa.</div></div>` : ''}
  <section class="hello">
    <div>
      <p class="muted">${name ? `Halo, ${esc(name)}.` : 'Halo, tim lapangan.'} ${navigator.onLine ? '' : 'Anda sedang offline; semua data tetap tersimpan di perangkat.'}</p>
      <h1>Data lapangan karbon biru, tercatat di tempat.</h1>
      <p class="muted" style="margin-top:8px">Koordinat, foto, kode sampel, dan pemeriksaan data dalam satu alur untuk survei lamun dan mangrove.</p>
      <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="new-survey">${I('plus', 20)} Mulai survei</button><a class="btn" href="#scan">${I('scan', 20)} Pindai label</a></div>
      ${!name ? `<p class="small" style="margin-top:12px"><a href="#data">Isi nama petugas</a> agar tercatat di setiap data.</p>` : ''}
    </div>
    ${latest ? `<a href="#sample-${esc(latest.data.sampleCode)}" style="text-decoration:none;color:inherit" aria-label="Sampel terbaru ${esc(latest.data.sampleCode)}">${tagHTML(latest, { cls: 'hero-tag' })}</a>`
      : `<div class="tagcard hero-tag" aria-label="Contoh label sampel"><div><div class="id code">LM-2026-ALOR-001</div><div class="meta"><div>Contoh label sampel</div><div>Kode unik + QR dibuat otomatis</div><div>saat sampel dicatat</div></div></div><div class="qr">${qrSVG(qrPayload('LM-2026-ALOR-001'))}</div></div>`}
  </section>
  <div class="section stats" role="list">
    <div class="stat" role="listitem"><b>${surveys.length}</b><span>Survei</span></div>
    <div class="stat" role="listitem"><b>${obs.length}</b><span>Plot & kuadran</span></div>
    <div class="stat" role="listitem"><b>${samples.length}</b><span>Sampel</span></div>
    <div class="stat ${withErr ? 'alert' : ''}" role="listitem"><b>${withErr}</b><span>Perlu dilengkapi</span></div>
  </div>
  <div class="section grid2">
    <div>
      <div class="spread" style="margin-bottom:10px"><h2>Survei terbaru</h2><a class="small" href="#surveys">Semua survei</a></div>
      ${surveys.length ? `<div class="list">${surveys.sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt)).slice(0, 5).map(surveyItem).join('')}</div>`
        : `<div class="list"><div class="empty"><h3>Belum ada survei</h3><p>Buat survei untuk lokasi yang akan didatangi, lalu catat plot dan sampel di dalamnya.</p><div class="btns" style="justify-content:center"><button class="btn primary sm" data-act="new-survey">Mulai survei</button><button class="btn sm" data-act="demo">Muat data contoh</button></div></div></div>`}
    </div>
    <div>
      <h2 style="margin-bottom:10px">Status laboratorium</h2>
      <div class="panel">
        ${samples.length ? `<div class="labbar" role="img" aria-label="Distribusi status laboratorium">${labCounts.map((n, i) => n ? `<i style="width:${n / samples.length * 100}%;background:${LAB_COLORS[i]}"></i>` : '').join('')}</div>
        <div class="legend">${META.labStatus.map((s, i) => `<span><i style="background:${LAB_COLORS[i]}"></i>${esc(s.label)} <b>${labCounts[i]}</b></span>`).join('')}</div>` : `<p class="muted small" style="margin:0">Status pengujian tiap sampel akan tampil di sini, dari dikemas di lapangan sampai diverifikasi.</p>`}
      </div>
      <div class="panel">
        <div class="spread"><div><b>${pending}</b> data belum terkirim ke server</div><button class="btn sm dark" data-act="sync" ${pending ? '' : 'disabled'}>${I('sync', 18)} Sinkronkan</button></div>
        <p class="tiny" style="margin:6px 0 0">${Sync.lastText()}</p>
      </div>
    </div>
  </div>`;
};
function surveyItem(s) {
  const nObs = live('observation').filter(o => o.parentId === s.id).length, nS = live('sample').filter(o => o.parentId === s.id).length;
  return `<a class="item" href="#survey-${s.id}"><span class="eco-bar" style="background:${ecoColor(s.data.ecosystem)}"></span><div class="main"><div class="t">${esc(s.data.title || s.data.siteName || 'Survei')}</div><div class="s">${esc(s.data.siteCode || '')} · ${esc(s.data.regency || '')} · ${fmtD(s.data.startDate)} · ${nObs} plot · ${nS} sampel</div></div>${issueBadge(s)}</a>`;
}

V.surveys = () => {
  const q = (App.state.q || '').toLowerCase();
  const list = live('survey').filter(s => !q || JSON.stringify(s.data).toLowerCase().includes(q)).sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
  return `<div class="pagehead"><div><h1>Survei</h1><p class="muted">Satu survei = satu lokasi dan satu ekosistem dalam satu kegiatan.</p></div><button class="btn primary" data-act="new-survey">${I('plus', 20)} Survei baru</button></div>
  <div class="search" style="margin-bottom:12px">${I('search', 20)}<input class="input" type="search" placeholder="Cari nama, lokasi, kode…" value="${esc(App.state.q || '')}" data-search aria-label="Cari survei"></div>
  ${list.length ? `<div class="list">${list.map(surveyItem).join('')}</div>` : `<div class="list"><div class="empty"><h3>${q ? 'Tidak ada survei yang cocok' : 'Belum ada survei'}</h3><p>${q ? 'Coba kata kunci lain.' : 'Mulai dengan membuat survei untuk lokasi lapangan.'}</p></div></div>`}`;
};

V.survey = id => {
  const s = Store.get(id); if (!s || s.meta.deleted) return notFound('Survei tidak ditemukan di perangkat ini.');
  const eco = ecoBy(s.data.ecosystem); const tab = App.state.stab || 'obs';
  const obs = live('observation').filter(o => o.parentId === id).sort((a, b) => (a.data.observedAt || '').localeCompare(b.data.observedAt || ''));
  const smp = live('sample').filter(o => o.parentId === id).sort((a, b) => a.data.sampleCode.localeCompare(b.data.sampleCode));
  const iss = validate(s);
  return `<a class="back" href="#surveys">${I('back', 18)} Survei</a>
  <div class="pagehead"><div><div class="row" style="margin-bottom:6px">${ecoBadge(s.data.ecosystem)}<span class="badge code">${esc(s.data.siteCode || '')}</span>${syncBadge(s)}</div><h1>${esc(s.data.title || 'Survei')}</h1><p class="muted">${esc(s.data.siteName || '')}, ${esc(s.data.regency || '')}, ${esc(s.data.province || '')} · ${fmtD(s.data.startDate)}${s.data.endDate ? ' – ' + fmtD(s.data.endDate) : ''}</p></div>
  <div class="btns"><button class="btn primary" data-act="new-obs" data-id="${id}">${I('plus', 20)} ${esc(eco?.observation.label || 'Observasi')}</button>${(eco?.sampleTypes || []).map(st => `<button class="btn tag" data-act="new-sample" data-id="${id}" data-st="${st.code}">${I('sample', 20)} ${esc(st.label)}</button>`).join('')}</div></div>
  <div class="tabs" role="tablist">${[['obs', `${eco?.observation.label || 'Observasi'} (${obs.length})`], ['smp', `Sampel (${smp.length})`], ['info', 'Info & riwayat']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="stab" data-v="${k}">${esc(l)}</button>`).join('')}</div>
  ${tab === 'obs' ? (obs.length ? `<div class="list">${obs.map(o => `<a class="item" href="#obs-${o.id}"><div class="main"><div class="t">${esc(obsTitle(o))}</div><div class="s">${fmtDT(o.data.observedAt)} · ${esc(gpsText(o.data.gps))} · ${photosOf(o.id).filter(p => !p.meta.deleted).length} foto</div></div>${issueBadge(o)}</a>`).join('')}</div>` : `<div class="list"><div class="empty"><h3>Belum ada ${esc((eco?.observation.label || 'observasi').toLowerCase())}</h3><p>Catat setiap plot/kuadran beserta koordinat dan fotonya.</p><button class="btn primary sm" data-act="new-obs" data-id="${id}">Tambah ${esc((eco?.observation.label || 'observasi').toLowerCase())}</button></div></div>`) : ''}
  ${tab === 'smp' ? (smp.length ? `<div class="list">${smp.map(sampleItem).join('')}</div>` : `<div class="list"><div class="empty"><h3>Belum ada sampel</h3><p>Setiap sampel otomatis mendapat kode unik dan QR, contoh ${esc(nextSampleCode(s.data.ecosystem, s.data.siteCode || 'SITE', (s.data.startDate || today()).slice(0, 4), ''))}.</p></div></div>`) : ''}
  ${tab === 'info' ? `<div class="grid2"><div class="panel">${kvHTML(META.surveyForm.fields, s.data)}<div class="btns" style="margin-top:12px"><button class="btn sm" data-act="edit-survey" data-id="${id}">${I('edit', 18)} Ubah survei</button><button class="btn sm danger" data-act="delete" data-id="${id}">${I('trash', 18)} Hapus</button></div></div><div><div class="panel"><h3 style="margin-bottom:8px">Pemeriksaan data</h3>${issuesHTML(iss)}</div><div class="panel"><h3 style="margin-bottom:8px">Riwayat perubahan</h3>${historyHTML(s)}</div></div></div>` : ''}`;
};
function sampleItem(x) {
  const st = sampleTypeOf(x); const li = labIndex(x.data.labStatus || 'FIELD');
  return `<a class="item" href="#sample-${esc(x.data.sampleCode)}"><div class="tagcard mini" style="min-width:0;flex:none"><div class="id code" style="font-size:18px">${esc(x.data.sampleCode)}</div></div><div class="main"><div class="t">${esc(st?.label || '')}${x.data.depthTop != null && x.data.depthTop !== '' ? ` · ${fmtNum(x.data.depthTop, 1)}–${fmtNum(x.data.depthBottom, 1)} cm` : ''}</div><div class="s"><span style="color:${LAB_COLORS[li] || '#999'}">●</span> ${esc(labLabel(x.data.labStatus || 'FIELD'))} · ${fmtDT(x.data.collectedAt)}</div></div>${issueBadge(x)}</a>`;
}

V.obs = id => {
  const o = Store.get(id); if (!o || o.meta.deleted) return notFound('Observasi tidak ditemukan.');
  const s = Store.get(o.parentId); const eco = ecoBy(o.data.ecosystem);
  const linked = live('sample').filter(x => x.data.linkedObs === id);
  return `<a class="back" href="#survey-${o.parentId}">${I('back', 18)} ${esc(s?.data.title || 'Survei')}</a>
  <div class="pagehead"><div><div class="row" style="margin-bottom:6px">${ecoBadge(o.data.ecosystem)}${syncBadge(o)}</div><h1>${esc(eco?.observation.label || 'Observasi')} ${esc(obsTitle(o))}</h1><p class="muted">${fmtDT(o.data.observedAt)} · dicatat ${esc(o.meta.createdBy)}</p></div>
  <div class="btns"><button class="btn" data-act="edit-obs" data-id="${id}">${I('edit', 20)} Ubah</button>${(eco?.sampleTypes || []).map(st => `<button class="btn tag" data-act="new-sample" data-id="${o.parentId}" data-st="${st.code}" data-obs="${id}">${I('sample', 20)} ${esc(st.label)}</button>`).join('')}</div></div>
  <div class="grid2" style="align-items:start"><div><div class="panel"><h3 style="margin-bottom:8px">Pemeriksaan data</h3>${issuesHTML(validate(o))}</div><div class="panel">${kvHTML(eco.observation.fields, o.data)}</div></div>
  <div>
  <div class="panel"><h3 style="margin-bottom:8px">Foto</h3>${photosHTML(id)}</div>
  ${linked.length ? `<div class="panel"><h3 style="margin-bottom:8px">Sampel dari titik ini</h3><div class="list">${linked.map(sampleItem).join('')}</div></div>` : ''}
  <div class="panel"><h3 style="margin-bottom:8px">Riwayat perubahan</h3>${historyHTML(o)}<div class="btns" style="margin-top:10px"><button class="btn sm danger" data-act="delete" data-id="${id}">${I('trash', 18)} Hapus observasi</button></div></div></div></div>`;
};

V.samples = () => {
  const f = App.state.labf || ''; const q = (App.state.q || '').toLowerCase();
  const all = live('sample');
  const list = all.filter(x => (!f || (x.data.labStatus || 'FIELD') === f) && (!q || (x.data.sampleCode + ' ' + (surveyOf(x)?.data.siteName || '')).toLowerCase().includes(q))).sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt));
  return `<div class="pagehead"><div><h1>Sampel</h1><p class="muted">Lacak setiap sampel dari lapangan sampai hasil laboratorium.</p></div><a class="btn tag" href="#scan">${I('scan', 20)} Pindai QR</a></div>
  <div class="search" style="margin-bottom:12px">${I('search', 20)}<input class="input" type="search" placeholder="Cari kode sampel atau lokasi…" value="${esc(App.state.q || '')}" data-search aria-label="Cari sampel"></div>
  <div class="chips" style="margin-bottom:14px"><button class="chip" data-act="labf" data-v="" aria-pressed="${!f}">Semua (${all.length})</button>${META.labStatus.map(s => `<button class="chip" data-act="labf" data-v="${s.code}" aria-pressed="${f === s.code}">${esc(s.label)} (${all.filter(x => (x.data.labStatus || 'FIELD') === s.code).length})</button>`).join('')}</div>
  ${list.length ? `<div class="list">${list.map(sampleItem).join('')}</div>` : `<div class="list"><div class="empty"><h3>${all.length ? 'Tidak ada sampel dengan filter ini' : 'Belum ada sampel'}</h3><p>${all.length ? 'Ubah filter status atau kata kunci.' : 'Sampel dibuat dari dalam survei atau plot. Kode dan QR terbentuk otomatis.'}</p></div></div>`}`;
};

V.sample = code => {
  const x = live('sample').find(s => s.data.sampleCode === code);
  if (!x) return `<a class="back" href="#samples">${I('back', 18)} Sampel</a>${notFound(`Sampel ${esc(code)} belum ada di perangkat ini.`, Sync.available ? `<button class="btn dark" data-act="remote-lookup" data-v="${esc(code)}">${I('sync', 18)} Cari di server</button>` : '')}`;
  const s = surveyOf(x); const st = sampleTypeOf(x); const li = labIndex(x.data.labStatus || 'FIELD');
  const carbon = st?.carbon && COMPUTE[st.carbon.formula]?.(x.data);
  const fieldOnly = st.fields.filter(f => !['gps', 'collectedAt', 'photos', 'notes'].includes(f.key));
  const team = [s?.data.teamLeader, ...(s?.data.teamMembers || '').split(/\n|,/)].map(t => (t || '').trim()).filter(Boolean);
  const g = x.data.gps;
  return `<a class="back" href="#survey-${x.parentId}">${I('back', 18)} ${esc(s?.data.title || 'Survei')}</a>
  <div class="grid2" style="align-items:start">
    <div>
      ${tagHTML(x)}
      <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="edit-lab" data-id="${x.id}">${I('edit', 20)} Status & hasil lab</button><button class="btn" data-act="edit-sample" data-id="${x.id}">Data lapangan</button><button class="btn" data-act="label" data-id="${x.id}">${I('download', 20)} Label</button></div>
      <div class="panel" style="margin-top:14px"><h3 style="margin-bottom:8px">Pemeriksaan data</h3>${issuesHTML(validate(x))}</div>
      <div class="panel"><h3 style="margin-bottom:10px">Status pengujian laboratorium</h3>
        <ol class="steps">${META.labStatus.map((l, i) => `<li data-n="${i + 1}" class="${i < li ? 'done' : i === li ? 'now' : ''}"><span>${esc(l.label)}</span></li>`).join('')}</ol></div>
      <div class="panel"><h3 style="margin-bottom:10px">Hasil analisis</h3>
        ${carbon ? `<div class="carbon" style="margin-bottom:12px"><div><b>${fmtNum(carbon.value, 2)}</b><span>${esc(carbon.unit)}</span></div><div><b>${fmtNum(carbon.co2e, 2)}</b><span>Mg CO₂e/ha</span></div></div>` : ''}
        ${kvHTML((st.labFields || []).filter(f => f.key !== 'labStatus'), x.data)}</div>
    </div>
    <div>
      <div class="panel"><h3 style="margin-bottom:8px">Lokasi pengambilan</h3><dl class="kv"><dt>Koordinat</dt><dd>${g && g.lat != null ? `${fmtField({ type: 'gps' }, g)}<br><a href="https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=16/${g.lat}/${g.lon}" target="_blank" rel="noopener">Buka di peta</a>` : '<span class="muted">Belum ada</span>'}</dd><dt>Lokasi</dt><dd>${esc(s?.data.siteName || '–')}, ${esc(s?.data.regency || '')}, ${esc(s?.data.province || '')}</dd><dt>Titik asal</dt><dd>${fmtField({ type: 'obsRef' }, x.data.linkedObs)}</dd></dl></div>
      <div class="panel"><h3 style="margin-bottom:8px">Tanggal, waktu & tim</h3><dl class="kv"><dt>Waktu pengambilan</dt><dd>${esc(fmtDT(x.data.collectedAt))}</dd><dt>Tim survei</dt><dd>${team.map(esc).join('<br>') || '–'}</dd><dt>Dicatat oleh</dt><dd>${esc(x.meta.createdBy)} · ${esc(x.meta.deviceId)}</dd></dl></div>
      <div class="panel"><h3 style="margin-bottom:8px">Sampel & perlakuan</h3>${kvHTML(fieldOnly, x.data)}${x.data.notes ? `<p class="small" style="margin-top:10px">${esc(x.data.notes)}</p>` : ''}</div>
      <div class="panel"><h3 style="margin-bottom:8px">Foto</h3>${photosHTML(x.id)}</div>
      <div class="panel"><h3 style="margin-bottom:8px">Riwayat perubahan</h3>${historyHTML(x)}</div>
      <div class="panel"><h3 style="margin-bottom:8px">Integritas data</h3><dl class="kv"><dt>Revisi</dt><dd>${x.meta.rev}</dd><dt>Sinkron</dt><dd>${syncBadge(x)}</dd><dt>Versi metadata</dt><dd>${esc(x.meta.metadataVersion)}</dd><dt>Hash SHA-256</dt><dd class="mono" style="word-break:break-all">${esc(x.meta.hash || '–')}</dd><dt>ID record</dt><dd class="mono">${esc(x.id)}</dd></dl><div class="btns" style="margin-top:10px"><button class="btn sm danger" data-act="delete" data-id="${x.id}">${I('trash', 18)} Hapus sampel</button></div></div>
    </div>
  </div>`;
};

V.scan = () => `<div class="pagehead"><div><h1>Pindai label sampel</h1><p class="muted">Foto QR pada kantong sampel untuk melihat lokasi, tim, perlakuan, status lab, hasil, dan riwayatnya.</p></div></div>
  <div class="scanbox">${I('scan', 56, 1.6)}<div class="btns" style="justify-content:center"><label class="btn tag">${I('camera', 20)} Foto QR dengan kamera<input type="file" accept="image/*" capture="environment" data-scan-in hidden></label><label class="btn" for="scanGallery">${I('image', 20)} Pilih gambar</label></div><input type="file" accept="image/*" data-scan-in hidden id="scanGallery"><p class="tiny" style="max-width:420px">Dekatkan kamera sampai QR memenuhi sekitar sepertiga foto dan tidak buram. Pemindaian berjalan di perangkat.</p><div data-scan-out></div></div>
  <div class="panel" style="margin-top:14px"><form data-manual class="row"><label for="manualCode" class="sr">Kode sampel</label><input id="manualCode" class="input code" style="flex:1;min-width:200px;font-size:20px" placeholder="LM-2026-ALOR-001" autocapitalize="characters" autocomplete="off"><button class="btn dark" type="submit">Buka sampel</button></form><p class="tiny" style="margin:8px 0 0">Ketik kode bila label basah atau QR rusak.</p></div>`;

V.species = () => {
  const ecos = ecoList().filter(e => e.species?.length); const ek = App.state.spEco && ecoBy(App.state.spEco)?.species?.length ? App.state.spEco : ecos[0]?.code;
  const eco = ecoBy(ek); const flt = (App.state.spf ||= {})[ek] ||= {}; const q = (App.state.q || '').toLowerCase();
  const list = eco.species.filter(s => Object.entries(flt).every(([k, v]) => !v || s.traits[k] === v) && (!q || (s.name + ' ' + s.local + ' ' + s.keys.join(' ')).toLowerCase().includes(q)));
  const primary = eco.traits[0];
  return `<div class="pagehead"><div><h1>Identifikasi jenis</h1><p class="muted">Pilih ciri yang terlihat untuk mempersempit kandidat. Kunci ini bekerja offline.</p></div></div>
  <div class="tabs" role="tablist">${ecos.map(e => `<button role="tab" aria-selected="${e.code === ek}" data-act="spEco" data-v="${e.code}">${esc(e.label)} (${e.species.length})</button>`).join('')}</div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="panel">${eco.traits.map(t => `<div style="margin-bottom:12px"><div class="small" style="font-weight:650;margin-bottom:6px">${esc(t.label)}</div><div class="chips">${t.options.map(o => `<button class="chip" data-act="spf" data-t="${t.key}" data-v="${esc(o.value)}" aria-pressed="${flt[t.key] === o.value}">${glyph(o.glyph, 'glyph')}${esc(o.label)}</button>`).join('')}</div></div>`).join('')}
      ${Object.values(flt).some(Boolean) ? `<button class="btn sm ghost" data-act="spf-reset">Hapus semua pilihan ciri</button>` : ''}</div>
      <div class="panel" id="aiPanel"><div class="row" style="margin-bottom:6px">${I('sparkle', 22)}<h3>Bantuan AI dari foto</h3></div>
        <p class="small muted">Unggah foto ${esc(eco.label.toLowerCase())} (daun, akar, buah) dan catatan ciri. AI memberi kandidat dari daftar jenis di metadata beserta ciri yang perlu dicek. Butuh internet.</p>
        <div class="row" style="margin-bottom:8px"><label class="btn sm dark">${I('camera', 18)} Kamera<input type="file" accept="image/*" capture="environment" data-ai-in hidden></label><label class="btn sm">${I('image', 18)} Galeri<input type="file" accept="image/*" data-ai-in hidden></label><span class="tiny" data-ai-file>Belum ada foto</span></div>
        <textarea class="input" data-ai-notes placeholder="Contoh: daun pita ±12 cm, ujung bergerigi, substrat pasir berlumpur"></textarea>
        <button class="btn primary block" style="margin-top:10px" data-act="ai-id" data-eco="${ek}">${I('sparkle', 20)} Identifikasi</button>
        <div data-ai-out style="margin-top:12px"></div></div>
    </div>
    <div>
      <div class="search" style="margin-bottom:10px">${I('search', 20)}<input class="input" type="search" placeholder="Cari nama ilmiah atau lokal…" value="${esc(App.state.q || '')}" data-search aria-label="Cari jenis"></div>
      <div class="list">${list.length ? list.map(s => `<div class="sp"><div class="row" style="flex-wrap:nowrap;align-items:flex-start">${glyph((primary.options.find(o => o.value === s.traits[primary.key]) || {}).glyph)}<div><h3>${esc(s.name)}</h3>${s.local ? `<div class="small muted">${esc(s.local)}</div>` : ''}</div></div><ul>${s.keys.map(k => `<li>${esc(k)}</li>`).join('')}</ul><div class="hab">Habitat: ${esc(s.habitat)}</div></div>`).join('') : `<div class="empty"><h3>Tidak ada jenis dengan kombinasi ciri ini</h3><p>Lepaskan salah satu ciri, atau catat sebagai “Belum teridentifikasi” dan ambil foto spesimen.</p></div>`}</div>
      <p class="tiny" style="margin-top:10px">${esc(META.app.disclaimer)}</p>
    </div>
  </div>`;
};

V.data = () => {
  const counts = ['survey', 'observation', 'sample', 'photo'].map(t => live(t).length);
  const pending = Store.all().filter(r => r.meta.syncStatus !== 'synced').length;
  const demo = Store.all().filter(r => r.meta.demo).length;
  return `<div class="pagehead"><div><h1>Data & pengaturan</h1><p class="muted">Profil petugas, sinkronisasi, ekspor ke MRV Calculator, dan metadata aplikasi.</p></div></div>
  <div class="grid2" style="align-items:start"><div>
    <div class="panel"><h2 style="margin-bottom:12px">Petugas & perangkat</h2>
      <div class="field"><label for="uName">Nama petugas</label><input id="uName" class="input" data-setting="userName" value="${esc(Settings.v.userName)}" placeholder="Nama lengkap"><div class="help">Tercatat sebagai pembuat dan pengubah data di riwayat.</div></div>
      <dl class="kv"><dt>ID perangkat</dt><dd class="mono">${esc(Settings.v.deviceId)}</dd><dt>Penyimpanan</dt><dd>${Store.persistent ? 'Tersimpan di perangkat (IndexedDB)' : '<span style="color:var(--err)">Sementara (memori)</span>'}</dd><dt>Isi perangkat</dt><dd>${counts[0]} survei · ${counts[1]} plot · ${counts[2]} sampel · ${counts[3]} foto</dd></dl></div>
    ${serverPanel()}
    <div class="panel"><h2 style="margin-bottom:8px">Sinkronisasi</h2><p class="small">${pending} data belum terkirim. ${esc(Sync.lastText())}</p><p class="tiny">Server: ${esc(Sync.adapterName())}</p><button class="btn dark" data-act="sync">${I('sync', 20)} Sinkronkan sekarang</button></div>
    <div class="panel"><h2 style="margin-bottom:8px">Ekspor & impor</h2>
      <div class="btns" style="flex-direction:column;align-items:stretch">
        <button class="btn primary" data-act="export-mrv">${I('download', 20)} Ekspor untuk MRV Calculator (JSON)</button>
        <button class="btn" data-act="export-csv">${I('download', 20)} Tabel sampel (CSV)</button>
        <button class="btn" data-act="export-json">${I('download', 20)} Cadangan lengkap + metadata (JSON)</button>
        <label class="btn">${I('upload', 20)} Impor cadangan JSON<input type="file" accept="application/json,.json" data-import hidden></label>
      </div><p class="tiny" style="margin-top:8px">Ekspor MRV memuat core sedimen, biomassa, dan tegakan mangrove beserta kode sampel, koordinat, status lab, hash, dan jumlah foto bukti.</p></div>
  </div><div>
    <div class="panel"><h2 style="margin-bottom:8px">Metadata aplikasi</h2>
      <dl class="kv"><dt>Versi aplikasi</dt><dd>${esc(META.app.version)}</dd><dt>Versi metadata</dt><dd>${esc(META.app.metadataVersion)} <span class="tiny">(${esc(META_SOURCE)})</span></dd><dt>Diperbarui</dt><dd>${esc(fmtD(META.app.updatedAt))}</dd><dt>Pola kode sampel</dt><dd class="mono">${esc(META.sampleCode.pattern)}</dd><dt>Modul ekosistem</dt><dd>${META.ecosystems.map(e => `${esc(e.label)} <span class="tiny">${e.enabled ? 'aktif' : 'belum aktif'}</span>`).join('<br>')}</dd></dl>
      <p class="small" style="margin-top:10px">Form, daftar jenis, aturan validasi, status lab, dan pola kode semuanya dibaca dari metadata. Perubahan metadata yang diterbitkan admin akan diterima semua perangkat saat sinkron.</p>
      <div class="btns"><button class="btn" data-act="meta-edit">Lihat / ubah metadata</button>${META_SOURCE !== 'tertanam' ? `<button class="btn ghost" data-act="meta-reset">Kembali ke metadata tertanam</button>` : ''}</div></div>
    <div class="panel"><h2 style="margin-bottom:8px">Kelola data perangkat</h2>
      <div class="btns">${demo ? `<button class="btn" data-act="demo-clear">Hapus data contoh (${demo})</button>` : `<button class="btn" data-act="demo">Muat data contoh</button>`}<button class="btn danger" data-act="wipe">Hapus semua data di perangkat</button></div></div>
    <div class="panel"><h2 style="margin-bottom:8px">Tentang</h2><p class="small">${esc(META.app.name)} · ${esc(META.app.owner)}. Pasangan dari ${esc(META.app.pairedWith)}.</p><p class="tiny">${esc(META.app.disclaimer)}</p></div>
  </div></div>`;
};
function notFound(msg, extra = '') { return `<div class="list"><div class="empty"><h3>${msg}</h3><p>Data mungkin dibuat di perangkat lain dan belum disinkronkan.</p>${extra}</div></div>`; }

function serverPanel() {
  if (window.claude && !Auth.configured() && !Settings.v.showSb) return '';
  const c = Auth.cfg(); const s = Auth.session;
  return `<div class="panel"><h2 style="margin-bottom:8px">Akun tim & server Supabase</h2>
    ${s ? `<p class="small">Masuk sebagai <b>${esc(s.user?.email || '')}</b>.</p><div class="btns"><button class="btn sm" data-act="sb-logout">Keluar</button></div>`
      : Auth.configured() ? `<div class="field"><label for="sbEmail">Email</label><input id="sbEmail" class="input" type="email" autocomplete="username" inputmode="email"></div><div class="field"><label for="sbPw">Kata sandi</label><input id="sbPw" class="input" type="password" autocomplete="current-password"></div><button class="btn primary" data-act="sb-login">Masuk</button><p class="tiny" style="margin-top:8px">Akun dibuat oleh admin. Setelah sekali masuk, aplikasi tetap bisa dipakai offline.</p>`
      : `<p class="small">Server belum diatur. Isi dari halaman Settings → API di proyek Supabase, atau minta admin.</p>`}
    <details style="margin-top:12px"${Auth.configured() ? '' : ' open'}><summary class="small" style="cursor:pointer;font-weight:650">Pengaturan server</summary>
      <div class="field" style="margin-top:10px"><label for="sbUrl">Project URL</label><input id="sbUrl" class="input mono" value="${esc(c.url)}" placeholder="https://xxxx.supabase.co" autocomplete="off"></div>
      <div class="field"><label for="sbKey">Anon / publishable key</label><input id="sbKey" class="input mono" value="${esc(c.key)}" autocomplete="off"><div class="help">Kunci publik ini aman di aplikasi karena akses data dibatasi aturan RLS dan login tim.</div></div>
      <button class="btn sm" data-act="sb-save">Simpan server</button></details></div>`;
}
