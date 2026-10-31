/* ─────────────────────────────────────────────────────────────
   Pulso · Estado y persistencia
   Un solo archivo JSON (pulso-data.json). Si lo ponen en una carpeta
   compartida (iCloud Drive, Dropbox, Google Drive), los dos ven lo
   mismo. Antes de guardar se verifica que nadie lo haya cambiado; si
   cambió, se fusionan los dos estados en vez de pisar al otro.
   Las llaves (tokens) NO van en este archivo: cada uno tiene las suyas
   en el Llavero de su Mac.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const VERSION = 1;
  const empty = () => ({
    version: VERSION,
    people: ['José', 'Socio'],
    clients: [],    // [{id, name, color}] — cada cuenta tiene clientId
    accounts: [],
    series: {},     // accountId → [{date, ...campos}]
    posts: {},      // accountId → [{id, date, type, ...}]
    campaigns: {},  // accountId → [{id, name, spend, ...}]
    goals: [],
    seo: { audits: [], gsc: [], gscImportedAt: null, brandTerms: [] },
    notes: [],
    settings: { graphVersion: 'v23.0', currency: 'US$' },
    deleted: {},    // id → timestamp (para que una fusión no "resucite" lo borrado)
    updatedAt: 0,
  });

  /* Fusión determinista de dos estados. Gana el elemento con
     updatedAt más reciente; las series se combinan por fecha. */
  function merge(a, b) {
    if (!a) return b; if (!b) return a;
    const out = empty();
    out.deleted = Object.assign({}, a.deleted, b.deleted);
    const alive = x => !(x && x.id && out.deleted[x.id]);
    const byId = (la, lb) => {
      const m = new Map();
      for (const x of [...(la || []), ...(lb || [])]) {
        if (!alive(x)) continue;
        const prev = m.get(x.id);
        if (!prev || (x.updatedAt || 0) >= (prev.updatedAt || 0)) m.set(x.id, x);
      }
      return [...m.values()];
    };
    const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
    out.people = newer.people || a.people || b.people;
    out.settings = Object.assign({}, (newer === a ? b : a).settings, newer.settings);
    out.accounts = byId(a.accounts, b.accounts).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
    out.goals = byId(a.goals, b.goals);
    out.clients = byId(a.clients, b.clients).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
    out.notes = byId(a.notes, b.notes);
    const ids = new Set(out.accounts.map(x => x.id));
    for (const key of ['series']) {
      for (const id of ids) {
        const d = new Map();
        for (const r of [...((b[key] || {})[id] || []), ...((a[key] || {})[id] || [])]) d.set(r.date, Object.assign({}, d.get(r.date), r));
        if (d.size) out.series[id] = [...d.values()].sort((x, y) => x.date.localeCompare(y.date));
      }
    }
    for (const key of ['posts', 'campaigns']) {
      for (const id of ids) {
        const l = byId((a[key] || {})[id], (b[key] || {})[id]);
        if (l.length) out[key][id] = l;
      }
    }
    const sa = a.seo || {}, sb = b.seo || {};
    out.seo = {
      audits: byId(sa.audits, sb.audits).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0)).slice(0, 60),
      gsc: (sa.gscImportedAt || 0) >= (sb.gscImportedAt || 0) ? sa.gsc || [] : sb.gsc || [],
      gscImportedAt: Math.max(sa.gscImportedAt || 0, sb.gscImportedAt || 0) || null,
      brandTerms: (newer.seo || {}).brandTerms || [],
    };
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return out;
  }

  function normalize(s) {
    const e = empty();
    if (!s || typeof s !== 'object') return e;
    const out = Object.assign(e, s);
    out.seo = Object.assign(empty().seo, s.seo || {});
    out.settings = Object.assign(empty().settings, s.settings || {});
    return out;
  }

  // ── Cuentas duplicadas ──────────────────────────────────────
  /* Identidad de una cuenta: sus IDs de Meta y su @usuario / dominio
     normalizado. Dos cuentas de la misma red que compartan cualquiera
     de estas claves son la misma cuenta. */
  function handleKey(platform, handle, name) {
    let h = String(handle || '').trim();
    if (!h && platform === 'instagram' && /^@/.test(name || '')) h = name;
    if (!h) return null;
    if (platform === 'web') {
      try { return new URL(/^https?:/i.test(h) ? h : 'https://' + h).host.replace(/^www\./, '').toLowerCase(); } catch (e) { return null; }
    }
    h = h.replace(/^https?:\/\/(www\.|m\.)?(instagram|tiktok|facebook|linkedin)\.com\/(in\/)?/i, '').replace(/^@/, '').split(/[/?#\s]/)[0];
    return h ? h.toLowerCase() : null;
  }
  function accountKeys(a) {
    const keys = [];
    const m = a.meta || {};
    for (const k of ['igId', 'pageId', 'adAccountId']) if (m[k]) keys.push(`${a.platform}:id:${String(m[k]).replace(/^act_/, '')}`);
    if (a.platform === 'meta_ads' && a.handle && /^(act_)?\d+$/.test(a.handle)) keys.push(`meta_ads:id:${a.handle.replace(/^act_/, '')}`);
    else if (a.platform !== 'meta_ads') { const h = handleKey(a.platform, a.handle, a.name); if (h) keys.push(`${a.platform}:h:${h}`); }
    return keys;
  }
  function findDuplicate(state, cand, exceptId) {
    const k = accountKeys(cand);
    if (!k.length) return null;
    return state.accounts.find(a => a.id !== exceptId && a.platform === cand.platform && accountKeys(a).some(x => k.includes(x))) || null;
  }
  /* Une las cuentas repetidas en la más antigua sin perder datos:
     días, publicaciones, campañas y metas pasan a la que se conserva. */
  function dedupeAccounts(state) {
    const keep = [];
    let merged = 0;
    for (const a of [...state.accounts].sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))) {
      const k = accountKeys(a);
      const t = k.length && keep.find(x => x.platform === a.platform && accountKeys(x).some(y => k.includes(y)));
      if (!t) { keep.push(a); continue; }
      t.meta = Object.assign({}, a.meta, t.meta);
      for (const f of ['handle', 'clientId', 'owner', 'lastSync', 'lastPublic']) if (t[f] == null || t[f] === '') t[f] = a[f];
      if (t.source === 'public' && a.source !== 'public') t.source = a.source;
      const rows = new Map((state.series[a.id] || []).map(r => [r.date, r]));
      for (const r of state.series[t.id] || []) rows.set(r.date, Object.assign({}, rows.get(r.date), r));
      if (rows.size) state.series[t.id] = [...rows.values()].sort((x, y) => x.date.localeCompare(y.date));
      const posts = new Map((state.posts[a.id] || []).map(p => [p.id, p]));
      for (const p of state.posts[t.id] || []) posts.set(p.id, p);
      if (posts.size) state.posts[t.id] = [...posts.values()].sort((x, y) => String(y.date).localeCompare(String(x.date)));
      if (!(state.campaigns[t.id] || []).length && state.campaigns[a.id]) state.campaigns[t.id] = state.campaigns[a.id];
      for (const g of state.goals) if (g.accountId === a.id) { g.accountId = t.id; g.updatedAt = Date.now(); }
      delete state.series[a.id]; delete state.posts[a.id]; delete state.campaigns[a.id];
      state.deleted[a.id] = Date.now();
      t.updatedAt = Date.now();
      merged++;
    }
    if (merged) state.accounts = state.accounts.filter(a => keep.includes(a));
    return merged;
  }

  // ── Organizar por clientes (sugerencia automática) ──────────
  /* Agrupa las cuentas sin cliente que pertenecen a la misma marca:
     comparten una palabra significativa en el nombre o el @usuario
     ("Banco Ademi" ↔ "@bancoademi", "Dra. Katherin" ↔ "katherinalmonte.skin").
     Los competidores van con el cliente de la cuenta propia creada más
     cerca en el tiempo (normalmente se agregaron juntos). */
  const GENERIC = new Set(['instagram', 'facebook', 'tiktok', 'linkedin', 'meta', 'ads', 'anuncios', 'captacion', 'cuenta', 'oficial',
    'official', 'pagina', 'page', 'www', 'http', 'https', 'com', 'net', 'org', 'demo', 'marca', 'sitio', 'web', 'store', 'shop', 'tienda',
    'banco', 'clinica', 'grupo', 'the', 'los', 'las', 'del', 'para', 'competidor', 'perfil']);
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function brandTokens(a) {
    const words = fold(`${a.name || ''} ${a.handle || ''}`).replace(/https?:\/\/[^/]+\//g, ' ').split(/[^a-z0-9]+/);
    return [...new Set(words.filter(w => w.length >= 4 && !GENERIC.has(w) && !/^\d+$/.test(w)))];
  }
  const compact = a => fold(`${a.name || ''}${a.handle || ''}`).replace(/[^a-z0-9]/g, '');
  const cleanName = n => String(n || '').replace(/\s*[·|\-–]\s*(instagram|facebook|tiktok|linkedin|meta ads|ads|sitio web|web).*$/i, '').replace(/^@/, '').trim();

  function suggestClients(state) {
    const pending = state.accounts.filter(a => !a.clientId || !state.clients.some(c => c.id === a.clientId));
    const own = pending.filter(a => a.role !== 'competidor');
    const parent = new Map(own.map(a => [a.id, a.id]));
    const find = x => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
    const shares = (a, b) => brandTokens(a).some(t => compact(b).includes(t)) || brandTokens(b).some(t => compact(a).includes(t));
    for (let i = 0; i < own.length; i++) for (let j = i + 1; j < own.length; j++) if (shares(own[i], own[j])) parent.set(find(own[i].id), find(own[j].id));
    const groups = new Map();
    for (const a of own) { const r = find(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); }
    const out = [...groups.values()].map(list => {
      const fb = list.find(a => a.platform === 'facebook') || list.find(a => a.platform !== 'linkedin') || list[0];
      let name = cleanName(fb.name) || fb.handle || 'Cliente';
      if (list.length === 1 && list[0].platform === 'linkedin' && list[0].personal) name = `${cleanName(list[0].name) || 'Mi'} (personal)`;
      return { name, accountIds: list.map(a => a.id), createdAt: Math.min(...list.map(a => a.createdAt || 0)) };
    }).sort((x, y) => x.createdAt - y.createdAt);
    // Competidores: al grupo con la cuenta propia más cercana en fecha de creación
    for (const c of pending.filter(a => a.role === 'competidor')) {
      let best = null, bestD = Infinity;
      for (const g of out) for (const id of g.accountIds) {
        const a = state.accounts.find(x => x.id === id);
        if (!a || a.role === 'competidor') continue;
        const d = Math.abs((a.createdAt || 0) - (c.createdAt || 0));
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) best.accountIds.push(c.id);
    }
    return out;
  }

  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  function Store(platform) {
    let state = empty();
    let mtime = 0;
    let timer = null;
    let saving = Promise.resolve();
    const subs = new Set();
    const emit = () => subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });

    async function load() {
      const r = await platform.readData();
      try { state = normalize(r.text ? JSON.parse(r.text) : null); } catch (e) { state = empty(); }
      mtime = r.mtime || 0;
      api.lastDeduped = dedupeAccounts(state);
      if (api.lastDeduped) save();
      emit();
      return state;
    }

    async function flush() {
      state.updatedAt = Date.now();
      let text = JSON.stringify(state);
      let r = await platform.writeData(text, mtime);
      if (r && r.conflict) {
        // Otra persona guardó mientras tanto: fusionamos y reintentamos
        let other = null;
        try { other = normalize(JSON.parse(r.text)); } catch (e) { other = null; }
        state = merge(state, other);
        mtime = r.mtime;
        text = JSON.stringify(state);
        r = await platform.writeData(text, mtime);
        emit();
      }
      if (r && r.ok) mtime = r.mtime;
      return r;
    }

    function save(immediate) {
      clearTimeout(timer);
      emit();
      const run = () => (saving = saving.then(flush).catch(e => console.error('No se pudo guardar', e)));
      if (immediate) return run();
      timer = setTimeout(run, 400);
      return saving;
    }

    /* Recarga desde disco (por si el otro cambió algo) y fusiona */
    async function refresh() {
      const r = await platform.readData();
      if (!r.text || r.mtime === mtime) return false;
      let other;
      try { other = normalize(JSON.parse(r.text)); } catch (e) { return false; }
      state = merge(state, other);
      mtime = r.mtime;
      if (dedupeAccounts(state)) save();
      emit();
      return true;
    }

    const touch = x => Object.assign(x, { updatedAt: Date.now() });

    const api = {
      get state() { return state; },
      findDuplicate: (cand, exceptId) => findDuplicate(state, cand, exceptId),
      load, save, refresh, flush,
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      replace(s) { state = normalize(s); save(true); },
      account: id => state.accounts.find(a => a.id === id),
      addAccount(a) {
        const acc = touch(Object.assign({ id: uid('acc'), createdAt: Date.now(), owner: state.people[0] }, a));
        state.accounts.push(acc); save(); return acc;
      },
      updateAccount(id, patch) { const a = state.accounts.find(x => x.id === id); if (a) { Object.assign(a, patch); touch(a); save(); } return a; },
      removeAccount(id) {
        state.accounts = state.accounts.filter(a => a.id !== id);
        delete state.series[id]; delete state.posts[id]; delete state.campaigns[id];
        state.goals = state.goals.filter(g => g.accountId !== id);
        state.deleted[id] = Date.now(); save();
      },
      rows: id => state.series[id] || [],
      /* Inserta o actualiza filas por fecha (los campos nuevos pisan a los viejos) */
      upsertRows(id, rows) {
        const m = new Map((state.series[id] || []).map(r => [r.date, r]));
        for (const r of rows) m.set(r.date, Object.assign({}, m.get(r.date), r));
        state.series[id] = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
        const acc = state.accounts.find(a => a.id === id); if (acc) { acc.lastSync = Date.now(); touch(acc); }
        save();
        return state.series[id].length;
      },
      deleteRow(id, date) { state.series[id] = (state.series[id] || []).filter(r => r.date !== date); const acc = this.account(id); if (acc) touch(acc); save(); },
      setPosts(id, posts) {
        const m = new Map((state.posts[id] || []).map(p => [p.id, p]));
        for (const p of posts) m.set(p.id, touch(Object.assign({}, m.get(p.id), p)));
        state.posts[id] = [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
        save();
      },
      setCampaigns(id, list) { state.campaigns[id] = list.map(c => touch(Object.assign({}, c))); save(); },
      addGoal(g) { const goal = touch(Object.assign({ id: uid('goal'), createdAt: Date.now() }, g)); state.goals.push(goal); save(); return goal; },
      updateGoal(id, patch) { const g = state.goals.find(x => x.id === id); if (g) { Object.assign(g, patch); touch(g); save(); } },
      removeGoal(id) { state.goals = state.goals.filter(g => g.id !== id); state.deleted[id] = Date.now(); save(); },
      addAudit(a) { state.seo.audits.unshift(touch(Object.assign({ id: uid('aud') }, a))); state.seo.audits = state.seo.audits.slice(0, 60); save(); },
      setGSC(rows) { state.seo.gsc = rows; state.seo.gscImportedAt = Date.now(); save(); },
      setPeople(list) { state.people = list; save(); },
      client: id => state.clients.find(c => c.id === id),
      addClient(c) { const cl = touch(Object.assign({ id: uid('cli'), createdAt: Date.now() }, c)); state.clients.push(cl); save(); return cl; },
      updateClient(id, patch) { const c = state.clients.find(x => x.id === id); if (c) { Object.assign(c, patch); touch(c); save(); } },
      removeClient(id) {
        state.clients = state.clients.filter(c => c.id !== id);
        state.accounts.forEach(a => { if (a.clientId === id) { delete a.clientId; touch(a); } });
        state.deleted[id] = Date.now(); save();
      },
      setSetting(k, v) { state.settings[k] = v; save(); },
    };
    return api;
  }

  const api = { Store, merge, normalize, empty, uid, accountKeys, findDuplicate, dedupeAccounts, handleKey, suggestClients };
  root.PulsoStore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
