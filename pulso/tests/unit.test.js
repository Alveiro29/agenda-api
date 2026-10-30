// Pruebas de la lógica de Pulso (sin navegador).  Ejecutar:  node --test pulso/tests
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const js = f => path.join(__dirname, '..', 'web', 'js', f);
const M = require(js('metrics.js'));
const A = require(js('analysis.js'));
const C = require(js('connectors.js'));
const S = require(js('store.js'));
const D = require(js('demo.js'));

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('fórmulas de publicidad: CPM, CTR de enlace, CPC, CPL, frecuencia', () => {
  const rows = [
    { date: '2026-10-01', spend: 50, impressions: 10000, reach: 5000, clicks: 200, linkClicks: 100, leads: 10 },
    { date: '2026-10-02', spend: 50, impressions: 15000, reach: 5000, clicks: 250, linkClicks: 150, leads: 15 },
  ];
  const t = A.summarize(rows, '2026-10-01', '2026-10-02');
  const v = A.computeAll(t, 'meta_ads');
  close(v.cpm, 4);              // 100 / 25.000 × 1.000
  close(v.ctr, 250 / 25000);    // usa clics de ENLACE, no todos los clics
  close(v.cpc, 100 / 250);
  close(v.cpl, 4);
  close(v.cvr, 25 / 250);
  close(v.frequency, 2.5);
  assert.equal(v.erReach, undefined, 'la tasa de interacción orgánica no aplica a anuncios');
});

test('seguidores es un saldo (último valor) y el crecimiento usa el cierre del período anterior', () => {
  const rows = [
    { date: '2026-09-30', followers: 1000 },
    { date: '2026-10-01', followers: 1010, reach: 500, engagements: 20, posts: 1 },
    { date: '2026-10-02', followers: 1030, reach: 1500, engagements: 60, posts: 1 },
  ];
  const v = A.computeAll(A.summarize(rows, '2026-10-01', '2026-10-02'), 'instagram');
  assert.equal(v.followers, 1030);
  assert.equal(v.netFollowers, 30);
  close(v.growthRate, 0.03);
  close(v.erReach, 80 / 2000);
  close(v.followsPer1k, 15);
  close(v.erFollowers, 40 / 1020, 1e-9); // interacciones por post ÷ seguidores promedio
});

test('comparePeriods: las tasas comparan en puntos porcentuales y los totales en %', () => {
  const rows = [];
  for (let i = 0; i < 14; i++) rows.push({ date: A.addDays('2026-10-01', i), reach: i < 7 ? 1000 : 1500, engagements: i < 7 ? 20 : 45 });
  const c = A.comparePeriods(rows, 'instagram', 7, '2026-10-14');
  close(c.delta.reach, 0.5);
  close(c.delta.erReach, 0.03 - 0.02);
});

test('posición promedio ponderada por impresiones', () => {
  const rows = C.adaptRows([{ date: '2026-10-01', clicks: 10, impressions: 100, position: 2 }, { date: '2026-10-02', clicks: 0, impressions: 900, position: 30 }], 'web');
  assert.equal(rows[0].searchClicks, 10);
  assert.equal(rows[0].clicks, undefined);
  const v = A.computeAll(A.summarize(rows, '2026-10-01', '2026-10-02'), 'web');
  close(v.avgPosition, (2 * 100 + 30 * 900) / 1000);
  close(v.searchCtr, 10 / 1000);
});

test('regresión lineal', () => {
  const r = A.linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
  close(r.slope, 2); close(r.intercept, 1); close(r.r2, 1);
  assert.equal(A.linearRegression([{ x: 0, y: 1 }]), null);
});

test('parseNumber entiende formatos latinos y gringos', () => {
  assert.equal(C.parseNumber('1,234'), 1234);
  assert.equal(C.parseNumber('1.234'), 1234);
  assert.equal(C.parseNumber('1.234,5'), 1234.5);
  assert.equal(C.parseNumber('1,234.5'), 1234.5);
  assert.equal(C.parseNumber('12,5%'), 0.125);
  assert.equal(C.parseNumber('2.5K'), 2500);
  assert.equal(C.parseNumber('US$3.20'), 3.2);
  assert.equal(C.parseNumber('7.125', { decimal: true }), 7.125);
  assert.equal(C.parseNumber('--'), null);
});

test('parseDate: ISO, DD/MM, MM/DD, nombres de mes sin año', () => {
  assert.equal(C.parseDate('2026-10-05'), '2026-10-05');
  assert.equal(C.parseDate('05/10/2026', { dayFirst: true }), '2026-10-05');
  assert.equal(C.parseDate('10/05/2026', { dayFirst: false }), '2026-10-05');
  assert.equal(C.parseDate('5 de octubre de 2026'), '2026-10-05');
  assert.equal(C.parseDate('Oct 5, 2026'), '2026-10-05');
  assert.equal(C.parseDate('December 30', { today: '2026-10-24T12:00:00' }), '2025-12-30');
  assert.equal(C.detectDayFirst(['01/02/2026', '25/02/2026']), true);
  assert.equal(C.detectDayFirst(['02/25/2026']), false);
});

test('importa un export de TikTok Studio en español', () => {
  const csv = '﻿Fecha,Visualizaciones de videos,Visualizaciones del perfil,Me gusta,Comentarios,Veces compartido\n"5 de octubre de 2026","12.345",210,"1.020",33,57\n"6 de octubre de 2026","9.876",180,850,20,41\n';
  const r = C.importCSV(csv);
  assert.equal(r.kind, 'daily');
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { date: '2026-10-05', views: 12345, profileVisits: 210, likes: 1020, comments: 33, shares: 57 });
});

test('importa Ads Manager (punto y coma, varias filas por día se suman)', () => {
  const csv = 'Inicio del informe;Importe gastado (USD);Impresiones;Alcance;Clics en el enlace;Clientes potenciales\n2026-10-01;10,50;1000;800;12;2\n2026-10-01;5,25;500;450;6;1\n';
  const r = C.importCSV(csv);
  assert.equal(r.rows.length, 1);
  close(r.rows[0].spend, 15.75);
  assert.equal(r.rows[0].impressions, 1500);
  assert.equal(r.rows[0].linkClicks, 18);
  assert.equal(r.rows[0].leads, 3);
});

test('reconoce el export de Consultas de Search Console', () => {
  const csv = 'Consultas principales,Clics,Impresiones,CTR,Posición\npréstamo personal,412,"18,400",2.24%,6.8\ncuenta de ahorro,133,7400,1.8%,8.93\n';
  const r = C.importCSV(csv);
  assert.equal(r.kind, 'gsc');
  assert.equal(r.rows[0].query, 'préstamo personal');
  assert.equal(r.rows[0].impressions, 18400);
  close(r.rows[0].ctr, 0.0224);
  close(r.rows[1].position, 8.93);
});

test('Meta: no cuenta dos veces lead + lead_grouped', () => {
  const actions = [{ action_type: 'lead', value: '7' }, { action_type: 'onsite_conversion.lead_grouped', value: '7' }, { action_type: 'link_click', value: '90' }];
  assert.equal(C.actionSum(actions, ['lead', 'onsite_conversion.lead_grouped']), 7);
});

test('metas: acumulativa, proyección y presupuesto solo por la brecha que lo orgánico no cubre', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ date: A.addDays('2026-10-01', i), spend: 10, impressions: 4000, reach: 3000, linkClicks: 40, leads: 4 });
  const g = { metric: 'leads', target: 200, startDate: '2026-10-01', deadline: '2026-11-29' };
  const p = A.goalProgress(g, rows, 'meta_ads', '2026-10-30', rows);
  assert.equal(p.current, 120);
  close(p.pacePerDay, 4);
  assert.equal(p.remaining, 30);
  assert.equal(p.projected, 240);
  assert.equal(p.status, 'en_ruta');
  assert.equal(p.adPlan, null, 'si va en ruta no hace falta pauta extra');
  const p2 = A.goalProgress({ ...g, target: 400 }, rows, 'meta_ads', '2026-10-30', rows);
  assert.notEqual(p2.status, 'en_ruta');
  close(p2.adPlan.budget, (400 - 240) * 2.5, 1e-6); // CPL real = 10/4
});

test('diagnóstico detecta fatiga creativa en anuncios', () => {
  const rows = [];
  for (let i = 0; i < 28; i++) rows.push({ date: A.addDays('2026-10-01', i), spend: 20, impressions: 5000, reach: 1000, linkClicks: 60, leads: 5 });
  const d = A.diagnose({ id: 'x', name: 'Ads', platform: 'meta_ads' }, rows, [], 28);
  assert.ok(d.some(x => x.title === 'Fatiga creativa'));
});

test('fusión de datos compartidos: une series por fecha, respeta borrados y gana lo más reciente', () => {
  const base = S.empty();
  base.accounts = [{ id: 'a1', name: 'IG', platform: 'instagram', updatedAt: 1 }, { id: 'a2', name: 'Borrar', platform: 'tiktok', updatedAt: 1 }];
  const mine = JSON.parse(JSON.stringify(base));
  const theirs = JSON.parse(JSON.stringify(base));
  mine.series.a1 = [{ date: '2026-10-01', reach: 100 }];
  theirs.series.a1 = [{ date: '2026-10-01', followers: 50 }, { date: '2026-10-02', reach: 300 }];
  theirs.accounts[0] = { ...theirs.accounts[0], name: 'IG nuevo', updatedAt: 5 };
  mine.accounts = mine.accounts.filter(a => a.id !== 'a2'); mine.deleted.a2 = 10;
  theirs.goals = [{ id: 'g1', accountId: 'a1', metric: 'reach', target: 1, updatedAt: 3 }];
  const m = S.merge(mine, theirs);
  assert.equal(m.accounts.length, 1);
  assert.equal(m.accounts[0].name, 'IG nuevo');
  assert.deepEqual(m.series.a1, [{ date: '2026-10-01', followers: 50, reach: 100 }, { date: '2026-10-02', reach: 300 }]);
  assert.equal(m.goals.length, 1);
});

test('el store fusiona en vez de pisar cuando la otra persona guardó antes', async () => {
  // Plataforma falsa: un "archivo" compartido con fecha de modificación
  const disk = { text: null, mtime: 0 };
  const platform = {
    async readData() { return { text: disk.text, mtime: disk.mtime }; },
    async writeData(text, expected) {
      if (disk.mtime && expected !== disk.mtime) return { ok: false, conflict: true, text: disk.text, mtime: disk.mtime };
      disk.text = text; disk.mtime += 1; return { ok: true, mtime: disk.mtime };
    },
  };
  const jose = S.Store(platform), socio = S.Store(platform);
  await jose.load(); await socio.load();
  jose.addAccount({ id: 'ig', name: 'IG', platform: 'instagram' }); await jose.flush();
  socio.addAccount({ id: 'tt', name: 'TT', platform: 'tiktok' }); await socio.flush();
  const final = JSON.parse(disk.text);
  assert.deepEqual(final.accounts.map(a => a.id).sort(), ['ig', 'tt']);
});

test('los datos de demostración calculan sin errores en todas las métricas y metas', () => {
  const st = S.empty();
  D.apply(st, '2026-10-23');
  assert.equal(st.accounts.length, 8);
  for (const a of st.accounts) {
    const c = A.comparePeriods(st.series[a.id], a.platform, 28);
    for (const [k, v] of Object.entries(c.current)) if (v != null) assert.ok(isFinite(v), `${a.id}.${k}`);
    assert.ok(A.diagnose(a, st.series[a.id], st.posts[a.id]).length > 0);
  }
  for (const g of st.goals) {
    const a = st.accounts.find(x => x.id === g.accountId);
    const p = A.goalProgress(g, st.series[a.id], a.platform, '2026-10-23', st.series.demo_ads);
    assert.ok(['logrado', 'en_ruta', 'en_riesgo', 'fuera_de_ruta', 'vencido'].includes(p.status));
  }
  D.remove(st);
  assert.equal(st.accounts.length, 0);
});

test('cada métrica del catálogo tiene explicación, fórmula y trampa', () => {
  for (const m of M.METRICS) {
    assert.ok(m.label && m.formula && m.what && m.trap, m.key);
    assert.ok(['level', 'cumulative', 'rate'].includes(m.goal), m.key);
  }
  assert.equal(M.grade(M.byKey.ctr, 0.02, 'meta_ads').level, 'great');
  assert.equal(M.grade(M.byKey.cpm, 8, 'meta_ads').level, 'low');
  assert.equal(M.grade(M.byKey.frequency, 5, 'meta_ads').level, 'high');
});

test('medición pública de Instagram: Business Discovery → filas diarias y posts', () => {
  const bd = { username: 'banco', followers_count: 50000, media_count: 900, media: { data: [
    { id: '1', timestamp: '2026-10-20T14:00:00+0000', like_count: 300, comments_count: 20, media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED' },
    { id: '2', timestamp: '2026-10-20T20:00:00+0000', like_count: 100, comments_count: 5, media_type: 'VIDEO', media_product_type: 'REELS' },
    { id: '3', timestamp: '2026-10-22T10:00:00+0000', like_count: 50, comments_count: 0, media_type: 'IMAGE' } ] } };
  const pub = C.normalizeInstagramPublic(bd);
  assert.equal(pub.official, true);
  const d = C.instagramPublicToData(pub, '2026-10-30');
  const byDate = Object.fromEntries(d.rows.map(r => [r.date, r]));
  assert.equal(byDate['2026-10-30'].followers, 50000);
  assert.deepEqual(byDate['2026-10-20'], { date: '2026-10-20', posts: 2, likes: 400, comments: 25, engagements: 425 });
  assert.equal(d.posts[1].type, 'Reel');
  close(A.postER(d.posts[0]), 320 / 50000); // sin alcance, la base son los seguidores
});

test('medición pública de Instagram: respaldo con el JSON del perfil web', () => {
  const web = { data: { user: { username: 'comp', full_name: 'Comp', edge_followed_by: { count: 1234 }, edge_owner_to_timeline_media: { count: 77, edges: [
    { node: { id: '9', shortcode: 'abc', taken_at_timestamp: 1793000000, edge_liked_by: { count: 40 }, edge_media_to_comment: { count: 3 }, __typename: 'GraphSidecar' } }] } } } };
  const pub = C.normalizeInstagramPublic(web);
  assert.equal(pub.official, false);
  assert.equal(pub.followers, 1234);
  assert.equal(pub.posts[0].type, 'Carrusel');
  assert.equal(pub.posts[0].permalink, 'https://www.instagram.com/p/abc/');
  assert.equal(C.normalizeInstagramPublic({ status: 'fail' }), null);
});

test('medición pública de TikTok: lee el perfil y calcula lo nuevo contra la medición anterior', () => {
  const data = { __DEFAULT_SCOPE__: { 'webapp.user-detail': { userInfo: { user: { uniqueId: 'banco' }, stats: { followerCount: 8100, heartCount: 250000, videoCount: 120 } } } } };
  const html = `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script></html>`;
  const st = C.parseTikTokProfile(html);
  assert.deepEqual(st, { username: 'banco', name: undefined, followers: 8100, hearts: 250000, videos: 120 });
  const first = C.tiktokPublicToRows(st, [], '2026-10-29');
  assert.equal(first[0].likes, undefined, 'la primera medición no tiene contra qué comparar');
  const second = C.tiktokPublicToRows({ ...st, followers: 8150, hearts: 251500, videos: 122 }, first, '2026-10-30');
  assert.equal(second[0].likes, 1500);
  assert.equal(second[0].posts, 2);
  assert.equal(C.parseTikTokProfile('<html>captcha</html>'), null);
});

test('diagnóstico explica los límites de una cuenta medida sin sesión', () => {
  const rows = [{ date: '2026-10-29', followers: 1000 }, { date: '2026-10-30', followers: 1010, posts: 1, likes: 5, comments: 0, engagements: 5 }];
  const d = A.diagnose({ id: 'b', name: 'Banco', platform: 'instagram', source: 'public' }, rows, [], 28);
  assert.ok(d.some(x => x.title === 'Medida con datos públicos'));
});
