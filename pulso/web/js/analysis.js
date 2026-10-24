/* ─────────────────────────────────────────────────────────────
   Pulso · Motor de análisis
   Resúmenes por período, comparación contra el período anterior,
   tendencia (regresión lineal), metas con ritmo y proyección,
   anclaje de metas a presupuesto publicitario, diagnóstico con
   recomendaciones y planificador de crecimiento por embudo.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  const M = root.PulsoMetrics || (typeof require !== 'undefined' ? require('./metrics.js') : null);

  // ── Fechas (siempre 'YYYY-MM-DD', en hora local) ────────────
  const DAY = 86400000;
  function iso(d) {
    const x = d instanceof Date ? d : new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }
  function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }

  // ── Resumen de un período ───────────────────────────────────
  /* rows: filas diarias ordenadas o no. Devuelve el objeto "t" que
     consumen las fórmulas de metrics.js */
  function summarize(rows, from, to) {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const inRange = sorted.filter(r => r.date >= from && r.date <= to);
    const before = sorted.filter(r => r.date < from);
    const t = { sum: {}, last: {}, first: {}, firstBase: {}, avg: {}, days: diffDays(from, to) + 1, rows: inRange.length, from, to };
    const counts = {};
    for (const r of inRange) {
      for (const [k, v] of Object.entries(r)) {
        if (k === 'date' || typeof v !== 'number' || !isFinite(v)) continue;
        t.sum[k] = (t.sum[k] || 0) + v;
        counts[k] = (counts[k] || 0) + 1;
        if (t.first[k] == null) t.first[k] = v;
        t.last[k] = v;
      }
    }
    for (const k of Object.keys(counts)) t.avg[k] = t.sum[k] / counts[k];
    // Base para crecimiento: último valor conocido ANTES del período
    // (si no hay, el primero del período).
    for (const k of Object.keys(t.first)) {
      let base = null;
      for (let i = before.length - 1; i >= 0; i--) if (typeof before[i][k] === 'number') { base = before[i][k]; break; }
      t.firstBase[k] = base != null ? base : t.first[k];
    }
    return t;
  }

  function computeAll(t, platform) {
    const out = {};
    for (const m of M.metricsFor(platform)) {
      let v = null;
      try { v = m.compute(t); } catch (e) { v = null; }
      out[m.key] = v == null || !isFinite(v) ? null : v;
    }
    return out;
  }

  /* Compara los últimos `days` días que terminan en `to` con los
     `days` anteriores. */
  function comparePeriods(rows, platform, days, to) {
    const end = to || latestDate(rows) || iso(new Date());
    const from = addDays(end, -(days - 1));
    const pEnd = addDays(from, -1);
    const pFrom = addDays(pEnd, -(days - 1));
    const cur = summarize(rows, from, end);
    const prev = summarize(rows, pFrom, pEnd);
    const a = computeAll(cur, platform);
    const b = computeAll(prev, platform);
    const delta = {};
    for (const k of Object.keys(a)) {
      if (a[k] == null || b[k] == null) { delta[k] = null; continue; }
      const m = M.byKey[k];
      delta[k] = m.unit === 'pct' ? a[k] - b[k] /* puntos porcentuales */ : (b[k] === 0 ? null : (a[k] - b[k]) / Math.abs(b[k]));
    }
    return { from, to: end, prevFrom: pFrom, prevTo: pEnd, current: a, previous: b, delta, hasPrevious: prev.rows > 0, t: cur };
  }

  function latestDate(rows) {
    let m = null;
    for (const r of rows) if (!m || r.date > m) m = r.date;
    return m;
  }

  // ── Serie diaria de una métrica ─────────────────────────────
  /* Para métricas de tasa usa una ventana móvil (por defecto 7 días)
     para que la línea no sea ruido. */
  function dailySeries(rows, platform, metricKey, from, to, window = 7) {
    const m = M.byKey[metricKey];
    const out = [];
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const start = from || (sorted[0] && sorted[0].date);
    const end = to || latestDate(sorted);
    if (!start || !end) return out;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const isRate = m.goal === 'rate';
      const isLevel = m.goal === 'level';
      const t = summarize(sorted, isRate ? addDays(d, -(window - 1)) : d, d);
      let v = null;
      if (t.rows) { try { v = m.compute(t); } catch (e) { v = null; } }
      if (isLevel && v == null) continue;
      out.push({ date: d, value: v == null || !isFinite(v) ? null : v });
    }
    return out;
  }

  // ── Regresión lineal ────────────────────────────────────────
  function linearRegression(points) {
    const p = points.filter(q => q.y != null && isFinite(q.y));
    const n = p.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (const { x, y } of p) { sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; }
    const den = n * sxx - sx * sx;
    if (!den) return null;
    const slope = (n * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / n;
    const ssTot = syy - (sy * sy) / n;
    let ssRes = 0;
    for (const { x, y } of p) { const e = y - (slope * x + intercept); ssRes += e * e; }
    const r2 = ssTot ? 1 - ssRes / ssTot : 1;
    return { slope, intercept, r2, n, predict: x => slope * x + intercept };
  }

  // ── Metas ───────────────────────────────────────────────────
  /* goal: { metric, target, baseline?, startDate, deadline, accountId, adsAccountId? }
     Devuelve estado, ritmo actual vs. necesario, proyección a la fecha
     límite y — si va atrasada — cuánto presupuesto haría falta para
     cerrar la brecha con publicidad. */
  function goalProgress(goal, rows, platform, today, adsRows) {
    const m = M.byKey[goal.metric];
    if (!m) return null;
    const now = today || latestDate(rows) || iso(new Date());
    const start = goal.startDate;
    const end = goal.deadline;
    const totalDays = Math.max(1, diffDays(start, end));
    const elapsed = Math.min(totalDays, Math.max(0, diffDays(start, now)));
    const remaining = Math.max(0, diffDays(now, end));
    const lower = m.better === 'down';

    let current = null, baseline = goal.baseline, projected = null, pacePerDay = null;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

    if (m.goal === 'cumulative') {
      const t = summarize(sorted, start, now);
      current = t.rows ? safe(() => m.compute(t)) || 0 : 0;
      baseline = 0;
      // Ritmo de los últimos 14 días (más representativo que todo el histórico)
      const recentFrom = maxDate(start, addDays(now, -13));
      const tr = summarize(sorted, recentFrom, now);
      const rDays = Math.max(1, diffDays(recentFrom, now) + 1);
      pacePerDay = tr.rows ? (safe(() => m.compute(tr)) || 0) / rDays : 0;
      projected = current + pacePerDay * remaining;
    } else if (m.goal === 'level') {
      const series = dailySeries(sorted, platform, m.key, addDays(now, -27), now);
      const pts = series.map((s, i) => ({ x: i, y: s.value }));
      const last = [...series].reverse().find(s => s.value != null);
      current = last ? last.value : null;
      if (baseline == null) {
        const b = summarize(sorted, start, start);
        baseline = safe(() => m.compute(b));
        if (baseline == null) baseline = series.length ? series.find(s => s.value != null)?.value : current;
      }
      const reg = linearRegression(pts);
      pacePerDay = reg ? reg.slope : 0;
      projected = current != null ? current + pacePerDay * remaining : null;
    } else {
      const t = summarize(sorted, addDays(now, -27), now);
      current = safe(() => m.compute(t));
      if (baseline == null) {
        const b = summarize(sorted, addDays(start, -27), start);
        baseline = safe(() => m.compute(b));
      }
      const series = dailySeries(sorted, platform, m.key, addDays(now, -27), now, 14);
      const reg = linearRegression(series.map((s, i) => ({ x: i, y: s.value })));
      pacePerDay = reg ? reg.slope : 0;
      projected = current != null ? current + pacePerDay * remaining : null;
    }

    const target = goal.target;
    const span = target - (baseline ?? 0);
    let progress = null;
    if (current != null && span) progress = (current - (baseline ?? 0)) / span;
    if (progress != null) progress = Math.max(0, Math.min(1.5, progress));
    const gap = current != null ? target - current : null;
    const requiredPerDay = gap != null && remaining > 0 ? gap / remaining : null;
    const achieved = current != null && (lower ? current <= target : current >= target);
    const willReach = projected != null && (lower ? projected <= target : projected >= target);
    const expected = elapsed / totalDays;

    let status;
    if (achieved) status = 'logrado';
    else if (remaining === 0) status = 'vencido';
    else if (willReach) status = 'en_ruta';
    else if (progress != null && progress >= expected * 0.75) status = 'en_riesgo';
    else status = 'fuera_de_ruta';

    // La publicidad cubre solo lo que el ritmo orgánico no alcanza a la fecha límite
    const shortfall = projected != null && m.goal !== 'rate' ? target - projected : gap;
    const adPlan = !achieved && !willReach && remaining > 0 ? adBoost(goal, m, lower ? null : shortfall, adsRows || rows, now) : null;
    return { metric: m, current, baseline, target, progress, expected, gap, pacePerDay, requiredPerDay,
             projected, remaining, elapsed, totalDays, status, adPlan, lower };
  }

  /* Anclar la meta a publicidad: cuánto costaría cerrar la brecha
     que el ritmo orgánico no alcanza, usando los costos reales de
     la cuenta de anuncios (últimos 28 días) o referencias si no hay. */
  const DEFAULT_COSTS = { cpm: 3.5, ctr: 0.009, cvr: 0.08, frequency: 1.6, costPerFollower: 0.25 };

  function adCosts(adsRows, now) {
    const t = summarize(adsRows || [], addDays(now, -27), now);
    const spend = t.sum.spend || 0;
    const real = spend > 0;
    const cpm = real && t.sum.impressions ? (spend / t.sum.impressions) * 1000 : DEFAULT_COSTS.cpm;
    const clicks = t.sum.linkClicks || t.sum.clicks;
    const ctr = real && t.sum.impressions && clicks ? clicks / t.sum.impressions : DEFAULT_COSTS.ctr;
    const cvr = real && clicks && t.sum.leads ? t.sum.leads / clicks : DEFAULT_COSTS.cvr;
    const frequency = real && t.sum.reach ? t.sum.impressions / t.sum.reach : DEFAULT_COSTS.frequency;
    return { cpm, ctr, cvr, frequency, cpc: cpm / (ctr * 1000), cpl: cpm / (ctr * 1000) / cvr,
             costPerFollower: DEFAULT_COSTS.costPerFollower, real };
  }

  function adBoost(goal, m, gap, adsRows, now) {
    if (gap == null || gap <= 0) return null;
    const c = adCosts(adsRows, now);
    let budget = null, how = '', objective = '';
    switch (m.key) {
      case 'reach':
        budget = (gap * c.frequency / 1000) * c.cpm;
        objective = 'Reconocimiento (Alcance)';
        how = `${M.compact(gap)} personas × frecuencia ${c.frequency.toFixed(1)} = ${M.compact(gap * c.frequency)} impresiones a CPM ${M.format(c.cpm, 'money')}`;
        break;
      case 'impressions':
        budget = (gap / 1000) * c.cpm;
        objective = 'Reconocimiento (Impresiones)';
        how = `${M.compact(gap)} impresiones a CPM ${M.format(c.cpm, 'money')}`;
        break;
      case 'leads':
        budget = gap * c.cpl;
        objective = 'Clientes potenciales (formulario instantáneo o mensajes)';
        how = `${M.compact(gap)} leads × CPL ${M.format(c.cpl, 'money')} (CPM ${M.format(c.cpm, 'money')}, CTR ${M.format(c.ctr, 'pct', { decimals: 2 })}, conversión ${M.format(c.cvr, 'pct')})`;
        break;
      case 'followers':
      case 'netFollowers':
        budget = gap * c.costPerFollower;
        objective = 'Interacción → visitas al perfil (o Seguidores en Meta)';
        how = `${M.compact(gap)} seguidores × ~${M.format(c.costPerFollower, 'money')} por seguidor (referencia; ajústalo con tu dato real)`;
        break;
      case 'searchClicks':
      case 'sessions':
        budget = gap * c.cpc;
        objective = 'Tráfico';
        how = `${M.compact(gap)} visitas × CPC ${M.format(c.cpc, 'money')}`;
        break;
      case 'engagements':
        budget = (gap / 0.04 / 1000) * c.cpm;
        objective = 'Interacción';
        how = `con una tasa de interacción pagada ~4%: ${M.compact(gap / 0.04)} impresiones a CPM ${M.format(c.cpm, 'money')}`;
        break;
      default:
        return { budget: null, objective: 'Optimización', how: 'Esta métrica es una tasa: no se compra con presupuesto, se mejora con creatividad, oferta y segmentación. Revisa el Diagnóstico.', costs: c };
    }
    const days = Math.max(1, diffDays(now, goal.deadline));
    return { budget, perDay: budget / days, objective, how, costs: c, days };
  }

  function safe(fn) { try { const v = fn(); return v == null || !isFinite(v) ? null : v; } catch (e) { return null; } }
  function maxDate(a, b) { return a > b ? a : b; }

  // ── Contenido ───────────────────────────────────────────────
  function postER(p) {
    const e = p.engagements != null ? p.engagements : (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
    const base = p.reach || p.views || p.impressions;
    return base ? e / base : null;
  }

  const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function contentInsights(posts) {
    const list = (posts || []).map(p => ({ ...p, er: postER(p) })).filter(p => p.er != null);
    const group = (keyFn) => {
      const g = {};
      for (const p of list) {
        const k = keyFn(p);
        if (!g[k]) g[k] = { key: k, n: 0, er: 0, reach: 0, saves: 0, shares: 0 };
        g[k].n++; g[k].er += p.er; g[k].reach += p.reach || p.views || 0; g[k].saves += p.saves || 0; g[k].shares += p.shares || 0;
      }
      return Object.values(g).map(x => ({ ...x, er: x.er / x.n, avgReach: x.reach / x.n })).sort((a, b) => b.er - a.er);
    };
    const avgER = list.length ? list.reduce((s, p) => s + p.er, 0) / list.length : null;
    const top = [...list].sort((a, b) => b.er - a.er).slice(0, 5);
    const bottom = [...list].sort((a, b) => a.er - b.er).slice(0, 3);
    return {
      n: list.length, avgER, top, bottom,
      byType: group(p => p.type || 'Otro'),
      byWeekday: group(p => WEEKDAYS[parseISO(p.date.slice(0, 10)).getDay()]),
      byHour: list.some(p => p.time) ? group(p => (p.time || '').slice(0, 2) + ':00') : [],
    };
  }

  // ── Diagnóstico ─────────────────────────────────────────────
  /* Reglas de experto: cada una mira una combinación de métricas y,
     si se cumple, propone una acción concreta. severity: alta|media|baja|bien */
  function diagnose(account, rows, posts, days = 28) {
    const platform = account.platform;
    const cmp = comparePeriods(rows, platform, days);
    const c = cmp.current, d = cmp.delta;
    const out = [];
    const add = (severity, title, detail, actions, metric) => out.push({ severity, title, detail, actions, metric, account: account.name, accountId: account.id });
    const g = k => M.grade(M.byKey[k], c[k], platform);
    const pct = (v, dec = 1) => M.format(v, 'pct', { decimals: dec });

    if (!rows.length) {
      add('media', 'Sin datos todavía', 'Esta cuenta no tiene métricas cargadas.', ['Conéctala con Meta o importa el CSV de la plataforma en la pestaña Datos.']);
      return out;
    }

    if (platform === 'meta_ads') {
      if (c.frequency != null && c.frequency > 3.5)
        add('alta', 'Fatiga creativa', `La frecuencia es ${c.frequency.toFixed(2)}: cada persona vio el anuncio casi ${Math.round(c.frequency)} veces.`,
          ['Rota 2–3 creatividades nuevas (mismo mensaje, distinto gancho visual).', 'Amplía la audiencia o usa Advantage+ audiencia.', 'Pon un tope: si la frecuencia pasa de 3 en 7 días, refresca.'], 'frequency');
      if (c.ctr != null && g('ctr')?.level === 'low')
        add('alta', 'El anuncio no detiene el scroll', `CTR de enlace de ${pct(c.ctr, 2)}, por debajo de ~1%.`,
          ['Prueba 3 ganchos distintos en los primeros 2 segundos (pregunta, dato fuerte, antes/después).', 'Haz el beneficio explícito en el titular: qué gana la persona, no qué vendes.', 'Usa formato vertical 9:16 nativo; evita piezas que parezcan anuncio de TV.'], 'ctr');
      if (c.ctr != null && c.cvr != null && g('ctr')?.level !== 'low' && c.cvr < 0.03)
        add('alta', 'El problema está en la landing, no en el anuncio', `La gente hace clic (CTR ${pct(c.ctr, 2)}) pero solo ${pct(c.cvr)} convierte.`,
          ['Revisa la velocidad móvil de la página (menos de 3 s).', 'Repite en la landing la misma promesa del anuncio (continuidad de mensaje).', 'Reduce el formulario a 3–4 campos o usa formulario instantáneo / WhatsApp.'], 'cvr');
      if (d.cpm != null && d.cpm > 0.25)
        add('media', 'La subasta se encareció', `El CPM subió ${pct(d.cpm, 0)} contra el período anterior (ahora ${M.format(c.cpm, 'money')}).`,
          ['Revisa si la audiencia es demasiado pequeña o si hay muchas campañas compitiendo por la misma gente.', 'Mejora la calidad del anuncio: Meta cobra menos a los anuncios que la gente no oculta.', 'Si es temporada alta, adelanta inversión a semanas menos competidas.'], 'cpm');
      if (d.cpl != null && d.cpl > 0.2)
        add('alta', 'El costo por lead está subiendo', `CPL ${M.format(c.cpl, 'money')} (+${pct(d.cpl, 0)}).`,
          ['Identifica el conjunto de anuncios con peor CPL y apágalo o rebájale presupuesto.', 'Duplica el ganador con creatividad nueva antes de que se fatigue.'], 'cpl');
      if (c.ctr != null && g('ctr')?.level === 'great')
        add('bien', 'Creatividad ganadora', `CTR de ${pct(c.ctr, 2)}: por encima de la referencia.`, ['Escálalo de a 20% de presupuesto cada 3–4 días para no reiniciar el aprendizaje.'], 'ctr');
      return out;
    }

    if (platform === 'web') {
      if (c.searchCtr != null && g('searchCtr')?.level === 'low')
        add('alta', 'CTR orgánico bajo', `Solo ${pct(c.searchCtr, 2)} de quienes te ven en Google hacen clic.`,
          ['Reescribe títulos: palabra clave al inicio + beneficio + número o año.', 'Meta description de 140–155 caracteres con un llamado a la acción.', 'Añade datos estructurados (FAQ, Organization, LocalBusiness) para ocupar más espacio en el resultado.'], 'searchCtr');
      if (c.avgPosition != null && c.avgPosition > 10)
        add('media', 'Posicionamiento fuera de la primera página', `Posición promedio ${c.avgPosition.toFixed(1)}.`,
          ['Importa las consultas de Search Console y ataca las de "distancia de impacto" (posición 4–20).', 'Mejora el contenido existente antes de crear nuevo: amplía, actualiza y enlaza internamente.'], 'avgPosition');
      if (d.searchImpressions != null && d.searchImpressions > 0.15)
        add('bien', 'Google te está mostrando más', `Las impresiones crecieron ${pct(d.searchImpressions, 0)}.`, ['Optimiza títulos de las páginas que más crecieron para convertir esas impresiones en clics.'], 'searchImpressions');
      return out;
    }

    // Redes orgánicas
    const er = c.erReach;
    if (er != null) {
      const gr = g('erReach');
      if (gr?.level === 'low')
        add('alta', 'Interacción por debajo de la referencia', `Tasa de interacción sobre alcance: ${pct(er, 2)} (referencia buena: ${pct(M.benchFor(M.byKey.erReach, platform).good)}).`,
          ['Abre cada pieza con un gancho que plantee un problema que tu audiencia reconoce.', 'Termina con una pregunta concreta o un "guarda esto para después".', 'Revisa los 3 posts con mejor tasa (pestaña Contenido) y repite su formato.'], 'erReach');
      else if (gr && (gr.level === 'great'))
        add('bien', 'Interacción excelente', `${pct(er, 2)} sobre alcance. La audiencia responde.`, ['Es el momento de pedir acción: CTA a WhatsApp/DM o a la web en 1 de cada 3 posts.', 'Impulsa (boost) los posts con mejor tasa: ya probaron que funcionan.'], 'erReach');
    }
    if (d.reach != null && d.reach < -0.15)
      add('alta', 'Caída de alcance', `El alcance bajó ${pct(Math.abs(d.reach), 0)} contra los ${days} días anteriores.`,
        ['Revisa si bajó la frecuencia de publicación (compara publicaciones por semana).', `Prioriza ${platform === 'linkedin' ? 'documentos (carruseles PDF) y texto con historia' : 'video corto vertical (Reels/TikTok)'}: es el formato con más distribución a no seguidores.`, 'Publica en tendencia: audio o tema del momento adaptado a tu nicho dentro de las primeras 48 h.'], 'reach');
    else if (d.reach != null && d.reach > 0.2)
      add('bien', 'Alcance en crecimiento', `+${pct(d.reach, 0)} contra el período anterior.`, ['Identifica qué piezas lo provocaron y conviértelas en serie.'], 'reach');
    if (c.saveRate != null && g('saveRate')?.level === 'low' && platform !== 'linkedin')
      add('media', 'Poco contenido "guardable"', `Tasa de guardados de ${pct(c.saveRate, 2)}.`,
        ['Crea carruseles de valor: guías, listas, pasos, errores comunes, comparativas.', 'Cierra con "Guárdalo para cuando lo necesites".'], 'saveRate');
    if (c.shareRate != null && g('shareRate')?.level === 'low')
      add('media', 'Poco contenido que se comparta', `Tasa de compartidos de ${pct(c.shareRate, 2)}.`,
        ['Haz contenido de identificación ("cuando tú…"), datos sorprendentes del sector y mitos vs. realidad.', 'Pregunta "¿a quién le enviarías esto?".'], 'shareRate');
    if (c.profileVisitRate != null && c.profileToFollow != null && g('profileToFollow')?.level === 'low')
      add('alta', 'El perfil no está convirtiendo', `Visitan el perfil pero solo ${pct(c.profileToFollow)} sigue la cuenta.`,
        ['Bio en 3 líneas: qué haces, para quién, qué gana al seguirte.', 'Fija 3 posts: quién eres, prueba social, oferta.', 'Ordena las destacadas como embudo: Empieza aquí → Servicios → Testimonios → Contacto.'], 'profileToFollow');
    if (c.bioCtr != null && g('bioCtr')?.level === 'low')
      add('media', 'Pocos clics al enlace', `CTR del enlace en bio: ${pct(c.bioCtr, 2)}.`,
        ['Un solo enlace con un beneficio claro ("Agenda tu cita en 1 minuto").', 'Menciona el enlace en historias con sticker de enlace, no solo en la bio.'], 'bioCtr');
    if (c.postsPerWeek != null && c.postsPerWeek < 2.5)
      add('media', 'Baja constancia', `${c.postsPerWeek.toFixed(1)} publicaciones por semana.`,
        ['Apunta a 3–5 por semana con una parrilla fija por días (ej.: lunes educativo, miércoles caso, viernes tendencia).', 'Graba en bloque: 1 sesión = contenido para 2 semanas.'], 'postsPerWeek');
    if (c.completionRate != null && g('completionRate')?.level === 'low')
      add('alta', 'Los videos pierden a la gente', `Solo ${pct(c.completionRate)} los ve completos.`,
        ['Gancho en el primer segundo: texto en pantalla + movimiento.', 'Corta silencios y "hola, bienvenidos". Ve directo al punto.', 'Prueba versiones de 7–15 s del mismo mensaje.'], 'completionRate');
    if (c.growthRate != null && c.growthRate < 0)
      add('alta', 'La cuenta está perdiendo seguidores', `Crecimiento neto negativo (${pct(c.growthRate, 2)}).`,
        ['Revisa si hubo cambio de temática o exceso de contenido promocional.', 'Vuelve al contenido de valor que te hizo crecer (top posts históricos).'], 'growthRate');

    if (posts && posts.length >= 6) {
      const ci = contentInsights(posts);
      if (ci.byType.length > 1) {
        const best = ci.byType[0], worst = ci.byType[ci.byType.length - 1];
        if (best.er > worst.er * 1.4)
          add('baja', `"${best.key}" es tu mejor formato`, `Tasa de interacción ${pct(best.er, 2)} vs ${pct(worst.er, 2)} de "${worst.key}".`,
            [`Sube la proporción de ${best.key} en la parrilla (que sea al menos 50%).`, `No elimines ${worst.key}: prueba cambiar su gancho antes de descartarlo.`], 'erReach');
      }
      if (ci.byWeekday.length >= 4) {
        const bd = ci.byWeekday[0];
        add('baja', `Tu mejor día es ${bd.key}`, `Promedio de interacción ${pct(bd.er, 2)} en ${bd.n} publicaciones.`, ['Reserva ese día para tus piezas más importantes (lanzamientos, ofertas).'], 'erReach');
      }
    }
    if (!out.length) add('bien', 'Todo en orden', 'Las métricas principales están dentro de rangos sanos.', ['Sube la vara: define una meta de crecimiento para los próximos 90 días.']);
    const order = { alta: 0, media: 1, baja: 2, bien: 3 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  // ── Planificador de crecimiento (embudo) ────────────────────
  /* Toma un objetivo (leads, seguidores, alcance o impresiones), un
     horizonte y las tasas reales de la cuenta, y devuelve lo que hace
     falta en cada etapa del embudo, cuánto aporta lo orgánico y
     cuánto presupuesto pagado cierra la diferencia. */
  function growthPlan({ objective, target, days, rates, organicPerDay }) {
    const r = Object.assign({ cpm: 3.5, ctr: 0.009, cvr: 0.08, frequency: 1.6, erReach: 0.04, followsPer1k: 3, profileVisitRate: 0.015 }, rates || {});
    const organic = Math.max(0, (organicPerDay || 0) * days);
    const gap = Math.max(0, target - organic);
    const stages = [];
    let budget = 0;
    if (objective === 'leads') {
      const clicks = gap / r.cvr, impressions = clicks / r.ctr, reach = impressions / r.frequency;
      budget = (impressions / 1000) * r.cpm;
      stages.push({ label: 'Alcance pagado necesario', value: reach }, { label: 'Impresiones', value: impressions },
        { label: `Clics (CTR ${M.format(r.ctr, 'pct', { decimals: 2 })})`, value: clicks }, { label: `Leads (conversión ${M.format(r.cvr, 'pct')})`, value: gap });
    } else if (objective === 'followers') {
      const reach = gap / (r.followsPer1k / 1000);
      const impressions = reach * r.frequency;
      budget = (impressions / 1000) * r.cpm * 0.6; // el impulso de contenido genera además alcance orgánico secundario
      stages.push({ label: 'Alcance necesario', value: reach }, { label: `Visitas al perfil (${M.format(r.profileVisitRate, 'pct')})`, value: reach * r.profileVisitRate },
        { label: `Seguidores (${r.followsPer1k.toFixed(1)} por 1.000)`, value: gap });
    } else if (objective === 'reach') {
      const impressions = gap * r.frequency;
      budget = (impressions / 1000) * r.cpm;
      stages.push({ label: 'Personas a alcanzar', value: gap }, { label: `Impresiones (frecuencia ${r.frequency.toFixed(1)})`, value: impressions });
    } else {
      budget = (gap / 1000) * r.cpm;
      stages.push({ label: 'Impresiones a comprar', value: gap });
    }
    const weeks = Math.max(1, Math.ceil(days / 7));
    return { objective, target, days, organic, gap, budget, perDay: budget / days, perWeek: budget / weeks, stages, rates: r,
             split: { awareness: 0.25, consideration: 0.35, conversion: 0.4 }, tactics: TACTICS[objective] || TACTICS.impressions };
  }

  const TACTICS = {
    leads: [
      ['Semana 1–2 · Atraer', 'Video corto educativo que plantee el problema (objetivo Interacción/Reproducciones). Crea audiencia de quienes vieron 50%+.'],
      ['Semana 2–3 · Convertir', 'Retargeting a esa audiencia con oferta clara + formulario instantáneo de 3 campos o clic a WhatsApp.'],
      ['Siempre', 'Responder leads en menos de 5 minutos: la probabilidad de cerrar cae fuerte después de la primera hora.'],
      ['Optimizar', 'Cada semana apaga el anuncio con peor CPL y duplica el ganador con un gancho nuevo.'],
    ],
    followers: [
      ['Contenido', '3 Reels/TikToks por semana con gancho en el primer segundo + 2 carruseles de valor "guardables".'],
      ['Distribución', 'Colaboraciones (posts colaborativos) con cuentas afines de tamaño similar: comparten audiencia.'],
      ['Perfil', 'Bio con propuesta de valor, 3 posts fijados y destacadas en orden de embudo.'],
      ['Pago', 'Impulsa los 2 posts con mejor tasa de interacción a audiencias similares (lookalike) de tus seguidores.'],
    ],
    reach: [
      ['Formato', 'Video vertical corto: es el formato con más distribución a no seguidores.'],
      ['Tendencias', 'Adapta 1 tendencia por semana a tu nicho en las primeras 48 h.'],
      ['Compartibles', 'Contenido de identificación y datos sorprendentes: cada compartido es alcance gratis.'],
      ['Pago', 'Campaña de Alcance con tope de frecuencia 2 cada 7 días a tu audiencia amplia.'],
    ],
    impressions: [
      ['Volumen', 'Sube la frecuencia de publicación de forma sostenida (historias diarias).'],
      ['Pago', 'Campaña de Reconocimiento optimizada a impresiones con 3–4 creatividades en rotación.'],
      ['Reutiliza', 'Convierte cada pieza en 3 formatos: Reel, carrusel e historia.'],
    ],
  };

  const api = { iso, parseISO, addDays, diffDays, summarize, computeAll, comparePeriods, latestDate, dailySeries,
                linearRegression, goalProgress, adCosts, adBoost, contentInsights, postER, diagnose, growthPlan, WEEKDAYS };
  root.PulsoAnalysis = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
