/* =====================================================================
   SUPABASE: login tim + adapter sinkronisasi (PostgREST) + AI (Edge Function)
   Konfigurasi: metadata sync.supabaseUrl & sync.supabaseAnonKey,
   atau diisi dari menu Data > Server Supabase (disimpan di perangkat).
   ===================================================================== */
const Auth = {
  session: null,
  cfg() { return { url: (Settings.v.sbUrl || META.sync.supabaseUrl || '').trim().replace(/\/$/, ''), key: (Settings.v.sbKey || META.sync.supabaseAnonKey || '').trim() }; },
  configured() { const c = this.cfg(); return !!(c.url && c.key); },
  async load() { this.session = (await Store.kvGet('sb_session')) || null; },
  async _save(s) { this.session = s; await Store.kvSet('sb_session', s); },
  async _auth(path, body) {
    const c = this.cfg();
    const r = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status));
    return j;
  },
  async signIn(email, password) {
    const j = await this._auth('token?grant_type=password', { email, password });
    await this._save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Date.now() / 1000 + (j.expires_in || 3600)), user: { id: j.user?.id, email: j.user?.email } });
    if (!Settings.v.userName && j.user?.email) { Settings.v.userName = j.user.email; await Settings.save(); }
    Sync.reset();
  },
  async token() {
    if (!this.session) return null;
    if (this.session.expires_at * 1000 < Date.now() + 60000) {
      if (!navigator.onLine) return this.session.access_token;
      try { const j = await this._auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token }); await this._save({ ...this.session, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Date.now() / 1000 + (j.expires_in || 3600)) }); }
      catch (e) { await this._save(null); Sync.reset(); return null; }
    }
    return this.session.access_token;
  },
  async signOut() { try { const c = this.cfg(); await fetch(`${c.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + this.session?.access_token } }); } catch (e) { } await this._save(null); Sync.reset(); },
  async isAdmin() { try { const rows = await sbFetch('/rest/v1/bcfa_admins?select=user_id'); return Array.isArray(rows) && rows.length > 0; } catch (e) { return false; } }
};
async function sbFetch(path, opt = {}) {
  const c = Auth.cfg(); const t = await Auth.token(); if (!t) { const e = new Error('Belum masuk ke akun tim'); e.code = 'auth'; throw e; }
  const r = await fetch(c.url + path, { ...opt, headers: { apikey: c.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (r.status === 401) { const e = new Error('Sesi berakhir, masuk ulang'); e.code = 'auth'; throw e; }
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.message || j.hint || ('HTTP ' + r.status)); e.code = r.status === 403 || j.code === '42501' ? 'forbidden' : 'http'; throw e; }
  return r.status === 204 || r.status === 201 && !(r.headers.get('content-type') || '').includes('json') ? null : r.json().catch(() => null);
}
const inList = ids => '(' + ids.map(i => '"' + String(i).replace(/"/g, '') + '"').join(',') + ')';
const SupabaseAdapter = {
  get name() { return 'Supabase ' + (Auth.cfg().url.replace(/^https?:\/\//, '') || ''); },
  async connect() {
    if (!Auth.configured()) return null;
    if (!(await Auth.token())) { Sync.needLogin = true; return null; }
    Sync.needLogin = false;
    const since0 = Settings.v.sbPulledAt;
    const T = '/rest/v1/' + (META.sync.supabaseTable || 'bcfa_records');
    const row = rec => ({ id: rec.id, type: rec.type, parent_id: rec.parentId, sample_code: rec.data?.sampleCode || null, updated_at: rec.meta.updatedAt, deleted: !!rec.meta.deleted, doc: rec });
    const pageAll = async q => { const out = []; for (let off = 0; ; off += 1000) { const rows = await sbFetch(`${T}?${q}&select=doc&order=id&limit=1000&offset=${off}`); out.push(...(rows || []).map(r => r.doc)); if (!rows || rows.length < 1000) break; } return out; };
    return {
      async getOne(id) { const r = await sbFetch(`${T}?id=eq.${encodeURIComponent(id)}&select=doc`); return r && r[0] ? r[0].doc : null; },
      async put(rec) { await sbFetch(`${T}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row(rec)) }); },
      async pullMain() { const since = Settings.v.sbPulledAt; const q = 'type=in.(survey,observation,sample)' + (since ? `&synced_at=gt.${encodeURIComponent(since)}` : ''); const startedAt = new Date(Date.now() - 120000).toISOString(); const docs = await pageAll(q); Settings.v.sbPulledAt = startedAt; return docs; },
      async pullPhotos(parentIds) { if (since0) return pageAll(`type=eq.photo&synced_at=gt.${encodeURIComponent(since0)}`); const out = []; for (let i = 0; i < parentIds.length; i += 40) out.push(...await pageAll(`type=eq.photo&parent_id=in.${encodeURIComponent(inList(parentIds.slice(i, i + 40)))}`)); return out; },
      async getMeta() { const r = await sbFetch('/rest/v1/bcfa_config?key=eq.metadata&select=doc'); return r && r[0] ? r[0].doc : null; },
      async putMeta(doc) { await sbFetch('/rest/v1/bcfa_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'metadata', doc }) }); },
      async findCode(code) { const r = await sbFetch(`${T}?sample_code=eq.${encodeURIComponent(code)}&select=doc&limit=1`); return r && r[0] ? r[0].doc : null; }
    };
  }
};
/* AI lewat Supabase Edge Function (kunci API AI disimpan di server, bukan di aplikasi) */
async function aiViaSupabase(prompt, file) {
  const c = Auth.cfg(); const t = await Auth.token(); if (!t) throw Object.assign(new Error('Masuk ke akun tim dulu untuk memakai AI.'), { code: 'auth' });
  let imageBase64 = null; if (file) { const b = await blobFromFile(file); imageBase64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(b); }); }
  const r = await fetch(`${c.url}/functions/v1/${META.ai?.function || 'identify-species'}`, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, imageBase64, mediaType: 'image/jpeg' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  if (!j.data) throw new Error('Jawaban AI tidak terbaca');
  return j.data;
}

/* Service worker: membuat aplikasi tetap terbuka tanpa internet (hanya di hosting sendiri) */
function registerSW() {
  if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost') || /claude\.ai|claudeusercontent/.test(location.hostname)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Versi baru aplikasi siap. Tutup lalu buka ulang aplikasi untuk memakainya.'); }); });
  }).catch(() => { });
}
