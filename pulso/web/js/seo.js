/* ─────────────────────────────────────────────────────────────
   Pulso · SEO
   - Auditor on-page: lee el HTML de una URL y evalúa ~30 factores
     (título, descripción, encabezados, imágenes, enlaces, datos
     estructurados, Open Graph, indexabilidad, móvil, palabra clave).
   - robots.txt y sitemap.xml.
   - Search Console: oportunidades por posición, CTR contra la curva
     esperada, canibalización y marca vs. no-marca.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  /* CTR orgánico esperado por posición (promedio de estudios públicos
     2023-2025, escritorio+móvil). Es una referencia, no una ley. */
  const CTR_CURVE = [0.276, 0.158, 0.11, 0.084, 0.063, 0.049, 0.039, 0.033, 0.027, 0.024,
                     0.019, 0.017, 0.015, 0.013, 0.011, 0.01, 0.009, 0.008, 0.007, 0.006];
  function expectedCtr(pos) {
    if (pos == null || !isFinite(pos)) return null;
    if (pos <= 1) return CTR_CURVE[0];
    if (pos >= 20) return 0.005;
    const i = Math.floor(pos) - 1, f = pos - Math.floor(pos);
    return CTR_CURVE[i] + (CTR_CURVE[i + 1] - CTR_CURVE[i]) * f;
  }

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const text = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();

  /* Ancho aproximado en píxeles (Google corta el título en ~580 px y la
     descripción en ~920 px en escritorio). */
  function pixelWidth(s, size = 20) {
    let w = 0;
    for (const ch of String(s || '')) {
      if ('il.,:;|!\'ítj'.includes(ch)) w += 0.28;
      else if ('fr()[]- '.includes(ch)) w += 0.36;
      else if ('mwMW'.includes(ch)) w += 0.86;
      else if (ch === ch.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(ch)) w += 0.68;
      else w += 0.52;
    }
    return w * size;
  }

  /* doc: Document ya parseado. url: URL final. keyword: frase objetivo. */
  function auditDocument(doc, url, keyword, meta = {}) {
    const checks = [];
    const add = (cat, id, label, status, detail, fix, weight = 1) => checks.push({ cat, id, label, status, detail, fix, weight });
    const kw = norm(keyword || '').trim();
    const has = s => kw && norm(s).includes(kw);
    let host = '';
    try { host = new URL(url).host; } catch (e) { /* url inválida */ }

    // ── Título ──
    const title = text(doc.querySelector('title'));
    const tw = pixelWidth(title);
    if (!title) add('Contenido', 'title', 'Etiqueta <title>', 'fail', 'La página no tiene título.', 'Agrega un <title> único de 50–60 caracteres con la palabra clave al inicio.', 3);
    else if (title.length < 30) add('Contenido', 'title', 'Etiqueta <title>', 'warn', `"${title}" — ${title.length} caracteres: demasiado corto, desaprovechas espacio.`, 'Amplíalo a 50–60 caracteres: palabra clave + beneficio + marca.', 3);
    else if (tw > 580) add('Contenido', 'title', 'Etiqueta <title>', 'warn', `${title.length} caracteres (~${Math.round(tw)} px): Google lo cortará.`, 'Recórtalo para que quepa en ~580 px (unos 55–60 caracteres).', 3);
    else add('Contenido', 'title', 'Etiqueta <title>', 'pass', `"${title}" — ${title.length} caracteres.`, '', 3);
    if (kw) {
      if (!has(title)) add('Palabra clave', 'kw-title', 'Palabra clave en el título', 'fail', `"${keyword}" no aparece en el título.`, 'Ponla en el título, idealmente al inicio.', 3);
      else add('Palabra clave', 'kw-title', 'Palabra clave en el título', norm(title).indexOf(kw) < 20 ? 'pass' : 'warn', norm(title).indexOf(kw) < 20 ? 'Aparece al inicio del título.' : 'Aparece, pero lejos del inicio.', 'Muévela hacia el comienzo del título.', 3);
    }

    // ── Descripción ──
    const desc = (doc.querySelector('meta[name="description" i]') || {}).content || '';
    if (!desc) add('Contenido', 'desc', 'Meta description', 'fail', 'No tiene meta description: Google improvisará un fragmento.', 'Escribe 140–155 caracteres con la palabra clave, el beneficio y un llamado a la acción.', 2);
    else if (desc.length < 110) add('Contenido', 'desc', 'Meta description', 'warn', `${desc.length} caracteres: corta.`, 'Llévala a 140–155 caracteres.', 2);
    else if (desc.length > 165) add('Contenido', 'desc', 'Meta description', 'warn', `${desc.length} caracteres: se cortará.`, 'Recórtala a máximo ~155 caracteres.', 2);
    else add('Contenido', 'desc', 'Meta description', 'pass', `${desc.length} caracteres.`, '', 2);
    if (kw && desc) add('Palabra clave', 'kw-desc', 'Palabra clave en la descripción', has(desc) ? 'pass' : 'warn', has(desc) ? 'Incluida (Google la resalta en negrita).' : 'No aparece.', 'Inclúyela: Google la resalta en negrita y sube el CTR.', 1);

    // ── Encabezados ──
    const h1s = [...doc.querySelectorAll('h1')].map(text).filter(Boolean);
    if (!h1s.length) add('Estructura', 'h1', 'Encabezado H1', 'fail', 'No hay H1.', 'Agrega un único H1 que describa la página.', 2);
    else if (h1s.length > 1) add('Estructura', 'h1', 'Encabezado H1', 'warn', `Hay ${h1s.length} H1: ${h1s.slice(0, 3).map(h => `"${h.slice(0, 40)}"`).join(', ')}.`, 'Deja un solo H1; convierte los demás en H2.', 2);
    else add('Estructura', 'h1', 'Encabezado H1', 'pass', `"${h1s[0].slice(0, 80)}"`, '', 2);
    if (kw && h1s.length) add('Palabra clave', 'kw-h1', 'Palabra clave en el H1', h1s.some(has) ? 'pass' : 'warn', h1s.some(has) ? 'Incluida.' : 'No aparece en el H1.', 'Inclúyela de forma natural en el H1.', 2);
    const heads = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
    let skips = 0;
    for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) skips++;
    const h2n = heads.filter(h => h === 2).length;
    add('Estructura', 'hierarchy', 'Jerarquía de encabezados', skips ? 'warn' : (h2n ? 'pass' : 'warn'),
      skips ? `${skips} salto(s) de nivel (ej. de H2 a H4).` : (h2n ? `${h2n} H2 organizan el contenido.` : 'No hay H2: el contenido no está seccionado.'),
      'Usa H2 para secciones y H3 para subsecciones, sin saltar niveles.', 1);

    // ── Contenido ──
    const bodyClone = doc.body ? doc.body.cloneNode(true) : null;
    if (bodyClone) bodyClone.querySelectorAll('script,style,noscript,nav,footer,header,svg').forEach(e => e.remove());
    const bodyText = text(bodyClone);
    const words = bodyText ? bodyText.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)) : [];
    const wc = words.length;
    add('Contenido', 'words', 'Cantidad de contenido', wc < 300 ? 'warn' : 'pass', `${wc.toLocaleString('es-DO')} palabras en el cuerpo.`,
      'Las páginas que posicionan para búsquedas informativas suelen tener 800+ palabras útiles. Para servicios, 400+ con preguntas frecuentes.', 2);
    if (kw && wc) {
      const t = norm(bodyText);
      let occ = 0, idx = 0;
      while ((idx = t.indexOf(kw, idx)) >= 0) { occ++; idx += kw.length; }
      const density = (occ * kw.split(/\s+/).length) / wc;
      const first100 = norm(words.slice(0, 100).join(' ')).includes(kw);
      add('Palabra clave', 'kw-density', 'Uso de la palabra clave', occ === 0 ? 'fail' : density > 0.03 ? 'warn' : 'pass',
        `${occ} vez/veces · densidad ${(density * 100).toFixed(2)}%.`,
        occ === 0 ? 'La palabra clave no aparece en el cuerpo.' : density > 0.03 ? 'Posible sobreoptimización: usa sinónimos y variaciones.' : '', 2);
      add('Palabra clave', 'kw-first', 'Palabra clave al inicio del texto', first100 ? 'pass' : 'warn', first100 ? 'Aparece en las primeras 100 palabras.' : 'No aparece en las primeras 100 palabras.', 'Menciónala en el primer párrafo.', 1);
      let slug = '';
      try { slug = norm(decodeURIComponent(new URL(url).pathname)).replace(/[-_/]+/g, ' '); } catch (e) { /* nada */ }
      add('Palabra clave', 'kw-url', 'Palabra clave en la URL', slug.includes(kw) ? 'pass' : 'warn', slug.includes(kw) ? 'La URL la contiene.' : 'La URL no la contiene.', 'URLs cortas y descriptivas: /tarjeta-de-credito-sin-anualidad', 1);
    }

    // ── Imágenes ──
    const imgs = [...doc.querySelectorAll('img')];
    const noAlt = imgs.filter(i => !i.hasAttribute('alt'));
    const emptyAlt = imgs.filter(i => i.hasAttribute('alt') && !i.getAttribute('alt').trim());
    if (!imgs.length) add('Imágenes', 'img-alt', 'Texto alternativo (alt)', 'info', 'La página no tiene imágenes <img>.', '', 0);
    else add('Imágenes', 'img-alt', 'Texto alternativo (alt)', noAlt.length ? (noAlt.length / imgs.length > 0.3 ? 'fail' : 'warn') : 'pass',
      `${imgs.length} imágenes · ${noAlt.length} sin alt · ${emptyAlt.length} con alt vacío (decorativas).`,
      'Describe cada imagen relevante en el alt (accesibilidad + Google Imágenes).', 2);
    const lazy = imgs.filter(i => i.getAttribute('loading') === 'lazy').length;
    if (imgs.length > 3) add('Rendimiento', 'lazy', 'Carga diferida de imágenes', lazy ? 'pass' : 'warn', `${lazy}/${imgs.length} con loading="lazy".`, 'Agrega loading="lazy" a las imágenes debajo del primer pantallazo.', 1);
    const noDims = imgs.filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length;
    if (imgs.length) add('Rendimiento', 'img-dims', 'Dimensiones de imágenes (CLS)', noDims ? 'warn' : 'pass', `${noDims} imágenes sin width/height.`, 'Define width y height para evitar saltos de diseño (CLS, parte de Core Web Vitals).', 1);
    const modern = imgs.filter(i => /\.(webp|avif)(\?|$)/i.test(i.getAttribute('src') || '') || i.closest('picture')).length;
    if (imgs.length) add('Rendimiento', 'img-format', 'Formatos modernos (WebP/AVIF)', modern / imgs.length >= 0.5 ? 'pass' : 'warn', `${modern}/${imgs.length} en formato moderno.`, 'Sirve imágenes WebP o AVIF: pesan 25–50% menos.', 1);

    // ── Enlaces ──
    const links = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && !h.startsWith('#') && !/^(mailto|tel|javascript|whatsapp):/i.test(h));
    let internal = 0, external = 0;
    for (const h of links) { try { (new URL(h, url).host === host ? internal++ : external++); } catch (e) { /* ignorar */ } }
    add('Enlaces', 'internal', 'Enlaces internos', internal >= 3 ? 'pass' : 'warn', `${internal} internos · ${external} externos.`, 'Enlaza a 3+ páginas relacionadas de tu sitio con textos ancla descriptivos.', 1);
    const vague = [...doc.querySelectorAll('a')].filter(a => /^(click aqu[ií]|aqu[ií]|clic aqu[ií]|ver m[aá]s|leer m[aá]s|here|click here|more)$/i.test(text(a))).length;
    if (vague) add('Enlaces', 'anchors', 'Textos ancla descriptivos', 'warn', `${vague} enlaces con texto genérico ("aquí", "ver más").`, 'Usa textos que describan el destino: "requisitos del préstamo personal".', 1);

    // ── Técnico ──
    const canonEl = doc.querySelector('link[rel="canonical" i]');
    const canonical = canonEl && canonEl.getAttribute('href');
    add('Técnico', 'canonical', 'URL canónica', canonical ? 'pass' : 'warn', canonical ? `Canónica: ${canonical}` : 'Sin rel="canonical".', 'Agrega <link rel="canonical"> para evitar contenido duplicado (con/sin www, parámetros UTM).', 2);
    const robots = ((doc.querySelector('meta[name="robots" i]') || {}).content || '').toLowerCase();
    const xRobots = ((meta.headers && meta.headers['x-robots-tag']) || '').toLowerCase();
    if (robots.includes('noindex') || xRobots.includes('noindex')) add('Técnico', 'index', 'Indexable', 'fail', 'La página tiene noindex: Google NO la mostrará.', 'Quita el noindex si quieres que posicione.', 4);
    else add('Técnico', 'index', 'Indexable', 'pass', robots ? `robots: ${robots}` : 'Sin restricciones de indexación.', '', 4);
    const lang = doc.documentElement && doc.documentElement.getAttribute('lang');
    add('Técnico', 'lang', 'Idioma declarado', lang ? 'pass' : 'warn', lang ? `lang="${lang}"` : 'Falta lang en <html>.', 'Agrega <html lang="es-DO"> (o el idioma que corresponda).', 1);
    const viewport = doc.querySelector('meta[name="viewport" i]');
    add('Técnico', 'viewport', 'Optimizada para móvil', viewport ? 'pass' : 'fail', viewport ? 'Tiene meta viewport.' : 'Sin meta viewport: se verá mal en móvil (Google indexa primero la versión móvil).', 'Agrega <meta name="viewport" content="width=device-width, initial-scale=1">.', 3);
    if (url) add('Técnico', 'https', 'HTTPS', url.startsWith('https://') ? 'pass' : 'fail', url.startsWith('https://') ? 'Conexión segura.' : 'La página no usa HTTPS.', 'Activa HTTPS y redirige todo el tráfico http → https.', 3);
    const hreflang = doc.querySelectorAll('link[rel="alternate"][hreflang]').length;
    if (hreflang) add('Técnico', 'hreflang', 'Versiones por idioma (hreflang)', 'pass', `${hreflang} alternativas declaradas.`, '', 0);
    const favicon = doc.querySelector('link[rel~="icon" i]');
    add('Técnico', 'favicon', 'Favicon', favicon ? 'pass' : 'warn', favicon ? 'Definido.' : 'Sin favicon: Google lo muestra junto al resultado en móvil.', 'Agrega un favicon de 48×48 px o múltiplos.', 1);
    if (meta.bytes) add('Rendimiento', 'size', 'Peso del HTML', meta.bytes > 300000 ? 'warn' : 'pass', `${(meta.bytes / 1024).toFixed(0)} KB de HTML.`, 'Reduce HTML inline, scripts y estilos incrustados.', 1);
    if (meta.ms) add('Rendimiento', 'ttfb', 'Tiempo de respuesta', meta.ms > 1500 ? 'warn' : 'pass', `${meta.ms} ms para descargar el HTML.`, 'Usa caché/CDN; apunta a menos de 800 ms.', 1);
    const scripts = doc.querySelectorAll('script[src]').length;
    const blocking = [...doc.querySelectorAll('head script[src]')].filter(s => !s.async && !s.defer && s.type !== 'module').length;
    add('Rendimiento', 'scripts', 'Scripts que bloquean la carga', blocking > 2 ? 'warn' : 'pass', `${scripts} scripts externos · ${blocking} bloqueantes en <head>.`, 'Agrega defer o async a los scripts que no son críticos.', 1);

    // ── Datos estructurados y redes ──
    const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    const types = [];
    let ldErrors = 0;
    for (const s of ld) {
      try {
        const j = JSON.parse(s.textContent);
        const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o['@type']) types.push([].concat(o['@type']).join('/')); if (o['@graph']) walk(o['@graph']); };
        walk(j);
      } catch (e) { ldErrors++; }
    }
    add('Datos estructurados', 'schema', 'Schema.org (JSON-LD)', ldErrors ? 'fail' : types.length ? 'pass' : 'warn',
      ldErrors ? `${ldErrors} bloque(s) JSON-LD con errores de sintaxis.` : types.length ? `Tipos: ${[...new Set(types)].join(', ')}.` : 'No hay datos estructurados.',
      'Agrega Organization/LocalBusiness y FAQPage o Product según la página: ganan resultados enriquecidos.', 2);
    const og = k => (doc.querySelector(`meta[property="og:${k}"]`) || {}).content;
    const ogMissing = ['title', 'description', 'image', 'url'].filter(k => !og(k));
    add('Redes', 'og', 'Open Graph (vista previa al compartir)', ogMissing.length ? (ogMissing.length > 2 ? 'fail' : 'warn') : 'pass',
      ogMissing.length ? `Faltan: og:${ogMissing.join(', og:')}.` : 'Completo: se verá bien en WhatsApp, Facebook y LinkedIn.',
      'Agrega og:title, og:description, og:image (1200×630) y og:url.', 1);
    const tw2 = doc.querySelector('meta[name="twitter:card"]');
    add('Redes', 'twitter', 'Twitter/X card', tw2 ? 'pass' : 'info', tw2 ? 'Definida.' : 'Sin twitter:card (opcional).', '', 0);

    // ── Puntaje ──
    const val = { pass: 1, warn: 0.5, fail: 0, info: null };
    let got = 0, max = 0;
    for (const c of checks) { if (val[c.status] == null || !c.weight) continue; got += val[c.status] * c.weight; max += c.weight; }
    const score = max ? Math.round((got / max) * 100) : 0;
    const order = { fail: 0, warn: 1, pass: 2, info: 3 };
    checks.sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);
    return { url, keyword, score, title, description: desc, h1: h1s[0] || '', wordCount: wc, checks,
             counts: { fail: checks.filter(c => c.status === 'fail').length, warn: checks.filter(c => c.status === 'warn').length, pass: checks.filter(c => c.status === 'pass').length } };
  }

  function auditHTML(html, url, keyword, meta) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return auditDocument(doc, url, keyword, Object.assign({ bytes: html.length }, meta || {}));
  }

  function parseRobots(txt) {
    const lines = String(txt || '').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
    const sitemaps = [], groups = [];
    let cur = null;
    for (const l of lines) {
      const [k, ...rest] = l.split(':');
      const key = k.trim().toLowerCase(), v = rest.join(':').trim();
      if (key === 'sitemap') sitemaps.push(v);
      else if (key === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v); }
      else if ((key === 'disallow' || key === 'allow') && cur) cur.rules.push({ type: key, path: v });
    }
    const star = groups.find(g => g.agents.includes('*'));
    const blocksAll = !!(star && star.rules.some(r => r.type === 'disallow' && r.path === '/'));
    return { sitemaps, groups, blocksAll };
  }

  function parseSitemap(xml) {
    const urls = [...String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
    const isIndex = /<sitemapindex/i.test(xml);
    const lastmods = [...String(xml || '').matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi)].map(m => m[1]).sort();
    return { isIndex, urls, count: urls.length, newest: lastmods[lastmods.length - 1] || null };
  }

  /* rows: [{query|page, clicks, impressions, ctr, position}] */
  function gscOpportunities(rows, { brandTerms = [], minImpressions = 50 } = {}) {
    const brand = brandTerms.map(norm).filter(Boolean);
    const isBrand = q => brand.some(b => norm(q).includes(b));
    const enriched = rows.map(r => {
      const exp = expectedCtr(r.position);
      const ctrGap = exp != null ? r.ctr - exp : null;
      const targetPos = r.position > 3 ? 3 : Math.max(1, Math.floor(r.position));
      const potential = Math.max(0, r.impressions * (expectedCtr(targetPos) || 0) - r.clicks);
      return { ...r, expectedCtr: exp, ctrGap, potential, brand: r.query ? isBrand(r.query) : false };
    });
    const striking = enriched.filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= minImpressions).sort((a, b) => b.potential - a.potential);
    const lowCtr = enriched.filter(r => r.position <= 10 && r.impressions >= minImpressions && r.ctrGap != null && r.ctr < r.expectedCtr * 0.6).sort((a, b) => a.ctrGap * a.impressions - b.ctrGap * b.impressions);
    const totals = enriched.reduce((t, r) => { t.clicks += r.clicks; t.impressions += r.impressions; if (r.brand) { t.brandClicks += r.clicks; } return t; }, { clicks: 0, impressions: 0, brandClicks: 0 });
    const posW = enriched.reduce((s, r) => s + r.position * r.impressions, 0);
    return {
      rows: enriched, striking: striking.slice(0, 25), lowCtr: lowCtr.slice(0, 25),
      totals: { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: totals.impressions ? posW / totals.impressions : null,
                brandShare: totals.clicks ? totals.brandClicks / totals.clicks : 0, potential: striking.reduce((s, r) => s + r.potential, 0) },
      buckets: [[1, 3], [4, 10], [11, 20], [21, 50], [51, 1000]].map(([a, b]) => {
        const g = enriched.filter(r => r.position >= a && r.position < b + 1);
        return { label: b > 100 ? `${a}+` : `${a}–${b}`, n: g.length, clicks: g.reduce((s, r) => s + r.clicks, 0), impressions: g.reduce((s, r) => s + r.impressions, 0) };
      }),
    };
  }

  /* Canibalización: misma consulta posicionando con varias páginas.
     Requiere export con consulta + página. */
  function cannibalization(rows) {
    const g = {};
    for (const r of rows) if (r.query && r.page) (g[r.query] = g[r.query] || []).push(r);
    return Object.entries(g).filter(([, v]) => v.length > 1).map(([q, v]) => ({ query: q, pages: v.sort((a, b) => a.position - b.position) }))
      .sort((a, b) => b.pages.reduce((s, r) => s + r.impressions, 0) - a.pages.reduce((s, r) => s + r.impressions, 0));
  }

  const api = { CTR_CURVE, expectedCtr, pixelWidth, auditDocument, auditHTML, parseRobots, parseSitemap, gscOpportunities, cannibalization };
  root.PulsoSEO = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
