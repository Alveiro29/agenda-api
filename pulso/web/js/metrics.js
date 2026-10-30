/* ─────────────────────────────────────────────────────────────
   Pulso · Catálogo de métricas
   Cada métrica sabe: cómo se calcula, qué significa, contra qué
   compararla y qué trampa evitar al leerla. Es la "fuente de verdad"
   que usan el tablero, las metas, el diagnóstico y la Academia.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const PLATFORMS = {
    instagram: { label: 'Instagram', short: 'IG', color: '#e87ba4' },
    facebook:  { label: 'Facebook',  short: 'FB', color: '#2a78d6' },
    tiktok:    { label: 'TikTok',    short: 'TT', color: '#1baf7a' },
    linkedin:  { label: 'LinkedIn',  short: 'IN', color: '#6250d6' },
    meta_ads:  { label: 'Meta Ads',  short: 'Ads', color: '#eb6834' },
    web:       { label: 'Sitio web / SEO', short: 'WEB', color: '#eda100' },
  };

  /* Campos crudos que guardamos por día (una fila = un día).
     agg: cómo se resume un período.
       sum  → se suma (clics, gasto, interacciones)
       last → se toma el último valor (seguidores: es un saldo, no un flujo)  */
  const FIELDS = {
    followers:      { label: 'Seguidores',               agg: 'last' },
    newFollowers:   { label: 'Seguidores nuevos',        agg: 'sum' },
    reach:          { label: 'Alcance',                  agg: 'sum' },
    impressions:    { label: 'Impresiones',              agg: 'sum' },
    views:          { label: 'Visualizaciones',          agg: 'sum' },
    profileVisits:  { label: 'Visitas al perfil',        agg: 'sum' },
    websiteClicks:  { label: 'Clics al sitio (perfil)',  agg: 'sum' },
    engagements:    { label: 'Interacciones',            agg: 'sum' },
    likes:          { label: 'Me gusta / reacciones',    agg: 'sum' },
    comments:       { label: 'Comentarios',              agg: 'sum' },
    shares:         { label: 'Compartidos',              agg: 'sum' },
    saves:          { label: 'Guardados',                agg: 'sum' },
    posts:          { label: 'Publicaciones',            agg: 'sum' },
    fullViews:      { label: 'Vistas completas',         agg: 'sum' },
    watchTimeSec:   { label: 'Tiempo de reproducción (s)', agg: 'sum' },
    spend:          { label: 'Inversión',                agg: 'sum' },
    clicks:         { label: 'Clics (todos)',            agg: 'sum' },
    linkClicks:     { label: 'Clics en el enlace',       agg: 'sum' },
    leads:          { label: 'Leads',                    agg: 'sum' },
    conversions:    { label: 'Conversiones',             agg: 'sum' },
    sessions:       { label: 'Sesiones',                 agg: 'sum' },
    searchClicks:   { label: 'Clics orgánicos (Google)', agg: 'sum' },
    searchImpressions: { label: 'Impresiones en Google', agg: 'sum' },
    positionSum:    { label: 'Posición (suma ponderada)', agg: 'sum', hidden: true },
    mediaCount:     { label: 'Publicaciones totales', agg: 'last', hidden: true },
    heartTotal:     { label: 'Me gusta totales (TikTok)', agg: 'last', hidden: true },
    videoTotal:     { label: 'Videos totales (TikTok)', agg: 'last', hidden: true },
  };

  const div = (a, b) => (b && isFinite(a) && isFinite(b) ? a / b : null);

  /* Métricas que se muestran. compute(t) recibe el resumen del período:
     t.sum.x, t.last.x, t.first.x, t.avg.x, t.days
     unit: 'n' número, 'pct' porcentaje (0-1), 'money', 'x' multiplicador, 's' segundos
     better: 'up' | 'down' — hacia dónde es bueno que se mueva
     goal: cómo se mide como meta → 'level' (saldo al final), 'cumulative'
       (suma dentro de la ventana de la meta) o 'rate' (promedio móvil de 28 días) */
  const METRICS = [
    // ── Audiencia ────────────────────────────────────────────
    { key: 'followers', group: 'Audiencia', label: 'Seguidores', unit: 'n', better: 'up', goal: 'level',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => t.last.followers,
      formula: 'Último valor del período',
      what: 'El tamaño de la audiencia que puede ver tu contenido sin pagar. Es un saldo, no un flujo: nunca se suma día por día.',
      trap: 'Crecer seguidores sin crecer alcance ni interacción es inflar un número que el algoritmo no premia. Mírala junto a "Seguidores por cada 1.000 de alcance".' },
    { key: 'netFollowers', group: 'Audiencia', label: 'Crecimiento neto', unit: 'n', better: 'up', goal: 'cumulative',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => (t.last.followers != null && t.first.followers != null ? t.last.followers - t.firstBase.followers : t.sum.newFollowers || null),
      formula: 'Seguidores al cierre − seguidores al cierre del período anterior',
      what: 'Cuántos seguidores ganaste (menos los que se fueron) en el período.',
      trap: 'Un pico aislado suele venir de un solo post viral o de un sorteo. Revisa si el crecimiento es sostenido semana a semana.' },
    { key: 'growthRate', group: 'Audiencia', label: 'Tasa de crecimiento', unit: 'pct', better: 'up', goal: 'rate',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => (t.last.followers != null && t.firstBase.followers ? (t.last.followers - t.firstBase.followers) / t.firstBase.followers : null),
      formula: 'Crecimiento neto ÷ seguidores al inicio',
      bench: { low: 0.01, good: 0.03, great: 0.06, period: '28 días' },
      what: 'Qué tan rápido crece la cuenta en relación con su tamaño. Permite comparar una cuenta de 2K con una de 200K.',
      trap: 'Las cuentas pequeñas crecen en % mucho más rápido. Compárala contra tu propio histórico antes que contra otras cuentas.' },
    { key: 'followsPer1k', group: 'Audiencia', label: 'Seguidores por cada 1.000 de alcance', unit: 'n', better: 'up', goal: 'rate', decimals: 1,
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => {
        const net = t.sum.newFollowers || (t.last.followers != null && t.firstBase.followers != null ? t.last.followers - t.firstBase.followers : null);
        const r = t.sum.reach || t.sum.views;
        return net != null && r ? (net / r) * 1000 : null;
      },
      formula: '(Seguidores nuevos ÷ alcance) × 1.000',
      bench: { low: 1, good: 3, great: 6 },
      what: 'Tu "tasa de conversión" de desconocido a seguidor. Mide si el perfil convence a quien te descubre.',
      trap: 'Si el alcance sube pero esta métrica cae, el contenido atrae a gente que no es tu público (alcance vacío).' },

    // ── Distribución ─────────────────────────────────────────
    { key: 'reach', group: 'Distribución', label: 'Alcance', unit: 'n', better: 'up', goal: 'cumulative',
      compute: t => t.sum.reach || null,
      formula: 'Suma del alcance diario',
      what: 'Cuentas únicas que vieron tu contenido. Es la métrica madre de la visibilidad.',
      trap: 'El alcance de varios días NO se puede sumar para obtener personas únicas: la misma persona cuenta una vez por día. La suma diaria sirve para tendencia; para únicos reales usa el alcance del período que da Meta.' },
    { key: 'impressions', group: 'Distribución', label: 'Impresiones / visualizaciones', unit: 'n', better: 'up', goal: 'cumulative',
      compute: t => t.sum.impressions || t.sum.views || null,
      formula: 'Suma de impresiones (o visualizaciones en IG/TikTok)',
      what: 'Veces que tu contenido apareció en pantalla. Desde 2025 Meta unificó esto como "Visualizaciones" (views).',
      trap: 'Muchas impresiones con poco alcance = las mismas personas te ven muchas veces (ver Frecuencia).' },
    { key: 'frequency', group: 'Distribución', label: 'Frecuencia', unit: 'x', better: 'neutral', goal: 'rate', decimals: 2,
      compute: t => div(t.sum.impressions || t.sum.views, t.sum.reach),
      formula: 'Impresiones ÷ alcance',
      bench: { low: 1.2, good: 2, great: 3, high: 4, kind: 'band' },
      what: 'Cuántas veces en promedio te vio cada persona. En anuncios, entre 1,5 y 3 por semana suele ser sano.',
      trap: 'Por encima de ~3,5–4 en una campaña: fatiga creativa. El CTR cae y el CPM/CPL suben.' },
    { key: 'postsPerWeek', group: 'Distribución', label: 'Publicaciones por semana', unit: 'n', better: 'up', goal: 'rate', decimals: 1,
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => (t.sum.posts != null && t.days ? (t.sum.posts / t.days) * 7 : null),
      formula: 'Publicaciones ÷ días × 7',
      bench: { low: 2, good: 4, great: 7 },
      what: 'Consistencia de publicación. El algoritmo premia la constancia más que los picos.',
      trap: 'Subir volumen bajando calidad diluye la tasa de interacción. Sube de a poco y mide.' },

    // ── Interacción ──────────────────────────────────────────
    { key: 'engagements', group: 'Interacción', label: 'Interacciones', unit: 'n', better: 'up', goal: 'cumulative',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => t.sum.engagements || sumOf(t, ['likes', 'comments', 'shares', 'saves']),
      formula: 'Me gusta + comentarios + compartidos + guardados',
      what: 'Total de acciones sobre tu contenido.',
      trap: 'No todas valen igual: un guardado o un compartido pesa mucho más para el algoritmo que un me gusta.' },
    { key: 'erReach', group: 'Interacción', label: 'Tasa de interacción (alcance)', unit: 'pct', better: 'up', goal: 'rate',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => div(t.sum.engagements || sumOf(t, ['likes', 'comments', 'shares', 'saves']), t.sum.reach || t.sum.impressions || t.sum.views),
      formula: 'Interacciones ÷ alcance',
      bench: { instagram: { low: 0.02, good: 0.04, great: 0.07 }, facebook: { low: 0.01, good: 0.025, great: 0.05 },
               tiktok: { low: 0.03, good: 0.06, great: 0.1 }, linkedin: { low: 0.02, good: 0.035, great: 0.06 },
               default: { low: 0.02, good: 0.04, great: 0.07 } },
      what: 'La métrica más honesta de calidad: de quienes te vieron, cuántos hicieron algo. Es la que usamos por defecto.',
      trap: 'Las agencias suelen reportar la tasa sobre seguidores porque da números más altos en cuentas pequeñas. Siempre di sobre qué base calculas.' },
    { key: 'erFollowers', group: 'Interacción', label: 'Tasa de interacción (seguidores)', unit: 'pct', better: 'up', goal: 'rate',
      platforms: ['instagram', 'facebook', 'tiktok', 'linkedin'],
      compute: t => {
        const e = t.sum.engagements || sumOf(t, ['likes', 'comments', 'shares', 'saves']);
        const perPost = t.sum.posts ? e / t.sum.posts : null;
        return div(perPost, t.avg.followers);
      },
      formula: '(Interacciones ÷ publicaciones) ÷ seguidores promedio — por publicación',
      bench: { low: 0.01, good: 0.03, great: 0.06 },
      what: 'La versión "de industria" de la tasa de interacción; sirve para comparar con competidores (de quienes no conoces el alcance).',
      trap: 'Se infla si un post se vuelve viral fuera de tu audiencia. Para tu diagnóstico interno usa la de alcance.' },
    { key: 'saveRate', group: 'Interacción', label: 'Tasa de guardados', unit: 'pct', better: 'up', goal: 'rate', decimals: 2,
      platforms: ['instagram', 'tiktok', 'facebook'],
      compute: t => div(t.sum.saves, t.sum.reach || t.sum.views),
      formula: 'Guardados ÷ alcance',
      bench: { low: 0.003, good: 0.01, great: 0.02 },
      what: 'Señal de VALOR: la gente guarda lo que le resulta útil para después. Es de las señales que más empujan el alcance en Instagram.',
      trap: 'Sube con carruseles educativos, checklists y guías; casi nunca con piezas puramente promocionales.' },
    { key: 'shareRate', group: 'Interacción', label: 'Tasa de compartidos', unit: 'pct', better: 'up', goal: 'rate', decimals: 2,
      compute: t => div(t.sum.shares, t.sum.reach || t.sum.views),
      formula: 'Compartidos ÷ alcance',
      bench: { low: 0.002, good: 0.006, great: 0.015 },
      what: 'Señal de VIRALIDAD: cada compartido te presenta a una audiencia nueva gratis. Es el motor del alcance no pagado.',
      trap: 'El contenido que se comparte suele ser identificación ("esto me pasa") o utilidad ("mira esto"), no autopromoción.' },
    { key: 'commentRate', group: 'Interacción', label: 'Tasa de comentarios', unit: 'pct', better: 'up', goal: 'rate', decimals: 2,
      compute: t => div(t.sum.comments, t.sum.reach || t.sum.views),
      formula: 'Comentarios ÷ alcance',
      bench: { low: 0.001, good: 0.004, great: 0.01 },
      what: 'Señal de CONVERSACIÓN y comunidad. Es la base para generar leads por DM.',
      trap: 'Los sorteos inflan comentarios de baja calidad que no convierten.' },

    // ── Perfil y tráfico ─────────────────────────────────────
    { key: 'profileVisitRate', group: 'Perfil y tráfico', label: 'Tasa de visita al perfil', unit: 'pct', better: 'up', goal: 'rate', decimals: 2,
      platforms: ['instagram', 'tiktok', 'facebook', 'linkedin'],
      compute: t => div(t.sum.profileVisits, t.sum.reach || t.sum.views),
      formula: 'Visitas al perfil ÷ alcance',
      bench: { low: 0.005, good: 0.015, great: 0.03 },
      what: 'Curiosidad que despierta el contenido: quién quiso saber más de la marca.',
      trap: 'Si es alta pero los seguidores nuevos no suben, el perfil (bio, destacadas, fijados) no está cerrando la venta.' },
    { key: 'profileToFollow', group: 'Perfil y tráfico', label: 'Conversión perfil → seguidor', unit: 'pct', better: 'up', goal: 'rate',
      platforms: ['instagram', 'tiktok', 'facebook', 'linkedin'],
      compute: t => {
        const net = t.sum.newFollowers || (t.last.followers != null && t.firstBase.followers != null ? t.last.followers - t.firstBase.followers : null);
        return net != null ? div(net, t.sum.profileVisits) : null;
      },
      formula: 'Seguidores nuevos ÷ visitas al perfil',
      bench: { low: 0.05, good: 0.12, great: 0.2 },
      what: 'Qué tan bien convierte tu perfil. Es la "landing page" de redes sociales.',
      trap: 'Se mejora con: bio con propuesta de valor clara, destacadas ordenadas como embudo y 3 posts fijados que expliquen quién eres.' },
    { key: 'bioCtr', group: 'Perfil y tráfico', label: 'CTR del enlace en bio', unit: 'pct', better: 'up', goal: 'rate', decimals: 2,
      platforms: ['instagram', 'tiktok', 'facebook', 'linkedin'],
      compute: t => div(t.sum.websiteClicks, t.sum.profileVisits),
      formula: 'Clics al sitio ÷ visitas al perfil',
      bench: { low: 0.02, good: 0.05, great: 0.1 },
      what: 'De quienes visitan el perfil, cuántos van a tu web o WhatsApp. Es el puente entre redes y leads.',
      trap: 'Un enlace genérico ("linktree con 12 botones") baja este número. Un solo CTA con beneficio claro lo sube.' },

    // ── Video ────────────────────────────────────────────────
    { key: 'completionRate', group: 'Video', label: 'Tasa de vistas completas', unit: 'pct', better: 'up', goal: 'rate',
      platforms: ['tiktok', 'instagram', 'facebook'],
      compute: t => div(t.sum.fullViews, t.sum.views),
      formula: 'Vistas completas ÷ visualizaciones',
      bench: { low: 0.1, good: 0.25, great: 0.4 },
      what: 'Retención: qué parte del público llegó al final. En TikTok y Reels es la señal #1 del algoritmo.',
      trap: 'Depende de la duración: un video de 7 s tiene completitud alta por naturaleza. Compara videos de duración similar.' },
    { key: 'avgWatchTime', group: 'Video', label: 'Tiempo promedio de reproducción', unit: 's', better: 'up', goal: 'rate', decimals: 1,
      platforms: ['tiktok', 'instagram', 'facebook'],
      compute: t => div(t.sum.watchTimeSec, t.sum.views),
      formula: 'Tiempo total de reproducción ÷ visualizaciones',
      what: 'Cuántos segundos se queda la gente. Combinada con la duración del video te dice dónde se van.',
      trap: 'Si es menor a 3 s, el gancho (primer segundo) no funciona: cambia la primera imagen y el texto en pantalla.' },

    // ── Publicidad ───────────────────────────────────────────
    { key: 'spend', group: 'Publicidad', label: 'Inversión', unit: 'money', better: 'neutral', goal: 'cumulative', platforms: ['meta_ads'],
      compute: t => t.sum.spend || null, formula: 'Suma del gasto',
      what: 'Lo invertido en el período.', trap: 'La inversión no es una meta: es el costo de llegar a una meta.' },
    { key: 'cpm', group: 'Publicidad', label: 'CPM', unit: 'money', better: 'down', goal: 'rate', platforms: ['meta_ads'],
      compute: t => (t.sum.spend && t.sum.impressions ? (t.sum.spend / t.sum.impressions) * 1000 : null),
      formula: 'Inversión ÷ impresiones × 1.000',
      bench: { low: 6, good: 3.5, great: 2, inverse: true },
      what: 'Costo de mostrar el anuncio 1.000 veces. Mide qué tan cara está la subasta para tu audiencia.',
      trap: 'Sube con audiencias muy pequeñas, fechas de alta demanda (Navidad, Black Friday) y anuncios con baja calidad. En RD/LatAm suele estar entre US$1,5 y US$5.' },
    { key: 'ctr', group: 'Publicidad', label: 'CTR (enlace)', unit: 'pct', better: 'up', goal: 'rate', decimals: 2, platforms: ['meta_ads'],
      compute: t => div(t.sum.linkClicks || t.sum.clicks, t.sum.impressions),
      formula: 'Clics en el enlace ÷ impresiones',
      bench: { low: 0.006, good: 0.01, great: 0.018 },
      what: 'Qué tan bien el anuncio convence de hacer clic. Es la métrica de la CREATIVIDAD y la OFERTA.',
      trap: 'Usa siempre el CTR de ENLACE, no el CTR "todos" (que cuenta clics en "ver más", en el perfil, etc. y se ve mejor de lo que es). Servicios financieros suelen estar entre 0,6% y 0,9%.' },
    { key: 'cpc', group: 'Publicidad', label: 'CPC (enlace)', unit: 'money', better: 'down', goal: 'rate', decimals: 2, platforms: ['meta_ads'],
      compute: t => div(t.sum.spend, t.sum.linkClicks || t.sum.clicks),
      formula: 'Inversión ÷ clics en el enlace',
      bench: { low: 0.6, good: 0.3, great: 0.15, inverse: true },
      what: 'Lo que pagas por cada visita. Es el resultado de CPM y CTR juntos: CPC = CPM ÷ (CTR × 1.000).',
      trap: 'Para bajar el CPC tienes dos palancas: abaratar la subasta (CPM) o mejorar el anuncio (CTR). Casi siempre es la segunda.' },
    { key: 'leads', group: 'Publicidad', label: 'Leads', unit: 'n', better: 'up', goal: 'cumulative', platforms: ['meta_ads', 'web'],
      compute: t => t.sum.leads || null, formula: 'Suma de leads (formularios, mensajes, registros)',
      what: 'Personas que levantaron la mano: dejaron datos o escribieron.', trap: 'Un lead no es una venta: sigue la calidad (cuántos califican) con tu equipo comercial.' },
    { key: 'cpl', group: 'Publicidad', label: 'Costo por lead (CPL)', unit: 'money', better: 'down', goal: 'rate', decimals: 2, platforms: ['meta_ads'],
      compute: t => div(t.sum.spend, t.sum.leads),
      formula: 'Inversión ÷ leads',
      what: 'Lo que cuesta cada lead. Es LA métrica de negocio de una campaña de captación.',
      trap: 'Un CPL bajo con leads de mala calidad es caro. Mide CPL calificado = inversión ÷ leads que el equipo comercial aceptó.' },
    { key: 'cvr', group: 'Publicidad', label: 'Tasa de conversión (clic → lead)', unit: 'pct', better: 'up', goal: 'rate', platforms: ['meta_ads', 'web'],
      compute: t => div(t.sum.leads, t.sum.linkClicks || t.sum.clicks || t.sum.sessions),
      formula: 'Leads ÷ clics en el enlace',
      bench: { low: 0.03, good: 0.08, great: 0.15 },
      what: 'Qué tan bien convierte la página o formulario de destino.',
      trap: 'CTR bueno + conversión mala = el problema NO es el anuncio, es la landing (velocidad, formulario largo, mensaje distinto al del anuncio).' },
    { key: 'cpa', group: 'Publicidad', label: 'Costo por conversión', unit: 'money', better: 'down', goal: 'rate', decimals: 2, platforms: ['meta_ads'],
      compute: t => div(t.sum.spend, t.sum.conversions),
      formula: 'Inversión ÷ conversiones',
      what: 'Costo de cada resultado final (compra, solicitud aprobada, cita).',
      trap: 'Configura bien el píxel/API de conversiones o este número mentirá.' },

    // ── SEO ──────────────────────────────────────────────────
    { key: 'searchClicks', group: 'SEO', label: 'Clics orgánicos', unit: 'n', better: 'up', goal: 'cumulative', platforms: ['web'],
      compute: t => t.sum.searchClicks || null, formula: 'Suma de clics en Google (Search Console)',
      what: 'Visitas que llegan desde Google sin pagar.', trap: 'Separa marca de no-marca: si todo el tráfico es de gente que ya te busca por nombre, el SEO no está trayendo público nuevo.' },
    { key: 'searchImpressions', group: 'SEO', label: 'Impresiones en Google', unit: 'n', better: 'up', goal: 'cumulative', platforms: ['web'],
      compute: t => t.sum.searchImpressions || null, formula: 'Suma de impresiones en resultados de búsqueda',
      what: 'Veces que tu sitio apareció en Google. Sube antes que los clics cuando una página empieza a posicionar.', trap: 'Impresiones que suben con CTR que cae suele ser posicionamiento en búsquedas nuevas pero en posiciones bajas: es buena señal temprana.' },
    { key: 'searchCtr', group: 'SEO', label: 'CTR orgánico', unit: 'pct', better: 'up', goal: 'rate', decimals: 2, platforms: ['web'],
      compute: t => div(t.sum.searchClicks, t.sum.searchImpressions),
      formula: 'Clics ÷ impresiones',
      bench: { low: 0.015, good: 0.03, great: 0.06 },
      what: 'Qué tan atractivo es tu resultado en Google (título + descripción).', trap: 'Depende muchísimo de la posición. Compáralo con la curva de CTR esperado por posición (pestaña SEO).' },
    { key: 'avgPosition', group: 'SEO', label: 'Posición promedio', unit: 'n', better: 'down', goal: 'rate', decimals: 1, platforms: ['web'],
      compute: t => div(t.sum.positionSum, t.sum.searchImpressions),
      formula: 'Σ(posición × impresiones) ÷ Σ impresiones',
      bench: { low: 20, good: 10, great: 4, inverse: true },
      what: 'Dónde apareces en promedio. Ponderada por impresiones, como la calcula Google.', trap: 'Un promedio esconde todo: una página en posición 2 y otra en 40 promedian 21. Analiza por consulta.' },
    { key: 'sessions', group: 'SEO', label: 'Sesiones', unit: 'n', better: 'up', goal: 'cumulative', platforms: ['web'],
      compute: t => t.sum.sessions || null, formula: 'Suma de sesiones (Analytics)', what: 'Visitas totales al sitio.', trap: 'Revisa la fuente: tráfico pagado que se apaga hace que las sesiones caigan de golpe.' },
  ];

  function sumOf(t, keys) {
    let s = 0, any = false;
    for (const k of keys) if (t.sum[k] != null && t.sum[k] !== 0) { s += t.sum[k]; any = true; }
    return any ? s : null;
  }

  const byKey = Object.fromEntries(METRICS.map(m => [m.key, m]));

  function benchFor(metric, platform) {
    const b = metric.bench;
    if (!b) return null;
    if (b.low != null) return b;
    return b[platform] || b.default || null;
  }

  /* Califica un valor contra la referencia. Devuelve
     { level: 'low'|'ok'|'good'|'great'|'high', label } o null */
  function grade(metric, value, platform) {
    const b = benchFor(metric, platform);
    if (!b || value == null || !isFinite(value)) return null;
    if (b.kind === 'band') {
      if (value < b.low) return { level: 'low', label: 'Baja' };
      if (value > b.high) return { level: 'high', label: 'Alta: fatiga' };
      return { level: 'good', label: 'Sana' };
    }
    if (b.inverse) {
      if (value <= b.great) return { level: 'great', label: 'Excelente' };
      if (value <= b.good) return { level: 'good', label: 'Buena' };
      if (value <= b.low) return { level: 'ok', label: 'Promedio' };
      return { level: 'low', label: 'Por mejorar' };
    }
    if (value >= b.great) return { level: 'great', label: 'Excelente' };
    if (value >= b.good) return { level: 'good', label: 'Buena' };
    if (value >= b.low) return { level: 'ok', label: 'Promedio' };
    return { level: 'low', label: 'Por mejorar' };
  }

  function metricsFor(platform) {
    return METRICS.filter(m => !m.platforms || m.platforms.includes(platform));
  }

  function format(value, unit, opts = {}) {
    if (value == null || !isFinite(value)) return '—';
    const d = opts.decimals;
    switch (unit) {
      case 'pct': return (value * 100).toLocaleString('es-DO', { maximumFractionDigits: d ?? 1, minimumFractionDigits: d ?? 1 }) + '%';
      case 'money': return (opts.currency || 'US$') + value.toLocaleString('es-DO', { maximumFractionDigits: d ?? 2, minimumFractionDigits: d ?? 2 });
      case 'x': return value.toLocaleString('es-DO', { maximumFractionDigits: d ?? 2 }) + '×';
      case 's': return value.toLocaleString('es-DO', { maximumFractionDigits: d ?? 1 }) + ' s';
      default: return compact(value, d);
    }
  }

  function compact(v, d) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString('es-DO', { maximumFractionDigits: 1 }) + ' M';
    if (a >= 1e4) return (v / 1e3).toLocaleString('es-DO', { maximumFractionDigits: 1 }) + ' K';
    return v.toLocaleString('es-DO', { maximumFractionDigits: d ?? (Number.isInteger(v) || a >= 100 ? 0 : 1) });
  }

  const api = { PLATFORMS, FIELDS, METRICS, byKey, grade, benchFor, metricsFor, format, compact, div };
  root.PulsoMetrics = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
