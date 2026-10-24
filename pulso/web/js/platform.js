/* ─────────────────────────────────────────────────────────────
   Pulso · Plataforma
   En la app de Mac habla con el shell nativo (Swift) por
   window.webkit.messageHandlers.pulso: red sin CORS, archivo de datos
   en una carpeta compartida y llaves en el Llavero (Keychain).
   En un navegador cae a fetch + localStorage para poder probarla.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  const handler = root.webkit && root.webkit.messageHandlers && root.webkit.messageHandlers.pulso;
  const native = !!handler;
  const call = (op, args = {}) => handler.postMessage(Object.assign({ op }, args));

  const LS = {
    get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? root.localStorage.removeItem(k) : root.localStorage.setItem(k, v); } catch (e) { /* modo privado */ } },
  };

  async function http(url, opts = {}) {
    const started = Date.now();
    if (native) {
      const r = await call('fetch', { url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body || null });
      if (r.error) throw new Error(r.error);
      return wrap(r.status, r.body, r.headers || {}, r.url || url, r.ms);
    }
    const res = await fetch(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body });
    const body = await res.text();
    const headers = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return wrap(res.status, body, headers, res.url || url, Date.now() - started);
  }
  function wrap(status, body, headers, url, ms) {
    let json = null;
    try { json = JSON.parse(body); } catch (e) { /* no es JSON */ }
    return { status, ok: status >= 200 && status < 300, body, json, headers, url, ms };
  }

  const DATA_KEY = 'pulso:data';
  const api = {
    native,
    http,
    /* → { text, mtime, path } */
    async readData() {
      if (native) return call('readData');
      return { text: LS.get(DATA_KEY), mtime: Number(LS.get(DATA_KEY + ':mtime')) || 0, path: 'localStorage (navegador)' };
    },
    /* Escribe solo si nadie más cambió el archivo desde expectedMtime.
       → { ok, mtime } o { ok:false, conflict:true, text, mtime } */
    async writeData(text, expectedMtime) {
      if (native) return call('writeData', { text, expectedMtime: expectedMtime || 0 });
      const cur = Number(LS.get(DATA_KEY + ':mtime')) || 0;
      if (expectedMtime != null && cur && cur !== expectedMtime) return { ok: false, conflict: true, text: LS.get(DATA_KEY), mtime: cur };
      const m = Date.now();
      LS.set(DATA_KEY, text); LS.set(DATA_KEY + ':mtime', String(m));
      return { ok: true, mtime: m };
    },
    async chooseFolder() { return native ? call('chooseFolder') : { cancelled: true, unsupported: true }; },
    async dataLocation() { return native ? call('dataLocation') : { path: 'localStorage (navegador)' }; },
    async getSecret(k) { return native ? (await call('secretGet', { key: k })).value || '' : LS.get('pulso:secret:' + k) || ''; },
    async setSecret(k, v) { return native ? call('secretSet', { key: k, value: v || '' }) : LS.set('pulso:secret:' + k, v || null); },
    async getPref(k) { return native ? (await call('prefGet', { key: k })).value ?? null : LS.get('pulso:pref:' + k); },
    async setPref(k, v) { return native ? call('prefSet', { key: k, value: v == null ? '' : String(v) }) : LS.set('pulso:pref:' + k, v == null ? null : String(v)); },
    openExternal(url) { if (native) call('open', { url }); else root.open(url, '_blank', 'noopener'); },
    async saveFile(name, text) {
      if (native) return call('saveFile', { name, text });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
      a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return { ok: true };
    },
  };
  root.PulsoPlatform = api;
})(typeof window !== 'undefined' ? window : globalThis);
