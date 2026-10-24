/* ─────────────────────────────────────────────────────────────
   Pulso · Interfaz
   Vistas: Resumen · Cuenta (Métricas, Tendencias, Contenido,
   Diagnóstico, Datos) · Metas · Estratega · SEO · Academia · Ajustes
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const M = window.PulsoMetrics, A = window.PulsoAnalysis, C = window.PulsoConnectors, SEO = window.PulsoSEO;
  const P = window.PulsoPlatform, CH = window.PulsoCharts, AI = window.PulsoAI, D = window.PulsoDemo;
  const S = window.PulsoStore.Store(P);
  const esc = CH.esc;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const ui = { view: 'resumen', accountId: null, tab: 'metricas', period: 28, person: 'Todos', seoTab: 'auditor', trendMetric: null,
               postSort: 'er', auditId: null, aiBusy: false, syncing: {} };

  // ── Utilidades ──────────────────────────────────────────────
  const today = () => A.iso(new Date());
  const fmtM = (key, v, opts = {}) => { const m = M.byKey[key]; return M.format(v, m ? m.unit : 'n', Object.assign({ decimals: m && m.decimals, currency: S.state.settings.currency }, opts)); };
  const plat = p => M.PLATFORMS[p] || { label: p, short: '?', color: '#888' };
  const platBadge = p => `<span class="plat" style="background:${plat(p).color}">${esc(plat(p).short)}</span>`;

  function deltaHtml(key, d) {
    if (d == null || !isFinite(d)) return '<span class="delta flat">—</span>';
    const m = M.byKey[key];
    const good = m.better === 'down' ? d < 0 : m.better === 'up' ? d > 0 : null;
    const cls = Math.abs(d) < 0.005 ? 'flat' : good == null ? 'flat' : good ? 'up' : 'down';
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '';
    const txt = m.unit === 'pct' ? `${d > 0 ? '+' : ''}${(d * 100).toFixed(2)} pp` : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}%`;
    return `<span class="delta ${cls}" title="contra el período anterior">${arrow} ${txt}</span>`;
  }
  function gradeHtml(key, v, platform) {
    const g = M.grade(M.byKey[key], v, platform);
    return g ? `<span class="badge ${g.level}">${esc(g.label)}</span>` : '';
  }
  function toast(msg, err) {
    const t = document.createElement('div');
    t.className = 't' + (err ? ' err' : ''); t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), err ? 6500 : 3200);
  }
  function modal({ title, body, footer, onMount, wide }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(860px,100%)"' : ''}>
      <header><h2>${esc(title)}</h2><button class="btn ghost" data-close aria-label="Cerrar">✕</button></header>
      <div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div></div>`;
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    $('.modal-back', root).addEventListener('mousedown', e => { if (e.target.classList.contains('modal-back')) close(); });
    if (onMount) onMount($('.modal', root), close);
    const f = $('input,select,textarea', root); if (f) f.focus();
    return close;
  }
  let popEl = null;
  function infoPop(key, anchor) {
    if (popEl) { popEl.remove(); popEl = null; }
    const m = M.byKey[key]; if (!m) return;
    const b = M.benchFor(m, 'default') || (m.bench && m.bench.default);
    popEl = document.createElement('div');
    popEl.className = 'pop';
    popEl.innerHTML = `<h4>${esc(m.label)}</h4><div class="formula">${esc(m.formula)}</div><p>${esc(m.what)}</p>
      ${b ? `<p><b>Referencia:</b> ${benchText(m, b)}</p>` : ''}<p class="trap"><b>Ojo:</b> ${esc(m.trap)}</p>`;
    document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect();
    popEl.style.left = Math.min(window.innerWidth - 336, Math.max(8, r.left - 20)) + 'px';
    popEl.style.top = (r.bottom + 8 + popEl.offsetHeight > window.innerHeight ? Math.max(8, r.top - popEl.offsetHeight - 8) : r.bottom + 8) + 'px';
  }
  function benchText(m, b) {
    if (b.kind === 'band') return `sana entre ${M.format(b.low, m.unit)} y ${M.format(b.high, m.unit)}`;
    const f = v => M.format(v, m.unit, { decimals: m.decimals });
    return b.inverse ? `excelente ≤ ${f(b.great)}, buena ≤ ${f(b.good)}, promedio ≤ ${f(b.low)}` : `promedio ≥ ${f(b.low)}, buena ≥ ${f(b.good)}, excelente ≥ ${f(b.great)}`;
  }
  document.addEventListener('mousedown', e => { if (popEl && !popEl.contains(e.target) && !e.target.closest('.info-btn')) { popEl.remove(); popEl = null; } });

  const visibleAccounts = () => S.state.accounts.filter(a => ui.person === 'Todos' || a.owner === ui.person);
  const adsRows = () => { const a = S.state.accounts.find(x => x.platform === 'meta_ads'); return a ? S.rows(a.id) : []; };
  const isSocial = p => ['instagram', 'facebook', 'tiktok', 'linkedin'].includes(p);
  const metaClient = async () => {
    const token = await P.getSecret('meta_token');
    if (!token) throw new Error('Primero guarda tu token de Meta en Ajustes.');
    return C.MetaClient({ token, version: S.state.settings.graphVersion || 'v23.0', http: P.http });
  };

  // ── Navegación ──────────────────────────────────────────────
  const NAV = [
    ['resumen', 'Resumen', '◎'], ['metas', 'Metas', '◉'], ['estratega', 'Estratega', '✦'], ['seo', 'SEO', '⌕'], ['academia', 'Academia de métricas', '✎'],
  ];
  function renderNav() {
    const accs = visibleAccounts();
    $('#nav').innerHTML = NAV.map(([k, label, ico]) => `<button class="nav-item ${ui.view === k ? 'active' : ''}" data-nav="${k}"><span class="ico">${ico}</span><span class="grow">${esc(label)}</span></button>`).join('')
      + `<div class="nav-sec">Cuentas</div>`
      + accs.map(a => `<button class="nav-item ${ui.view === 'cuenta' && ui.accountId === a.id ? 'active' : ''}" data-account="${a.id}"><span class="dot" style="background:${plat(a.platform).color}"></span><span class="grow">${esc(a.name)}</span></button>`).join('')
      + `<button class="nav-item" data-act="add-account"><span class="ico">＋</span><span class="grow">Agregar cuenta</span></button>`
      + `<div class="nav-sec"></div><button class="nav-item ${ui.view === 'ajustes' ? 'active' : ''}" data-nav="ajustes"><span class="ico">⚙</span><span class="grow">Ajustes</span></button>`;
    const sel = $('#person');
    const opts = ['Todos', ...S.state.people];
    sel.innerHTML = opts.map(p => `<option ${p === ui.person ? 'selected' : ''}>${esc(p)}</option>`).join('');
  }
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nav) go(b.dataset.nav);
    else if (b.dataset.account) go('cuenta', { accountId: b.dataset.account });
    else if (b.dataset.act === 'add-account') accountModal();
  });
  $('#person').addEventListener('change', e => { ui.person = e.target.value; P.setPref('person', ui.person); render(); });

  function go(view, extra = {}) {
    Object.assign(ui, { view }, extra);
    if (view === 'cuenta' && !extra.tab) ui.tab = 'metricas';
    render();
    $('#view').scrollTop = 0;
  }

  function setHeader(title, subtitle, actions = '') {
    $('#title').textContent = title;
    $('#subtitle').textContent = subtitle || '';
    $('#toolbar-actions').innerHTML = actions;
  }
  const periodSeg = () => `<div class="seg" role="group" aria-label="Período">${[7, 28, 90].map(d => `<button data-period="${d}" class="${ui.period === d ? 'on' : ''}">${d} días</button>`).join('')}</div>`;
  $('#toolbar-actions').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.period) { ui.period = +b.dataset.period; render(); }
    else if (b.dataset.act && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b);
  });
  $('#view').addEventListener('click', e => {
    const info = e.target.closest('.info-btn');
    if (info) { e.stopPropagation(); infoPop(info.dataset.info, info); return; }
    const b = e.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b, e);
  });

  function render() {
    renderNav();
    const v = $('#view');
    try {
      ({ resumen: viewResumen, cuenta: viewCuenta, metas: viewMetas, estratega: viewEstratega, seo: viewSEO, academia: viewAcademia, ajustes: viewAjustes }[ui.view] || viewResumen)(v);
    } catch (err) {
      console.error(err);
      v.innerHTML = `<div class="empty"><h2>Algo falló al dibujar esta vista</h2><p>${esc(err.message)}</p></div>`;
    }
  }

  // ── Resumen ─────────────────────────────────────────────────
  function viewResumen(v) {
    const accs = visibleAccounts();
    const metaLinked = accs.some(a => a.meta && (a.meta.igId || a.meta.pageId || a.meta.adAccountId));
    setHeader('Resumen', ui.person === 'Todos' ? 'Todas las cuentas' : `Cuentas de ${ui.person}`,
      periodSeg() + (metaLinked ? `<button class="btn" data-act="sync-all">↻ Sincronizar Meta</button>` : ''));
    if (!accs.length) {
      v.innerHTML = `<div class="empty"><h2>Empecemos</h2><p>Agrega tus cuentas (Instagram, Facebook, TikTok, Meta Ads, LinkedIn y tu sitio web) o explora la app con datos de ejemplo.</p>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-act="add-account">Agregar cuenta</button><button class="btn" data-act="demo-load">Ver con datos de demostración</button><button class="btn" data-act="go-settings">Conectar Meta</button></div></div>`;
      return;
    }
    const cmp = {}; for (const a of accs) cmp[a.id] = A.comparePeriods(S.rows(a.id), a.platform, ui.period);
    const agg = (key, filter) => {
      let cur = 0, prev = 0, any = false, anyPrev = false;
      for (const a of accs.filter(filter)) {
        const c = cmp[a.id];
        if (c.current[key] != null) { cur += c.current[key]; any = true; }
        if (c.previous[key] != null) { prev += c.previous[key]; anyPrev = true; }
      }
      return { cur: any ? cur : null, delta: any && anyPrev && prev ? (cur - prev) / prev : null };
    };
    const kpis = [
      ['reach', 'Alcance orgánico', agg('reach', a => isSocial(a.platform))],
      ['engagements', 'Interacciones', agg('engagements', a => isSocial(a.platform))],
      ['followers', 'Seguidores (total)', agg('followers', a => isSocial(a.platform))],
      ['leads', 'Leads', agg('leads', a => a.platform === 'meta_ads' || a.platform === 'web')],
      ['spend', 'Inversión publicitaria', agg('spend', a => a.platform === 'meta_ads')],
      ['searchClicks', 'Clics desde Google', agg('searchClicks', a => a.platform === 'web')],
    ].filter(k => k[2].cur != null);

    const alerts = accs.flatMap(a => A.diagnose(a, S.rows(a.id), S.state.posts[a.id], ui.period)).filter(d => d.severity === 'alta').slice(0, 6);
    const goals = S.state.goals.filter(g => accs.some(a => a.id === g.accountId));

    v.innerHTML = `
      <div class="section"><div class="grid kpis">${kpis.map(([key, label, k]) => `
        <div class="card kpi"><div class="label">${esc(label)} <button class="info-btn" data-info="${key}" aria-label="Qué es ${esc(label)}">ⓘ</button></div>
        <div class="value">${fmtM(key, k.cur)}</div><div class="foot">${deltaHtml(key, k.delta)}<span class="muted">vs ${ui.period} días previos</span></div></div>`).join('')}</div></div>

      <div class="section"><div class="section-h"><h2>Cuentas</h2><span class="muted small">Toca una cuenta para ver el detalle</span></div>
        <div class="grid cards">${accs.map(a => accountCard(a, cmp[a.id])).join('')}</div></div>

      <div class="grid two">
        <div class="card"><div class="section-h"><h2>Alertas prioritarias</h2><button class="btn sm" data-act="go-diag">Ver diagnóstico</button></div>
          ${alerts.length ? alerts.map(insightHtml).join('') : '<p class="muted">Sin alertas de prioridad alta. 👌</p>'}</div>
        <div class="card"><div class="section-h"><h2>Metas</h2><button class="btn sm" data-act="go-goals">Ver todas</button></div>
          ${goals.length ? goals.slice(0, 5).map(g => goalMini(g)).join('') : `<p class="muted">Aún no hay metas. Una meta convierte las métricas en dirección.</p><button class="btn primary sm" data-act="new-goal">Crear meta</button>`}</div>
      </div>`;
  }

  function primaryKeys(p) {
    if (p === 'meta_ads') return ['spend', 'leads', 'cpl'];
    if (p === 'web') return ['searchClicks', 'searchImpressions', 'avgPosition'];
    return ['followers', 'reach', 'erReach'];
  }
  function accountCard(a, c) {
    const keys = primaryKeys(a.platform);
    const sparkKey = a.platform === 'meta_ads' ? 'leads' : a.platform === 'web' ? 'searchClicks' : 'reach';
    const ser = A.dailySeries(S.rows(a.id), a.platform, sparkKey, c.from, c.to).map(p => ({ y: p.value }));
    const diag = A.diagnose(a, S.rows(a.id), S.state.posts[a.id], ui.period)[0];
    return `<div class="card acc-card" data-act="open-account" data-id="${a.id}" tabindex="0">
      <div class="acc-head">${platBadge(a.platform)}<span class="name">${esc(a.name)}</span><span class="muted small">${esc(a.owner || '')}</span></div>
      <div class="acc-stats">${keys.map(k => `<div><b>${fmtM(k, c.current[k])}</b><small>${esc(M.byKey[k].label)}</small><div class="small">${deltaHtml(k, c.delta[k])}</div></div>`).join('')}</div>
      <div class="acc-foot">${CH.spark(ser, { color: plat(a.platform).color })}${diag ? `<span class="badge ${diag.severity}" title="${esc(diag.detail)}">${esc(diag.title)}</span>` : ''}</div>
    </div>`;
  }
  function insightHtml(d) {
    const sevLabel = { alta: 'Prioridad alta', media: 'Media', baja: 'Oportunidad', bien: 'Bien' }[d.severity];
    return `<div class="insight ${d.severity}"><h4><span class="badge ${d.severity}">${sevLabel}</span>${esc(d.title)}${d.metric ? ` <button class="info-btn" data-info="${d.metric}" aria-label="Sobre la métrica">ⓘ</button>` : ''}</h4>
      <p>${ui.view !== 'cuenta' ? `<b>${esc(d.account)}:</b> ` : ''}${esc(d.detail)}</p><ul>${d.actions.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }

  // ── Metas ───────────────────────────────────────────────────
  const STATUS = { logrado: 'Lograda', en_ruta: 'En ruta', en_riesgo: 'En riesgo', fuera_de_ruta: 'Fuera de ruta', vencido: 'Vencida' };
  function goalCalc(g) {
    const a = S.account(g.accountId); if (!a) return null;
    return A.goalProgress(g, S.rows(a.id), a.platform, today() > (A.latestDate(S.rows(a.id)) || today()) ? A.latestDate(S.rows(a.id)) : today(), adsRows());
  }
  function goalMini(g) {
    const p = goalCalc(g); if (!p) return '';
    return `<div style="margin-bottom:12px"><div class="row"><b>${esc(g.title || p.metric.label)}</b><span class="spacer"></span><span class="badge ${p.status}">${STATUS[p.status]}</span></div>
      <div class="progress"><div class="fill" style="width:${Math.min(100, (p.progress || 0) * 100)}%"></div><div class="expected" style="left:${Math.min(100, p.expected * 100)}%" title="Donde deberías ir hoy"></div></div>
      <div class="small muted">${fmtM(g.metric, p.current)} de ${fmtM(g.metric, g.target)} · faltan ${p.remaining} días</div></div>`;
  }
  function viewMetas(v) {
    setHeader('Metas', 'Visibilidad, clics, leads y crecimiento — ancladas a presupuesto', `<button class="btn primary" data-act="new-goal">＋ Nueva meta</button>`);
    const accs = visibleAccounts();
    const goals = S.state.goals.filter(g => accs.some(a => a.id === g.accountId));
    if (!goals.length) {
      v.innerHTML = `<div class="empty"><h2>Sin metas todavía</h2><p>Define qué quieres lograr (ej. 1.500 leads en 60 días, 25K seguidores, +40% de alcance) y Pulso te dirá si vas en ruta, a qué ritmo y cuánto presupuesto haría falta para cerrar la brecha.</p><button class="btn primary" data-act="new-goal">Crear la primera meta</button></div>`;
      return;
    }
    const order = { fuera_de_ruta: 0, en_riesgo: 1, vencido: 2, en_ruta: 3, logrado: 4 };
    const list = goals.map(g => ({ g, p: goalCalc(g) })).filter(x => x.p).sort((a, b) => order[a.p.status] - order[b.p.status]);
    v.innerHTML = `<div class="grid two">${list.map(({ g, p }) => goalCard(g, p)).join('')}</div>`;
  }
  function goalCard(g, p) {
    const a = S.account(g.accountId);
    const m = p.metric;
    const perDay = v => v == null ? '—' : m.goal === 'rate' ? `${v * 7 >= 0 ? '+' : '−'}${fmtM(g.metric, Math.abs(v * 7))}/sem`
      : `${Math.abs(v) < 10 ? v.toLocaleString('es-DO', { maximumFractionDigits: 1 }) : M.compact(Math.round(v))}/día`;
    const ad = p.adPlan;
    return `<div class="card">
      <div class="row">${platBadge(a.platform)}<h2 style="flex:1">${esc(g.title || m.label)}</h2><span class="badge ${p.status}">${STATUS[p.status]}</span></div>
      <div class="muted small" style="margin-top:4px">${esc(a.name)} · ${esc(m.label)} <button class="info-btn" data-info="${m.key}">ⓘ</button> · ${esc(g.startDate)} → ${esc(g.deadline)} · ${esc(g.owner || a.owner || '')}</div>
      <div class="progress"><div class="fill" style="width:${Math.min(100, (p.progress || 0) * 100)}%"></div><div class="expected" style="left:${Math.min(100, p.expected * 100)}%" title="Donde deberías ir hoy (${Math.round(p.expected * 100)}% del tiempo)"></div></div>
      <div class="row small"><span><b>${p.progress != null ? Math.round(p.progress * 100) : '—'}%</b> del camino</span><span class="muted">· ${Math.round(p.expected * 100)}% del tiempo transcurrido</span></div>
      <div class="goal-stats">
        <div><small>Actual</small><b>${fmtM(g.metric, p.current)}</b></div>
        <div><small>Meta</small><b>${fmtM(g.metric, g.target)}</b></div>
        <div><small>Proyección al cierre</small><b>${fmtM(g.metric, p.projected)}</b></div>
        <div><small>Ritmo actual</small><b>${perDay(p.pacePerDay)}</b></div>
        <div><small>Ritmo necesario</small><b>${p.requiredPerDay != null && p.remaining ? perDay(p.requiredPerDay) : '—'}</b></div>
        <div><small>Días restantes</small><b>${p.remaining}</b></div>
      </div>
      ${ad ? `<div class="ad-plan"><h4>📣 Anclar a publicidad</h4>
        ${ad.budget != null ? `<div class="row"><div><div class="muted small">Presupuesto para cerrar la brecha</div><b style="font-size:18px">${M.format(ad.budget, 'money')}</b> <span class="muted">≈ ${M.format(ad.perDay, 'money')}/día por ${ad.days} días</span></div></div>
        <div class="small" style="margin-top:6px"><b>Objetivo de campaña:</b> ${esc(ad.objective)}</div><div class="small muted">${esc(ad.how)}${ad.costs && !ad.costs.real ? ' · costos de referencia (conecta Meta Ads para usar los tuyos)' : ''}</div>`
        : `<div class="small">${esc(ad.how)}</div>`}</div>` : ''}
      <div class="row end" style="margin-top:12px"><button class="btn sm" data-act="edit-goal" data-id="${g.id}">Editar</button><button class="btn sm danger" data-act="del-goal" data-id="${g.id}">Eliminar</button></div>
    </div>`;
  }

  function goalModal(existing) {
    const accs = visibleAccounts();
    if (!accs.length) { toast('Primero agrega una cuenta.'); return; }
    const g = existing || { accountId: (accs.find(a => a.id === ui.accountId) || accs[0]).id, startDate: today(), deadline: A.addDays(today(), 90) };
    modal({
      title: existing ? 'Editar meta' : 'Nueva meta',
      body: `<div class="form-grid">
        <label class="field">Cuenta<select name="accountId">${accs.map(a => `<option value="${a.id}" ${a.id === g.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        <label class="field">Métrica<select name="metric"></select></label>
        <label class="field">Valor meta<input name="target" type="number" step="any" value="${g.target ?? ''}" required></label>
        <label class="field">Desde<input name="startDate" type="date" value="${esc(g.startDate)}"></label>
        <label class="field">Fecha límite<input name="deadline" type="date" value="${esc(g.deadline)}"></label>
        <label class="field">Responsable<select name="owner">${S.state.people.map(p => `<option ${p === (g.owner || ui.person) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      </div>
      <label class="field">Nombre de la meta <span class="hint">(opcional)</span><input name="title" type="text" value="${esc(g.title || '')}" placeholder="Ej.: 1.500 leads antes de diciembre"></label>
      <div id="goal-hint" class="callout small"></div>`,
      footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Guardar meta</button>`,
      onMount(el, close) {
        const f = n => $(`[name=${n}]`, el);
        const fillMetrics = () => {
          const a = S.account(f('accountId').value);
          const rows = S.rows(a.id);
          const cmp = A.comparePeriods(rows, a.platform, 28);
          const list = M.metricsFor(a.platform).filter(m => m.key !== 'spend' && (cmp.current[m.key] != null || m.goal === 'cumulative'));
          f('metric').innerHTML = list.map(m => `<option value="${m.key}" ${m.key === g.metric ? 'selected' : ''}>${esc(m.group)} · ${esc(m.label)}</option>`).join('');
          hint();
        };
        const hint = () => {
          const a = S.account(f('accountId').value), key = f('metric').value, m = M.byKey[key];
          if (!m) return;
          const rows = S.rows(a.id);
          const days = Math.max(1, A.diffDays(f('startDate').value || today(), f('deadline').value || today()));
          const cmp = A.comparePeriods(rows, a.platform, 28);
          const cur = cmp.current[key];
          let base, sugg = [];
          if (m.goal === 'cumulative') {
            base = cur != null ? (cur / 28) * days : null;
            if (base) sugg = [1, 1.25, 1.6].map(x => base * x);
          } else if (m.goal === 'level') {
            const slope = (cmp.current.netFollowers != null ? cmp.current.netFollowers / 28 : 0) || (cur || 0) * 0.0005;
            if (cur != null) sugg = [1, 1.3, 1.8].map(x => cur + Math.max(slope, (cur || 0) * 0.0003) * days * x);
          } else if (cur != null) {
            sugg = (m.better === 'down' ? [0.95, 0.85, 0.75] : [1.05, 1.15, 1.3]).map(x => cur * x);
          }
          const round = v => (m.unit === 'pct' ? +v.toFixed(4) : v > 100 ? Math.round(v / 10) * 10 : +v.toFixed(2));
          $('#goal-hint', el).innerHTML = `<b>${esc(m.label)}</b> — ${m.goal === 'cumulative' ? 'se suma desde la fecha de inicio' : m.goal === 'level' ? 'se mide el valor al cierre' : 'se mide el promedio de los últimos 28 días'}.
            ${cur != null ? `Últimos 28 días: <b>${fmtM(key, cur)}</b>.` : 'Aún no hay datos de esta métrica.'}
            ${sugg.length ? `<div class="row" style="margin-top:8px">${['Conservadora', 'Realista', 'Ambiciosa'].map((l, i) => `<button class="btn sm" data-sugg="${round(sugg[i])}">${l}: ${fmtM(key, round(sugg[i]))}</button>`).join('')}</div>` : ''}
            ${m.unit === 'pct' ? '<div class="muted" style="margin-top:6px">Escribe las tasas como proporción: 4% = 0.04</div>' : ''}`;
          $$('[data-sugg]', el).forEach(b => b.addEventListener('click', () => { f('target').value = b.dataset.sugg; }));
        };
        f('accountId').addEventListener('change', fillMetrics);
        f('metric').addEventListener('change', hint);
        f('deadline').addEventListener('change', hint);
        fillMetrics();
        $('[data-save]', el).addEventListener('click', () => {
          const data = { accountId: f('accountId').value, metric: f('metric').value, target: parseFloat(f('target').value), startDate: f('startDate').value, deadline: f('deadline').value, owner: f('owner').value, title: f('title').value.trim() };
          if (!isFinite(data.target)) { toast('Escribe el valor meta.', true); return; }
          if (data.deadline <= data.startDate) { toast('La fecha límite debe ser posterior al inicio.', true); return; }
          if (!data.title) data.title = `${M.byKey[data.metric].label}: ${fmtM(data.metric, data.target)}`;
          existing ? S.updateGoal(existing.id, data) : S.addGoal(data);
          close(); toast('Meta guardada'); render();
        });
      },
    });
  }

  // ── Cuenta ──────────────────────────────────────────────────
  function viewCuenta(v) {
    const a = S.account(ui.accountId);
    if (!a) { go('resumen'); return; }
    const linked = a.meta && (a.meta.igId || a.meta.pageId || a.meta.adAccountId);
    setHeader(a.name, `${plat(a.platform).label}${a.handle ? ' · ' + a.handle : ''}${a.owner ? ' · ' + a.owner : ''}`,
      periodSeg() + (linked ? `<button class="btn" data-act="sync" data-id="${a.id}" ${ui.syncing[a.id] ? 'disabled' : ''}>${ui.syncing[a.id] ? 'Sincronizando…' : '↻ Sincronizar'}</button>` : '') + `<button class="btn" data-act="new-goal">＋ Meta</button>`);
    const tabs = [['metricas', 'Métricas'], ['tendencias', 'Tendencias'], ['contenido', 'Contenido'], ['diagnostico', 'Diagnóstico'], ['datos', 'Datos e importación']]
      .filter(([k]) => k !== 'contenido' || isSocial(a.platform)).concat(a.platform === 'meta_ads' ? [['campanas', 'Campañas']] : []);
    const rows = S.rows(a.id);
    const body = !rows.length && ui.tab !== 'datos'
      ? `<div class="empty"><h2>Esta cuenta no tiene datos todavía</h2><p>${linked ? 'Sincroniza con Meta o ' : ''}importa el CSV que exporta la plataforma.</p><button class="btn primary" data-act="tab" data-tab="datos">Cargar datos</button></div>`
      : ({ metricas: tabMetricas, tendencias: tabTendencias, contenido: tabContenido, diagnostico: tabDiagnostico, datos: tabDatos, campanas: tabCampanas }[ui.tab] || tabMetricas)(a, rows);
    v.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tab-body">${body}</div>`;
    if (ui.tab === 'tendencias' && rows.length) mountTrend(a, rows);
    if (ui.tab === 'datos') mountDatos(a);
  }

  function tabMetricas(a, rows) {
    const c = A.comparePeriods(rows, a.platform, ui.period);
    const groups = {};
    for (const m of M.metricsFor(a.platform)) if (c.current[m.key] != null) (groups[m.group] = groups[m.group] || []).push(m);
    return `<p class="muted small" style="margin-top:-6px">${esc(c.from)} → ${esc(c.to)} comparado con ${esc(c.prevFrom)} → ${esc(c.prevTo)}${c.hasPrevious ? '' : ' (sin datos del período anterior)'} · ⓘ explica cada métrica.</p>`
      + Object.entries(groups).map(([gname, list]) => `<div class="section"><div class="section-h"><h2>${esc(gname)}</h2></div><div class="grid kpis">${list.map(m => `
        <div class="card kpi"><div class="label">${esc(m.label)} <button class="info-btn" data-info="${m.key}" aria-label="Qué es ${esc(m.label)}">ⓘ</button></div>
          <div class="value">${fmtM(m.key, c.current[m.key])}</div>
          <div class="foot">${deltaHtml(m.key, c.delta[m.key])}${gradeHtml(m.key, c.current[m.key], a.platform)}</div>
          <div class="muted small" style="margin-top:4px">antes: ${fmtM(m.key, c.previous[m.key])}</div></div>`).join('')}</div></div>`).join('');
  }

  function tabTendencias(a, rows) {
    const c = A.comparePeriods(rows, a.platform, ui.period);
    const avail = M.metricsFor(a.platform).filter(m => c.current[m.key] != null);
    if (!ui.trendMetric || !avail.some(m => m.key === ui.trendMetric)) ui.trendMetric = (avail.find(m => m.key === (a.platform === 'meta_ads' ? 'leads' : a.platform === 'web' ? 'searchClicks' : 'reach')) || avail[0] || {}).key;
    return `<div class="card"><div class="row" style="margin-bottom:10px"><label class="field" style="flex-direction:row;align-items:center;gap:8px">Métrica
      <select id="trend-metric">${avail.map(m => `<option value="${m.key}" ${m.key === ui.trendMetric ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      <button class="info-btn" data-info="${ui.trendMetric}">ⓘ</button><span class="spacer"></span><span class="muted small">Las tasas se suavizan con promedio móvil de 7 días</span></div>
      <div id="trend-chart"></div><div id="trend-stats" class="row small" style="margin-top:10px"></div></div>`;
  }
  function mountTrend(a, rows) {
    const sel = $('#trend-metric'); if (!sel) return;
    sel.addEventListener('change', () => { ui.trendMetric = sel.value; render(); });
    const c = A.comparePeriods(rows, a.platform, ui.period);
    const key = ui.trendMetric, m = M.byKey[key];
    const cur = A.dailySeries(rows, a.platform, key, c.from, c.to);
    const prev = A.dailySeries(rows, a.platform, key, c.prevFrom, c.prevTo);
    const prevAligned = cur.map((p, i) => ({ x: p.date, y: prev[i] ? prev[i].value : null, label: prev[i] ? prev[i].date : '' }));
    const reg = A.linearRegression(cur.map((p, i) => ({ x: i, y: p.value })));
    const trend = reg ? cur.map((p, i) => ({ x: p.date, y: reg.predict(i) })) : [];
    const series = [{ name: `${m.label} (actual)`, points: cur.map(p => ({ x: p.date, y: p.value })), color: 'var(--series-1)' }];
    if (prevAligned.some(p => p.y != null)) series.push({ name: 'Período anterior', points: prevAligned, color: 'var(--series-prev)', dashed: true });
    if (trend.length) series.push({ name: 'Tendencia', points: trend, color: 'var(--series-2)', width: 1.5, dashed: true });
    CH.line($('#trend-chart'), series, { unit: m.unit, decimals: m.decimals, height: 280, label: m.label });
    if (reg) {
      const wk = reg.slope * 7;
      const strength = reg.r2 > 0.5 ? 'tendencia clara' : reg.r2 > 0.2 ? 'tendencia moderada' : 'mucho ruido: no concluyas todavía';
      $('#trend-stats').innerHTML = `<span class="badge ${wk === 0 || reg.r2 < 0.2 ? 'info' : (m.better === 'down' ? wk < 0 : wk > 0) ? 'good' : 'low'}">${wk > 0 ? '▲' : '▼'} ${esc(fmtM(key, Math.abs(wk)))} por semana</span>
        <span class="muted">R² ${reg.r2.toFixed(2)} — ${strength}.</span><span class="muted">El R² dice qué tanto de la variación explica la línea de tendencia (1 = toda).</span>`;
    }
  }

  function tabContenido(a) {
    const posts = S.state.posts[a.id] || [];
    if (!posts.length) return `<div class="empty"><h2>Sin publicaciones</h2><p>Al sincronizar con Meta se traen las publicaciones con sus métricas. Para TikTok y LinkedIn, Pulso analiza las métricas diarias.</p></div>`;
    const ci = A.contentInsights(posts);
    const sorters = { er: p => p.er, reach: p => p.reach || p.views || 0, saves: p => p.saves || 0, shares: p => p.shares || 0, date: p => p.date };
    const list = posts.map(p => ({ ...p, er: A.postER(p) })).sort((x, y) => (sorters[ui.postSort](y) > sorters[ui.postSort](x) ? 1 : -1));
    const th = (k, l) => `<th class="sortable r" data-act="sort-posts" data-k="${k}">${l}${ui.postSort === k ? ' ↓' : ''}</th>`;
    return `<div class="grid kpis section">
        <div class="card kpi"><div class="label">Publicaciones analizadas</div><div class="value">${ci.n}</div></div>
        <div class="card kpi"><div class="label">Interacción promedio por post <button class="info-btn" data-info="erReach">ⓘ</button></div><div class="value">${M.format(ci.avgER, 'pct', { decimals: 2 })}</div></div>
        <div class="card kpi"><div class="label">Mejor formato</div><div class="value" style="font-size:20px">${esc(ci.byType[0] ? ci.byType[0].key : '—')}</div><div class="foot muted">${ci.byType[0] ? M.format(ci.byType[0].er, 'pct', { decimals: 2 }) + ' de interacción' : ''}</div></div>
        <div class="card kpi"><div class="label">Mejor día</div><div class="value" style="font-size:20px">${esc(ci.byWeekday[0] ? ci.byWeekday[0].key : '—')}</div></div>
      </div>
      <div class="grid two section">
        <div class="card"><h2 style="margin-bottom:10px">Interacción por formato</h2>${CH.bars(ci.byType.map(t => ({ label: t.key, value: t.er, note: `· ${t.n} posts` })), { unit: 'pct', decimals: 2, highlightFirst: true })}</div>
        <div class="card"><h2 style="margin-bottom:10px">Interacción por día de la semana</h2>${CH.bars(ci.byWeekday.map(t => ({ label: t.key, value: t.er, note: `· ${t.n}` })), { unit: 'pct', decimals: 2, highlightFirst: true })}</div>
      </div>
      <div class="card"><div class="section-h"><h2>Publicaciones</h2><span class="muted small">Ordena por columna</span></div><div class="table-wrap"><table>
        <thead><tr><th class="sortable" data-act="sort-posts" data-k="date">Fecha${ui.postSort === 'date' ? ' ↓' : ''}</th><th>Formato</th><th>Texto</th>${th('reach', 'Alcance')}${th('er', 'Interacción')}${th('saves', 'Guardados')}${th('shares', 'Compartidos')}<th class="r">Comentarios</th></tr></thead>
        <tbody>${list.slice(0, 80).map(p => `<tr><td>${esc(p.date)}</td><td>${esc(p.type || '')}</td><td class="wrap">${p.permalink ? `<a href="#" data-act="open-url" data-url="${esc(p.permalink)}">${esc((p.caption || '(sin texto)').slice(0, 70))}</a>` : esc((p.caption || '').slice(0, 70))}</td>
          <td class="r">${M.compact(p.reach || p.views || 0)}</td><td class="r">${M.format(p.er, 'pct', { decimals: 2 })}</td><td class="r">${p.saves ?? '—'}</td><td class="r">${p.shares ?? '—'}</td><td class="r">${p.comments ?? '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function tabDiagnostico(a, rows) {
    const list = A.diagnose(a, rows, S.state.posts[a.id], ui.period);
    return `<p class="muted small" style="margin-top:-6px">Reglas de experto aplicadas a los últimos ${ui.period} días. Cada hallazgo trae acciones concretas. Para una lectura más profunda usa el Analista IA en Estratega.</p>` + list.map(insightHtml).join('');
  }

  function tabCampanas(a) {
    const list = S.state.campaigns[a.id] || [];
    if (!list.length) return '<div class="empty"><h2>Sin campañas</h2><p>Sincroniza la cuenta publicitaria para ver el desglose por campaña.</p></div>';
    const rowsC = list.map(c => ({ ...c, ctr: c.impressions ? c.linkClicks / c.impressions : null, cpm: c.impressions ? (c.spend / c.impressions) * 1000 : null, cpc: c.linkClicks ? c.spend / c.linkClicks : null, cpl: c.leads ? c.spend / c.leads : null }));
    const g = (k, v) => gradeHtml(k, v, 'meta_ads');
    return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Campaña</th><th class="r">Inversión</th><th class="r">Impresiones</th><th class="r">Frecuencia</th><th class="r">CPM</th><th class="r">CTR</th><th class="r">CPC</th><th class="r">Leads</th><th class="r">CPL</th></tr></thead>
      <tbody>${rowsC.map(c => `<tr><td class="wrap"><b>${esc(c.name)}</b><div class="muted small">${esc(c.objective || '')}</div></td><td class="r">${M.format(c.spend, 'money')}</td><td class="r">${M.compact(c.impressions)}</td>
        <td class="r">${M.format(c.frequency, 'x')} ${g('frequency', c.frequency)}</td><td class="r">${M.format(c.cpm, 'money')}</td><td class="r">${M.format(c.ctr, 'pct', { decimals: 2 })} ${g('ctr', c.ctr)}</td>
        <td class="r">${M.format(c.cpc, 'money')}</td><td class="r">${c.leads || '—'}</td><td class="r">${M.format(c.cpl, 'money')}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Lectura rápida: frecuencia alta + CTR cayendo = fatiga; CTR bien + CPL alto = problema de landing o formulario; CPM alto = audiencia muy chica o temporada cara.</p></div>`;
  }

  const MANUAL_FIELDS = {
    instagram: ['followers', 'reach', 'views', 'profileVisits', 'websiteClicks', 'likes', 'comments', 'shares', 'saves', 'posts'],
    facebook: ['followers', 'reach', 'impressions', 'engagements', 'profileVisits', 'websiteClicks', 'posts'],
    tiktok: ['followers', 'views', 'reach', 'profileVisits', 'likes', 'comments', 'shares', 'saves', 'fullViews', 'watchTimeSec', 'posts'],
    linkedin: ['followers', 'impressions', 'reach', 'engagements', 'likes', 'comments', 'shares', 'profileVisits', 'posts'],
    meta_ads: ['spend', 'impressions', 'reach', 'linkClicks', 'clicks', 'leads', 'conversions'],
    web: ['searchClicks', 'searchImpressions', 'position', 'sessions', 'leads'],
  };
  const EXPORT_HELP = {
    instagram: 'Meta Business Suite → Estadísticas → Exportar datos (CSV), o conecta la cuenta en Ajustes → Meta para traerlo automático.',
    facebook: 'Meta Business Suite → Estadísticas → Exportar datos (CSV), o conecta la Página en Ajustes → Meta.',
    tiktok: 'TikTok Studio (web) → Analíticas → Resumen → elige 60 días → Descargar datos. Si baja en XLSX, ábrelo y guárdalo como CSV. Repite en la pestaña Seguidores para el total de seguidores.',
    linkedin: 'Tu perfil → Analíticas → Impresiones de publicaciones → Exportar. Abre el Excel y guarda la hoja de interacción diaria como CSV.',
    meta_ads: 'Administrador de anuncios → Informes → desglose por Día → Exportar CSV. O conecta la cuenta publicitaria en Ajustes → Meta.',
    web: 'Search Console → Rendimiento → Exportar → CSV: la pestaña "Fechas" carga aquí las métricas diarias; la de "Consultas" va en SEO → Search Console. Para sesiones y leads, exporta desde Analytics con columna Fecha.',
  };
  function tabDatos(a, rows) {
    const fields = MANUAL_FIELDS[a.platform] || [];
    const last = [...rows].reverse().slice(0, 21);
    const cols = fields.filter(f => last.some(r => r[f === 'position' ? 'positionSum' : f] != null));
    const label = f => (f === 'position' ? 'Posición promedio' : (M.FIELDS[f] || {}).label || f);
    const linked = a.meta && (a.meta.igId || a.meta.pageId || a.meta.adAccountId);
    return `<div class="grid two section">
      <div class="card"><h2>Importar CSV</h2><p class="muted small">${esc(EXPORT_HELP[a.platform] || '')}</p>
        <div class="row"><input type="file" id="csv-file" accept=".csv,.txt,text/csv"></div>
        <details style="margin-top:8px"><summary class="small">…o pega el contenido</summary><textarea id="csv-text" placeholder="Fecha,Seguidores,Alcance,…"></textarea></details>
        <div class="row end" style="margin-top:10px"><button class="btn primary" data-act="import-csv">Importar</button></div>
        <p class="muted small">Pulso reconoce encabezados en español e inglés, fechas DD/MM o MM/DD y números con coma o punto. Si un día ya existe, se actualizan solo los campos que traiga el archivo.</p></div>
      <div class="card"><h2>Registro manual</h2><p class="muted small">Para cargar un día a mano (útil para LinkedIn personal o cuentas sin exportación).</p>
        <div class="form-grid" id="manual-form"><label class="field">Fecha<input type="date" name="date" value="${A.addDays(today(), -1)}"></label>
        ${fields.map(f => `<label class="field">${esc(label(f))}<input type="number" step="any" name="${f}"></label>`).join('')}</div>
        <div class="row end" style="margin-top:10px"><button class="btn" data-act="manual-save">Guardar día</button></div></div>
    </div>
    ${linked ? `<div class="card section"><div class="row"><div><h2>Meta conectada</h2><div class="muted small">${a.meta.igId ? 'Instagram ' + esc(a.meta.igId) : ''} ${a.meta.pageId ? 'Página ' + esc(a.meta.pageId) : ''} ${a.meta.adAccountId ? 'Cuenta publicitaria ' + esc(a.meta.adAccountId) : ''}${a.lastSync ? ' · última sincronización ' + new Date(a.lastSync).toLocaleString('es-DO') : ''}</div></div><span class="spacer"></span>
      <select id="sync-days"><option value="30">30 días</option><option value="60">60 días</option><option value="90" selected>90 días</option></select><button class="btn primary" data-act="sync" data-id="${a.id}">↻ Sincronizar ahora</button></div></div>` : ''}
    <div class="card section"><div class="section-h"><h2>Últimos días cargados</h2><span class="muted small">${rows.length} días en total${rows.length ? ` · ${esc(rows[0].date)} → ${esc(rows[rows.length - 1].date)}` : ''}</span></div>
      ${last.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th>${cols.map(f => `<th class="r">${esc(label(f))}</th>`).join('')}<th></th></tr></thead><tbody>
      ${last.map(r => `<tr><td>${esc(r.date)}</td>${cols.map(f => `<td class="r">${f === 'position' ? (r.positionSum && r.searchImpressions ? (r.positionSum / r.searchImpressions).toFixed(1) : '—') : r[f] != null ? (f === 'spend' ? M.format(r[f], 'money') : M.compact(r[f])) : '—'}</td>`).join('')}<td class="r"><button class="btn sm ghost" data-act="del-row" data-date="${r.date}" aria-label="Borrar ${r.date}">✕</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin datos.</p>'}</div>
    <div class="card"><h2 style="margin-bottom:10px">Configuración de la cuenta</h2><div class="form-grid" id="acc-form">
      <label class="field">Nombre<input name="name" type="text" value="${esc(a.name)}"></label>
      <label class="field">Usuario / URL<input name="handle" type="text" value="${esc(a.handle || '')}"></label>
      <label class="field">Responsable<select name="owner">${S.state.people.map(p => `<option ${p === a.owner ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      ${a.platform === 'instagram' ? `<label class="field">ID de Instagram (Meta)<input name="igId" type="text" value="${esc((a.meta || {}).igId || '')}"></label>` : ''}
      ${a.platform === 'facebook' ? `<label class="field">ID de la Página<input name="pageId" type="text" value="${esc((a.meta || {}).pageId || '')}"></label>` : ''}
      ${a.platform === 'meta_ads' ? `<label class="field">ID cuenta publicitaria<input name="adAccountId" type="text" value="${esc((a.meta || {}).adAccountId || '')}" placeholder="act_123…"></label>` : ''}
    </div><div class="row end" style="margin-top:12px"><button class="btn danger" data-act="del-account" data-id="${a.id}">Eliminar cuenta</button><button class="btn primary" data-act="save-account" data-id="${a.id}">Guardar</button></div></div>`;
  }
  function mountDatos() { /* los botones usan data-act */ }

  // ── Estratega ───────────────────────────────────────────────
  const OBJ = { leads: 'Leads', followers: 'Seguidores', reach: 'Alcance (personas)', impressions: 'Impresiones' };
  function viewEstratega(v) {
    setHeader('Estratega', 'Planes de crecimiento con números, y un analista IA', '');
    const accs = visibleAccounts();
    if (!accs.length) { v.innerHTML = '<div class="empty"><h2>Agrega cuentas primero</h2></div>'; return; }
    const notes = S.state.notes.filter(n => n.type === 'ai').sort((a, b) => b.createdAt - a.createdAt);
    v.innerHTML = `<div class="grid two">
      <div class="card"><h2>Planificador de crecimiento</h2><p class="muted small">Calcula el embudo y el presupuesto para llegar a una meta, usando las tasas reales de tus cuentas.</p>
        <div class="form-grid" id="plan-form">
          <label class="field">Objetivo<select name="objective">${Object.entries(OBJ).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="field">Cantidad meta<input name="target" type="number" value="500"></label>
          <label class="field">En cuántos días<input name="days" type="number" value="30"></label>
          <label class="field">Cuenta de referencia<select name="account">${accs.filter(a => a.platform !== 'web').map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
        </div><div class="row end" style="margin-top:10px"><button class="btn primary" data-act="plan">Calcular plan</button></div>
        <div id="plan-out"></div></div>
      <div class="card"><h2>Analista IA</h2><p class="muted small">Claude lee el resumen de métricas, diagnósticos, contenido y metas y te devuelve una lectura estratégica con plan de 30 días. Solo se envían números agregados; nunca tokens.</p>
        <div class="row" style="margin:8px 0">${accs.map(a => `<label class="small"><input type="checkbox" name="ai-acc" value="${a.id}" checked> ${esc(a.name)}</label>`).join('')}</div>
        <label class="field">Pregunta o enfoque <span class="hint">(opcional)</span><textarea id="ai-q" style="min-height:70px;font-family:inherit" placeholder="Ej.: ¿Por qué cayó el alcance en Facebook y qué hago esta semana? ¿Cómo bajo el CPL a US$4?"></textarea></label>
        <div class="row end" style="margin-top:10px"><button class="btn primary" data-act="ai-run" ${ui.aiBusy ? 'disabled' : ''}>${ui.aiBusy ? 'Analizando… (puede tardar un minuto)' : 'Analizar'}</button></div>
        <div id="ai-out" class="ai-out">${notes[0] ? aiNoteHtml(notes[0]) : ''}</div>
        ${notes.length > 1 ? `<details style="margin-top:12px"><summary class="small">Análisis anteriores (${notes.length - 1})</summary>${notes.slice(1, 10).map(n => `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px">${aiNoteHtml(n)}</div>`).join('')}</details>` : ''}</div>
    </div>`;
  }
  function aiNoteHtml(n) {
    return `<div class="muted small" style="margin-top:12px">${new Date(n.createdAt).toLocaleString('es-DO')} · ${esc(n.by || '')}${n.question ? ' · “' + esc(n.question.slice(0, 80)) + '”' : ''}</div>${AI.render(n.text)}`;
  }
  function runPlan() {
    const f = n => $(`#plan-form [name=${n}]`);
    const objective = f('objective').value, target = +f('target').value, days = +f('days').value;
    const a = S.account(f('account').value);
    if (!(target > 0 && days > 0)) { toast('Revisa la meta y los días.', true); return; }
    const now = today();
    const costs = A.adCosts(adsRows(), now);
    const c = A.comparePeriods(S.rows(a.id), a.platform, 28);
    const rates = Object.assign({}, costs, {
      followsPer1k: c.current.followsPer1k || 3, profileVisitRate: c.current.profileVisitRate || 0.015, erReach: c.current.erReach || 0.04,
    });
    const organicPerDay = objective === 'followers' ? (c.current.netFollowers || 0) / 28 : objective === 'reach' ? (isSocial(a.platform) ? (c.current.reach || 0) / 28 : 0)
      : objective === 'impressions' ? (isSocial(a.platform) ? (c.current.impressions || 0) / 28 : 0) : (a.platform === 'meta_ads' ? 0 : (c.current.leads || 0) / 28);
    const plan = A.growthPlan({ objective, target, days, rates, organicPerDay });
    const money = v => M.format(v, 'money');
    $('#plan-out').innerHTML = `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
      <div class="grid kpis">
        <div><div class="muted small">Presupuesto total</div><b style="font-size:22px">${money(plan.budget)}</b></div>
        <div><div class="muted small">Por día / por semana</div><b>${money(plan.perDay)}</b> / <b>${money(plan.perWeek)}</b></div>
        <div><div class="muted small">Aporte orgánico estimado</div><b>${M.compact(Math.round(plan.organic))}</b> <span class="muted small">al ritmo actual</span></div>
        <div><div class="muted small">Brecha a cubrir con pauta</div><b>${M.compact(Math.round(plan.gap))}</b></div>
      </div>
      <h3 style="margin:14px 0 8px">Embudo necesario</h3>
      <div class="funnel">${plan.stages.map((s, i) => `<div class="stage" style="width:${100 - i * (50 / Math.max(1, plan.stages.length - 1))}%;opacity:${1 - i * 0.12}"><b>${M.compact(Math.round(s.value))}</b>${esc(s.label)}</div>`).join('')}</div>
      <h3 style="margin:14px 0 6px">Reparto sugerido del presupuesto</h3>
      ${CH.bars([{ label: 'Atracción (TOFU)', value: plan.budget * plan.split.awareness }, { label: 'Consideración', value: plan.budget * plan.split.consideration }, { label: 'Conversión', value: plan.budget * plan.split.conversion }], { unit: 'money' })}
      <h3 style="margin:14px 0 6px">Tácticas</h3><ul>${plan.tactics.map(([t, d]) => `<li><b>${esc(t)}:</b> ${esc(d)}</li>`).join('')}</ul>
      <p class="muted small">Tasas usadas: CPM ${money(rates.cpm)}, CTR ${M.format(rates.ctr, 'pct', { decimals: 2 })}, conversión ${M.format(rates.cvr, 'pct')}, frecuencia ${rates.frequency.toFixed(1)}, ${rates.followsPer1k.toFixed(1)} seguidores por 1.000 de alcance. ${costs.real ? 'Costos de tu cuenta de Meta Ads (últimos 28 días).' : 'Costos de referencia: conecta Meta Ads para usar los tuyos.'}</p>
      <div class="row end"><button class="btn sm" data-act="plan-goal" data-obj="${objective}" data-target="${target}" data-days="${days}" data-acc="${a.id}">Convertir en meta</button></div></div>`;
  }
  async function runAI() {
    const key = await P.getSecret('anthropic_key');
    if (!key) { toast('Agrega tu API key de Claude en Ajustes → Analista IA.', true); return; }
    const ids = $$('[name=ai-acc]:checked').map(i => i.value);
    if (!ids.length) { toast('Elige al menos una cuenta.', true); return; }
    const question = $('#ai-q').value.trim();
    ui.aiBusy = true; render();
    try {
      const payload = AI.buildPayload(S.state, ids, ui.period);
      const r = await AI.analyze({ apiKey: key, model: S.state.settings.aiModel, payload, question, http: P.http });
      S.state.notes.push({ id: window.PulsoStore.uid('note'), type: 'ai', text: r.text + (r.truncated ? '\n\n_(respuesta cortada por longitud)_' : ''), question, by: ui.person === 'Todos' ? '' : ui.person, createdAt: Date.now(), updatedAt: Date.now() });
      S.save();
    } catch (e) { toast(e.message, true); }
    ui.aiBusy = false; render();
  }

  // ── SEO ─────────────────────────────────────────────────────
  function viewSEO(v) {
    setHeader('SEO', 'Auditoría on-page, Search Console y rastreo', '');
    const tabs = [['auditor', 'Auditor on-page'], ['gsc', 'Search Console'], ['rastreo', 'Rastreo e indexación']];
    let body = '';
    if (ui.seoTab === 'auditor') body = seoAuditor();
    else if (ui.seoTab === 'gsc') body = seoGSC();
    else body = seoRastreo();
    v.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-act="seo-tab" data-tab="${k}" class="${ui.seoTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`;
    if (ui.seoTab === 'gsc' && S.state.seo.gsc.length) mountCtrCurve();
  }
  function seoAuditor() {
    const audits = S.state.seo.audits;
    const cur = audits.find(x => x.id === ui.auditId) || audits[0];
    const web = S.state.accounts.find(a => a.platform === 'web');
    return `<div class="card section"><div class="row">
        <input id="seo-url" type="url" placeholder="https://tusitio.com/pagina" value="${esc(cur ? cur.url : (web && /^https?:/.test(web.handle || '') ? web.handle : ''))}" style="flex:2;min-width:240px">
        <input id="seo-kw" type="text" placeholder="Palabra clave objetivo (opcional)" value="${esc(cur ? cur.keyword || '' : '')}" style="flex:1;min-width:180px">
        <button class="btn primary" data-act="audit">Auditar</button></div>
        ${P.native ? '' : '<p class="muted small">En el navegador solo se pueden auditar sitios que permiten CORS. En la app de Mac funciona con cualquier URL.</p>'}</div>
      ${cur ? auditHtml(cur) : '<div class="empty"><h2>Audita una página</h2><p>Revisa ~30 factores: título y descripción (con vista previa en Google), encabezados, palabra clave, imágenes, enlaces, datos estructurados, Open Graph, indexabilidad, móvil y rendimiento.</p></div>'}
      ${audits.length > 1 ? `<div class="card"><h2 style="margin-bottom:8px">Historial</h2><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>URL</th><th>Palabra clave</th><th class="r">Puntaje</th></tr></thead><tbody>
        ${audits.map(x => `<tr data-act="show-audit" data-id="${x.id}"><td>${new Date(x.updatedAt).toLocaleDateString('es-DO')}</td><td>${esc(x.url)}</td><td>${esc(x.keyword || '—')}</td><td class="r"><span class="badge ${x.score >= 80 ? 'pass' : x.score >= 55 ? 'warn' : 'fail'}">${x.score}</span></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }
  function auditHtml(r) {
    let host = r.url; try { const u = new URL(r.url); host = u.host + u.pathname.replace(/\/$/, '').replace(/\//g, ' › '); } catch (e) { /* nada */ }
    const cats = {};
    for (const c of r.checks) (cats[c.cat] = cats[c.cat] || []).push(c);
    const icon = { pass: '✓', warn: '!', fail: '✕', info: 'i' };
    const tTrim = r.title && SEO.pixelWidth(r.title) > 580 ? r.title.slice(0, 57) + '…' : r.title;
    const dTrim = r.description && r.description.length > 158 ? r.description.slice(0, 155) + '…' : r.description;
    return `<div class="grid two section">
      <div class="card"><div class="row" style="gap:18px">${CH.ring(r.score)}<div><h2>Puntaje SEO on-page</h2><div class="muted small">${esc(r.url)}</div>
        <div class="row small" style="margin-top:8px"><span class="badge fail">${r.counts.fail} críticos</span><span class="badge warn">${r.counts.warn} a mejorar</span><span class="badge pass">${r.counts.pass} bien</span></div>
        <div class="small muted" style="margin-top:6px">${r.wordCount} palabras${r.keyword ? ` · palabra clave: “${esc(r.keyword)}”` : ''}</div></div></div></div>
      <div class="card"><h2 style="margin-bottom:10px">Así te ve Google</h2><div class="serp"><div class="u">${esc(host)}</div><div class="t">${esc(tTrim || '(sin título)')}</div><div class="d">${esc(dTrim || 'Google tomará un fragmento del texto de la página porque no hay meta description.')}</div></div></div>
    </div>
    <div class="grid two section">${Object.entries(cats).map(([cat, list]) => `<div class="card"><h2 style="margin-bottom:6px">${esc(cat)}</h2>${list.map(c => `
      <div class="check ${c.status}"><span class="st" aria-label="${c.status}">${icon[c.status]}</span><div><b>${esc(c.label)}</b> <span class="muted">— ${esc(c.detail)}</span>${c.fix && c.status !== 'pass' ? `<div class="fix">→ ${esc(c.fix)}</div>` : ''}</div></div>`).join('')}</div>`).join('')}</div>`;
  }
  async function runAudit() {
    let url = $('#seo-url').value.trim();
    const kw = $('#seo-kw').value.trim();
    if (!url) { toast('Escribe una URL.', true); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const btn = $('[data-act=audit]'); btn.disabled = true; btn.textContent = 'Auditando…';
    try {
      const res = await P.http(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 Pulso-SEO', 'Accept': 'text/html' } });
      if (!res.ok) throw new Error(`La página respondió HTTP ${res.status}`);
      const r = SEO.auditHTML(res.body, res.url || url, kw, { ms: res.ms, headers: res.headers });
      S.addAudit({ url: r.url, keyword: kw, score: r.score, title: r.title, description: r.description, h1: r.h1, wordCount: r.wordCount, checks: r.checks, counts: r.counts });
      ui.auditId = S.state.seo.audits[0].id;
      render();
    } catch (e) {
      toast(`No se pudo leer la página: ${e.message}${P.native ? '' : ' (en el navegador puede ser CORS)'}`, true);
      btn.disabled = false; btn.textContent = 'Auditar';
    }
  }
  function seoGSC() {
    const rows = S.state.seo.gsc;
    const brand = (S.state.seo.brandTerms || []).join(', ');
    const importer = `<div class="card section"><div class="row"><div style="flex:1;min-width:240px"><h2>Importar desde Search Console</h2>
      <p class="muted small">Search Console → Rendimiento → elige 3 meses → Exportar → CSV. Sube el archivo de <b>Consultas</b> (o <b>Páginas</b>).${S.state.seo.gscImportedAt ? ` Última importación: ${new Date(S.state.seo.gscImportedAt).toLocaleDateString('es-DO')}.` : ''}</p></div>
      <input type="file" id="gsc-file" accept=".csv,text/csv"><button class="btn primary" data-act="gsc-import">Importar</button></div>
      <div class="row" style="margin-top:8px"><label class="field" style="flex-direction:row;align-items:center;gap:8px">Términos de marca<input id="brand-terms" type="text" value="${esc(brand)}" placeholder="tu marca, variaciones"></label><button class="btn sm" data-act="save-brand">Guardar</button>
      <span class="muted small">Separa búsquedas de marca (ya te conocen) de no-marca (público nuevo).</span></div></div>`;
    if (!rows.length) return importer + '<div class="empty"><h2>Sin datos de Search Console</h2><p>Con el export de consultas, Pulso encuentra las palabras en "distancia de impacto" (posiciones 4–20), las de CTR anormalmente bajo y estima cuántos clics ganarías.</p></div>';
    const o = SEO.gscOpportunities(rows, { brandTerms: S.state.seo.brandTerms || [], minImpressions: 50 });
    const dim = rows[0].query != null ? 'query' : 'page';
    const cann = SEO.cannibalization(rows);
    const t = o.totals;
    const tableOf = (list, extra) => `<div class="table-wrap"><table><thead><tr><th>${dim === 'query' ? 'Consulta' : 'Página'}</th><th class="r">Posición</th><th class="r">Impresiones</th><th class="r">Clics</th><th class="r">CTR</th><th class="r">CTR esperado</th><th class="r">${extra}</th></tr></thead><tbody>
      ${list.map(r => `<tr><td class="wrap">${esc(r[dim])}${r.brand ? ' <span class="badge">marca</span>' : ''}</td><td class="r">${r.position.toFixed(1)}</td><td class="r">${M.compact(r.impressions)}</td><td class="r">${M.compact(r.clicks)}</td>
        <td class="r">${M.format(r.ctr, 'pct', { decimals: 2 })}</td><td class="r muted">${M.format(r.expectedCtr, 'pct', { decimals: 1 })}</td><td class="r"><b>+${M.compact(Math.round(r.potential))}</b></td></tr>`).join('')}</tbody></table></div>`;
    return importer + `
      <div class="grid kpis section">
        <div class="card kpi"><div class="label">Clics</div><div class="value">${M.compact(t.clicks)}</div></div>
        <div class="card kpi"><div class="label">Impresiones</div><div class="value">${M.compact(t.impressions)}</div></div>
        <div class="card kpi"><div class="label">CTR <button class="info-btn" data-info="searchCtr">ⓘ</button></div><div class="value">${M.format(t.ctr, 'pct', { decimals: 2 })}</div></div>
        <div class="card kpi"><div class="label">Posición promedio <button class="info-btn" data-info="avgPosition">ⓘ</button></div><div class="value">${t.position ? t.position.toFixed(1) : '—'}</div></div>
        <div class="card kpi"><div class="label">Clics de marca</div><div class="value">${M.format(t.brandShare, 'pct', { decimals: 0 })}</div><div class="foot muted">${t.brandShare > 0.6 ? 'Dependes mucho de la marca' : 'Buen peso de no-marca'}</div></div>
        <div class="card kpi"><div class="label">Clics potenciales</div><div class="value">+${M.compact(Math.round(t.potential))}</div><div class="foot muted">si las de distancia de impacto llegan al top 3</div></div>
      </div>
      <div class="grid two section">
        <div class="card"><h2>CTR real vs. esperado por posición</h2><p class="muted small">Puntos por debajo de la línea = el título/descripción no convence. Por encima = buen snippet.</p><div id="ctr-curve"></div></div>
        <div class="card"><h2 style="margin-bottom:10px">Distribución por posición</h2>${CH.bars(o.buckets.map(b => ({ label: `Pos. ${b.label}`, value: b.impressions, note: `· ${b.n} ${dim === 'query' ? 'consultas' : 'páginas'}` })), {})}
          <p class="muted small" style="margin-top:8px">Impresiones por rango. Lo que está en 4–20 es tu mina de oro: Google ya te considera relevante.</p></div>
      </div>
      <div class="card section"><div class="section-h"><h2>🎯 Distancia de impacto (posiciones 4–20)</h2><span class="muted small">Ordenadas por clics que ganarías llegando al top 3</span></div>
        ${o.striking.length ? tableOf(o.striking, 'Clics potenciales') : '<p class="muted">Ninguna con suficientes impresiones.</p>'}
        <p class="muted small">Cómo atacarlas: amplía y actualiza el contenido de esa página para cubrir la intención completa, ponla en el título y H1, agrega una sección de preguntas frecuentes y enlázala desde 3–5 páginas internas con ese texto ancla.</p></div>
      <div class="card section"><div class="section-h"><h2>CTR por debajo de lo normal</h2><span class="muted small">Top 10 con CTR menor al 60% del esperado</span></div>
        ${o.lowCtr.length ? tableOf(o.lowCtr, 'Clics potenciales') : '<p class="muted">Ninguna: tus snippets están en línea con lo esperado.</p>'}
        <p class="muted small">Cómo arreglarlas: reescribe el título (beneficio + número + año), meta description con llamado a la acción, y datos estructurados para resultados enriquecidos.</p></div>
      ${cann.length ? `<div class="card"><h2>Posible canibalización</h2><p class="muted small">La misma búsqueda reparte impresiones entre varias páginas: Google no sabe cuál mostrar.</p>${cann.slice(0, 10).map(c => `<div style="margin-top:8px"><b>${esc(c.query)}</b><ul>${c.pages.map(p => `<li>${esc(p.page)} — pos. ${p.position.toFixed(1)}, ${M.compact(p.impressions)} impr.</li>`).join('')}</ul></div>`).join('')}</div>` : ''}`;
  }
  function mountCtrCurve() {
    const el = $('#ctr-curve'); if (!el) return;
    const rows = S.state.seo.gsc;
    const pts = [];
    for (let p = 1; p <= 20; p++) {
      const g = rows.filter(r => Math.round(r.position) === p);
      const imp = g.reduce((s, r) => s + r.impressions, 0);
      pts.push({ x: p, exp: SEO.expectedCtr(p), real: imp ? g.reduce((s, r) => s + r.clicks, 0) / imp : null, n: g.length });
    }
    CH.line(el, [
      { name: 'Tu CTR real', points: pts.map(p => ({ x: p.x, y: p.real, label: p.n ? `${p.n} consultas` : '' })), color: 'var(--series-1)', markers: true },
      { name: 'CTR esperado', points: pts.map(p => ({ x: p.x, y: p.exp })), color: 'var(--series-prev)', dashed: true },
    ], { unit: 'pct', decimals: 1, height: 230, xLabel: p => `${p.x}`, tipLabel: p => `Posición ${p.x}`, label: 'CTR por posición' });
  }
  function seoRastreo() {
    const web = S.state.accounts.find(a => a.platform === 'web');
    let dom = ''; try { dom = web && web.handle ? new URL(web.handle).origin : ''; } catch (e) { /* nada */ }
    return `<div class="card section"><div class="row"><input id="crawl-domain" type="url" placeholder="https://tusitio.com" value="${esc(dom)}" style="flex:1;min-width:240px"><button class="btn primary" data-act="crawl">Revisar</button></div>
      <p class="muted small">Revisa robots.txt (¿bloquea a Google?), los sitemaps declarados y cuántas URLs contienen, y la redirección de http a https.</p></div><div id="crawl-out"></div>`;
  }
  async function runCrawl() {
    let base = $('#crawl-domain').value.trim();
    if (!base) return;
    if (!/^https?:\/\//.test(base)) base = 'https://' + base;
    const origin = new URL(base).origin;
    const out = $('#crawl-out');
    out.innerHTML = '<div class="card">Revisando…</div>';
    const items = [];
    const add = (status, label, detail) => items.push({ status, label, detail });
    try {
      const rb = await P.http(origin + '/robots.txt');
      if (!rb.ok) add('warn', 'robots.txt', `No existe (HTTP ${rb.status}). No es grave, pero es el lugar para declarar el sitemap.`);
      else {
        const r = SEO.parseRobots(rb.body);
        add(r.blocksAll ? 'fail' : 'pass', 'robots.txt', r.blocksAll ? '¡Bloquea TODO el sitio a todos los buscadores (Disallow: /)!' : `${r.groups.length} grupo(s) de reglas; no bloquea el sitio completo.`);
        const maps = r.sitemaps.length ? r.sitemaps : [origin + '/sitemap.xml'];
        add(r.sitemaps.length ? 'pass' : 'warn', 'Sitemap declarado', r.sitemaps.length ? r.sitemaps.join(', ') : 'robots.txt no declara sitemap. Agrega: Sitemap: ' + origin + '/sitemap.xml');
        for (const sm of maps.slice(0, 3)) {
          try {
            const s = await P.http(sm);
            if (!s.ok) { add('fail', 'Sitemap', `${sm} responde HTTP ${s.status}`); continue; }
            const p = SEO.parseSitemap(s.body);
            add(p.count ? 'pass' : 'warn', p.isIndex ? 'Índice de sitemaps' : 'Sitemap', `${sm}: ${p.count} ${p.isIndex ? 'sitemaps' : 'URLs'}${p.newest ? ` · última modificación ${p.newest.slice(0, 10)}` : ' · sin <lastmod> (agrégalo para que Google priorice lo nuevo)'}`);
          } catch (e) { add('fail', 'Sitemap', `${sm}: ${e.message}`); }
        }
      }
      try {
        const h = await P.http(origin.replace('https://', 'http://'));
        add(h.url && h.url.startsWith('https://') ? 'pass' : 'warn', 'Redirección http → https', h.url && h.url.startsWith('https://') ? `Redirige a ${h.url}` : 'La versión http no redirige a https.');
      } catch (e) { /* algunos sitios no aceptan http en absoluto */ }
    } catch (e) { add('fail', 'Conexión', e.message + (P.native ? '' : ' (en el navegador puede ser CORS)')); }
    const icon = { pass: '✓', warn: '!', fail: '✕' };
    out.innerHTML = `<div class="card">${items.map(c => `<div class="check ${c.status}"><span class="st">${icon[c.status]}</span><div><b>${esc(c.label)}</b> <span class="muted">— ${esc(c.detail)}</span></div></div>`).join('')}</div>`;
  }

  // ── Academia ────────────────────────────────────────────────
  function viewAcademia(v) {
    setHeader('Academia de métricas', 'Qué mide cada número, cómo se calcula y cómo no engañarse', '');
    const groups = {};
    for (const m of M.METRICS) (groups[m.group] = groups[m.group] || []).push(m);
    v.innerHTML = `<div class="prose section"><div class="callout">
      <h2 style="margin-bottom:6px">7 reglas para leer números como analista</h2>
      <ol class="steps">
        <li><b>Siempre di la base.</b> "4% de interacción" no significa nada sin decir si es sobre alcance, impresiones o seguidores.</li>
        <li><b>Compara períodos iguales.</b> 28 días contra los 28 anteriores; un lunes no se compara con un sábado. Pulso lo hace por ti.</li>
        <li><b>Tasas antes que totales.</b> Los totales crecen solo con publicar más; las tasas te dicen si lo estás haciendo mejor.</li>
        <li><b>Una métrica sola miente.</b> Lee pares: alcance + seguidores por 1.000, CTR + conversión, frecuencia + CTR, impresiones + CTR orgánico.</li>
        <li><b>Muestras pequeñas engañan.</b> Con 4 posts no hay "mejor formato". Busca al menos 8–10 por grupo antes de concluir.</li>
        <li><b>Correlación no es causa.</b> Si subió el alcance el día que publicaste a las 7 pm, prueba la hora varias semanas antes de cambiar toda la parrilla.</li>
        <li><b>Vanidad vs. negocio.</b> Seguidores e impresiones abren la puerta; leads, CPL y conversión pagan las cuentas. Reporta las dos, decide con las segundas.</li>
      </ol></div></div>
      <div class="row section"><input id="gloss-q" type="search" placeholder="Buscar métrica (ej. CTR, guardados, frecuencia)…" style="flex:1;max-width:420px"></div>
      <div id="gloss">${Object.entries(groups).map(([g, list]) => `<div class="section gloss-group"><h2 style="margin-bottom:10px">${esc(g)}</h2><div class="gloss">${list.map(m => `
        <div class="card" data-search="${esc((m.label + ' ' + m.key + ' ' + m.what).toLowerCase())}"><h3>${esc(m.label)}<span class="badge">${m.better === 'up' ? '↑ mejor' : m.better === 'down' ? '↓ mejor' : 'contexto'}</span></h3>
          <div class="formula">${esc(m.formula)}</div><p class="small" style="margin:4px 0">${esc(m.what)}</p>
          ${m.bench ? `<p class="small muted">Referencia: ${benchText(m, M.benchFor(m, 'default') || m.bench.default || m.bench)}${m.bench.instagram ? ' (varía por red: IG, FB, TikTok y LinkedIn tienen rangos propios)' : ''}</p>` : ''}
          <div class="trap"><b>Ojo:</b> ${esc(m.trap)}</div></div>`).join('')}</div></div>`).join('')}</div>`;
    $('#gloss-q').addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      $$('#gloss [data-search]').forEach(c => { c.style.display = !q || c.dataset.search.includes(q) ? '' : 'none'; });
      $$('#gloss .gloss-group').forEach(g => { g.style.display = $$('[data-search]', g).some(c => c.style.display !== 'none') ? '' : 'none'; });
    });
  }

  // ── Ajustes ─────────────────────────────────────────────────
  async function viewAjustes(v) {
    setHeader('Ajustes', '', '');
    const [loc, metaTok, aiKey, theme] = await Promise.all([P.dataLocation(), P.getSecret('meta_token'), P.getSecret('anthropic_key'), P.getPref('theme')]);
    const st = S.state;
    v.innerHTML = `<div class="grid two">
      <div class="card"><h2>Equipo</h2><p class="muted small">Las dos personas que usan Pulso. Cada cuenta y meta tiene un responsable.</p>
        <div class="form-grid"><label class="field">Persona 1<input id="p1" type="text" value="${esc(st.people[0] || '')}"></label><label class="field">Persona 2<input id="p2" type="text" value="${esc(st.people[1] || '')}"></label></div>
        <div class="row end" style="margin-top:10px"><button class="btn" data-act="save-people">Guardar</button></div></div>
      <div class="card"><h2>Datos compartidos</h2><p class="muted small">Pulso guarda todo en un archivo <code>pulso-data.json</code>. Ponlo en una carpeta compartida de iCloud Drive (o Dropbox/Google Drive) y elige esa misma carpeta en las dos Macs: los dos verán lo mismo, y si ambos guardan a la vez Pulso fusiona los cambios.</p>
        <div class="small" style="word-break:break-all"><b>Ubicación:</b> ${esc(loc.path || '')}</div>
        <div class="row end" style="margin-top:10px">${P.native ? '<button class="btn" data-act="choose-folder">Elegir carpeta…</button>' : ''}<button class="btn" data-act="reload">Recargar ahora</button></div></div>
      <div class="card"><h2>Meta (Instagram, Facebook y Ads)</h2>
        <ol class="steps small"><li>Entra a <a href="#" data-act="open-url" data-url="https://developers.facebook.com/apps">developers.facebook.com/apps</a> y crea una app tipo <b>Empresa</b>.</li>
          <li>Abre el <a href="#" data-act="open-url" data-url="https://developers.facebook.com/tools/explorer/">Graph API Explorer</a>, elige tu app y agrega permisos: <code>pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, ads_read, business_management</code>.</li>
          <li>Genera el token y extiéndelo a 60 días en el <a href="#" data-act="open-url" data-url="https://developers.facebook.com/tools/debug/accesstoken/">Depurador de tokens</a> → "Extender". Para que no venza nunca: Business Manager → Usuarios del sistema → Generar token.</li></ol>
        <label class="field" style="margin-top:8px">Token de acceso <span class="hint">se guarda en el Llavero de esta Mac, no en el archivo compartido</span><input id="meta-token" type="password" value="${esc(metaTok)}" placeholder="EAAB…"></label>
        <div class="row" style="margin-top:8px"><label class="field" style="flex-direction:row;align-items:center;gap:8px">Versión de la API<input id="graph-ver" type="text" value="${esc(st.settings.graphVersion || 'v23.0')}" style="width:90px"></label><span class="spacer"></span><button class="btn primary" data-act="meta-discover">Guardar y buscar cuentas</button></div>
        <div id="meta-found"></div></div>
      <div class="card"><h2>Analista IA (Claude)</h2><p class="muted small">Opcional. Crea una API key en <a href="#" data-act="open-url" data-url="https://console.anthropic.com/settings/keys">console.anthropic.com</a>. Se guarda en el Llavero de esta Mac.</p>
        <label class="field">API key<input id="ai-key" type="password" value="${esc(aiKey)}" placeholder="sk-ant-…"></label>
        <label class="field" style="margin-top:8px">Modelo<input id="ai-model" type="text" value="${esc(st.settings.aiModel || AI.DEFAULT_MODEL)}"></label>
        <div class="row end" style="margin-top:10px"><button class="btn" data-act="save-ai">Guardar</button></div></div>
      <div class="card"><h2>Datos de demostración</h2><p class="muted small">6 cuentas de ejemplo con 120 días de datos, metas y Search Console para explorar todas las funciones. No tocan tus cuentas reales.</p>
        <div class="row end"><button class="btn" data-act="demo-load">Cargar demo</button><button class="btn danger" data-act="demo-remove">Quitar demo</button></div></div>
      <div class="card"><h2>Respaldo</h2><p class="muted small">Exporta todo a un archivo JSON (sin tokens) o restaura uno.</p>
        <div class="row"><button class="btn" data-act="export">Exportar respaldo</button><input type="file" id="backup-file" accept=".json,application/json"><button class="btn" data-act="import-backup">Restaurar</button></div>
        <h2 style="margin-top:16px">Apariencia</h2><div class="seg" style="margin-top:8px">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => `<button data-act="theme" data-theme="${k}" class="${(theme || 'auto') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    </div>`;
  }
  async function metaDiscover() {
    const tok = $('#meta-token').value.trim();
    await P.setSecret('meta_token', tok);
    S.setSetting('graphVersion', $('#graph-ver').value.trim() || 'v23.0');
    const out = $('#meta-found');
    if (!tok) { out.innerHTML = ''; toast('Token borrado.'); return; }
    out.innerHTML = '<p class="muted">Buscando cuentas…</p>';
    try {
      const client = await metaClient();
      const me = await client.me();
      const { pages, ads } = await client.discover();
      const exists = (k, id) => S.state.accounts.some(a => a.meta && a.meta[k] === id);
      for (const p of pages) if (p.access_token) await P.setSecret('meta_page_' + p.id, p.access_token);
      const items = [];
      for (const p of pages) {
        items.push({ platform: 'facebook', name: p.name, id: p.id, key: 'pageId', sub: `${M.compact(p.followers_count || p.fan_count || 0)} seguidores` });
        const ig = p.instagram_business_account;
        if (ig) items.push({ platform: 'instagram', name: '@' + (ig.username || ig.id), id: ig.id, key: 'igId', sub: `${M.compact(ig.followers_count || 0)} seguidores · vinculado a ${p.name}` });
      }
      for (const a of ads) items.push({ platform: 'meta_ads', name: a.name, id: a.id, key: 'adAccountId', sub: `${a.id} · ${a.currency || ''}${a.account_status !== 1 ? ' · inactiva' : ''}` });
      out.innerHTML = `<p class="small">Conectado como <b>${esc(me.name)}</b>. ${items.length ? 'Agrega las cuentas que quieras seguir:' : 'No encontré Páginas, Instagram ni cuentas publicitarias con ese token: revisa los permisos.'}</p>
        ${items.map(i => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border)">${platBadge(i.platform)}<div style="flex:1"><b>${esc(i.name)}</b><div class="muted small">${esc(i.sub)}</div></div>
          ${exists(i.key, i.id) ? '<span class="badge pass">Agregada</span>' : `<button class="btn sm" data-act="meta-add" data-platform="${i.platform}" data-name="${esc(i.name)}" data-key="${i.key}" data-id="${esc(i.id)}">Agregar</button>`}</div>`).join('')}`;
    } catch (e) { out.innerHTML = `<p class="small" style="color:var(--bad)">${esc(e.message)}</p>`; }
  }

  async function syncAccount(a, days = 90) {
    if (ui.syncing[a.id]) return;
    ui.syncing[a.id] = true; if (ui.view === 'cuenta') render();
    try {
      const client = await metaClient();
      const progress = msg => { $('#sync-status').textContent = `${a.name}: ${msg}`; };
      let res;
      if (a.platform === 'instagram' && a.meta.igId) res = await client.syncInstagram(a.meta.igId, days, progress);
      else if (a.platform === 'facebook' && a.meta.pageId) res = await client.syncPage(a.meta.pageId, (await P.getSecret('meta_page_' + a.meta.pageId)) || undefined, days, progress);
      else if (a.platform === 'meta_ads' && a.meta.adAccountId) res = await client.syncAds(a.meta.adAccountId, days, progress);
      else throw new Error('Esta cuenta no tiene un ID de Meta configurado.');
      S.upsertRows(a.id, res.rows);
      if (res.posts) S.setPosts(a.id, res.posts);
      if (res.campaigns) S.setCampaigns(a.id, res.campaigns);
      toast(`${a.name}: ${res.rows.length} días sincronizados${res.posts ? `, ${res.posts.length} publicaciones` : ''}.`);
    } catch (e) { toast(`${a.name}: ${e.message}`, true); }
    ui.syncing[a.id] = false;
    $('#sync-status').textContent = '';
    render();
  }

  // ── Agregar cuenta ──────────────────────────────────────────
  function accountModal() {
    modal({
      title: 'Agregar cuenta',
      body: `<div class="form-grid">
        <label class="field">Plataforma<select name="platform">${Object.entries(M.PLATFORMS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('')}</select></label>
        <label class="field">Nombre<input name="name" type="text" placeholder="Ej.: Banco · Instagram"></label>
        <label class="field">Usuario o URL<input name="handle" type="text" placeholder="@cuenta o https://…"></label>
        <label class="field">Responsable<select name="owner">${S.state.people.map(p => `<option ${p === ui.person ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label></div>
        <p class="muted small" id="acc-hint"></p>`,
      footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Agregar</button>`,
      onMount(el, close) {
        const hint = () => {
          const p = $('[name=platform]', el).value;
          $('#acc-hint', el).textContent = ['instagram', 'facebook', 'meta_ads'].includes(p) ? 'Tip: en Ajustes → Meta puedes agregar estas cuentas ya conectadas para sincronizarlas solas.'
            : p === 'linkedin' ? 'LinkedIn personal: carga los datos con el export de Analíticas o el registro manual.' : p === 'tiktok' ? 'TikTok: importa el CSV de TikTok Studio desde la pestaña Datos.' : 'Sitio web: pon la URL completa para usarla en el auditor SEO.';
        };
        $('[name=platform]', el).addEventListener('change', hint); hint();
        $('[data-save]', el).addEventListener('click', () => {
          const g = n => $(`[name=${n}]`, el).value.trim();
          const platform = g('platform');
          const acc = S.addAccount({ platform, name: g('name') || M.PLATFORMS[platform].label, handle: g('handle'), owner: g('owner'), meta: {}, personal: platform === 'linkedin' });
          close(); go('cuenta', { accountId: acc.id, tab: 'datos' });
        });
      },
    });
  }

  async function readFileInput(sel) {
    const f = $(sel) && $(sel).files[0];
    return f ? f.text() : null;
  }

  // ── Acciones ────────────────────────────────────────────────
  const ACTIONS = {
    'add-account': () => accountModal(),
    'go-settings': () => go('ajustes'),
    'go-goals': () => go('metas'),
    'go-diag': () => { const a = visibleAccounts()[0]; if (a) go('cuenta', { accountId: a.id, tab: 'diagnostico' }); },
    'open-account': b => go('cuenta', { accountId: b.dataset.id }),
    'tab': b => { ui.tab = b.dataset.tab; render(); },
    'seo-tab': b => { ui.seoTab = b.dataset.tab; render(); },
    'new-goal': () => goalModal(),
    'edit-goal': b => goalModal(S.state.goals.find(g => g.id === b.dataset.id)),
    'del-goal': b => { if (confirm('¿Eliminar esta meta?')) { S.removeGoal(b.dataset.id); render(); } },
    'sort-posts': b => { ui.postSort = b.dataset.k; render(); },
    'open-url': (b, e) => { e && e.preventDefault(); P.openExternal(b.dataset.url); },
    'demo-load': () => { D.apply(S.state); S.save(true); toast('Datos de demostración cargados.'); go('resumen'); },
    'demo-remove': () => { D.remove(S.state); S.save(true); toast('Demo eliminada.'); render(); },
    'sync': b => { const a = S.account(b.dataset.id); const d = $('#sync-days'); syncAccount(a, d ? +d.value : 90); },
    'sync-all': async () => { for (const a of visibleAccounts().filter(x => x.meta && (x.meta.igId || x.meta.pageId || x.meta.adAccountId))) await syncAccount(a); },
    'import-csv': async () => {
      const a = S.account(ui.accountId);
      const text = (await readFileInput('#csv-file')) || $('#csv-text').value;
      if (!text || !text.trim()) { toast('Elige un archivo o pega el contenido.', true); return; }
      const r = C.importCSV(text);
      if (r.kind === 'gsc') { S.setGSC(r.rows); toast(`Era un export de consultas: ${r.rows.length} filas cargadas en SEO → Search Console.`); ui.view = 'seo'; ui.seoTab = 'gsc'; render(); return; }
      if (r.kind !== 'daily' || !r.rows.length) { toast(r.error || 'No reconocí el formato del archivo.', true); return; }
      const rows = C.adaptRows(r.rows, a.platform);
      S.upsertRows(a.id, rows);
      const cols = [...new Set(Object.values(r.mapping))].filter(x => x !== 'date').map(f => (M.FIELDS[f] || {}).label || f);
      toast(`${rows.length} días importados (${cols.join(', ')})${r.skipped ? ` · ${r.skipped} filas sin fecha válida` : ''}.`);
      render();
    },
    'manual-save': () => {
      const a = S.account(ui.accountId);
      const row = {};
      for (const i of $$('#manual-form input')) { if (i.name === 'date') row.date = i.value; else if (i.value !== '') row[i.name] = parseFloat(i.value); }
      if (!row.date || Object.keys(row).length < 2) { toast('Pon la fecha y al menos un valor.', true); return; }
      S.upsertRows(a.id, C.adaptRows([row], a.platform)); toast('Día guardado.'); render();
    },
    'del-row': b => { S.deleteRow(ui.accountId, b.dataset.date); render(); },
    'save-account': b => {
      const a = S.account(b.dataset.id);
      const g = n => { const el = $(`#acc-form [name=${n}]`); return el ? el.value.trim() : undefined; };
      const meta = Object.assign({}, a.meta);
      for (const k of ['igId', 'pageId', 'adAccountId']) if (g(k) !== undefined) meta[k] = g(k);
      S.updateAccount(a.id, { name: g('name') || a.name, handle: g('handle'), owner: g('owner'), meta });
      toast('Cuenta actualizada.'); render();
    },
    'del-account': b => { if (confirm('¿Eliminar la cuenta y todos sus datos?')) { S.removeAccount(b.dataset.id); go('resumen'); } },
    'plan': () => runPlan(),
    'plan-goal': b => {
      const a = S.account(b.dataset.acc);
      const map = { leads: a.platform === 'meta_ads' || a.platform === 'web' ? 'leads' : null, followers: 'netFollowers', reach: 'reach', impressions: 'impressions' };
      let acc = a, metric = map[b.dataset.obj];
      if (!metric) { acc = S.state.accounts.find(x => x.platform === 'meta_ads') || a; metric = 'leads'; }
      goalModal({ accountId: acc.id, metric, target: +b.dataset.target, startDate: today(), deadline: A.addDays(today(), +b.dataset.days), title: `${OBJ[b.dataset.obj]}: ${M.compact(+b.dataset.target)} en ${b.dataset.days} días`, _new: true });
    },
    'ai-run': () => runAI(),
    'audit': () => runAudit(),
    'show-audit': b => { ui.auditId = b.dataset.id; render(); },
    'crawl': () => runCrawl(),
    'gsc-import': async () => {
      const text = await readFileInput('#gsc-file');
      if (!text) { toast('Elige el CSV de consultas o páginas.', true); return; }
      const r = C.importCSV(text);
      if (r.kind !== 'gsc') { toast('Ese archivo no parece un export de Consultas/Páginas de Search Console.', true); return; }
      S.setGSC(r.rows); toast(`${r.rows.length} ${r.dimension === 'query' ? 'consultas' : 'páginas'} importadas.`); render();
    },
    'save-brand': () => { S.state.seo.brandTerms = $('#brand-terms').value.split(',').map(s => s.trim()).filter(Boolean); S.save(); render(); },
    'save-people': () => {
      const p1 = $('#p1').value.trim() || 'Persona 1', p2 = $('#p2').value.trim() || 'Persona 2';
      const old = S.state.people.slice();
      S.state.accounts.forEach(a => { if (a.owner === old[0]) a.owner = p1; else if (a.owner === old[1]) a.owner = p2; });
      S.state.goals.forEach(g => { if (g.owner === old[0]) g.owner = p1; else if (g.owner === old[1]) g.owner = p2; });
      if (ui.person === old[0]) ui.person = p1; else if (ui.person === old[1]) ui.person = p2;
      S.setPeople([p1, p2]); toast('Equipo guardado.'); render();
    },
    'choose-folder': async () => { const r = await P.chooseFolder(); if (r && !r.cancelled) { await S.load(); toast('Carpeta de datos actualizada.'); render(); } },
    'reload': async () => { await S.refresh(); toast('Datos recargados.'); render(); },
    'meta-discover': () => metaDiscover(),
    'meta-add': b => {
      const meta = { [b.dataset.key]: b.dataset.id };
      S.addAccount({ platform: b.dataset.platform, name: b.dataset.name, handle: b.dataset.platform === 'instagram' ? b.dataset.name : '', owner: ui.person === 'Todos' ? S.state.people[0] : ui.person, meta });
      b.outerHTML = '<span class="badge pass">Agregada</span>'; renderNav(); toast(`${b.dataset.name} agregada. Ábrela y pulsa Sincronizar.`);
    },
    'save-ai': async () => { await P.setSecret('anthropic_key', $('#ai-key').value.trim()); S.setSetting('aiModel', $('#ai-model').value.trim() || AI.DEFAULT_MODEL); toast('Guardado.'); },
    'export': async () => { const r = await P.saveFile(`pulso-respaldo-${today()}.json`, JSON.stringify(S.state, null, 1)); if (r && r.ok) toast('Respaldo exportado.'); },
    'import-backup': async () => {
      const text = await readFileInput('#backup-file');
      if (!text) { toast('Elige el archivo de respaldo.', true); return; }
      try { const s = JSON.parse(text); if (!s.accounts) throw new Error('formato'); if (confirm('¿Reemplazar todos los datos actuales con el respaldo?')) { S.replace(s); toast('Respaldo restaurado.'); go('resumen'); } }
      catch (e) { toast('El archivo no es un respaldo válido de Pulso.', true); }
    },
    'theme': b => { applyTheme(b.dataset.theme); P.setPref('theme', b.dataset.theme); render(); },
  };

  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  // Atajos de teclado tipo Mac: ⌘1…⌘6 para las secciones
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const map = { 1: 'resumen', 2: 'metas', 3: 'estratega', 4: 'seo', 5: 'academia', 6: 'ajustes' };
    if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
  });
  $('#view').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('acc-card')) go('cuenta', { accountId: e.target.dataset.id });
  });

  // ── Arranque ────────────────────────────────────────────────
  (async function boot() {
    applyTheme(await P.getPref('theme'));
    await S.load();
    const saved = await P.getPref('person');
    if (saved && (saved === 'Todos' || S.state.people.includes(saved))) ui.person = saved;
    render();
    S.subscribe(() => { const t = $('#sync-status'); if (t && !t.textContent.includes(':')) t.textContent = 'Guardado ' + new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }); });
    // Trae los cambios de la otra persona cada minuto y al volver a la ventana
    const pull = async () => { if (await S.refresh()) render(); };
    setInterval(pull, 60000);
    window.addEventListener('focus', pull);
    let resizeT; window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (ui.view === 'cuenta' && ui.tab === 'tendencias') render(); if (ui.view === 'seo' && ui.seoTab === 'gsc') mountCtrCurve(); }, 200); });
  })();

  window.PulsoApp = { ui, S, go, render };
})();
