/* ─────────────────────────────────────────────────────────────
   Pulso · Analista IA (Claude)
   Opcional. Toma el resumen de métricas ya calculado por Pulso (no
   los datos crudos) y pide a Claude una lectura estratégica.
   La llave vive en el Llavero; la llamada sale por el puente nativo.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  const DEFAULT_MODEL = 'claude-opus-5-5';

  const SYSTEM = `Eres el analista de performance de un equipo de marketing digital en República Dominicana (sector financiero y marcas de servicios). Trabajas para alguien que domina estrategia de contenido, diseño UX/gráfico y publicidad, y quiere profundizar en la lectura de métricas.

Cómo respondes:
- En español dominicano neutro, directo, sin relleno ni formalidad artificial.
- Basa cada afirmación en los números que recibes; cita la cifra exacta. Si un dato no está, dilo en vez de suponer.
- Explica el "por qué" detrás de cada número (qué lo mueve, qué palanca lo cambia) para que la persona aprenda a leerlo sola.
- Distingue correlación de causalidad, y señala cuándo una muestra es demasiado pequeña para concluir.
- Prioriza: lo que más impacto tiene en leads, alcance y crecimiento primero.

Estructura (usa estos encabezados con ###):
### Lectura en 30 segundos
### Lo que dicen los números
### Diagnóstico (causas probables)
### Plan de 30 días (acciones concretas, con métrica y meta numérica por acción)
### Experimentos A/B sugeridos
### Qué vigilar la próxima semana`;

  async function analyze({ apiKey, model, payload, question, http }) {
    if (!apiKey) throw new Error('Falta la API key de Claude (Ajustes → Analista IA).');
    const headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      // Si el modelo rechaza la solicitud por sus filtros, la API reintenta con otro modelo adecuado
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    };
    if (!(root.PulsoPlatform && root.PulsoPlatform.native)) headers['anthropic-dangerous-direct-browser-access'] = 'true';
    const body = {
      model: model || DEFAULT_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `${question ? question + '\n\n' : 'Analiza estas cuentas y dame el plan.\n\n'}Datos (JSON, calculados por Pulso; tasas en proporción 0–1, montos en USD):\n${JSON.stringify(payload)}` }],
    };
    const res = await http('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    const j = res.json;
    if (!res.ok) throw new Error((j && j.error && j.error.message) || `Error de la API de Claude (HTTP ${res.status})`);
    if (j.stop_reason === 'refusal') throw new Error('Claude no pudo responder esta solicitud. Prueba reformulando la pregunta.');
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return { text, truncated: j.stop_reason === 'max_tokens', model: j.model };
  }

  /* Resumen compacto que se envía: métricas del período, variación y
     diagnóstico de reglas, más los mejores posts. Sin tokens ni datos personales. */
  function buildPayload(state, accountIds, days) {
    const A = root.PulsoAnalysis, M = root.PulsoMetrics;
    const out = { periodo_dias: days, fecha: A.iso(new Date()), cuentas: [], metas: [] };
    for (const id of accountIds) {
      const a = state.accounts.find(x => x.id === id);
      if (!a) continue;
      const rows = state.series[id] || [];
      const cmp = A.comparePeriods(rows, a.platform, days);
      const metrics = {};
      for (const [k, v] of Object.entries(cmp.current)) if (v != null) metrics[k] = { valor: round(v), anterior: round(cmp.previous[k]), variacion: round(cmp.delta[k]), referencia: (M.grade(M.byKey[k], v, a.platform) || {}).label };
      const ci = A.contentInsights(state.posts[id] || []);
      out.cuentas.push({
        nombre: a.name, plataforma: M.PLATFORMS[a.platform].label, responsable: a.owner, metricas: metrics,
        diagnostico_reglas: A.diagnose(a, rows, state.posts[id]).map(d => `${d.severity}: ${d.title} — ${d.detail}`),
        contenido: ci.n ? { publicaciones: ci.n, interaccion_promedio: round(ci.avgER), por_formato: ci.byType.map(t => ({ formato: t.key, n: t.n, interaccion: round(t.er), alcance_prom: Math.round(t.avgReach) })),
          por_dia: ci.byWeekday.map(t => ({ dia: t.key, n: t.n, interaccion: round(t.er) })), top: ci.top.map(p => ({ fecha: p.date, formato: p.type, texto: p.caption, alcance: p.reach, interaccion: round(p.er), guardados: p.saves, compartidos: p.shares })) } : null,
        campanas: (state.campaigns[id] || []).map(c => ({ nombre: c.name, objetivo: c.objective, gasto: c.spend, impresiones: c.impressions, frecuencia: c.frequency, clics: c.linkClicks, leads: c.leads })),
      });
      for (const g of state.goals.filter(g => g.accountId === id)) {
        const p = A.goalProgress(g, rows, a.platform, null, adsRowsFor(state));
        if (p) out.metas.push({ meta: g.title, metrica: p.metric.label, actual: round(p.current), objetivo: g.target, proyeccion: round(p.projected), estado: p.status, dias_restantes: p.remaining });
      }
    }
    return out;
  }
  function adsRowsFor(state) { const ads = state.accounts.find(a => a.platform === 'meta_ads'); return ads ? state.series[ads.id] || [] : []; }
  function round(v) { return v == null || !isFinite(v) ? null : Math.abs(v) < 10 ? +v.toFixed(4) : Math.round(v); }

  /* Markdown mínimo → HTML seguro (encabezados, listas, negritas) */
  function render(md) {
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    let html = '', inList = false;
    for (const raw of md.split('\n')) {
      const l = raw.trimEnd();
      const li = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
      if (inList) { html += '</ul>'; inList = false; }
      const h = l.match(/^#{1,4}\s+(.*)/);
      if (h) html += `<h3>${inline(h[1])}</h3>`;
      else if (l.trim()) html += `<p>${inline(l)}</p>`;
    }
    if (inList) html += '</ul>';
    return html;
  }

  root.PulsoAI = { analyze, buildPayload, render, DEFAULT_MODEL };
})(typeof window !== 'undefined' ? window : globalThis);
