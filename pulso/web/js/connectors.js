/* ─────────────────────────────────────────────────────────────
   Pulso · Conectores
   1) Importador CSV que entiende las exportaciones de TikTok Studio,
      LinkedIn, Meta Business Suite, Ads Manager y Search Console
      (en español o inglés, con , o ; y números con formato latino).
   2) Meta Graph API: Instagram profesional, Página de Facebook y
      cuentas publicitarias, con un token de acceso.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  // ── CSV ─────────────────────────────────────────────────────
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
    const delim = [',', ';', '\t'].map(d => [d, countOutsideQuotes(firstLine, d)]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows.map(r => r.map(c => c.trim()));
  }
  function countOutsideQuotes(s, ch) { let n = 0, q = false; for (const c of s) { if (c === '"') q = !q; else if (!q && c === ch) n++; } return n; }

  /* Número en cualquier formato: "1,234" "1.234" "1.234,5" "12,5%" "US$3.20" "2.5K" */
  function parseNumber(raw, opts = {}) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s || s === '-' || s === '--' || /^n\/?a$/i.test(s)) return null;
    const pct = s.includes('%');
    let mult = 1;
    const suf = s.match(/([kKmM])\s*$/);
    if (suf) { mult = /k/i.test(suf[1]) ? 1e3 : 1e6; s = s.slice(0, -1); }
    s = s.replace(/[^\d.,\-]/g, '');
    if (!s) return null;
    const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      // El separador que aparece último es el decimal
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma >= 0) {
      const parts = s.split(',');
      // "1,234" / "12,345,678" → miles; "12,5" → decimal
      s = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && !pct && !opts.decimal) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot >= 0) {
      const parts = s.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && !pct && !suf && !opts.decimal)) s = s.replace(/\./g, '');
    }
    const v = parseFloat(s);
    if (!isFinite(v)) return null;
    return pct ? (v * mult) / 100 : v * mult;
  }

  const MONTHS = { jan: 1, ene: 1, january: 1, enero: 1, feb: 2, february: 2, febrero: 2, mar: 3, march: 3, marzo: 3,
    apr: 4, abr: 4, april: 4, abril: 4, may: 5, mayo: 5, jun: 6, june: 6, junio: 6, jul: 7, july: 7, julio: 7,
    aug: 8, ago: 8, august: 8, agosto: 8, sep: 9, sept: 9, set: 9, september: 9, septiembre: 9, setiembre: 9,
    oct: 10, october: 10, octubre: 10, nov: 11, november: 11, noviembre: 11, dec: 12, dic: 12, december: 12, diciembre: 12 };

  /* Fechas: 2025-10-05, 2025/10/05, 10/05/2025 (MM/DD o DD/MM — se
     decide por todo el archivo), "October 5", "5 de octubre de 2025",
     "Oct 5, 2025", 2025-10-05T00:00:00 */
  function parseDate(raw, opts = {}) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      return opts.dayFirst ? mk(y, +m[2], +m[1]) : mk(y, +m[1], +m[2]);
    }
    const words = s.replace(/,/g, ' ').replace(/\bde\b/g, ' ').split(/\s+/).filter(Boolean);
    let mon = null, day = null, year = null;
    for (const w of words) {
      const k = w.replace(/\.$/, '');
      if (MONTHS[k] && mon == null) mon = MONTHS[k];
      else if (/^\d{4}$/.test(k)) year = +k;
      else if (/^\d{1,2}$/.test(k) && day == null) day = +k;
    }
    if (mon && day) {
      if (!year) {
        // Sin año (TikTok): el más reciente que no quede en el futuro
        const ref = opts.today ? new Date(opts.today) : new Date();
        year = ref.getFullYear();
        if (new Date(year, mon - 1, day) > ref) year--;
      }
      return mk(year, mon, day);
    }
    return null;
  }
  function mk(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function detectDayFirst(values) {
    for (const v of values) {
      const m = String(v || '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) return true;
      if (+m[2] > 12) return false;
    }
    return true; // en RD/LatAm lo normal es DD/MM
  }

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* Diccionario de encabezados → campo de Pulso. El orden importa:
     se prueba primero lo más específico. */
  const HEADER_MAP = [
    ['date', ['date', 'fecha', 'day', 'dia', 'reporting starts', 'inicio del informe', 'fecha de inicio']],
    ['newFollowers', ['new followers', 'nuevos seguidores', 'seguidores nuevos', 'follows', 'seguimientos', 'follower gains', 'net followers', 'net new followers', 'new follows']],
    ['followers', ['followers', 'seguidores', 'total followers', 'total de seguidores', 'page likes', 'me gusta de la pagina']],
    ['linkClicks', ['link clicks', 'clics en el enlace', 'clicks en el enlace', 'outbound clicks', 'clics salientes']],
    ['websiteClicks', ['website clicks', 'clics en el sitio web', 'clics al sitio web', 'toques en el enlace', 'link in bio clicks', 'bio link clicks']],
    ['profileVisits', ['profile views', 'visualizaciones del perfil', 'visitas al perfil', 'profile visits', 'page views', 'visitas a la pagina']],
    ['fullViews', ['fully watched', 'vistas completas', 'videos vistos completos', 'completed views', 'thruplays', 'reproducciones completas']],
    ['watchTimeSec', ['total play time', 'tiempo total de reproduccion', 'total watch time', 'watch time seconds']],
    ['views', ['video views', 'visualizaciones de videos', 'visualizaciones de video', 'reproducciones de video', 'views', 'visualizaciones', 'reproducciones', 'plays']],
    ['impressions', ['impressions', 'impresiones', 'impressions organic', 'impresiones organicas']],
    ['reach', ['reach', 'alcance', 'accounts reached', 'cuentas alcanzadas', 'unique impressions', 'members reached', 'miembros alcanzados']],
    ['likes', ['likes', 'me gusta', 'reactions', 'reacciones']],
    ['comments', ['comments', 'comentarios']],
    ['shares', ['shares', 'compartidos', 'veces compartido', 'reposts', 'compartir', 'veces que se compartio']],
    ['saves', ['saves', 'guardados', 'saved', 'favoritos', 'favorites']],
    ['engagements', ['engagements', 'interacciones', 'total engagements', 'post engagements', 'interacciones con la publicacion']],
    ['spend', ['amount spent', 'importe gastado', 'spend', 'gasto', 'cost', 'costo', 'amount spent usd', 'importe gastado usd', 'importe gastado dop']],
    ['leads', ['leads', 'clientes potenciales', 'resultados leads', 'lead', 'formularios']],
    ['conversions', ['conversions', 'conversiones', 'results', 'resultados', 'purchases', 'compras']],
    ['clicks', ['clicks', 'clics', 'clicks all', 'clics todos', 'clics (todos)']],
    ['sessions', ['sessions', 'sesiones', 'visits', 'visitas']],
    ['posts', ['posts', 'publicaciones', 'videos publicados', 'videos posted']],
    ['position', ['position', 'posicion', 'average position', 'posicion media', 'posicion promedio']],
    ['ctr', ['ctr']],
  ];
  const DECIMAL_FIELDS = new Set(['position', 'ctr']);

  const GSC_MAP = {
    query: ['top queries', 'consultas principales', 'query', 'consulta', 'queries', 'consultas'],
    page: ['top pages', 'paginas principales', 'page', 'pagina', 'url'],
    clicks: ['clicks', 'clics'],
    impressions: ['impressions', 'impresiones'],
    ctr: ['ctr'],
    position: ['position', 'posicion'],
  };

  function mapHeaders(headers) {
    const mapping = {};
    const used = new Set();
    headers.forEach((h, i) => {
      const n = norm(h);
      for (const [field, aliases] of HEADER_MAP) {
        if (used.has(field)) continue;
        if (aliases.some(a => n === a)) { mapping[i] = field; used.add(field); return; }
      }
    });
    // segunda pasada: coincidencias parciales para lo que no se mapeó
    headers.forEach((h, i) => {
      if (mapping[i]) return;
      const n = norm(h);
      for (const [field, aliases] of HEADER_MAP) {
        if (used.has(field)) continue;
        if (aliases.some(a => a.length > 3 && (n.startsWith(a + ' ') || n.endsWith(' ' + a)))) { mapping[i] = field; used.add(field); return; }
      }
    });
    return mapping;
  }

  /* Convierte un CSV de métricas en filas diarias.
     Devuelve { kind: 'daily'|'gsc'|'unknown', rows, mapping, headers, skipped } */
  function importCSV(text, opts = {}) {
    const table = parseCSV(text);
    if (!table.length) return { kind: 'unknown', rows: [], mapping: {}, headers: [], skipped: 0 };
    // Algunas exportaciones traen líneas de título antes del encabezado
    let hIdx = 0;
    for (let i = 0; i < Math.min(table.length, 6); i++) {
      const m = mapHeaders(table[i]);
      if (Object.values(m).includes('date') || isGscHeader(table[i])) { hIdx = i; break; }
    }
    const headers = table[hIdx];
    const body = table.slice(hIdx + 1);

    if (isGscHeader(headers)) return importGSC(headers, body);

    const mapping = Object.assign(mapHeaders(headers), opts.mapping || {});
    const dateCol = Object.keys(mapping).find(k => mapping[k] === 'date');
    if (dateCol == null) return { kind: 'unknown', rows: [], mapping, headers, skipped: body.length, error: 'No encontré una columna de fecha.' };
    const dayFirst = opts.dayFirst ?? detectDayFirst(body.map(r => r[dateCol]));
    const byDate = {};
    let skipped = 0;
    for (const r of body) {
      const date = parseDate(r[dateCol], { dayFirst, today: opts.today });
      if (!date) { skipped++; continue; }
      const row = byDate[date] || (byDate[date] = { date });
      for (const [col, field] of Object.entries(mapping)) {
        if (field === 'date') continue;
        const v = parseNumber(r[col], { decimal: DECIMAL_FIELDS.has(field) });
        if (v == null) continue;
        // Si un mismo día viene repetido (export por anuncio), se suma — salvo seguidores, que es un saldo
        row[field] = field === 'followers' ? v : (row[field] || 0) + v;
      }
    }
    const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    return { kind: 'daily', rows, mapping, headers, skipped, dayFirst };
  }

  function isGscHeader(headers) {
    const n = headers.map(norm);
    const has = list => n.some(h => list.includes(h));
    return has(GSC_MAP.position) && has(GSC_MAP.impressions) && (has(GSC_MAP.query) || has(GSC_MAP.page));
  }

  function importGSC(headers, body) {
    const n = headers.map(norm);
    const col = key => n.findIndex(h => GSC_MAP[key].includes(h));
    const ci = { query: col('query'), page: col('page'), clicks: col('clicks'), impressions: col('impressions'), ctr: col('ctr'), position: col('position') };
    const rows = [];
    for (const r of body) {
      const item = {
        query: ci.query >= 0 ? r[ci.query] : null,
        page: ci.page >= 0 ? r[ci.page] : null,
        clicks: parseNumber(r[ci.clicks]) || 0,
        impressions: parseNumber(r[ci.impressions]) || 0,
        position: parseNumber(r[ci.position], { decimal: true }),
      };
      item.ctr = ci.ctr >= 0 ? parseNumber(r[ci.ctr], { decimal: true }) : (item.impressions ? item.clicks / item.impressions : 0);
      if (item.ctr != null && item.ctr > 1) item.ctr = item.ctr / 100;
      if ((item.query || item.page) && item.position != null) rows.push(item);
    }
    return { kind: 'gsc', rows, headers, mapping: ci, skipped: body.length - rows.length, dimension: ci.query >= 0 ? 'query' : 'page' };
  }

  /* Ajusta filas genéricas a la plataforma. En un sitio web, "clics" e
     "impresiones" son de Google (Search Console) y la posición se guarda
     ponderada por impresiones para poder promediarla bien después. */
  function adaptRows(rows, platform) {
    return rows.map(r0 => {
      const r = Object.assign({}, r0);
      if (platform === 'web') {
        if (r.clicks != null && r.searchClicks == null) { r.searchClicks = r.clicks; delete r.clicks; }
        if (r.impressions != null && r.searchImpressions == null) { r.searchImpressions = r.impressions; delete r.impressions; }
        if (r.position != null && r.searchImpressions) r.positionSum = +(r.position * r.searchImpressions).toFixed(2);
      }
      delete r.position; delete r.ctr;
      return r;
    });
  }

  // ── Meta Graph API ──────────────────────────────────────────
  /* http(url) → Promise<{status, ok, json}>; lo provee la plataforma
     (puente nativo en la Mac, fetch en el navegador). */
  function MetaClient({ token, version = 'v23.0', http }) {
    const base = `https://graph.facebook.com/${version}`;

    async function get(path, params = {}, tok = token) {
      const u = new URL(path.startsWith('http') ? path : base + path);
      for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
      if (!u.searchParams.has('access_token')) u.searchParams.set('access_token', tok);
      const res = await http(u.toString());
      const body = res.json;
      if (!res.ok || (body && body.error)) {
        const e = (body && body.error) || {};
        const err = new Error(metaErrorText(e, res.status));
        err.code = e.code; err.meta = e;
        throw err;
      }
      return body;
    }

    async function all(path, params, tok, max = 10) {
      const out = [];
      let page = await get(path, params, tok);
      for (let i = 0; page && i < max; i++) {
        out.push(...(page.data || []));
        if (!page.paging || !page.paging.next) break;
        page = await get(page.paging.next, {}, tok);
      }
      return out;
    }

    return {
      get, all,
      me: () => get('/me', { fields: 'id,name' }),
      /* Descubre Páginas, Instagram profesionales vinculados y cuentas publicitarias */
      async discover() {
        const pages = await all('/me/accounts', { fields: 'id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,followers_count,profile_picture_url}', limit: 50 });
        let ads = [];
        try { ads = await all('/me/adaccounts', { fields: 'id,name,account_status,currency', limit: 50 }); } catch (e) { ads = []; }
        return { pages, ads };
      },
      syncInstagram: (igId, days, progress) => syncInstagram(get, all, igId, days, progress),
      syncPage: (pageId, pageToken, days, progress) => syncPage(get, all, pageId, pageToken, days, progress),
      syncAds: (actId, days, progress) => syncAds(get, all, actId, days, progress),
      /* Business Discovery: datos públicos de CUALQUIER cuenta profesional de
         Instagram, consultados desde tu propia cuenta ("lupa"). Es la vía
         oficial de Meta para medir competidores sin iniciar sesión en ellos. */
      discoverInstagram(lupaIgId, username) {
        const u = String(username).replace(/^@/, '').trim();
        const media = 'media.limit(50){id,caption,like_count,comments_count,timestamp,media_type,media_product_type,permalink}';
        return get(`/${lupaIgId}`, { fields: `business_discovery.username(${u}){username,name,followers_count,follows_count,media_count,${media}}` })
          .then(r => r.business_discovery);
      },
    };
  }

  function metaErrorText(e, status) {
    if (e.code === 190) return 'El token de Meta venció o no es válido. Genera uno nuevo en Ajustes.';
    if (e.code === 10 || e.code === 200) return `Permiso faltante en el token: ${e.message || ''}`;
    if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) return 'Meta limitó las llamadas por un rato. Intenta de nuevo en unos minutos.';
    return e.message || `Error de Meta (HTTP ${status})`;
  }

  const unix = s => Math.floor(new Date(s + 'T00:00:00').getTime() / 1000);
  const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dayList(days) {
    const out = [];
    const t = new Date(); t.setHours(0, 0, 0, 0);
    for (let i = days; i >= 1; i--) { const d = new Date(t); d.setDate(t.getDate() - i); out.push(isoOf(d)); }
    return out;
  }
  function nextDay(s) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + 1); return isoOf(d); }

  async function syncInstagram(get, all, igId, days = 30, progress = () => {}) {
    const rows = {};
    const row = d => rows[d] || (rows[d] = { date: d });
    const dates = dayList(Math.min(days, 90));
    const profile = await get(`/${igId}`, { fields: 'username,followers_count,media_count' });

    // Alcance diario (serie de tiempo)
    progress('Alcance diario…');
    try {
      for (let i = 0; i < dates.length; i += 30) {
        const chunk = dates.slice(i, i + 30);
        const r = await get(`/${igId}/insights`, { metric: 'reach', period: 'day', since: unix(chunk[0]), until: unix(nextDay(chunk[chunk.length - 1])) });
        for (const m of r.data || []) for (const v of m.values || []) {
          const d = (v.end_time || '').slice(0, 10);
          // end_time marca el cierre del día → corresponde al día anterior
          const day = isoOf(new Date(new Date(d + 'T00:00:00').getTime() - 86400000));
          if (dates.includes(day)) row(day).reach = v.value;
        }
      }
    } catch (e) { progress('Alcance no disponible: ' + e.message); }

    // Nuevos seguidores diarios (Meta solo da los últimos 30 días)
    try {
      const last30 = dates.slice(-30);
      const r = await get(`/${igId}/insights`, { metric: 'follower_count', period: 'day', since: unix(last30[0]), until: unix(nextDay(last30[last30.length - 1])) });
      for (const m of r.data || []) for (const v of m.values || []) {
        const d = (v.end_time || '').slice(0, 10);
        const day = isoOf(new Date(new Date(d + 'T00:00:00').getTime() - 86400000));
        if (dates.includes(day)) row(day).newFollowers = v.value;
      }
    } catch (e) { /* cuentas con <100 seguidores no tienen este dato */ }

    // Métricas de valor total, día por día
    const metrics = ['views', 'profile_views', 'website_clicks', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'accounts_engaged'];
    const map = { views: 'views', profile_views: 'profileVisits', website_clicks: 'websiteClicks', total_interactions: 'engagements', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves' };
    let ok = metrics.slice();
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      progress(`Interacciones ${i + 1}/${dates.length}…`);
      try {
        const r = await get(`/${igId}/insights`, { metric: ok.join(','), metric_type: 'total_value', period: 'day', since: unix(d), until: unix(nextDay(d)) });
        for (const m of r.data || []) if (map[m.name] && m.total_value) row(d)[map[m.name]] = m.total_value.value;
      } catch (e) {
        // Si una métrica no es válida en esta versión, la quitamos y seguimos
        const bad = ok.find(x => (e.message || '').includes(x));
        if (bad) { ok = ok.filter(x => x !== bad); i--; continue; }
        if (e.code === 190) throw e;
      }
    }

    // Seguidores: reconstruimos el saldo hacia atrás desde el valor actual
    const sorted = Object.values(rows).sort((a, b) => a.date.localeCompare(b.date));
    let bal = profile.followers_count;
    for (let i = sorted.length - 1; i >= 0; i--) {
      sorted[i].followers = bal;
      if (sorted[i].newFollowers != null) bal -= sorted[i].newFollowers;
    }

    // Publicaciones con sus métricas
    progress('Publicaciones…');
    const posts = [];
    const media = await all(`/${igId}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: 50 }, undefined, 2);
    const since = dates[0];
    for (const m of media) {
      const date = (m.timestamp || '').slice(0, 10);
      if (date < since) continue;
      const p = { id: m.id, date, time: (m.timestamp || '').slice(11, 16), type: mediaType(m), caption: (m.caption || '').slice(0, 140), permalink: m.permalink, likes: m.like_count, comments: m.comments_count };
      try {
        const metricList = m.media_product_type === 'STORY' ? 'reach,views,shares' : 'reach,saved,shares,views,total_interactions';
        const r = await get(`/${m.id}/insights`, { metric: metricList });
        for (const x of r.data || []) {
          const v = x.values ? x.values[0].value : x.total_value?.value;
          if (x.name === 'saved') p.saves = v; else if (x.name === 'total_interactions') p.engagements = v; else p[x.name] = v;
        }
      } catch (e) { /* posts antiguos o de tipo sin insights */ }
      posts.push(p);
      if (row(date)) row(date).posts = (row(date).posts || 0) + 1;
    }
    return { rows: Object.values(rows).sort((a, b) => a.date.localeCompare(b.date)), posts, profile };
  }

  function mediaType(m) {
    if (m.media_product_type === 'REELS') return 'Reel';
    if (m.media_product_type === 'STORY') return 'Historia';
    if (m.media_type === 'CAROUSEL_ALBUM') return 'Carrusel';
    if (m.media_type === 'VIDEO') return 'Video';
    return 'Imagen';
  }

  async function syncPage(get, all, pageId, pageToken, days = 30, progress = () => {}) {
    const rows = {};
    const row = d => rows[d] || (rows[d] = { date: d });
    const dates = dayList(Math.min(days, 90));
    const info = await get(`/${pageId}`, { fields: 'name,followers_count,fan_count' }, pageToken);
    // Meta retira y renombra métricas de Página con frecuencia: probamos
    // cada una por separado y nos quedamos con las que respondan.
    const metrics = {
      page_impressions_unique: 'reach', page_media_view: 'views', page_impressions: 'impressions',
      page_post_engagements: 'engagements', page_daily_follows_unique: 'newFollowers', page_views_total: 'profileVisits',
      page_total_actions: 'websiteClicks',
    };
    for (const [metric, field] of Object.entries(metrics)) {
      progress(`Página: ${metric}…`);
      try {
        for (let i = 0; i < dates.length; i += 30) {
          const chunk = dates.slice(i, i + 30);
          const r = await get(`/${pageId}/insights`, { metric, period: 'day', since: unix(chunk[0]), until: unix(nextDay(chunk[chunk.length - 1])) }, pageToken);
          for (const m of r.data || []) for (const v of m.values || []) {
            const d = (v.end_time || '').slice(0, 10);
            const day = isoOf(new Date(new Date(d + 'T00:00:00').getTime() - 86400000));
            if (dates.includes(day) && typeof v.value === 'number') row(day)[field] = v.value;
          }
        }
      } catch (e) { if (e.code === 190) throw e; }
    }
    const sorted = dates.map(d => row(d));
    let bal = info.followers_count ?? info.fan_count;
    for (let i = sorted.length - 1; i >= 0; i--) {
      sorted[i].followers = bal;
      if (sorted[i].newFollowers != null) bal -= sorted[i].newFollowers;
    }
    progress('Publicaciones de la Página…');
    const posts = [];
    try {
      const feed = await all(`/${pageId}/posts`, { fields: 'id,message,created_time,permalink_url,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)', since: unix(dates[0]), limit: 50 }, pageToken, 3);
      for (const f of feed) {
        const date = (f.created_time || '').slice(0, 10);
        posts.push({ id: f.id, date, time: (f.created_time || '').slice(11, 16), type: 'Publicación', caption: (f.message || '').slice(0, 140), permalink: f.permalink_url,
          likes: f.reactions?.summary?.total_count || 0, comments: f.comments?.summary?.total_count || 0, shares: f.shares?.count || 0 });
        if (rows[date]) rows[date].posts = (rows[date].posts || 0) + 1;
      }
    } catch (e) { /* sin permiso pages_read_user_content */ }
    return { rows: sorted, posts, profile: info };
  }

  const LEAD_ACTIONS = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.messaging_conversation_started_7d'];
  const CONV_ACTIONS = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'schedule', 'submit_application'];

  function actionSum(actions, types) {
    let s = 0;
    // Evita contar dos veces el mismo lead (lead y lead_grouped suelen venir juntos)
    const found = (actions || []).filter(a => types.includes(a.action_type));
    const grouped = found.find(a => a.action_type === 'onsite_conversion.lead_grouped');
    for (const a of found) {
      if (grouped && a.action_type === 'lead') continue;
      s += parseFloat(a.value) || 0;
    }
    return s;
  }

  async function syncAds(get, all, actId, days = 30, progress = () => {}) {
    const id = String(actId).startsWith('act_') ? actId : 'act_' + actId;
    const dates = dayList(Math.min(days, 365));
    const range = { since: dates[0], until: dates[dates.length - 1] };
    progress('Anuncios: resultados diarios…');
    const daily = await all(`/${id}/insights`, { fields: 'spend,impressions,reach,frequency,clicks,inline_link_clicks,actions', time_increment: 1, time_range: range, level: 'account', limit: 100 }, undefined, 20);
    const rows = daily.map(d => ({
      date: d.date_start,
      spend: parseFloat(d.spend) || 0, impressions: +d.impressions || 0, reach: +d.reach || 0,
      clicks: +d.clicks || 0, linkClicks: +d.inline_link_clicks || 0,
      leads: actionSum(d.actions, LEAD_ACTIONS), conversions: actionSum(d.actions, CONV_ACTIONS),
    }));
    progress('Anuncios: campañas…');
    let campaigns = [];
    try {
      const c = await all(`/${id}/insights`, { fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,frequency,inline_link_clicks,actions', time_range: range, level: 'campaign', limit: 100 }, undefined, 5);
      campaigns = c.map(x => ({ id: x.campaign_id, name: x.campaign_name, objective: x.objective, spend: parseFloat(x.spend) || 0, impressions: +x.impressions || 0,
        reach: +x.reach || 0, frequency: parseFloat(x.frequency) || 0, linkClicks: +x.inline_link_clicks || 0, leads: actionSum(x.actions, LEAD_ACTIONS) }));
    } catch (e) { /* opcional */ }
    return { rows, campaigns };
  }

  // ── Medición pública (sin iniciar sesión) ───────────────────
  /* Lo que cualquiera puede ver de un perfil: seguidores, publicaciones y
     me gusta/comentarios de cada post. NO incluye alcance, impresiones,
     guardados ni visitas: eso solo lo ve quien administra la cuenta.
     Cada medición deja una "foto" del día; con varios días se arma la
     curva de crecimiento. */

  /* Normaliza Business Discovery (oficial) o el JSON web de Instagram
     (respaldo no oficial) a { username, followers, mediaCount, posts[] } */
  function normalizeInstagramPublic(src) {
    if (!src) return null;
    if (src.followers_count != null) {
      return {
        username: src.username, name: src.name, followers: src.followers_count, mediaCount: src.media_count, official: true,
        posts: ((src.media && src.media.data) || []).map(m => ({
          id: m.id, date: (m.timestamp || '').slice(0, 10), time: (m.timestamp || '').slice(11, 16), type: mediaType(m),
          caption: (m.caption || '').slice(0, 140), permalink: m.permalink, likes: m.like_count, comments: m.comments_count,
        })),
      };
    }
    const u = (src.data && src.data.user) || src.user;
    if (!u || !u.edge_followed_by) return null;
    const edges = (u.edge_owner_to_timeline_media && u.edge_owner_to_timeline_media.edges) || [];
    return {
      username: u.username, name: u.full_name, followers: u.edge_followed_by.count,
      mediaCount: u.edge_owner_to_timeline_media && u.edge_owner_to_timeline_media.count, official: false,
      posts: edges.map(({ node: n }) => {
        const d = new Date((n.taken_at_timestamp || 0) * 1000);
        return {
          id: n.id, date: isoOf(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          type: n.product_type === 'clips' ? 'Reel' : n.__typename === 'GraphSidecar' ? 'Carrusel' : n.is_video ? 'Video' : 'Imagen',
          caption: (((n.edge_media_to_caption || {}).edges || [])[0] || { node: { text: '' } }).node.text.slice(0, 140),
          permalink: n.shortcode ? `https://www.instagram.com/p/${n.shortcode}/` : null,
          likes: (n.edge_liked_by || n.edge_media_preview_like || {}).count, comments: (n.edge_media_to_comment || {}).count,
          views: n.video_view_count || undefined,
        };
      }),
    };
  }

  /* Convierte una medición de Instagram en filas diarias y posts.
     - Hoy: seguidores (saldo) y total de publicaciones.
     - Día de cada post: cuántos posts, me gusta y comentarios acumulados
       (se actualizan en cada medición, porque siguen sumando). */
  function instagramPublicToData(pub, today) {
    const rows = {};
    const row = d => rows[d] || (rows[d] = { date: d });
    row(today).followers = pub.followers;
    if (pub.mediaCount != null) row(today).mediaCount = pub.mediaCount;
    const byDay = {};
    for (const p of pub.posts) {
      if (!p.date) continue;
      const g = byDay[p.date] || (byDay[p.date] = { posts: 0, likes: 0, comments: 0 });
      g.posts++; g.likes += p.likes || 0; g.comments += p.comments || 0;
    }
    for (const [d, g] of Object.entries(byDay)) Object.assign(row(d), g, { engagements: g.likes + g.comments });
    const posts = pub.posts.map(p => Object.assign({}, p, { followers: pub.followers, engagements: (p.likes || 0) + (p.comments || 0) }));
    return { rows: Object.values(rows).sort((a, b) => a.date.localeCompare(b.date)), posts };
  }

  /* TikTok: el perfil público trae un JSON con los contadores */
  function parseTikTokProfile(html) {
    const m = String(html || '').match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    let j; try { j = JSON.parse(m[1]); } catch (e) { return null; }
    const d = j && j.__DEFAULT_SCOPE__ && j.__DEFAULT_SCOPE__['webapp.user-detail'];
    const info = d && d.userInfo;
    if (!info || !info.stats) return null;
    const st = info.statsV2 || info.stats;
    const n = v => (v == null ? null : Number(v));
    return { username: info.user && info.user.uniqueId, name: info.user && info.user.nickname,
             followers: n(st.followerCount), hearts: n(st.heartCount ?? st.heart), videos: n(st.videoCount) };
  }

  /* TikTok solo da totales: la diferencia con la medición anterior son
     los me gusta y videos nuevos de ese intervalo. */
  function tiktokPublicToRows(stats, prevRows, today) {
    const before = [...(prevRows || [])].filter(r => r.date < today && r.heartTotal != null).sort((a, b) => a.date.localeCompare(b.date)).pop();
    const row = { date: today, followers: stats.followers, heartTotal: stats.hearts, videoTotal: stats.videos };
    if (before) {
      const dl = stats.hearts - before.heartTotal, dv = stats.videos - before.videoTotal;
      if (dl >= 0) { row.likes = dl; row.engagements = dl; }
      if (dv >= 0) row.posts = dv;
    }
    return [row];
  }

  const api = { parseCSV, parseNumber, parseDate, detectDayFirst, mapHeaders, importCSV, adaptRows, MetaClient, actionSum, HEADER_MAP,
                normalizeInstagramPublic, instagramPublicToData, parseTikTokProfile, tiktokPublicToRows };
  root.PulsoConnectors = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
