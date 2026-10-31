/* ─────────────────────────────────────────────────────────────
   Pulso · Datos de demostración
   Genera 120 días de métricas creíbles (con estacionalidad semanal,
   ruido y tendencias distintas por cuenta) para explorar la app antes
   de conectar las cuentas reales. Siempre los mismos números (semilla).
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  const A = root.PulsoAnalysis || require('./analysis.js');

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function build(today, people) {
    const r = rng(42);
    const noise = (amp = 0.2) => 1 + (r() - 0.5) * 2 * amp;
    const end = today || A.iso(new Date(Date.now() - 86400000));
    const days = 120;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) dates.push(A.addDays(end, -i));
    const weekday = d => A.parseISO(d).getDay();
    const wk = [0.8, 1.1, 1.05, 1.1, 1.0, 0.95, 0.75];
    const [p1, p2] = people || ['José', 'Socio'];
    const now = Date.now();

    const clients = [
      { id: 'demo_cli_banco', name: 'Banco (demo)', color: '#2a78d6' },
      { id: 'demo_cli_clinica', name: 'Clínica (demo)', color: '#e87ba4' },
      { id: 'demo_cli_personal', name: 'Personal (demo)', color: '#6250d6' },
    ].map((c, i) => Object.assign(c, { createdAt: now + i, updatedAt: now, demo: true }));
    const clientOf = { demo_ig: 'demo_cli_banco', demo_fb: 'demo_cli_banco', demo_ads: 'demo_cli_banco', demo_web: 'demo_cli_banco', demo_comp1: 'demo_cli_banco', demo_comp2: 'demo_cli_banco', demo_tt: 'demo_cli_clinica', demo_in: 'demo_cli_personal' };
    const accounts = [
      { id: 'demo_ig', name: 'Marca · Instagram', platform: 'instagram', handle: '@marca.rd', owner: p1 },
      { id: 'demo_fb', name: 'Marca · Facebook', platform: 'facebook', handle: 'Marca RD', owner: p1 },
      { id: 'demo_tt', name: 'Marca · TikTok', platform: 'tiktok', handle: '@marca.rd', owner: p2 },
      { id: 'demo_ads', name: 'Meta Ads · Captación', platform: 'meta_ads', handle: 'act_000000', owner: p1 },
      { id: 'demo_web', name: 'marca.com.do', platform: 'web', handle: 'https://example.com', owner: p2 },
      { id: 'demo_in', name: 'José · LinkedIn', platform: 'linkedin', handle: 'in/jose', owner: p1, personal: true },
      { id: 'demo_comp1', name: 'Competidor A · Instagram', platform: 'instagram', handle: '@competidor.a', owner: p1, role: 'competidor', source: 'public' },
      { id: 'demo_comp2', name: 'Competidor B · Instagram', platform: 'instagram', handle: '@competidor.b', owner: p1, role: 'competidor', source: 'public' },
    ].map((a, i) => Object.assign(a, { createdAt: now + i, updatedAt: now, demo: true, clientId: clientOf[a.id] }));

    const series = {}, posts = {}, campaigns = {};
    const types = { instagram: ['Reel', 'Carrusel', 'Imagen', 'Reel', 'Carrusel'], facebook: ['Video', 'Imagen', 'Enlace'], tiktok: ['Video'], linkedin: ['Texto', 'Documento', 'Imagen', 'Video'] };
    const captions = ['5 errores al pedir un préstamo', '¿Sabías esto de tu tarjeta?', 'Antes vs. después', 'Detrás de cámaras', 'Lo que nadie te dice de ahorrar', 'Tendencia adaptada', 'Testimonio real', 'Guía rápida en 3 pasos', 'Mito o realidad', 'Pregunta de la semana'];

    function social(id, cfg) {
      let followers = cfg.followers;
      const rows = [];
      const list = [];
      dates.forEach((d, i) => {
        const trend = 1 + cfg.trend * (i / days);
        const reach = Math.round(cfg.reach * trend * wk[weekday(d)] * noise(0.3));
        const er = cfg.er * noise(0.25);
        const eng = Math.round(reach * er);
        const nf = Math.max(-5, Math.round(reach * cfg.f1k / 1000 * noise(0.5)));
        followers += nf;
        const posted = r() < cfg.postProb ? 1 : 0;
        const row = {
          date: d, followers, newFollowers: nf, reach,
          views: Math.round(reach * cfg.viewsX * noise(0.15)),
          profileVisits: Math.round(reach * cfg.pvr * noise(0.3)),
          websiteClicks: Math.round(reach * cfg.pvr * cfg.bio * noise(0.4)),
          engagements: eng,
          likes: Math.round(eng * 0.72), comments: Math.round(eng * 0.06), shares: Math.round(eng * cfg.sh), saves: Math.round(eng * cfg.sv),
          posts: posted,
        };
        if (cfg.video) { row.fullViews = Math.round(row.views * cfg.video * noise(0.2)); row.watchTimeSec = Math.round(row.views * cfg.watch * noise(0.15)); }
        if (cfg.impressionsX) { row.impressions = Math.round(reach * cfg.impressionsX * noise(0.1)); delete row.views; }
        rows.push(row);
        if (posted) {
          const type = types[cfg.platform][Math.floor(r() * types[cfg.platform].length)];
          const boost = { Reel: 1.6, Video: 1.4, Carrusel: 1.1, Documento: 1.3, Imagen: 0.7, Texto: 0.9, Enlace: 0.5 }[type] || 1;
          const pr = Math.round(cfg.reach * 1.4 * boost * noise(0.6));
          const per = cfg.er * (type === 'Carrusel' || type === 'Documento' ? 1.4 : type === 'Imagen' || type === 'Enlace' ? 0.7 : 1) * noise(0.35);
          const pe = Math.round(pr * per);
          list.push({ id: `${id}_p${i}`, date: d, time: ['08:30', '12:15', '18:45', '20:00'][Math.floor(r() * 4)], type, caption: captions[Math.floor(r() * captions.length)],
            reach: pr, views: Math.round(pr * cfg.viewsX), likes: Math.round(pe * 0.72), comments: Math.round(pe * 0.06), shares: Math.round(pe * cfg.sh * boost), saves: Math.round(pe * cfg.sv * (type === 'Carrusel' ? 2 : 1)), engagements: pe, updatedAt: now });
        }
      });
      series[id] = rows;
      posts[id] = list.reverse();
    }

    social('demo_ig', { platform: 'instagram', followers: 18400, reach: 5200, trend: 0.35, er: 0.038, f1k: 2.6, postProb: 0.55, viewsX: 2.4, pvr: 0.018, bio: 0.04, sh: 0.08, sv: 0.11, video: 0.21, watch: 6.5 });
    social('demo_fb', { platform: 'facebook', followers: 42100, reach: 3900, trend: -0.25, er: 0.012, f1k: 0.9, postProb: 0.4, viewsX: 1.6, pvr: 0.006, bio: 0.08, sh: 0.12, sv: 0.02 });
    social('demo_tt', { platform: 'tiktok', followers: 6100, reach: 9800, trend: 0.9, er: 0.071, f1k: 3.9, postProb: 0.45, viewsX: 1.25, pvr: 0.021, bio: 0.02, sh: 0.1, sv: 0.07, video: 0.09, watch: 4.1 });
    social('demo_in', { platform: 'linkedin', followers: 2350, reach: 620, trend: 0.5, er: 0.041, f1k: 4.4, postProb: 0.3, viewsX: 1, pvr: 0.02, bio: 0.03, sh: 0.06, sv: 0.01, impressionsX: 1.6 });

    // Competidores: solo lo que se ve desde afuera (seguidores, posts, me gusta, comentarios)
    social('demo_comp1', { platform: 'instagram', followers: 31200, reach: 7000, trend: 0.15, er: 0.025, f1k: 1.6, postProb: 0.7, viewsX: 2, pvr: 0.01, bio: 0.03, sh: 0.05, sv: 0.08 });
    social('demo_comp2', { platform: 'instagram', followers: 12800, reach: 4200, trend: 0.6, er: 0.055, f1k: 3.2, postProb: 0.5, viewsX: 2, pvr: 0.02, bio: 0.03, sh: 0.09, sv: 0.12 });
    for (const id of ['demo_comp1', 'demo_comp2']) {
      const fol = Object.fromEntries(series[id].map(r => [r.date, r.followers]));
      posts[id] = posts[id].map(p => ({ id: p.id, date: p.date, time: p.time, type: p.type, caption: p.caption, likes: p.likes, comments: p.comments,
        engagements: p.likes + p.comments, followers: fol[p.date], updatedAt: p.updatedAt }));
      const byDay = {};
      for (const p of posts[id]) { const g = byDay[p.date] || (byDay[p.date] = { posts: 0, likes: 0, comments: 0 }); g.posts++; g.likes += p.likes; g.comments += p.comments; }
      series[id] = series[id].map(r => Object.assign({ date: r.date, followers: r.followers }, byDay[r.date] ? Object.assign({}, byDay[r.date], { engagements: byDay[r.date].likes + byDay[r.date].comments }) : {}));
    }

    // Anuncios: la frecuencia sube al final (fatiga) y el CTR cae un poco
    series.demo_ads = dates.map((d, i) => {
      const spend = +(28 * noise(0.15) * (i > 60 ? 1.3 : 1)).toFixed(2);
      const cpm = 3.1 * noise(0.12) * (1 + i / days * 0.35);
      const impressions = Math.round(spend / cpm * 1000);
      const freq = 1.3 + 2.6 * (i / days);
      const ctr = 0.0115 * noise(0.15) * (1 - i / days * 0.3);
      const linkClicks = Math.round(impressions * ctr);
      return { date: d, spend, impressions, reach: Math.round(impressions / freq), clicks: Math.round(linkClicks * 1.8), linkClicks, leads: Math.round(linkClicks * 0.085 * noise(0.4)), conversions: Math.round(linkClicks * 0.012 * noise(0.8)) };
    });
    campaigns.demo_ads = [
      { id: 'c1', name: 'Captación · Formulario préstamo', objective: 'OUTCOME_LEADS', spend: 2210.4, impressions: 612000, reach: 201000, frequency: 3.04, linkClicks: 6110, leads: 498, updatedAt: now },
      { id: 'c2', name: 'Retargeting · WhatsApp', objective: 'OUTCOME_ENGAGEMENT', spend: 905.1, impressions: 188000, reach: 41000, frequency: 4.58, linkClicks: 2650, leads: 301, updatedAt: now },
      { id: 'c3', name: 'Reconocimiento · Video marca', objective: 'OUTCOME_AWARENESS', spend: 640, impressions: 402000, reach: 233000, frequency: 1.73, linkClicks: 1120, leads: 0, updatedAt: now },
    ];

    series.demo_web = dates.map((d, i) => {
      const imp = Math.round(2400 * (1 + i / days * 0.6) * wk[weekday(d)] * noise(0.2));
      const pos = 14.5 - 4 * (i / days) + (r() - 0.5) * 2;
      return { date: d, searchImpressions: imp, searchClicks: Math.round(imp * 0.024 * noise(0.25)), positionSum: +(pos * imp).toFixed(1), sessions: Math.round(imp * 0.05 * noise(0.2)), leads: Math.round(imp * 0.0012 * noise(0.8)) };
    });

    const gsc = [
      ['préstamo personal', 6.8, 18400, 412], ['préstamo personal rd', 4.2, 9100, 610], ['tarjeta de crédito sin anualidad', 11.6, 12800, 96],
      ['cuenta de ahorro', 8.9, 7400, 133], ['marca rd', 1.1, 5200, 2610], ['marca préstamos', 1.4, 2100, 980], ['calculadora de préstamo', 14.2, 9900, 41],
      ['cómo ahorrar dinero', 18.7, 15100, 22], ['requisitos para préstamo', 5.6, 4300, 155], ['préstamo para vehículo', 9.3, 3800, 61],
      ['tasa de interés préstamo personal', 7.4, 6200, 98], ['mejor tarjeta de crédito rd', 12.9, 5600, 30], ['préstamo en línea', 21.4, 8800, 9],
      ['seguro de vida', 26.3, 6100, 4], ['certificado financiero', 3.2, 2900, 290],
    ].map(([query, position, impressions, clicks]) => ({ query, position, impressions, clicks, ctr: clicks / impressions }));

    const goals = [
      { id: 'demo_g1', accountId: 'demo_ig', metric: 'followers', target: 22000, startDate: A.addDays(end, -45), deadline: A.addDays(end, 60), title: 'Llegar a 22K en Instagram', owner: p1 },
      { id: 'demo_g2', accountId: 'demo_ads', metric: 'leads', target: 1500, startDate: A.addDays(end, -30), deadline: A.addDays(end, 30), title: '1.500 leads en 60 días', owner: p1 },
      { id: 'demo_g3', accountId: 'demo_tt', metric: 'reach', target: 900000, startDate: A.addDays(end, -20), deadline: A.addDays(end, 40), title: 'Alcance TikTok 900K', owner: p2 },
      { id: 'demo_g4', accountId: 'demo_web', metric: 'searchClicks', target: 9000, startDate: A.addDays(end, -60), deadline: A.addDays(end, 30), title: 'Tráfico orgánico', owner: p2 },
    ].map(g => Object.assign(g, { createdAt: now, updatedAt: now, demo: true }));

    return { clients, accounts, series, posts, campaigns, goals, gsc };
  }

  /* Mezcla los datos demo dentro de un estado existente (sin tocar lo real) */
  function apply(state, today) {
    const d = build(today, state.people);
    state.clients = state.clients || [];
    const cids = new Set(state.clients.map(c => c.id));
    for (const c of d.clients) if (!cids.has(c.id)) state.clients.push(c);
    const ids = new Set(state.accounts.map(a => a.id));
    for (const a of d.accounts) if (!ids.has(a.id)) state.accounts.push(a);
    Object.assign(state.series, d.series);
    Object.assign(state.posts, d.posts);
    Object.assign(state.campaigns, d.campaigns);
    const gids = new Set(state.goals.map(g => g.id));
    for (const g of d.goals) if (!gids.has(g.id)) state.goals.push(g);
    if (!state.seo.gsc || !state.seo.gsc.length) { state.seo.gsc = d.gsc; state.seo.gscImportedAt = Date.now(); state.seo.brandTerms = ['marca']; }
    for (const id of Object.keys(state.deleted || {})) if (id.startsWith('demo_')) delete state.deleted[id];
    return state;
  }

  function remove(state) {
    const ids = state.accounts.filter(a => a.demo).map(a => a.id);
    state.accounts = state.accounts.filter(a => !a.demo);
    state.clients = (state.clients || []).filter(c => { if (c.demo) state.deleted[c.id] = Date.now(); return !c.demo; });
    for (const id of ids) { delete state.series[id]; delete state.posts[id]; delete state.campaigns[id]; state.deleted[id] = Date.now(); }
    state.goals = state.goals.filter(g => { if (g.demo) state.deleted[g.id] = Date.now(); return !g.demo; });
    if (state.seo.gsc && state.seo.gsc.some(r => r.query === 'marca rd')) state.seo.gsc = [];
    return state;
  }

  const api = { build, apply, remove };
  root.PulsoDemo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
