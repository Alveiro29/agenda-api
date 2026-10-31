// Recorrido de la interfaz en un navegador real (Playwright/Chromium).
// Ejecutar:  node pulso/tests/e2e.js      (necesita `playwright` instalado)
const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'web', 'index.html'));

  // Cuentas creadas antes de existir los clientes: el asistente las organiza solo
  await page.evaluate(() => {
    const S = PulsoApp.S;
    S.addAccount({ platform: 'facebook', name: 'Banco Ademi', meta: { pageId: '11' } });
    S.addAccount({ platform: 'instagram', name: '@bancoademi', handle: '@bancoademi' });
    S.addAccount({ platform: 'instagram', name: '@drakatherin', handle: '@drakatherin' });
    S.addAccount({ platform: 'facebook', name: 'Dra Katherin Almonte', meta: { pageId: '22' } });
  });
  await page.click('[data-nav=ajustes]');
  await page.click('[data-act=organize]');
  assert.equal(await page.locator('#org-names input').count(), 2, 'propone 2 clientes');
  await page.click('[data-save]');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.client-card').count(), 2);
  for (const id of await page.evaluate(() => PulsoApp.S.state.accounts.map(a => a.id))) await page.evaluate(i => PulsoApp.S.removeAccount(i), id);
  for (const id of await page.evaluate(() => PulsoApp.S.state.clients.map(c => c.id))) await page.evaluate(i => PulsoApp.S.removeClient(i), id);
  await page.click('[data-nav=resumen]');

  await page.click('text=Ver con datos de demostración');
  await page.waitForSelector('.acc-card');
  assert.equal(await page.locator('.acc-card').count(), 6);

  // Cada sección y cada pestaña de una cuenta se dibuja sin errores
  for (const v of ['metas', 'estratega', 'seo', 'academia', 'ajustes', 'resumen']) {
    await page.click(`[data-nav=${v}]`);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('text=Algo falló').count(), 0, v);
  }
  await page.click('[data-account=demo_ig]');
  for (const t of ['tendencias', 'contenido', 'diagnostico', 'datos', 'metricas']) {
    await page.click(`[data-act=tab][data-tab=${t}]`);
    await page.waitForTimeout(150);
  }
  assert.ok(await page.locator('.info-btn').count() > 5);
  await page.locator('.info-btn').first().click();
  assert.equal(await page.locator('.pop').count(), 1);

  // Importar un CSV pegado
  await page.click('[data-act=tab][data-tab=datos]');
  await page.click('summary');
  await page.fill('#csv-text', 'Fecha,Alcance,Seguidores\n2030-01-01,999,30000\n');
  await page.click('[data-act=import-csv]');
  await page.waitForTimeout(200);
  assert.ok(await page.locator('td', { hasText: '2030-01-01' }).count() > 0, 'la fila importada aparece');

  // Clientes: tarjetas en "Todos" y al abrir uno todo se filtra
  await page.click('[data-nav=resumen]');
  assert.equal(await page.locator('.client-card').count(), 3);
  await page.click('.client-card[data-id=demo_cli_banco]');
  await page.waitForTimeout(150);
  assert.equal(await page.textContent('#title'), 'Banco (demo)');
  assert.equal(await page.locator('.acc-card').count(), 4, 'solo las cuentas propias del banco');
  await page.click('[data-nav=comparativa]');
  assert.equal(await page.locator('text=Marca · TikTok').count(), 0, 'la comparativa no mezcla clientes');
  assert.ok(await page.locator('text=Competidor A · Instagram').count() > 0);
  await page.selectOption('#client', 'todos');

  // Comparativa y alta de una cuenta pública (sin red: solo el formulario)
  await page.click('[data-nav=comparativa]');
  await page.waitForTimeout(150);
  assert.ok(await page.locator('text=Competidor A · Instagram').count() > 0);
  await page.click('[data-act=add-competitor]');
  assert.equal(await page.locator('[name=source]').inputValue(), 'public');
  await page.selectOption('[name=platform]', 'facebook');
  assert.equal(await page.locator('[name=source]').isDisabled(), true, 'Facebook no tiene medición pública');
  await page.keyboard.press('Escape');

  // No permite duplicar una cuenta
  await page.click('[data-nav=resumen]');
  await page.click('[data-act=add-account] >> nth=0');
  await page.selectOption('[name=platform]', 'instagram');
  await page.fill('[name=handle]', 'https://instagram.com/competidor.a/');
  await page.click('[data-save]');
  await page.waitForTimeout(150);
  assert.equal(await page.textContent('#title'), 'Competidor A · Instagram', 'abre la cuenta existente');
  assert.equal(await page.evaluate(() => PulsoApp.S.state.accounts.filter(a => (a.handle || '').toLowerCase().includes('competidor.a')).length), 1);

  // Planificador
  await page.click('[data-nav=estratega]');
  await page.click('[data-act=plan]');
  assert.ok(await page.locator('.funnel .stage').count() >= 2);

  // Crear una meta
  await page.click('[data-nav=metas]');
  const before = await page.locator('.ad-plan, .goal-stats').count();
  await page.click('[data-act=new-goal] >> nth=0');
  await page.fill('[name=target]', '50000');
  await page.click('[data-save]');
  await page.waitForTimeout(200);
  assert.ok(await page.locator('.goal-stats').count() > 0 && (await page.locator('.ad-plan, .goal-stats').count()) > before);

  // Auditor SEO sobre un HTML de prueba (sin red)
  const audit = await page.evaluate(() => {
    const html = `<!doctype html><html lang="es"><head><title>Préstamo personal en RD | Tasa desde 12% — Banco</title>
      <meta name="description" content="Solicita tu préstamo personal en línea en minutos. Tasas competitivas, respuesta en 24 horas y sin papeleo. Calcula tu cuota y aplica hoy mismo.">
      <meta name="viewport" content="width=device-width"><link rel="canonical" href="https://ejemplo.com/prestamo-personal">
      <meta property="og:title" content="x"><script type="application/ld+json">{"@type":"FAQPage"}</script></head>
      <body><h1>Préstamo personal</h1><h2>Requisitos</h2><h4>Salto</h4><p>${'El préstamo personal ideal. '.repeat(80)}</p><img src="a.jpg"></body></html>`;
    return PulsoSEO.auditHTML(html, 'https://ejemplo.com/prestamo-personal', 'préstamo personal');
  });
  const byId = Object.fromEntries(audit.checks.map(c => [c.id, c.status]));
  assert.equal(byId.title, 'pass');
  assert.equal(byId['kw-title'], 'pass');
  assert.equal(byId.desc, 'pass');
  assert.equal(byId.hierarchy, 'warn');
  assert.equal(byId['img-alt'], 'fail');
  assert.equal(byId.schema, 'pass');
  assert.equal(byId.index, 'pass');
  assert.ok(audit.score > 40 && audit.score < 95, 'puntaje ' + audit.score);

  const noindex = await page.evaluate(() => PulsoSEO.auditHTML('<html><head><meta name="robots" content="noindex"></head><body></body></html>', 'http://x.com', ''));
  assert.equal(noindex.checks.find(c => c.id === 'index').status, 'fail');

  assert.deepEqual(errors, []);
  console.log('e2e OK');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
