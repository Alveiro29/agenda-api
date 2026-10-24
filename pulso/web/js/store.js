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
      emit();
      return true;
    }

    const touch = x => Object.assign(x, { updatedAt: Date.now() });

    return {
      get state() { return state; },
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
      setSetting(k, v) { state.settings[k] = v; save(); },
    };
  }

  const api = { Store, merge, normalize, empty, uid };
  root.PulsoStore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
