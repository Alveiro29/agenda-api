/* ─────────────────────────────────────────────────────────────
   Pulso · Gráficas (SVG, sin dependencias)
   Línea con cruz de lectura y tooltip, sparkline y barras.
   Los colores salen de variables CSS (--series-1, --grid, …) para
   que el modo oscuro funcione sin tocar nada aquí.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';
  const M = root.PulsoMetrics;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function niceTicks(min, max, count = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  const shortDate = d => { const [, m, day] = d.split('-'); return `${+day}/${+m}`; };

  /* series: [{ name, points:[{x:'YYYY-MM-DD'|number, y}], color:'var(--series-1)', dashed, width }]
     opts: { unit, decimals, height, xLabel: fn, zeroBased, markers } */
  function line(el, series, opts = {}) {
    const W = Math.max(320, el.clientWidth || 640), H = opts.height || 240;
    const pad = { l: 56, r: 16, t: 14, b: 28 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const all = series.flatMap(s => s.points.filter(p => p.y != null && isFinite(p.y)));
    if (!all.length) { el.innerHTML = `<div class="empty-chart">Sin datos para graficar en este período.</div>`; return; }
    // Eje X por índice de la serie principal (las demás se alinean por posición)
    const n = Math.max(...series.map(s => s.points.length));
    let ymin = Math.min(...all.map(p => p.y)), ymax = Math.max(...all.map(p => p.y));
    if (opts.zeroBased !== false && ymin > 0 && ymin < ymax * 0.6) ymin = 0;
    const ticks = niceTicks(ymin, ymax);
    ymin = ticks[0]; ymax = ticks[ticks.length - 1];
    const x = i => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = v => pad.t + ih - ((v - ymin) / (ymax - ymin || 1)) * ih;
    const fmt = v => M.format(v, opts.unit || 'n', { decimals: opts.decimals });
    const xl = opts.xLabel || (p => (typeof p.x === 'string' ? shortDate(p.x) : p.x));

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opts.label || 'Gráfica')}">`;
    for (const t of ticks) svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${esc(fmt(t))}</text>`;
    const main = series[0].points;
    const every = Math.max(1, Math.ceil(n / Math.floor(iw / 64)));
    main.forEach((p, i) => { if (i % every === 0 || i === n - 1) svg += `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(xl(p))}</text>`; });
    series.forEach((s, si) => {
      let d = '', pen = false;
      s.points.forEach((p, i) => {
        if (p.y == null || !isFinite(p.y)) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`; pen = true;
      });
      svg += `<path d="${d}" fill="none" stroke="${s.color || `var(--series-${si + 1})`}" stroke-width="${s.width || 2}" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (opts.markers || s.markers) s.points.forEach((p, i) => { if (p.y != null) svg += `<circle cx="${x(i)}" cy="${y(p.y)}" r="4" fill="${s.color || `var(--series-${si + 1})`}" stroke="var(--surface)" stroke-width="2"/>`; });
    });
    svg += `<line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}" style="display:none"/>`;
    series.forEach((s, si) => { svg += `<circle class="hover-dot" data-s="${si}" r="4.5" fill="${s.color || `var(--series-${si + 1})`}" stroke="var(--surface)" stroke-width="2" style="display:none"/>`; });
    svg += `<rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/></svg>`;

    const legend = series.length > 1 ? `<div class="legend">${series.map((s, si) => `<span><i style="background:${s.color || `var(--series-${si + 1})`};${s.dashed ? 'opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    el.innerHTML = `<div class="chart-wrap">${legend}${svg}<div class="tooltip" style="display:none"></div></div>`;

    const root = el.querySelector('svg'), tip = el.querySelector('.tooltip'), cross = el.querySelector('.crosshair');
    const dots = [...el.querySelectorAll('.hover-dot')];
    el.querySelector('.hit').addEventListener('mousemove', ev => {
      const r = root.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
      let rowsHtml = '';
      series.forEach((s, si) => {
        const p = s.points[i];
        if (!p || p.y == null) { dots[si].style.display = 'none'; return; }
        dots[si].setAttribute('cx', x(i)); dots[si].setAttribute('cy', y(p.y)); dots[si].style.display = '';
        rowsHtml += `<div><i style="background:${s.color || `var(--series-${si + 1})`}"></i>${esc(s.name)} <b>${esc(fmt(p.y))}</b>${p.label ? ` <span class="muted">${esc(p.label)}</span>` : ''}</div>`;
      });
      const p0 = main[i] || series.find(s => s.points[i])?.points[i];
      tip.innerHTML = `<div class="tip-h">${esc(p0 ? (opts.tipLabel ? opts.tipLabel(p0) : (typeof p0.x === 'string' ? p0.x : xl(p0))) : '')}</div>${rowsHtml}`;
      tip.style.display = '';
      const left = (x(i) / W) * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + 'px';
      tip.style.top = '8px';
    });
    el.querySelector('.hit').addEventListener('mouseleave', () => { tip.style.display = 'none'; cross.style.display = 'none'; dots.forEach(d => (d.style.display = 'none')); });
  }

  function spark(points, opts = {}) {
    const W = opts.width || 120, H = opts.height || 32;
    const v = points.map(p => p.y).filter(y => y != null && isFinite(y));
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v);
    const xs = i => (i / (points.length - 1)) * (W - 4) + 2;
    const ys = y => H - 3 - ((y - min) / (max - min || 1)) * (H - 6);
    let d = '', pen = false;
    points.forEach((p, i) => { if (p.y == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`; pen = true; });
    const last = points.length - 1;
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${opts.color || 'var(--series-1)'}" stroke-width="1.6" stroke-linejoin="round"/>${points[last].y != null ? `<circle cx="${xs(last)}" cy="${ys(points[last].y)}" r="2.6" fill="${opts.color || 'var(--series-1)'}"/>` : ''}</svg>`;
  }

  /* items: [{label, value, note}] → barras horizontales en HTML */
  function bars(items, opts = {}) {
    if (!items.length) return '<div class="empty-chart">Sin datos.</div>';
    const max = Math.max(...items.map(i => i.value || 0)) || 1;
    return `<div class="bars">${items.map((it, i) => `
      <div class="bar-row" title="${esc(it.label)}: ${esc(M.format(it.value, opts.unit || 'n', { decimals: opts.decimals }))}">
        <span class="bar-label">${esc(it.label)}</span>
        <span class="bar-track"><span class="bar" style="width:${Math.max(2, (it.value / max) * 100)}%;background:${it.color || (i === 0 && opts.highlightFirst ? 'var(--series-1)' : 'var(--series-1-soft)')}"></span></span>
        <span class="bar-val">${esc(M.format(it.value, opts.unit || 'n', { decimals: opts.decimals }))}${it.note ? `<small> ${esc(it.note)}</small>` : ''}</span>
      </div>`).join('')}</div>`;
  }

  /* Anillo de puntaje 0–100 */
  function ring(score, size = 96) {
    const r = size / 2 - 7, c = 2 * Math.PI * r;
    const cls = score >= 80 ? 'good' : score >= 55 ? 'warn' : 'bad';
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Puntaje ${score} de 100">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="7" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="7" fill="none" stroke-dasharray="${(score / 100) * c} ${c}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" class="ring-txt">${score}</text></svg>`;
  }

  root.PulsoCharts = { line, spark, bars, ring, niceTicks, esc };
})(typeof window !== 'undefined' ? window : globalThis);
