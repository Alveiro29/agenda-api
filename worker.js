/* ─────────────────────────────────────────────────────────────
   API de agenda — Dra Katherin Almonte Skin Lab
   Cloudflare Worker · habla con Google Calendar (cuenta de servicio)

   SECRETS a crear en Cloudflare
   (Worker → Settings → Variables and Secrets → Add → tipo "Secret"):

     GOOGLE_SA_JSON   el contenido COMPLETO del archivo .json de la
                      cuenta de servicio (se pega tal cual, con llaves)
     CAL_CITAS        ID del calendario "Citas web"  (permiso: hacer cambios)
     CAL_PERSONAL     ID del calendario personal de la Dra. (permiso: solo ver)
                      · opcional, pero recomendado: lo que ella ponga ahí
                        le cierra SUS procedimientos en las dos sucursales
     PANEL_CLAVE      clave del panel interno (citas Y consentimientos).
                      Sin ella, /api/citas y /api/pacientes quedan
                      desactivados. Usa una clave larga: ahí hay datos
                      de pacientes.

   BINDING a crear en Cloudflare (Worker → Settings → Bindings → Add
   → "D1 database"; variable name = DB, base de datos = skinlab-db):

     DB   base de datos D1 donde se guardan, de forma permanente,
          los pacientes, sus citas, los consentimientos firmados y las
          notas de seguimiento. Google Calendar sigue siendo la fuente
          de verdad de la agenda; la tabla "citas" es la copia que
          permite ver el historial de cada paciente de un vistazo.
          Sin este binding, esos 3 siguen funcionando
          para la parte de Google Calendar, pero /api/consentimientos,
          /api/pacientes y las notas de seguimiento dejan de poder
          guardar nada nuevo.

   Variables normales (tipo Text), opcionales:
     CUPOS_GAZCUE     cabinas simultáneas en Gazcue (por defecto 2)
     CUPOS_SDN        cabinas simultáneas en Sto. Dgo. Norte (por defecto 2)
     ALLOWED_ORIGINS  dominios separados por coma que pueden llamar la API
     HORAS_CANCELACION  antelación mínima para que la paciente cancele o
                      mueva su cita sola (por defecto 24). Más cerca de la
                      hora, el enlace la manda a WhatsApp.
     CITA_SECRET      clave para firmar los enlaces personales. Si no se
                      pone, se deriva de PANEL_CLAVE — no hay que configurar
                      nada. Ojo: cambiar la clave que se use invalida los
                      enlaces que ya estén circulando.
     PERSONAL_SOLO_CLAVE  OBSOLETA. Ya no se usa para decidir bloqueos: el
                      alcance del calendario personal ahora es correcto por
                      diseño (ver más abajo). Se sigue leyendo solo para
                      reportarla en /api/salud y no romper la configuración.

   ── LOS DOS RECURSOS DE LA CLÍNICA ─────────────────────────
   Hay dos, y solo dos:

     · CABINAS — cuartos físicos por sucursal (CUPOS_*). Es el único
       límite del total simultáneo. NO hay un límite por número de
       colaboradoras: una colaboradora atiende las dos cabinas en
       paralelo, porque los faciales tienen tiempo muerto (mascarillas,
       reposo) que aprovecha para alternar. Así trabaja la clínica.

     · LA DRA. — recurso global de 1. Es la única que hace inyectables y
       tratamientos íntimos, y no puede estar en dos sucursales a la vez:
       entre Gazcue y la Av. Jacobo Majluta hay de 45 a 75 minutos reales
       según el tráfico.

   Dos reglas la gobiernan, y solo aplican a SUS procedimientos:

     Regla A · entre dos citas suyas en sucursales DISTINTAS tiene que
       haber al menos TRASLADO_MIN minutos entre el fin de una y el
       inicio de la otra. Se valida contra la cita anterior Y la
       siguiente: no se sabe en qué orden van a entrar las reservas.
       Dentro de la MISMA sucursal no hay restricción: cita pegada a cita.

     Regla B · sus citas de un mismo día pueden cambiar de sucursal como
       máximo MAX_CAMBIOS_SEDE veces. Gazcue → SDN → Gazcue se rechaza.

   Ninguna de las dos cierra nada por adelantado: un día vacío tiene las
   dos sucursales 100% disponibles. El bloqueo lo genera la propia reserva.
   Y ninguna toca los servicios de colaboradora: esos solo piden cabina.

   La Dra. sí puede agendar a mano lo que quiera, rompiendo las reglas.
   El sistema no le prohíbe nada a ella; solo gobierna lo que la web
   le ofrece a las pacientes. El panel avisa, pero deja guardar.

   ── CÓMO SE LEE EL CALENDARIO ──────────────────────────────
   En "Citas web":
     · Cita creada por el sitio → ocupa UNA cabina de su sucursal
       (la sucursal va en el campo Ubicación, y cada una tiene su color).
       Si además es un procedimiento de la Dra., la ocupa a ella también.
     · Evento de día completo, o con CERRADO / BLOQUEO / FERIADO /
       VACACIONES / NO AGENDAR en el título → es un bloqueo, no una cita:
       con Ubicación en una sucursal cierra SOLO esa; sin Ubicación
       (o con las dos escritas) cierra las dos. Así se crean también los
       bloqueos que arma el panel (ver /api/bloqueos/crear).
   En el calendario personal:
     · Un evento ocupado → le cierra a ella SUS procedimientos, en las dos
       sucursales. Los servicios de colaboradora siguen disponibles: su
       almuerzo ya no tumba un facial en la otra sede.
     · Salvo que el título traiga CERRADO/VACACIONES/etc., que sí cierra
       la clínica entera — es la forma de avisar que no se abre.
   En ambos:
     · Un evento marcado "Disponible" no bloquea nada
       (los eventos de día completo son "Disponible" por defecto en Google;
        para que unas vacaciones sí cierren, ponles VACACIONES en el título
        o márcalas como "Ocupado" — el panel ya lo hace solo)

   Endpoints:
     GET  /api/disponibilidad?desde=YYYY-MM-DD&dias=6&sucursal=Gazcue&dur=60&servicio=Botox
            servicio es opcional: sin él solo se calcula la cabina, igual
            que antes. Con él se aplican además las reglas de la Dra.
     POST /api/reservar
     POST /api/citas       (panel interno · pide PANEL_CLAVE en el cuerpo)
     POST /api/citas/nota  (panel interno · agrega una nota de seguimiento a una cita)
     POST /api/citas/editar (panel interno · cambia servicio, sucursal, fecha/hora
                             y datos del paciente de una cita que aún no ha pasado)
     POST /api/citas/cancelar (panel interno · cancela una cita: queda en el
                             historial con estado 'Cancelada', no solo borrada)
     POST /api/bloqueos        (panel interno · lista vacaciones/feriados/cierres)
     POST /api/bloqueos/crear  (panel interno · bloquea días en una sucursal o en ambas)
     POST /api/bloqueos/borrar (panel interno · quita un bloqueo)
     GET  /api/salud       (diagnóstico)

     GET  /api/cita?t=TOKEN          (público · la paciente ve su propia cita)
     GET  /api/cita/horarios?t=TOKEN (público · horarios libres para reprogramarla)
     POST /api/cita/cancelar         (público · la paciente cancela su cita)
     POST /api/cita/mover            (público · la paciente la cambia de horario)
       El "token" es el enlace personal que devuelve /api/reservar. Va firmado
       con HMAC, así que no se puede inventar ni cambiar por el de otra cita, y
       vence dos días después de la cita. Cancelar y mover se cierran cuando
       faltan menos de HORAS_CANCELACION horas (24 por defecto).

     POST /api/consentimientos          (público · el paciente firma desde su enlace)
     POST /api/consentimientos/importar (panel interno · trae consentimientos viejos guardados en localStorage)
     POST /api/pacientes                (panel interno · lista de pacientes)
     POST /api/pacientes/historial      (panel interno · citas + consentimientos + notas de un paciente)
     POST /api/pacientes/sincronizar    (panel interno · trae de la agenda las pacientes que ya
                                         tienen citas hechas; se puede repetir sin duplicar.
                                         incluirPersonal:true suma el calendario personal)
     POST /api/pacientes/borrar         (panel interno · borra un paciente traído por error;
                                         se niega si tiene consentimientos firmados)
     POST /api/consentimientos/lista    (panel interno · documentos firmados)
     POST /api/consentimientos/uno      (panel interno · un documento completo, para ver/imprimir)
     POST /api/consentimientos/borrar   (panel interno · borra un documento firmado)
   ───────────────────────────────────────────────────────────── */

/* ── Reglas del consultorio ── */
const OFF = '-04:00';              // Rep. Dominicana: UTC-4 todo el año
const TZ = 'America/Santo_Domingo';
const OPEN = 9 * 60;               // 9:00 a.m.
const CLOSE = 18 * 60 + 30;        // 6:30 p.m.
const STEP = 30;                   // los turnos empiezan cada 30 min
const WORKDAYS = [1, 2, 3, 4, 5, 6]; // lunes a sábado (0 = domingo, cerrado)
const LEAD_MIN = 120;              // mínimo 2 h de antelación
const MAX_AHEAD = 365;             // se agenda hasta un año adelante
const CUPOS_DEF = 2;               // cabinas por sucursal
const CANCELA_DEF = 24;            // horas de antelación para que la paciente cancele sola
const CIERRE_TOTAL = /cerrad|bloque|feriad|vacacion|no agendar|inhabil|inhábil/i;

/* ── La Dra. como recurso (ver la explicación de arriba) ── */
const TRASLADO_MIN = 95;           // minutos mínimos entre sucursales distintas
const MAX_CAMBIOS_SEDE = 1;        // cambios de sucursal permitidos por día
const BUFFER_DRA_MIN = 15;         // limpieza/preparación tras un procedimiento suyo
const HORIZONTE_SUG = 14;          // días que se miran adelante para poder sugerir

/* Fuente de verdad de qué consume a la Dra. Son los nombres EXACTOS del
   catálogo (js/catalogo.js), normalizados: minúsculas, sin tildes, sin
   puntuación. El front NO decide esto — manda el nombre y aquí se resuelve.
   Si agregas un servicio al catálogo que lo haga ella, agrégalo aquí. */
const SERVICIOS_DRA = [
  /* Mesoterapia y skin boosters */
  'mesoterapia pdrn acido hialuronico',
  'mesoterapia revitalisse hidratacion antioxidante',
  'mesoterapia acneheal',
  'pdrn crystal',
  'skin booster hyalift 75 proactive',
  'long lasting',
  'profhilo bioestimulacion',
  'plasma rico en plaquetas prp',
  'exosomas regeneracion celular',
  'biorevitalizacion de ojeras rrss peeling',
  /* Inyectables y armonización */
  'toxina botulinica neuronox',
  'botox',
  'hipersudoracion axilar',
  'diseno de labios',
  'hidratacion de labios',
  'aumento de menton',
  'relleno de surcos nasogenianos',
  'sosten ligamentario',
  'armonizacion efecto lifting',
  'relleno de ojeras',
  'hilos tensores',
  /* Aparatología */
  'radiofrecuencia fraccionada con microagujas',
  'remocion de verrugas exeresis',
  /* Corporal y bienestar */
  'sesion de quemadores de grasa',
  'lipoescultura quimica',
  'sueroterapia iv therapy',
  /* Salud íntima */
  'o shot prp vaginal',
  'hifu vaginal vaginal tightening',
  'relleno de labios mayores',
  'happy intim peeling intimo y blanqueamiento'
];

/* Para las citas que ella escribe A MANO, donde el título no es el nombre
   exacto del catálogo ("Bótox – María"). Cualquiera de estas palabras la
   marca como suya. OJO al agregar: aquí NO pueden entrar palabras de
   servicios de colaboradora ('facial', 'peeling', 'hifu' a secas,
   'limpieza', 'drenaje', 'masaje', 'evaluacion'), o le cerrarían la agenda
   a la otra sucursal sin motivo. */
const PALABRAS_DRA = [
  'botox', 'toxina botulinica', 'neuronox', 'acido hialuronico', 'relleno',
  'labios', 'menton', 'nasogenianos', 'ligamentario', 'armonizacion', 'ojeras',
  'hilos tensores', 'bioestimulacion', 'profhilo', 'skin booster', 'skinbooster',
  'long lasting', 'mesoterapia', 'pdrn', 'plasma rico', 'prp', 'exosomas',
  'hipersudoracion', 'microagujas', 'verrugas', 'quemadores de grasa',
  'lipoescultura', 'sueroterapia', 'iv therapy', 'o shot', 'oshot',
  'hifu vaginal', 'vaginal', 'intim'
];

/* La firma de la marca sale en los títulos que crea la web. Hay que quitarla
   antes de buscar el "DRA" manual, o cada cita quedaría marcada como suya. */
const FIRMA_MARCA = /\b(dra\s+katherin\s+almonte|katherin\s+almonte|skin\s+lab)\b/g;

const normDra = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fuera las tildes
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* ¿Este texto — nombre de servicio o título de evento — es de la Dra.? */
function esServicioDra(txt) {
  const t = normDra(txt);
  if (!t) return false;
  if (SERVICIOS_DRA.includes(t)) return true;
  return PALABRAS_DRA.some(k => t.includes(k));
}

/* ¿Este evento del calendario la consume? Tres señales, en este orden:
     1. extendedProperties.private.dra — definitivo, lo escribe la web
     2. el título o la línea "Servicio:" coincide con el catálogo
     3. el título trae [DRA] — el override manual, para que ella pueda
        reservarse tiempo sin escribir un servicio                        */
function eventoEsDra(ev) {
  const priv = (ev.extendedProperties && ev.extendedProperties.private) || {};
  if (priv.dra === '1') return true;
  if (priv.dra === '0') return false;
  const titulo = ev.summary || '';
  const servicio = (String(ev.description || '').match(/servicio\s*:\s*(.+)/i) || [])[1] || '';
  if (esServicioDra(titulo) || esServicioDra(servicio)) return true;
  return /(^| )dra( |$)|\[dra\]/.test(normDra(titulo.replace(FIRMA_MARCA, ' ')));
}

/* Sucursales. color = colorId de Google Calendar
   (2 = Sage/verde · 4 = Flamingo/rosa — a tono con la marca) */
const SUCURSALES = {
  gazcue: { nombre: 'Gazcue', color: '2', re: /gazcue|m[aá]ximo\s*cabral|energ[ií]a\s*vital/i, cupos: 'CUPOS_GAZCUE' },
  sdn: { nombre: 'Santo Domingo Norte', color: '4', re: /norte|villa\s*mella|majluta|jardines\s*del\s*arroyo|\bsdn\b/i, cupos: 'CUPOS_SDN' }
};
const claveSucursal = txt => {
  const s = String(txt || '');
  if (!s.trim()) return null;
  for (const [k, v] of Object.entries(SUCURSALES)) if (v.re.test(s)) return k;
  return null;
};
const laOtraSucursal = k => Object.keys(SUCURSALES).find(x => x !== k) || null;

const DEFAULT_ORIGINS = [
  'https://sitio-katherin.josea-yuasen.workers.dev',
  'https://drakatherinalmonte.com',
  'https://www.drakatherinalmonte.com'
];

/* ── fechas (todo en hora de RD) ── */
const pad = n => String(n).padStart(2, '0');
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const instant = (date, mins) => new Date(`${date}T${hhmm(mins)}:00${OFF}`);
/* "14:30" → "2:30 p.m." — para los mensajes que lee la paciente */
const en12 = t => {
  const h = +String(t).slice(0, 2), m = String(t).slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'a.m.' : 'p.m.'}`;
};

function localNow() {
  const s = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  return { date: s.slice(0, 10), mins: +s.slice(11, 13) * 60 + +s.slice(14, 16) };
}
const dowOf = date => new Date(`${date}T12:00:00${OFF}`).getUTCDay();
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00${OFF}`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const nInt = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : def; };
const cuposDe = (env, k) => nInt(env[SUCURSALES[k].cupos], CUPOS_DEF);

/* ── autenticación con Google ── */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function importKey(pem) {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', raw.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

let tokenCache = { value: null, exp: 0 };

async function getToken(env) {
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  if (!env.GOOGLE_SA_JSON) throw new Error('Falta el secret GOOGLE_SA_JSON');

  let sa;
  try { sa = JSON.parse(env.GOOGLE_SA_JSON); }
  catch (e) { throw new Error('GOOGLE_SA_JSON no es un JSON válido'); }
  if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_SA_JSON no tiene client_email / private_key');

  const now = Math.floor(Date.now() / 1000);
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  });

  const key = await importKey(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Google rechazó las credenciales: ' + (data.error_description || data.error || res.status));
  }
  tokenCache = { value: data.access_token, exp: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

/* ── lectura de eventos ──
   No se usa freeBusy porque ese fusiona los solapamientos y no dejaría
   contar cuántas cabinas están realmente ocupadas.
   Cada tramo lleva al final el id del evento que lo produjo: así, al EDITAR
   una cita, se puede descontar la propia cita para que no choque consigo misma.

   Cinco cubetas:
     ocupa           [ini, fin, sucursal, id] — consume UNA cabina de esa sede
     cierra          [ini, fin, id]           — cierra TODO, las dos sedes
     cierraSucursal  [ini, fin, sucursal, id] — cierra UNA sola sede
     dra             [ini, fin, sucursal, id] — además, consume a la Dra.
                     (es un subconjunto de "ocupa": también ocupa cuarto)
     draOcupa        [ini, fin, id]           — la ocupa a ella sin sede
                     legible (su calendario personal). Bloquea sus
                     procedimientos, pero no cuenta para las reglas A ni B:
                     no se puede asumir dónde está.                        */
function clasificarEventos(items, esPersonal) {
  const ocupa = [], cierra = [], cierraSucursal = [], dra = [], draOcupa = [];

  for (const ev of items || []) {
    if (ev.status === 'cancelled') continue;

    const forzado = CIERRE_TOTAL.test(ev.summary || '');
    // "Disponible" no bloquea, salvo que el título lo fuerce
    if (!forzado && ev.transparency === 'transparent') continue;

    let a, b, diaCompleto = false;
    if (ev.start && ev.start.date) {
      diaCompleto = true;
      a = instant(ev.start.date, 0).getTime();
      b = instant(ev.end.date, 0).getTime();
    } else if (ev.start && ev.start.dateTime) {
      a = new Date(ev.start.dateTime).getTime();
      b = new Date(ev.end.dateTime).getTime();
    } else continue;
    if (!(b > a)) continue;

    if (esPersonal) {
      /* Su agenda personal ya NO cierra la clínica entera. Le cierra a ella
         SUS procedimientos, en las dos sedes; los de colaboradora siguen
         ofreciéndose. Un CERRADO/VACACIONES ahí sí cierra todo: esa es la
         forma de avisar que la clínica no abre. */
      if (forzado) cierra.push([a, b, ev.id]);
      else draOcupa.push([a, b, ev.id]);
      continue;
    }
    if (forzado || diaCompleto) {
      // Un bloqueo (vacaciones, feriado…) con Ubicación puesta en una
      // sucursal solo cierra esa; sin ubicación, cierra las dos.
      const sucBloqueo = claveSucursal(ev.location);
      if (sucBloqueo) cierraSucursal.push([a, b, sucBloqueo, ev.id]);
      else cierra.push([a, b, ev.id]);
      continue;
    }

    const suc = claveSucursal(ev.location);
    if (!suc) { cierra.push([a, b, ev.id]); continue; }        // sin sucursal → cierra todo
    ocupa.push([a, b, suc, ev.id]);
    if (eventoEsDra(ev)) dra.push([a, b, suc, ev.id]);
  }
  return { ocupa, cierra, cierraSucursal, dra, draOcupa };
}

async function leerCalendario(env, calendarId, timeMin, timeMax, esPersonal) {
  const token = await getToken(env);
  const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  u.searchParams.set('timeMin', timeMin.toISOString());
  u.searchParams.set('timeMax', timeMax.toISOString());
  u.searchParams.set('singleEvents', 'true');   // expande los eventos que se repiten
  u.searchParams.set('orderBy', 'startTime');
  u.searchParams.set('maxResults', '2500');
  u.searchParams.set('timeZone', TZ);

  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404) throw new Error('Calendario no encontrado. Revisa el ID.');
    if (res.status === 403) throw new Error('Sin permiso sobre el calendario. ¿Lo compartiste con la cuenta de servicio?');
    throw new Error('Google Calendar: ' + ((data.error && data.error.message) || res.status));
  }
  return clasificarEventos(data.items, esPersonal);
}

const AGENDA_VACIA = { ocupa: [], cierra: [], cierraSucursal: [], dra: [], draOcupa: [] };
const mezclarAgendas = (a, b) => ({
  ocupa: a.ocupa.concat(b.ocupa),
  cierra: a.cierra.concat(b.cierra),
  cierraSucursal: a.cierraSucursal.concat(b.cierraSucursal),
  dra: a.dra.concat(b.dra),
  draOcupa: a.draOcupa.concat(b.draOcupa)
});

/* ¿Ese tramo [a,b) está cerrado para esa sucursal? Cierre total (ambas) o
   cierre propio de la sucursal (vacaciones puestas solo ahí). */
const cierraPara = (ag, suc, a, b) =>
  ag.cierra.some(([cs, ce]) => a < ce && b > cs) ||
  (ag.cierraSucursal || []).some(([cs, ce, k]) => k === suc && a < ce && b > cs);

async function agendaDe(env, timeMin, timeMax) {
  if (!env.CAL_CITAS) throw new Error('Falta el secret CAL_CITAS');
  const citas = await leerCalendario(env, env.CAL_CITAS, timeMin, timeMax, false);
  if (!env.CAL_PERSONAL) return citas;
  const personal = await leerCalendario(env, env.CAL_PERSONAL, timeMin, timeMax, true);
  return mezclarAgendas(citas, personal);
}

/* Quita de la agenda los tramos que produce un evento concreto. Se usa al
   editar: la cita que se está moviendo no puede contarse como obstáculo
   de sí misma. */
const sinEvento = (ag, id) => ({
  ocupa: ag.ocupa.filter(([, , , eid]) => eid !== id),
  cierra: ag.cierra.filter(([, , eid]) => eid !== id),
  cierraSucursal: (ag.cierraSucursal || []).filter(([, , , eid]) => eid !== id),
  dra: (ag.dra || []).filter(([, , , eid]) => eid !== id),
  draOcupa: (ag.draOcupa || []).filter(([, , eid]) => eid !== id)
});

/* ── pico de cabinas ocupadas a la vez dentro de [a,b) ── */
function pico(a, b, evs) {
  const dentro = evs.filter(([s, e]) => s < b && e > a);
  if (!dentro.length) return 0;
  const puntos = [a, ...dentro.map(([s]) => s).filter(s => s > a && s < b)];
  let max = 0;
  for (const p of puntos) {
    let c = 0;
    for (const [s, e] of dentro) if (s <= p && e > p) c++;
    if (c > max) max = c;
  }
  return max;
}

/* ── las citas de la Dra. de un día, ordenadas y ya con su buffer ──
   El buffer se suma AQUÍ, al leer, y no al crear el evento: así el
   calendario enseña la hora real de la cita y la limpieza se respeta
   igual. Vale tanto para las citas viejas como para las nuevas. */
function citasDraDelDia(ag, date) {
  const a0 = instant(date, 0).getTime();
  const a1 = instant(addDays(date, 1), 0).getTime();
  return (ag.dra || [])
    .filter(([s, e]) => s < a1 && e > a0)
    .map(([s, e, k]) => ({ ini: s, fin: e + BUFFER_DRA_MIN * 60000, suc: k }))
    .sort((x, y) => x.ini - y.ini);
}

/* ── el corazón de las reglas A y B ──
   Devuelve null si la Dra. puede tomar el tramo [a,b) en esa sucursal, o el
   motivo por el que no. [a,b) tiene que venir YA con el buffer sumado.

   El paso de los pares consecutivos revalida TODA la secuencia, no solo lo
   que toca al candidato: de ahí sale que la regla funcione en los dos
   sentidos sin importar en qué orden entraron las reservas. */
function conflictoDra(suyas, draOcupa, a, b, suc) {
  if ((draOcupa || []).some(([s, e]) => a < e && b > s)) return 'ocupada';
  if (suyas.some(c => a < c.fin && b > c.ini)) return 'ocupada';

  const seq = suyas.concat([{ ini: a, fin: b, suc }]).sort((x, y) => x.ini - y.ini);

  let cambios = 0;
  for (let i = 0; i < seq.length - 1; i++) if (seq[i].suc !== seq[i + 1].suc) cambios++;
  if (cambios > MAX_CAMBIOS_SEDE) return 'segundo_traslado';

  for (let i = 0; i < seq.length - 1; i++) {
    const x = seq[i], y = seq[i + 1];
    if (x.suc !== y.suc && (y.ini - x.fin) < TRASLADO_MIN * 60000) return 'traslado';
  }
  return null;
}

/* ── turnos con cabinas libres ──
   Devuelve { turnos, bloqueados }. turnos mantiene la forma de siempre
   ({h, c}) para no romper el panel ni "mi cita"; c = cabinas que quedarían
   libres. bloqueados dice por qué se cayó cada hora, y es lo que permite
   explicarle algo a la paciente en vez de enseñarle un calendario vacío.

   opciones: { requiereDra, sinLead } */
function freeSlots(date, duration, ag, suc, cupos, now, opciones) {
  const op = opciones || {};
  const requiereDra = !!op.requiereDra;
  const dur = duration + (requiereDra ? BUFFER_DRA_MIN : 0);
  const turnos = [], bloqueados = [];
  if (!WORKDAYS.includes(dowOf(date))) return { turnos, bloqueados };

  const mios = ag.ocupa.filter(([, , k]) => k === suc);
  const suyas = requiereDra ? citasDraDelDia(ag, date) : [];
  const isToday = date === now.date;

  for (let start = OPEN; start + dur <= CLOSE; start += STEP) {
    // lo que ya pasó no se reporta como bloqueado: es ruido, no un motivo
    if (isToday && !op.sinLead && start < now.mins + LEAD_MIN) continue;

    const a = instant(date, start).getTime();
    const b = instant(date, start + dur).getTime();
    const fuera = m => bloqueados.push({ hora: hhmm(start), motivo: m });

    if (cierraPara(ag, suc, a, b)) { fuera('cerrado'); continue; }

    /* Cabina: cuentan TODOS los eventos de esa sede, los de la Dra.
       incluidos — ella también ocupa cuarto. */
    const libres = cupos - pico(a, b, mios);
    if (libres <= 0) { fuera('sin_cabina'); continue; }

    /* Servicio de colaboradora: hasta aquí. No hay chequeo de personal,
       porque una colaboradora cubre las dos cabinas en paralelo. */
    if (!requiereDra) { turnos.push({ h: hhmm(start), c: libres, ultimaCabina: libres === 1 }); continue; }

    const motivo = conflictoDra(suyas, ag.draOcupa, a, b, suc);
    if (motivo) { fuera(motivo); continue; }

    turnos.push({ h: hhmm(start), c: libres, ultimaCabina: libres === 1 });
  }
  return { turnos, bloqueados };
}

/* ── la sugerencia ──
   Un calendario vacío se lee como "no hay cupo" y la paciente se va. Cuando
   un día no da turnos, esto arma el porqué y a dónde ir: la otra sucursal
   ese mismo día, o el próximo día con espacio en la misma. No vuelve a
   Google: reusa la agenda que ya se leyó. */
const MOTIVOS_ORDEN = ['traslado', 'segundo_traslado', 'ocupada', 'sin_cabina', 'cerrado'];

function sugerenciaPara(env, date, duration, ag, suc, now, op) {
  const cuenta = {};
  (op.bloqueados || []).forEach(x => { cuenta[x.motivo] = (cuenta[x.motivo] || 0) + 1; });
  const motivoPrincipal = MOTIVOS_ORDEN.filter(m => cuenta[m])
    .sort((x, y) => cuenta[y] - cuenta[x] || MOTIVOS_ORDEN.indexOf(x) - MOTIVOS_ORDEN.indexOf(y))[0]
    || (WORKDAYS.includes(dowOf(date)) ? 'sin_turnos' : 'cerrado');

  const otraK = laOtraSucursal(suc);
  let otraSucursal = null;
  if (otraK) {
    const r = freeSlots(date, duration, ag, otraK, cuposDe(env, otraK), now, op);
    if (r.turnos.length) otraSucursal = { sucursal: SUCURSALES[otraK].nombre, primerTurno: r.turnos[0].h };
  }

  let proximoDia = null;
  for (let i = 1; i <= HORIZONTE_SUG; i++) {
    const d = addDays(date, i);
    if (!WORKDAYS.includes(dowOf(d))) continue;
    const r = freeSlots(d, duration, ag, suc, cuposDe(env, suc), now, op);
    if (r.turnos.length) { proximoDia = { fecha: d, primerTurno: r.turnos[0].h }; break; }
  }

  /* dónde está ella ese día, para poder explicarlo en vez de solo negar */
  const fuera = citasDraDelDia(ag, date).filter(c => c.suc !== suc);
  const donde = fuera.length ? SUCURSALES[fuera[0].suc].nombre : null;
  const franja = fuera.length
    ? (new Date(fuera[0].ini - 4 * 3600 * 1000).getUTCHours() < 12 ? 'esa mañana' : 'esa tarde')
    : '';

  let mensaje;
  switch (motivoPrincipal) {
    case 'traslado':
    case 'segundo_traslado':
      mensaje = donde
        ? `La Dra. está en ${donde} ${franja} y necesita hora y media para cruzar la ciudad.`
        : 'Ese día la agenda de la Dra. ya está comprometida en la otra sucursal.';
      break;
    case 'ocupada':
      mensaje = 'La Dra. ya tiene la agenda llena ese día.'; break;
    case 'sin_cabina':
      mensaje = `Las cabinas de ${SUCURSALES[suc].nombre} están ocupadas todo el día.`; break;
    case 'cerrado':
      mensaje = `Ese día no atendemos en ${SUCURSALES[suc].nombre}.`; break;
    default:
      mensaje = `No quedan horarios ese día en ${SUCURSALES[suc].nombre}.`;
  }
  if (otraSucursal) mensaje += ` Sí hay espacio en ${otraSucursal.sucursal}, desde las ${en12(otraSucursal.primerTurno)}`;
  else if (proximoDia) mensaje += ' Te mostramos el próximo día con espacio.';
  else mensaje += ' Escríbenos por WhatsApp y te buscamos un hueco.';

  return { motivoPrincipal, mensaje, otraSucursal, proximoDia };
}

/* Lo que se le responde a la paciente cuando el turno se le fue de las manos
   entre que lo eligió y le dio a confirmar. */
const MENSAJE_409 = {
  traslado: 'Ese horario se acaba de cerrar: la Dra. tiene una cita en la otra sucursal y no alcanza a cruzar la ciudad.',
  segundo_traslado: 'Ese horario se acaba de cerrar: obligaría a la Dra. a cambiar de sucursal dos veces el mismo día.',
  ocupada: 'Ese horario acaba de ocuparse. Elige otro, por favor.',
  sin_cabina: 'Ya no queda cabina libre a esa hora. Elige otro horario, por favor.',
  cerrado: 'Ese día ya no estamos atendiendo en esa sucursal.'
};
const mensaje409 = m => MENSAJE_409[m] || MENSAJE_409.ocupada;

/* ── panel interno: comparación de clave en tiempo constante ── */
function claveOk(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/* Saca un campo de la descripción del evento ("Paciente: Juan" → "Juan") */
function campo(texto, etiqueta) {
  const re = new RegExp('^' + etiqueta + ':\\s*(.+)$', 'im');
  const m = re.exec(texto || '');
  return m ? m[1].trim() : '';
}

/* Las líneas con las que el sitio arma la descripción de una cita. Todo lo
   demás (el sello "Reservado desde el sitio web", las notas de seguimiento)
   es texto que hay que conservar tal cual al reescribir el evento. */
const CAMPOS_CITA = /^\s*(Paciente|Tel[eé]fono|Correo|Servicio|Sucursal|Promociones|Nota del paciente)\s*:/i;
const restoDescripcion = d => String(d || '')
  .split('\n')
  .filter(l => !CAMPOS_CITA.test(l))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/* ── enlace personal de la paciente ("mi cita") ──────────────────────
   Un token que identifica UNA cita concreta. No se puede inventar ni
   cambiar por el de otra: lleva una firma HMAC hecha con un secreto que
   solo conoce el servidor. La clave sale de CITA_SECRET si existe y, si
   no, se deriva de PANEL_CLAVE, para no tener que configurar nada nuevo.
   Se deriva, no se usa tal cual: de la firma no se puede sacar la clave.

   Formato: base64url({i:idEvento, c:calendario, x:vence}) + "." + firma  */
const b64urlTxt = t => btoa(String.fromCharCode(...new TextEncoder().encode(t)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64urlTxt = t => new TextDecoder().decode(
  Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

async function firmarCita(env, payload) {
  const base = env.CITA_SECRET || env.PANEL_CLAVE;
  if (!base) throw new Error('Falta PANEL_CLAVE (o CITA_SECRET) para firmar los enlaces de cita.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('cita-v1:' + base),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

async function tokenCita(env, id, calendario, venceEn) {
  const p = b64urlTxt(JSON.stringify({ i: id, c: calendario === 'personal' ? 'p' : 'c', x: venceEn }));
  return p + '.' + await firmarCita(env, p);
}

/* Devuelve { id, calendario } o null si el token está roto, falsificado o vencido. */
async function leerTokenCita(env, token) {
  const t = String(token || '');
  const corte = t.lastIndexOf('.');
  if (corte < 1) return null;
  const payload = t.slice(0, corte), firma = t.slice(corte + 1);
  let esperada;
  try { esperada = await firmarCita(env, payload); } catch (e) { return null; }
  if (!claveOk(firma, esperada)) return null;         // comparación en tiempo constante
  let d;
  try { d = JSON.parse(deB64urlTxt(payload)); } catch (e) { return null; }
  if (!d.i || !d.x || Date.now() > d.x * 1000) return null;
  return { id: String(d.i), calendario: d.c === 'p' ? 'personal' : 'citas' };
}

const horasAviso = env => {
  const n = parseInt(env.HORAS_CANCELACION, 10);
  return Number.isFinite(n) && n >= 0 ? n : CANCELA_DEF;
};

/* Trae el evento al que apunta un token. Lanza con un mensaje ya listo
   para enseñarle a la paciente. */
async function citaDeToken(env, tk) {
  const calId = tk.calendario === 'personal' ? env.CAL_PERSONAL : env.CAL_CITAS;
  if (!calId) throw new Error('No encontramos tu cita.');
  const token = await getToken(env);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(tk.id)}`;
  const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  const ev = await res.json();
  if (!res.ok) throw new Error('No encontramos tu cita. Puede que ya no exista.');
  return { base, token, ev };
}

/* Lo que se le enseña a la paciente. A propósito NO viajan su teléfono ni su
   correo: si el enlace se reenvía a alguien más, no se le regalan sus datos. */
function vistaCita(env, ev) {
  const desc = ev.description || '';
  const cancelada = ev.status === 'cancelled' || !ev.start || !ev.start.dateTime;
  const t0 = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime) : null;
  const t1 = t0 ? new Date((ev.end && ev.end.dateTime) || ev.start.dateTime) : null;
  const local = t0 ? new Date(t0.getTime() - 4 * 3600 * 1000).toISOString() : '';
  const sucKey = claveSucursal(ev.location);
  const horas = horasAviso(env);
  const faltan = t0 ? (t0.getTime() - Date.now()) / 3600000 : -1;

  return {
    fecha: local.slice(0, 10),
    hora: local.slice(11, 16),
    duracion: t0 ? Math.max(0, Math.round((t1 - t0) / 60000)) : 0,
    servicio: campo(desc, 'Servicio') || (ev.summary || '').split('·')[0].trim(),
    sucursal: sucKey ? SUCURSALES[sucKey].nombre : (ev.location || ''),
    nombre: campo(desc, 'Paciente') || '',
    nota: campo(desc, 'Nota del paciente'),
    estado: cancelada ? 'Cancelada' : (faltan < 0 ? 'Pasada' : 'Agendada'),
    puedeCambiar: !cancelada && faltan >= horas,
    horasMinimas: horas,
    requiereDra: eventoEsDra(ev)
  };
}

/* ── base de datos (D1): pacientes, consentimientos, notas de seguimiento ──
   Un mismo paciente puede llegar por distintas vías (agenda web, panel de
   citas, formulario de consentimiento), así que buscamos primero por
   identificación (cédula/pasaporte), y si no hay, por teléfono o correo,
   antes de crear uno nuevo — para no duplicar al mismo paciente cada vez. */
async function upsertPaciente(env, datos) {
  const nombre = String(datos.nombre || '').trim();
  const identificacion = String(datos.identificacion || '').trim();
  const telefono = String(datos.telefono || '').trim();
  const correo = String(datos.correo || '').trim().toLowerCase();
  const antecedentes = String(datos.antecedentes || '').trim();

  let row = null;
  if (identificacion) row = await env.DB.prepare('SELECT * FROM pacientes WHERE identificacion = ?').bind(identificacion).first();
  if (!row && telefono) row = await env.DB.prepare('SELECT * FROM pacientes WHERE telefono = ?').bind(telefono).first();
  if (!row && correo) row = await env.DB.prepare('SELECT * FROM pacientes WHERE correo = ?').bind(correo).first();
  // Último recurso: si la cita solo trae el nombre (típico de citas puestas a
  // mano en el calendario), buscamos por nombre. Sin esto, cada sincronización
  // volvería a crear a la misma persona una y otra vez.
  if (!row && nombre && !identificacion && !telefono && !correo) {
    row = await env.DB.prepare(
      "SELECT * FROM pacientes WHERE lower(trim(nombre)) = lower(trim(?))"
    ).bind(nombre).first();
  }

  if (row) {
    await env.DB.prepare(`UPDATE pacientes SET
        nombre = CASE WHEN ? != '' THEN ? ELSE nombre END,
        identificacion = CASE WHEN ? != '' THEN ? ELSE identificacion END,
        telefono = CASE WHEN ? != '' THEN ? ELSE telefono END,
        correo = CASE WHEN ? != '' THEN ? ELSE correo END,
        antecedentes = CASE WHEN ? != '' THEN ? ELSE antecedentes END,
        actualizado_en = datetime('now')
      WHERE id = ?`)
      .bind(nombre, nombre, identificacion, identificacion, telefono, telefono, correo, correo, antecedentes, antecedentes, row.id)
      .run();
    return row.id;
  }

  const res = await env.DB.prepare(
    'INSERT INTO pacientes (nombre, identificacion, telefono, correo, antecedentes) VALUES (?, ?, ?, ?, ?)'
  ).bind(nombre, identificacion, telefono, correo, antecedentes).run();
  return res.meta.last_row_id;
}

/* Guarda (o actualiza) una cita en la base de datos, ligada a su paciente.
   Se identifica por el id del evento de Google Calendar, así que volver a
   sincronizar el mismo rango no duplica nada: refresca lo que ya estaba. */
async function guardarCita(env, pacienteId, c) {
  await env.DB.prepare(`
    INSERT INTO citas (paciente_id, cita_id, fecha, hora, servicio, sucursal, estado, origen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cita_id) DO UPDATE SET
      paciente_id = excluded.paciente_id,
      fecha = excluded.fecha,
      hora = excluded.hora,
      servicio = excluded.servicio,
      sucursal = excluded.sucursal,
      estado = excluded.estado,
      origen = excluded.origen
  `).bind(
    pacienteId,
    String(c.id || ''),
    String(c.fecha || ''),
    String(c.hora || ''),
    String(c.servicio || ''),
    String(c.sucursal || ''),
    String(c.estado || ''),
    String(c.origen || '')
  ).run();
}

/* Trae TODOS los eventos de un calendario en el rango, paginando. */
async function eventosDeCalendario(token, calendarId, timeMin, timeMax) {
  const items = [];
  let pageToken = '';
  do {
    const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    u.searchParams.set('timeMin', timeMin.toISOString());
    u.searchParams.set('timeMax', timeMax.toISOString());
    u.searchParams.set('singleEvents', 'true');
    u.searchParams.set('showDeleted', 'true');
    u.searchParams.set('orderBy', 'startTime');
    u.searchParams.set('maxResults', '2500');
    u.searchParams.set('timeZone', TZ);
    if (pageToken) u.searchParams.set('pageToken', pageToken);

    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 404) throw new Error('Calendario no encontrado. Revisa el ID.');
      if (res.status === 403) throw new Error('Sin permiso sobre el calendario.');
      throw new Error('Google Calendar: ' + ((data.error && data.error.message) || res.status));
    }
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

/* Lee TODAS las citas del calendario de citas web, incluidas las canceladas.
   Devuelve filas planas, listas para tabla y para exportar.
   También agrega, marcadas como "Personal", las citas que la Dra. haya
   agendado directamente en su calendario personal en vez de "Citas web" —
   si no, esas quedaban invisibles en el panel aunque sí ocupan cabina. */
async function listarCitas(env, timeMin, timeMax) {
  const token = await getToken(env);
  const ahora = Date.now();
  const filas = [];

  const itemsCitas = await eventosDeCalendario(token, env.CAL_CITAS, timeMin, timeMax);
  for (const ev of itemsCitas) {
    const ini = ev.start && (ev.start.dateTime || ev.start.date);
    if (!ini) continue;                                  // cancelada sin fecha: no aporta nada
    const desc = ev.description || '';
    const web = /Reservado desde el sitio web/i.test(desc);
    const t0 = new Date(ev.start.dateTime || `${ev.start.date}T00:00:00${OFF}`);
    const t1 = new Date((ev.end && (ev.end.dateTime || `${ev.end.date}T00:00:00${OFF}`)) || t0);
    const local = new Date(t0.getTime() - 4 * 3600 * 1000).toISOString();

    const cancelada = ev.status === 'cancelled';
    const sucKey = claveSucursal(ev.location);

    filas.push({
      id: ev.id,
      fecha: local.slice(0, 10),
      hora: local.slice(11, 16),
      duracion: Math.max(0, Math.round((t1 - t0) / 60000)),
      sucursal: sucKey ? SUCURSALES[sucKey].nombre : (ev.location || '—'),
      nombre: campo(desc, 'Paciente') || (ev.summary || '').split('·').slice(1).join('·').trim(),
      telefono: campo(desc, 'Tel[ée]fono'),
      email: campo(desc, 'Correo'),
      servicio: campo(desc, 'Servicio') || (ev.summary || '').split('·')[0].trim(),
      nota: campo(desc, 'Nota del paciente'),
      promos: /^Promociones:\s*S[ií]/im.test(desc),
      estado: cancelada ? 'Cancelada' : (t1.getTime() < ahora ? 'Atendida' : 'Agendada'),
      origen: web ? 'Web' : 'Manual',
      diaCompleto: !ev.start.dateTime,
      dra: !ev.start.date && eventoEsDra(ev),
      creada: ev.created ? ev.created.slice(0, 10) : ''
    });
  }

  if (env.CAL_PERSONAL) {
    const itemsPersonal = await eventosDeCalendario(token, env.CAL_PERSONAL, timeMin, timeMax);
    for (const ev of itemsPersonal) {
      const ini = ev.start && (ev.start.dateTime || ev.start.date);
      if (!ini) continue;
      if (ev.start.date) continue;                        // día completo → bloqueo (vacaciones/cerrado), no es una cita
      if (ev.transparency === 'transparent') continue;      // marcado "Disponible" → no es una cita real
      const desc = ev.description || '';
      const t0 = new Date(ev.start.dateTime);
      const t1 = new Date((ev.end && ev.end.dateTime) || t0);
      const local = new Date(t0.getTime() - 4 * 3600 * 1000).toISOString();

      const cancelada = ev.status === 'cancelled';
      const sucKey = claveSucursal(ev.location);

      filas.push({
        id: ev.id,
        fecha: local.slice(0, 10),
        hora: local.slice(11, 16),
        duracion: Math.max(0, Math.round((t1 - t0) / 60000)),
        sucursal: sucKey ? SUCURSALES[sucKey].nombre : '—',
        nombre: campo(desc, 'Paciente') || ev.summary || '—',
        telefono: campo(desc, 'Tel[ée]fono'),
        email: campo(desc, 'Correo'),
        servicio: campo(desc, 'Servicio') || '',
        nota: 'Agendada por la Dra. directo en su calendario personal — verifica sucursal y datos.',
        promos: false,
        estado: cancelada ? 'Cancelada' : (t1.getTime() < ahora ? 'Atendida' : 'Agendada'),
        origen: 'Personal',
        diaCompleto: false,
        dra: true,
        creada: ev.created ? ev.created.slice(0, 10) : ''
      });
    }
  }

  filas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return filas;
}

/* ── CORS ── */
function corsHeaders(request, env) {
  const list = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : DEFAULT_ORIGINS)
    .map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const ok = list.includes(origin) || /^https:\/\/[a-z0-9-]+\.(pages|workers)\.dev$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (list[0] || '*'),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

const json = (body, status, request, env) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(request, env)
  }
});

/* ── rutas ── */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    try {
      /* ── diagnóstico ──
         Trae los valores de las reglas para poder confirmar de un vistazo,
         abriendo /api/salud en el navegador, que lo desplegado es lo nuevo. */
      if (path === '/api/salud') {
        if (!env.GOOGLE_SA_JSON) return json({ ok: false, error: 'Falta el secret GOOGLE_SA_JSON' }, 500, request, env);
        if (!env.CAL_CITAS) return json({ ok: false, error: 'Falta el secret CAL_CITAS' }, 500, request, env);
        const sa = JSON.parse(env.GOOGLE_SA_JSON);
        await getToken(env);

        const hoy = localNow().date;
        const t0 = instant(hoy, 0), t1 = instant(addDays(hoy, 1), 0);
        const chequeo = {};

        try {
          const c = await leerCalendario(env, env.CAL_CITAS, t0, t1, false);
          chequeo['Citas web'] = `acceso correcto · ${c.ocupa.length} citas hoy (${c.dra.length} de la Dra.) · ${c.cierra.length} bloqueos`;
        } catch (e) { chequeo['Citas web'] = 'ERROR · ' + e.message; }

        if (env.CAL_PERSONAL) {
          try {
            const p = await leerCalendario(env, env.CAL_PERSONAL, t0, t1, true);
            chequeo['Agenda personal'] = `acceso correcto · ${p.draOcupa.length} compromisos hoy · ${p.cierra.length} cierres de clínica`;
          } catch (e) { chequeo['Agenda personal'] = 'ERROR · ' + e.message; }
        } else chequeo['Agenda personal'] = 'no configurada (opcional)';

        return json({
          ok: true,
          version: 'dra-2sedes-1',
          cuentaDeServicio: sa.client_email,
          horario: `${hhmm(OPEN)}–${hhmm(CLOSE)} · días ${WORKDAYS.join(',')} (0=dom)`,
          sucursales: Object.values(SUCURSALES).map(s => `${s.nombre}: ${nInt(env[s.cupos], CUPOS_DEF)} cabinas`),
          reglasDeLaDra: {
            TRASLADO_MIN,
            MAX_CAMBIOS_SEDE,
            BUFFER_DRA_MIN,
            serviciosDra: SERVICIOS_DRA.length,
            palabrasClaveDra: PALABRAS_DRA.length,
            calendarioPersonal: 'cierra solo los procedimientos de la Dra., en las dos sedes'
          },
          PERSONAL_SOLO_CLAVE: `${env.PERSONAL_SOLO_CLAVE || '(sin definir)'} — OBSOLETA: ya no se usa, el alcance es correcto por diseño`,
          calendarios: chequeo
        }, 200, request, env);
      }

      /* ── disponibilidad ──
         "servicio" es opcional. Sin él solo se calcula la cabina (es como
         llama el panel, y así sigue viendo la agenda sin restricciones).
         Con él se aplican además las reglas de la Dra.

         Se leen HORIZONTE_SUG días de más para poder decir "el próximo día
         con espacio es el X" sin volver a llamar a Google. */
      if (path === '/api/disponibilidad' && request.method === 'GET') {
        const desde = url.searchParams.get('desde');
        const dias = Math.min(Math.max(nInt(url.searchParams.get('dias'), 6), 1), 14);
        const suc = claveSucursal(url.searchParams.get('sucursal'));
        const dur = Math.min(Math.max(nInt(url.searchParams.get('dur'), 45), 15), 240);
        const servicio = url.searchParams.get('servicio') || '';
        const requiereDra = esServicioDra(servicio);

        if (!isDate(desde)) return json({ ok: false, error: 'Fecha inválida.' }, 400, request, env);
        if (!suc) return json({ ok: false, error: 'Sucursal no reconocida.' }, 400, request, env);

        const now = localNow();
        if (desde > addDays(now.date, MAX_AHEAD)) return json({ ok: true, dias: {} }, 200, request, env);

        const cupos = cuposDe(env, suc);
        const ag = await agendaDe(env, instant(desde, 0), instant(addDays(desde, dias + HORIZONTE_SUG), 0));

        const resultado = {}, bloqueados = {}, sugerencias = {};
        for (let i = 0; i < dias; i++) {
          const d = addDays(desde, i);
          if (d < now.date || d > addDays(now.date, MAX_AHEAD)) { resultado[d] = []; continue; }

          const r = freeSlots(d, dur, ag, suc, cupos, now, { requiereDra });
          resultado[d] = r.turnos;
          /* el porqué de cada hora que se cayó: sirve para explicar, y para
             poder depurar desde el navegador por qué falta un turno */
          if (r.bloqueados.length) bloqueados[d] = r.bloqueados;
          if (r.turnos.length) continue;

          /* Día sin turnos: se explica y se ofrece a dónde ir. Un calendario
             vacío y mudo se lee como "no hay cupo" y la paciente se va. */
          sugerencias[d] = sugerenciaPara(env, d, dur, ag, suc, now, {
            requiereDra, bloqueados: r.bloqueados
          });
        }
        return json({
          ok: true, dias: resultado, duracion: dur, cupos,
          servicio, requiereDra, bloqueados, sugerencias
        }, 200, request, env);
      }

      /* ── reserva ── */
      if (path === '/api/reservar' && request.method === 'POST') {
        const b = await request.json().catch(() => ({}));
        if (b.web) return json({ ok: true }, 200, request, env);   // trampa anti-bots

        const falta = ['fecha', 'hora', 'sucursal', 'nombre', 'telefono', 'email', 'servicio']
          .find(k => !String(b[k] || '').trim());
        if (falta) return json({ ok: false, error: `Falta el campo: ${falta}` }, 400, request, env);
        if (!isDate(b.fecha) || !/^\d{2}:\d{2}$/.test(b.hora)) {
          return json({ ok: false, error: 'Fecha u hora inválida.' }, 400, request, env);
        }

        const suc = claveSucursal(b.sucursal);
        if (!suc) return json({ ok: false, error: 'Sucursal no reconocida.' }, 400, request, env);
        const info = SUCURSALES[suc];
        const cupos = cuposDe(env, suc);

        const dur = Math.min(Math.max(nInt(b.duracion, 45), 15), 240);
        const mins = +b.hora.slice(0, 2) * 60 + +b.hora.slice(3, 5);
        const now = localNow();
        const requiereDra = esServicioDra(b.servicio);

        if (!WORKDAYS.includes(dowOf(b.fecha))) return json({ ok: false, error: 'Ese día el consultorio no abre.' }, 409, request, env);
        if (mins < OPEN || mins + dur > CLOSE) return json({ ok: false, error: 'Ese horario está fuera del horario de atención.' }, 409, request, env);
        if (b.fecha < now.date || (b.fecha === now.date && mins < now.mins + LEAD_MIN)) {
          return json({ ok: false, error: 'Ese horario ya pasó. Elige otro.' }, 409, request, env);
        }

        /* Revalidación contra el calendario, justo antes de escribir. Se
           corre el MISMO cálculo que armó la lista de turnos, para este solo
           candidato. Sin esto hay dobles reservas: dos personas pueden pedir
           horarios incompatibles en sedes distintas con segundos de
           diferencia, y las dos ver "disponible" cuando eligieron.
           Se lee el día entero (no solo el tramo) porque las reglas de la
           Dra. dependen de TODAS sus citas de ese día, en las dos sedes. */
        const ag = await agendaDe(env,
          instant(b.fecha, 0), instant(addDays(b.fecha, 1 + HORIZONTE_SUG), 0));
        const chequeo = freeSlots(b.fecha, dur, ag, suc, cupos, now, { requiereDra });
        if (!chequeo.turnos.some(t => t.h === b.hora)) {
          const motivo = (chequeo.bloqueados.find(x => x.hora === b.hora) || {}).motivo || 'ocupada';
          return json({
            ok: false, motivo, error: mensaje409(motivo),
            sugerencia: sugerenciaPara(env, b.fecha, dur, ag, suc, now, {
              requiereDra, bloqueados: chequeo.bloqueados
            })
          }, 409, request, env);
        }

        const lim = s => String(s || '').slice(0, 300);
        const token = await getToken(env);
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.CAL_CITAS)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: `${lim(b.servicio)} · ${lim(b.nombre)}`,
              location: info.nombre,          // ← define a qué sucursal pertenece
              colorId: info.color,            // ← color distinto por sucursal
              /* Marca legible por máquina: es la señal definitiva de si la
                 cita consume a la Dra., y no depende de cómo se escriba el
                 título. Google la guarda y no la muestra en la interfaz. */
              extendedProperties: {
                private: {
                  dra: requiereDra ? '1' : '0',
                  sede: info.nombre,
                  servicio: normDra(b.servicio).slice(0, 120)
                }
              },
              description: [
                `Paciente: ${lim(b.nombre)}`,
                `Teléfono: ${lim(b.telefono)}`,
                `Correo: ${lim(b.email)}`,
                `Servicio: ${lim(b.servicio)}${b.precio ? ' · ' + lim(b.precio) : ''}`,
                `Sucursal: ${info.nombre}`,
                `Promociones: ${b.promos === true ? 'Sí' : 'No'}`,
                b.nota ? `Nota del paciente: ${lim(b.nota)}` : '',
                '', 'Reservado desde el sitio web.'
              ].filter(Boolean).join('\n'),
              start: { dateTime: `${b.fecha}T${b.hora}:00${OFF}`, timeZone: TZ },
              end: { dateTime: `${b.fecha}T${hhmm(mins + dur)}:00${OFF}`, timeZone: TZ }
            })
          }
        );
        const ev = await res.json();
        if (!res.ok) return json({ ok: false, error: 'No se pudo guardar la cita: ' + ((ev.error && ev.error.message) || res.status) }, 502, request, env);

        // La cita ya quedó en el calendario. Además la registramos en la base
        // de datos para que la paciente tenga historial desde el primer día.
        // Si la base falla, la reserva NO se cae: el calendario manda.
        if (env.DB) {
          try {
            const pid = await upsertPaciente(env, { nombre: b.nombre, telefono: b.telefono, correo: b.email });
            await guardarCita(env, pid, {
              id: ev.id, fecha: b.fecha, hora: b.hora,
              servicio: b.servicio, sucursal: info.nombre,
              estado: 'Agendada', origen: 'Web'
            });
          } catch (e) { /* silencioso a propósito */ }
        }

        /* Enlace personal para ver, mover o cancelar su cita. Vence dos días
           después de la cita: para entonces ya no hay nada que gestionar.
           Si por lo que sea no se puede firmar, la reserva NO se cae — la
           paciente siempre tiene el WhatsApp. */
        let enlace = '';
        try {
          const finMs = instant(b.fecha, mins + dur).getTime();
          enlace = await tokenCita(env, ev.id, 'citas', Math.floor(finMs / 1000) + 2 * 86400);
        } catch (e) { /* sin enlace, pero con cita */ }

        return json({ ok: true, id: ev.id, fecha: b.fecha, hora: b.hora, duracion: dur, sucursal: info.nombre, requiereDra, token: enlace }, 200, request, env);
      }

      /* ── "mi cita": lo que la paciente puede hacer sola ─────────────────
         Todo esto es público, sin clave: el acceso es el enlace firmado que
         se le dio al reservar. Cada endpoint verifica la firma antes de
         tocar nada, así que un enlace inventado no llega a ningún lado.
         Cancelar y mover se cierran cuando faltan menos de HORAS_CANCELACION
         horas — ahí la mandamos a WhatsApp, que es cuando de verdad conviene
         hablar con la clínica. */

      /* ver mi cita */
      if (path === '/api/cita' && request.method === 'GET') {
        const tk = await leerTokenCita(env, url.searchParams.get('t'));
        if (!tk) return json({ ok: false, error: 'Este enlace no es válido o ya venció.' }, 401, request, env);
        const { ev } = await citaDeToken(env, tk);
        return json({ ok: true, cita: vistaCita(env, ev) }, 200, request, env);
      }

      /* horarios libres para reprogramarla — descontando su propia cita, que
         si no se vería a sí misma ocupando la cabina. El servicio sale del
         evento, así que si es un procedimiento de la Dra. la paciente solo
         ve horarios donde ella de verdad puede estar en esa sucursal. */
      if (path === '/api/cita/horarios' && request.method === 'GET') {
        const tk = await leerTokenCita(env, url.searchParams.get('t'));
        if (!tk) return json({ ok: false, error: 'Este enlace no es válido o ya venció.' }, 401, request, env);
        const { ev } = await citaDeToken(env, tk);
        const v = vistaCita(env, ev);
        if (!v.puedeCambiar) {
          return json({ ok: false, error: `Faltan menos de ${v.horasMinimas} horas para tu cita. Escríbenos por WhatsApp y la movemos contigo.` }, 409, request, env);
        }
        const suc = claveSucursal(ev.location);
        if (!suc) return json({ ok: false, error: 'Escríbenos por WhatsApp para mover esta cita.' }, 409, request, env);

        const desde = url.searchParams.get('desde');
        const dias = Math.min(Math.max(nInt(url.searchParams.get('dias'), 6), 1), 14);
        if (!isDate(desde)) return json({ ok: false, error: 'Fecha inválida.' }, 400, request, env);

        const now = localNow();
        const cupos = cuposDe(env, suc);
        const dur = v.duracion || 45;
        const opciones = { requiereDra: v.requiereDra };
        const ag = sinEvento(
          await agendaDe(env, instant(desde, 0), instant(addDays(desde, dias + HORIZONTE_SUG), 0)),
          tk.id
        );

        const resultado = {}, sugerencias = {};
        for (let i = 0; i < dias; i++) {
          const d = addDays(desde, i);
          if (d < now.date || d > addDays(now.date, MAX_AHEAD)) { resultado[d] = []; continue; }
          const r = freeSlots(d, dur, ag, suc, cupos, now, opciones);
          resultado[d] = r.turnos;
          if (!r.turnos.length) {
            sugerencias[d] = sugerenciaPara(env, d, dur, ag, suc, now,
              Object.assign({ bloqueados: r.bloqueados }, opciones));
          }
        }
        return json({ ok: true, dias: resultado, duracion: dur, sucursal: v.sucursal, requiereDra: v.requiereDra, sugerencias }, 200, request, env);
      }

      /* cancelar mi cita */
      if (path === '/api/cita/cancelar' && request.method === 'POST') {
        const b = await request.json().catch(() => ({}));
        const tk = await leerTokenCita(env, b.t);
        if (!tk) return json({ ok: false, error: 'Este enlace no es válido o ya venció.' }, 401, request, env);
        const { base, token, ev } = await citaDeToken(env, tk);
        const v = vistaCita(env, ev);
        if (v.estado === 'Cancelada') return json({ ok: false, error: 'Esta cita ya estaba cancelada.' }, 409, request, env);
        if (v.estado === 'Pasada') return json({ ok: false, error: 'Esta cita ya pasó.' }, 409, request, env);
        if (!v.puedeCambiar) {
          return json({ ok: false, error: `Faltan menos de ${v.horasMinimas} horas para tu cita. Escríbenos por WhatsApp para cancelarla.` }, 409, request, env);
        }

        /* Dejamos constancia de quién canceló ANTES de borrar: en el panel una
           cita cancelada por la paciente y una borrada por la Dra. se ven
           igual, y no es lo mismo. */
        const sello = `Cancelada por la paciente desde el enlace del sitio el ${localNow().date}.`;
        await fetch(base, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: `CANCELADA · ${ev.summary || ''}`.slice(0, 300),
            description: ((ev.description || '').trim() + '\n\n' + sello).trim()
          })
        }).catch(() => {});

        const res = await fetch(base, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          const d = await res.json().catch(() => ({}));
          return json({ ok: false, error: 'No pudimos cancelar tu cita: ' + ((d.error && d.error.message) || res.status) }, 502, request, env);
        }

        // el calendario ya está libre; la constancia en la base es aparte
        if (env.DB) {
          try {
            await env.DB.prepare("UPDATE citas SET estado = 'Cancelada' WHERE cita_id = ?").bind(tk.id).run();
            const pid = await upsertPaciente(env, { nombre: v.nombre });
            await env.DB.prepare('INSERT INTO notas_seguimiento (paciente_id, cita_id, nota) VALUES (?, ?, ?)')
              .bind(pid, tk.id, sello).run();
          } catch (e) { /* silencioso a propósito */ }
        }
        return json({ ok: true }, 200, request, env);
      }

      /* mover mi cita a otro horario */
      if (path === '/api/cita/mover' && request.method === 'POST') {
        const b = await request.json().catch(() => ({}));
        const tk = await leerTokenCita(env, b.t);
        if (!tk) return json({ ok: false, error: 'Este enlace no es válido o ya venció.' }, 401, request, env);
        const { base, token, ev } = await citaDeToken(env, tk);
        const v = vistaCita(env, ev);
        if (v.estado !== 'Agendada') return json({ ok: false, error: 'Esta cita ya no se puede mover.' }, 409, request, env);
        if (!v.puedeCambiar) {
          return json({ ok: false, error: `Faltan menos de ${v.horasMinimas} horas para tu cita. Escríbenos por WhatsApp y la movemos contigo.` }, 409, request, env);
        }

        const fecha = String(b.fecha || '').trim(), hora = String(b.hora || '').trim();
        if (!isDate(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
          return json({ ok: false, error: 'Fecha u hora inválida.' }, 400, request, env);
        }
        const suc = claveSucursal(ev.location);
        if (!suc) return json({ ok: false, error: 'Escríbenos por WhatsApp para mover esta cita.' }, 409, request, env);
        const info = SUCURSALES[suc];
        const dur = v.duracion || 45;
        const mins = +hora.slice(0, 2) * 60 + +hora.slice(3, 5);
        const now = localNow();

        /* Aquí sí valen todas las reglas de una reserva normal: quien está del
           otro lado es la paciente, no la Dra. No hay "guardar de todos modos". */
        if (!WORKDAYS.includes(dowOf(fecha))) return json({ ok: false, error: 'Ese día el consultorio no abre.' }, 409, request, env);
        if (mins < OPEN || mins + dur > CLOSE) return json({ ok: false, error: 'Ese horario está fuera del horario de atención.' }, 409, request, env);
        if (fecha > addDays(now.date, MAX_AHEAD)) return json({ ok: false, error: 'Esa fecha está muy lejos. Elige otra más cercana.' }, 409, request, env);
        if (fecha < now.date || (fecha === now.date && mins < now.mins + LEAD_MIN)) {
          return json({ ok: false, error: 'Ese horario ya pasó. Elige otro.' }, 409, request, env);
        }

        const ag = sinEvento(
          await agendaDe(env, instant(fecha, 0), instant(addDays(fecha, 1 + HORIZONTE_SUG), 0)),
          tk.id
        );
        const opciones = { requiereDra: v.requiereDra };
        const chequeo = freeSlots(fecha, dur, ag, suc, cuposDe(env, suc), now, opciones);
        if (!chequeo.turnos.some(t => t.h === hora)) {
          const motivo = (chequeo.bloqueados.find(x => x.hora === hora) || {}).motivo || 'ocupada';
          return json({
            ok: false, motivo, error: mensaje409(motivo),
            sugerencia: sugerenciaPara(env, fecha, dur, ag, suc, now,
              Object.assign({ bloqueados: chequeo.bloqueados }, opciones))
          }, 409, request, env);
        }

        const sello = `Movida por la paciente el ${now.date}: antes era ${v.fecha} a las ${v.hora}.`;
        const res = await fetch(base, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: ((ev.description || '').trim() + '\n\n' + sello).trim(),
            start: { dateTime: `${fecha}T${hora}:00${OFF}`, timeZone: TZ },
            end: { dateTime: `${fecha}T${hhmm(mins + dur)}:00${OFF}`, timeZone: TZ }
          })
        });
        const data = await res.json();
        if (!res.ok) {
          return json({ ok: false, error: 'No pudimos mover tu cita: ' + ((data.error && data.error.message) || res.status) }, 502, request, env);
        }

        if (env.DB) {
          try {
            await env.DB.prepare('UPDATE citas SET fecha = ?, hora = ? WHERE cita_id = ?').bind(fecha, hora, tk.id).run();
          } catch (e) { /* silencioso a propósito */ }
        }
        return json({ ok: true, fecha, hora, duracion: dur, sucursal: info.nombre }, 200, request, env);
      }

      /* ── panel: editar una cita que todavía no ha pasado ──
         Cambia el procedimiento, la sucursal, la fecha/hora, la duración o los
         datos del paciente, y lo escribe en Google Calendar — que es la agenda
         real. Lo que ya pasó no se toca: eso es historial.

         Por defecto revalida horario, cabinas y las reglas de la Dra. igual
         que una reserva nueva, pero descontando la propia cita (si no,
         moverla dentro de su mismo turno chocaría consigo misma). Cuando algo
         no cuadra responde 409 con conflicto:true, y el panel ofrece "Guardar
         de todos modos" — que reenvía con forzar:true. La Dra. sabe cuándo
         puede meter algo fuera de horario o cruzar la ciudad a la carrera; el
         sistema avisa, no le prohíbe. */
      if (path === '/api/citas/editar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }

        const id = String(b.id || '').trim();
        if (!id) return json({ ok: false, error: 'Falta el id de la cita.' }, 400, request, env);
        const esPersonal = b.calendario === 'personal';
        const calId = esPersonal ? env.CAL_PERSONAL : env.CAL_CITAS;
        if (!calId) return json({ ok: false, error: 'Ese calendario no está configurado.' }, 400, request, env);

        const token = await getToken(env);
        const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`;
        const previa = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
        const ev = await previa.json();
        if (!previa.ok) {
          return json({ ok: false, error: 'No se encontró esa cita: ' + ((ev.error && ev.error.message) || previa.status) }, 404, request, env);
        }
        if (ev.status === 'cancelled') {
          return json({ ok: false, error: 'Esa cita está cancelada. Agenda una nueva en vez de editar esta.' }, 409, request, env);
        }
        if (!ev.start || !ev.start.dateTime) {
          return json({ ok: false, error: 'Eso es un bloqueo de día completo, no una cita. Edítalo directo en Google Calendar.' }, 409, request, env);
        }

        // "las citas que no han pasado": se mide contra el FIN del evento,
        // así una cita que está ocurriendo ahora mismo todavía se puede mover.
        const iniAct = new Date(ev.start.dateTime);
        const finAct = new Date((ev.end && ev.end.dateTime) || ev.start.dateTime);
        if (finAct.getTime() <= Date.now()) {
          return json({ ok: false, error: 'Esa cita ya pasó. Solo se pueden editar las que aún no han ocurrido.' }, 409, request, env);
        }

        /* Valores que ya tiene el evento. Solo cambia lo que venga en la
           petición; un campo ausente se queda como estaba, y un campo
           presente pero vacío se borra a propósito. */
        const desc = ev.description || '';
        const localAct = new Date(iniAct.getTime() - 4 * 3600 * 1000).toISOString();
        const durAct = Math.max(15, Math.round((finAct - iniAct) / 60000));
        const lim = s => String(s == null ? '' : s).trim().slice(0, 300);
        const trae = k => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== null && b[k] !== undefined;
        const val = (k, viejo) => trae(k) ? lim(b[k]) : viejo;

        const nombreViejo = campo(desc, 'Paciente') || (ev.summary || '').split('·').slice(1).join('·').trim();
        /* El título se arma como "Servicio · Paciente" y la descripción guarda
           "Servicio: nombre · precio". Para no arrastrar el precio dentro del
           nombre del servicio, se recorta el paciente del título. */
        const servicioViejo = (() => {
          const s = String(ev.summary || '').trim();
          if (nombreViejo && s.endsWith(' · ' + nombreViejo)) return s.slice(0, s.length - (' · ' + nombreViejo).length).trim();
          return campo(desc, 'Servicio') || s.split('·')[0].trim();
        })();
        const precioViejo = (() => {
          const c = campo(desc, 'Servicio');
          if (!c || !servicioViejo || !c.startsWith(servicioViejo)) return '';
          return c.slice(servicioViejo.length).replace(/^\s*·\s*/, '').trim();
        })();

        const fecha = trae('fecha') ? lim(b.fecha) : localAct.slice(0, 10);
        const hora = trae('hora') ? lim(b.hora) : localAct.slice(11, 16);
        if (!isDate(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
          return json({ ok: false, error: 'Fecha u hora inválida.' }, 400, request, env);
        }
        const dur = Math.min(Math.max(nInt(b.duracion, durAct), 15), 240);
        const mins = +hora.slice(0, 2) * 60 + +hora.slice(3, 5);

        const sucTxt = trae('sucursal') ? lim(b.sucursal) : (ev.location || campo(desc, 'Sucursal'));
        const suc = claveSucursal(sucTxt);
        const info = suc ? SUCURSALES[suc] : null;
        if (!esPersonal && !info) {
          return json({ ok: false, error: 'Sucursal no reconocida. Elige Gazcue o Santo Domingo Norte.' }, 400, request, env);
        }

        const nombre = val('nombre', nombreViejo) || nombreViejo;
        const servicio = val('servicio', servicioViejo) || servicioViejo;
        const precio = trae('precio') ? lim(b.precio) : (trae('servicio') ? '' : precioViejo);
        const telefono = val('telefono', campo(desc, 'Tel[ée]fono'));
        const email = val('email', campo(desc, 'Correo'));
        const nota = val('nota', campo(desc, 'Nota del paciente'));
        const teniaPromos = /^Promociones:\s*/im.test(desc);
        const promos = typeof b.promos === 'boolean' ? b.promos : /^Promociones:\s*S[ií]/im.test(desc);
        const esDeLaDra = esServicioDra(servicio);

        if (!nombre) return json({ ok: false, error: 'La cita necesita el nombre del paciente.' }, 400, request, env);
        if (!servicio) return json({ ok: false, error: 'La cita necesita un procedimiento.' }, 400, request, env);

        /* Revalidación del hueco. Sin LEAD_MIN: esto lo usa la Dra. desde el
           panel, no un paciente reservando en línea, y ella sí puede meter
           algo dentro de la próxima hora. */
        const ini = instant(fecha, mins), fin = instant(fecha, mins + dur);
        const now = localNow();
        if (fecha < now.date || (fecha === now.date && mins + dur <= now.mins)) {
          return json({ ok: false, error: 'Ese horario ya pasó. Elige otro.' }, 409, request, env);
        }
        if (fecha > addDays(now.date, MAX_AHEAD)) {
          return json({ ok: false, error: 'Esa fecha queda demasiado lejos.' }, 400, request, env);
        }

        const avisos = [];
        if (!WORKDAYS.includes(dowOf(fecha))) avisos.push('ese día el consultorio no abre');
        if (mins < OPEN || mins + dur > CLOSE) avisos.push(`la cita se sale del horario de ${hhmm(OPEN)} a ${hhmm(CLOSE)}`);
        if (info && !esPersonal) {
          /* Se lee el día ENTERO, no solo el tramo: las reglas de la Dra.
             dependen de todas sus citas de ese día, en las dos sucursales. */
          const ag = sinEvento(await agendaDe(env, instant(fecha, 0), instant(addDays(fecha, 1), 0)), id);
          if (cierraPara(ag, suc, ini.getTime(), fin.getTime())) {
            avisos.push('ese rato está bloqueado en la agenda');
          } else {
            const cupos = cuposDe(env, suc);
            const libres = cupos - pico(ini.getTime(), fin.getTime(), ag.ocupa.filter(([, , k]) => k === suc));
            if (libres <= 0) avisos.push(`no quedan cabinas libres en ${info.nombre} a esa hora`);
          }
          if (esDeLaDra) {
            const motivo = conflictoDra(
              citasDraDelDia(ag, fecha), ag.draOcupa,
              ini.getTime(), fin.getTime() + BUFFER_DRA_MIN * 60000, suc
            );
            if (motivo === 'ocupada') avisos.push('la Dra. ya tiene otra cita, o un compromiso personal, a esa hora');
            if (motivo === 'traslado') avisos.push(`la Dra. no alcanza a llegar desde la otra sucursal: entre sedes hacen falta ${TRASLADO_MIN} min`);
            if (motivo === 'segundo_traslado') avisos.push('sería el segundo cambio de sucursal de la Dra. ese día');
          }
        }
        if (avisos.length && b.forzar !== true) {
          return json({
            ok: false, conflicto: true,
            error: 'Ojo: ' + avisos.join('; ') + '.'
          }, 409, request, env);
        }

        /* Se reescriben solo los campos que el sitio maneja. Todo lo demás de
           la descripción —el sello "Reservado desde el sitio web", las notas
           de seguimiento— se conserva tal cual, al final. */
        const campos = [
          `Paciente: ${nombre}`,
          telefono ? `Teléfono: ${telefono}` : '',
          email ? `Correo: ${email}` : '',
          `Servicio: ${servicio}${precio ? ' · ' + precio : ''}`,
          info ? `Sucursal: ${info.nombre}` : (sucTxt ? `Sucursal: ${sucTxt}` : ''),
          (teniaPromos || typeof b.promos === 'boolean') ? `Promociones: ${promos ? 'Sí' : 'No'}` : '',
          nota ? `Nota del paciente: ${nota}` : ''
        ].filter(Boolean);
        const resto = restoDescripcion(desc);

        const cuerpo = {
          summary: `${servicio} · ${nombre}`,
          description: campos.join('\n') + (resto ? '\n\n' + resto : ''),
          start: { dateTime: `${fecha}T${hora}:00${OFF}`, timeZone: TZ },
          end: { dateTime: `${fecha}T${hhmm(mins + dur)}:00${OFF}`, timeZone: TZ },
          /* se refresca la marca: si cambió el procedimiento, puede haber
             dejado de ser (o haber pasado a ser) una cita de la Dra. */
          extendedProperties: {
            private: {
              dra: esDeLaDra ? '1' : '0',
              sede: info ? info.nombre : '',
              servicio: normDra(servicio).slice(0, 120)
            }
          }
        };
        if (info) { cuerpo.location = info.nombre; cuerpo.colorId = info.color; }

        const res = await fetch(base, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo)
        });
        const data = await res.json();
        if (!res.ok) {
          const detalle = (data.error && data.error.message) || res.status;
          const pista = (res.status === 403 && esPersonal)
            ? ' La cuenta de servicio solo tiene permiso de lectura sobre el calendario personal: compártelo con permiso de "hacer cambios" para poder editar desde aquí.'
            : '';
          return json({ ok: false, error: 'No se pudo guardar el cambio: ' + detalle + pista }, 502, request, env);
        }

        // La agenda ya quedó bien. La copia en la base de datos se refresca
        // aparte: si falla, no tumbamos la edición.
        if (env.DB) {
          try {
            const pid = await upsertPaciente(env, { nombre, telefono, correo: email });
            await guardarCita(env, pid, {
              id, fecha, hora,
              servicio: servicio + (precio ? ' · ' + precio : ''),
              sucursal: info ? info.nombre : sucTxt,
              estado: 'Agendada',
              origen: esPersonal ? 'Personal' : (/Reservado desde el sitio web/i.test(desc) ? 'Web' : 'Manual')
            });
          } catch (e) { /* silencioso a propósito */ }
        }

        return json({
          ok: true, id, fecha, hora, duracion: dur,
          sucursal: info ? info.nombre : sucTxt,
          servicio, requiereDra: esDeLaDra, avisos
        }, 200, request, env);
      }

      /* ── panel: traer a la base de datos las pacientes que ya están en la
         agenda ── Recorre el calendario de citas hacia atrás y registra a cada
         paciente con las citas que ya se le hicieron. Es idempotente: se puede
         correr las veces que haga falta sin duplicar nada. */
      if (path === '/api/pacientes/sincronizar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);

        // Los días se cuentan hacia atrás desde hoy. Se admite "meses" por
        // compatibilidad con la versión anterior del panel.
        const dias = b.dias != null
          ? Math.min(Math.max(nInt(b.dias, 30), 1), 1100)
          : Math.round(Math.min(Math.max(nInt(b.meses, 1), 1), 36) * 30.5);
        const hasta = new Date();
        const desde = new Date(hasta.getTime() - dias * 864e5);

        const incluirPersonal = b.incluirPersonal === true;
        const citas = await listarCitas(env, desde, hasta);

        /* Cloudflare corta una invocación que haga demasiadas llamadas a la
           base ("Too many API requests by single Worker invocation"). Por eso
           esto NO consulta por cada cita: lee los pacientes una sola vez, cruza
           en memoria, y escribe en lotes. Son ~4 llamadas en total. */
        let sinNombre = 0, personales = 0, bloqueos = 0;
        const utiles = [];
        for (const c of citas) {
          const nombre = String(c.nombre || '').trim();
          if (c.origen === 'Personal' && !incluirPersonal) { personales++; continue; }
          if (!nombre || nombre === '—') { sinNombre++; continue; }
          if (CIERRE_TOTAL.test(nombre)) { bloqueos++; continue; }   // cierres, feriados, vacaciones
          utiles.push({ ...c, nombre });
        }

        const norm = s => String(s || '').trim().toLowerCase();
        const indexar = filas => {
          const ix = { ced: new Map(), tel: new Map(), mail: new Map(), nom: new Map() };
          for (const p of filas) {
            if (p.identificacion) ix.ced.set(norm(p.identificacion), p.id);
            if (p.telefono) ix.tel.set(norm(p.telefono), p.id);
            if (p.correo) ix.mail.set(norm(p.correo), p.id);
            if (p.nombre) ix.nom.set(norm(p.nombre), p.id);
          }
          return ix;
        };
        const buscar = (ix, c) =>
          (c.telefono && ix.tel.get(norm(c.telefono))) ||
          (c.email && ix.mail.get(norm(c.email))) ||
          ix.nom.get(norm(c.nombre)) || null;

        const SQL = 'SELECT id, nombre, identificacion, telefono, correo FROM pacientes';
        let ix = indexar((await env.DB.prepare(SQL).all()).results);

        // 1) pacientes que no existen todavía (sin repetir dentro del mismo lote)
        const nuevos = new Map();
        for (const c of utiles) {
          if (buscar(ix, c)) continue;
          const k = norm(c.telefono) || norm(c.email) || norm(c.nombre);
          if (!nuevos.has(k)) nuevos.set(k, c);
        }
        const enLotes = async (stmts, tam = 50) => {
          for (let i = 0; i < stmts.length; i += tam) await env.DB.batch(stmts.slice(i, i + tam));
        };
        if (nuevos.size) {
          const ins = env.DB.prepare('INSERT INTO pacientes (nombre, telefono, correo) VALUES (?, ?, ?)');
          await enLotes([...nuevos.values()].map(c =>
            ins.bind(c.nombre, String(c.telefono || '').trim(), String(c.email || '').trim().toLowerCase())));
          ix = indexar((await env.DB.prepare(SQL).all()).results);   // ahora sí tienen id
        }

        // 2) las citas, en lotes; el ON CONFLICT del cita_id evita duplicar
        const insCita = env.DB.prepare(`
          INSERT INTO citas (paciente_id, cita_id, fecha, hora, servicio, sucursal, estado, origen)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(cita_id) DO UPDATE SET
            paciente_id = excluded.paciente_id, fecha = excluded.fecha, hora = excluded.hora,
            servicio = excluded.servicio, sucursal = excluded.sucursal,
            estado = excluded.estado, origen = excluded.origen`);
        const stmts = [], vistos = new Set();
        let sinPaciente = 0;
        for (const c of utiles) {
          const pid = buscar(ix, c);
          if (!pid) { sinPaciente++; continue; }
          vistos.add(pid);
          stmts.push(insCita.bind(pid, String(c.id || ''), String(c.fecha || ''), String(c.hora || ''),
            String(c.servicio || ''), String(c.sucursal || ''), String(c.estado || ''), String(c.origen || '')));
        }
        await enLotes(stmts);

        return json({
          ok: true, dias, incluirPersonal,
          revisadas: citas.length,
          pacientes: vistos.size,
          pacientesNuevos: nuevos.size,
          citasGuardadas: stmts.length,
          sinNombre, personales, bloqueos, fallidas: sinPaciente
        }, 200, request, env);
      }

      /* ── panel: borrar un paciente que no debía estar ──
         Pensado para limpiar lo que entre por error al sincronizar el
         calendario personal. Se niega si tiene consentimientos firmados:
         eso es un documento legal y no se borra desde aquí. */
      if (path === '/api/pacientes/borrar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const id = parseInt(b.id, 10);
        if (!id) return json({ ok: false, error: 'Falta el id del paciente.' }, 400, request, env);

        const cons = await env.DB.prepare('SELECT COUNT(*) AS n FROM consentimientos WHERE paciente_id = ?').bind(id).first();
        if (cons.n > 0) {
          return json({ ok: false, error: 'Este paciente tiene consentimientos firmados. No se puede borrar desde aquí.' }, 409, request, env);
        }
        await env.DB.prepare('DELETE FROM citas WHERE paciente_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM notas_seguimiento WHERE paciente_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM pacientes WHERE id = ?').bind(id).run();
        return json({ ok: true }, 200, request, env);
      }

      /* ── listado de citas para el panel interno ──
         POST (no GET) para que la clave no quede en logs ni en el historial. */
      if (path === '/api/citas' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) {
          return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        }
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));   // frena el probar claves a lo loco
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!isDate(b.desde) || !isDate(b.hasta)) {
          return json({ ok: false, error: 'Rango de fechas inválido.' }, 400, request, env);
        }
        const desde = instant(b.desde, 0);
        const hasta = instant(addDays(b.hasta, 1), 0);
        if (hasta - desde > 400 * 864e5) {
          return json({ ok: false, error: 'El rango no puede pasar de 13 meses.' }, 400, request, env);
        }
        const citas = await listarCitas(env, desde, hasta);
        return json({ ok: true, total: citas.length, citas }, 200, request, env);
      }

      /* ── agregar nota de seguimiento a una cita ──
         Se guarda dentro de la descripción del evento en Google Calendar
         (no hay base de datos aparte), así que queda visible para siempre
         y también si alguien abre el evento directo en Google Calendar. */
      if (path === '/api/citas/nota' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        const id = String(b.id || '').trim();
        const nota = String(b.nota || '').trim().slice(0, 500);
        if (!id || !nota) return json({ ok: false, error: 'Falta el id de la cita o el texto de la nota.' }, 400, request, env);
        const calId = b.calendario === 'personal' ? env.CAL_PERSONAL : env.CAL_CITAS;
        if (!calId) return json({ ok: false, error: 'Ese calendario no está configurado.' }, 400, request, env);

        const token = await getToken(env);
        const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`;
        const actual = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
        const evActual = await actual.json();
        if (!actual.ok) return json({ ok: false, error: 'No se encontró esa cita: ' + ((evActual.error && evActual.error.message) || actual.status) }, 404, request, env);

        const hoy = localNow().date;
        const linea = `Seguimiento (${hoy}): ${nota}`;
        const desc = ((evActual.description || '').trim() + '\n\n' + linea).trim();
        const res = await fetch(base, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc })
        });
        const data = await res.json();
        if (!res.ok) return json({ ok: false, error: 'No se pudo guardar la nota: ' + ((data.error && data.error.message) || res.status) }, 502, request, env);

        // además de quedar en Calendar, la guardamos en la base de datos
        // ligada al paciente, para que sobreviva y sea consultable aunque
        // esa cita se borre o edite después. Si la base de datos aún no
        // está conectada, no rompemos la nota que ya se guardó arriba.
        if (env.DB) {
          try {
            const pacienteId = await upsertPaciente(env, {
              nombre: b.nombre, telefono: b.telefono, correo: b.email
            });
            await env.DB.prepare(
              'INSERT INTO notas_seguimiento (paciente_id, cita_id, nota) VALUES (?, ?, ?)'
            ).bind(pacienteId, id, nota).run();
          } catch (e) { /* la nota en Calendar ya se guardó; no fallamos la petición por esto */ }
        }
        return json({ ok: true }, 200, request, env);
      }

      /* ── panel: cancelar una cita ──
         Igual que cuando la paciente cancela desde su enlace (mismo sello,
         mismo PATCH+DELETE), pero iniciado por la Dra. desde el panel. La cita
         no desaparece sin dejar rastro: el título queda "CANCELADA · …", el
         sello dice quién la canceló y desde dónde, y la fila en la base de
         datos (tabla "citas") pasa a estado 'Cancelada' — así el historial
         del paciente la sigue mostrando aunque el evento ya no esté en
         Google Calendar. */
      if (path === '/api/citas/cancelar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        const id = String(b.id || '').trim();
        if (!id) return json({ ok: false, error: 'Falta el id de la cita.' }, 400, request, env);
        const esPersonal = b.calendario === 'personal';
        const calId = esPersonal ? env.CAL_PERSONAL : env.CAL_CITAS;
        if (!calId) return json({ ok: false, error: 'Ese calendario no está configurado.' }, 400, request, env);

        const token = await getToken(env);
        const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`;
        const previa = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
        const ev = await previa.json();
        if (!previa.ok) {
          return json({ ok: false, error: 'No se encontró esa cita: ' + ((ev.error && ev.error.message) || previa.status) }, 404, request, env);
        }
        if (ev.status === 'cancelled') return json({ ok: false, error: 'Esa cita ya estaba cancelada.' }, 409, request, env);
        if (!ev.start || !ev.start.dateTime) {
          return json({ ok: false, error: 'Eso es un bloqueo de día completo, no una cita.' }, 409, request, env);
        }

        const sello = `Cancelada por la Dra. desde el panel el ${localNow().date}.`;
        await fetch(base, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: `CANCELADA · ${ev.summary || ''}`.slice(0, 300),
            description: ((ev.description || '').trim() + '\n\n' + sello).trim()
          })
        }).catch(() => {});

        const res = await fetch(base, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          const d = await res.json().catch(() => ({}));
          /* El caso más común: la cita vive en el calendario personal, que está
             compartido con la cuenta de servicio solo como "ver". Sin decirlo,
             el error se lee como una falla del sistema y no como lo que es. */
          const pista = (res.status === 403 && esPersonal)
            ? ' Esta cita está en el calendario personal de la Dra., que la cuenta de servicio solo puede leer. Cancélala desde Google Calendar, o comparte ese calendario con permiso de "Hacer cambios en los eventos" para poder cancelarla desde aquí.'
            : '';
          return json({ ok: false, error: 'No pudimos cancelar la cita: ' + ((d.error && d.error.message) || res.status) + pista }, 502, request, env);
        }

        // el calendario ya quedó libre; la constancia en la base es aparte
        if (env.DB) {
          try {
            await env.DB.prepare("UPDATE citas SET estado = 'Cancelada' WHERE cita_id = ?").bind(id).run();
            const pid = await upsertPaciente(env, { nombre: b.nombre, telefono: b.telefono, correo: b.email });
            await env.DB.prepare('INSERT INTO notas_seguimiento (paciente_id, cita_id, nota) VALUES (?, ?, ?)')
              .bind(pid, id, sello).run();
          } catch (e) { /* silencioso a propósito */ }
        }
        return json({ ok: true }, 200, request, env);
      }

      /* ── panel: listar bloqueos (vacaciones, feriados, cierres) ──
         Un bloqueo es un evento de día completo en "Citas web" que de verdad
         cierra algo: con CERRADO/BLOQUEO/FERIADO/VACACIONES/NO AGENDAR en el
         título, o marcado "Ocupado" (ver clasificarEventos). Con Ubicación en
         una sucursal cierra solo esa; sin ubicación, cierra las dos. Se listan
         aparte de las citas normales para que el panel tenga una vista propia
         de "cuándo no se trabaja", sin mezclarlos con pacientes. */
      if (path === '/api/bloqueos' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.CAL_CITAS) return json({ ok: false, error: 'Falta el secret CAL_CITAS.' }, 500, request, env);

        const desde = isDate(b.desde) ? b.desde : addDays(localNow().date, -30);
        const hasta = isDate(b.hasta) ? b.hasta : addDays(localNow().date, 365);

        const token = await getToken(env);
        const items = await eventosDeCalendario(token, env.CAL_CITAS, instant(desde, 0), instant(addDays(hasta, 1), 0));
        const bloqueos = items
          .filter(ev => ev.status !== 'cancelled' && ev.start && ev.start.date
            && (CIERRE_TOTAL.test(ev.summary || '') || ev.transparency !== 'transparent'))
          .map(ev => {
            const sucKey = claveSucursal(ev.location);
            return {
              id: ev.id,
              desde: ev.start.date,
              hasta: addDays(ev.end.date, -1),   // Google guarda el fin del día completo como exclusivo
              sucursal: sucKey ? SUCURSALES[sucKey].nombre : 'Ambas',
              motivo: campo(ev.description || '', 'Motivo'),
              titulo: ev.summary || ''
            };
          })
          .sort((a, c) => a.desde.localeCompare(c.desde));
        return json({ ok: true, bloqueos }, 200, request, env);
      }

      /* ── panel: crear un bloqueo (vacaciones, días que la Dra. no va) ──
         Se guarda como un evento de día completo en "Citas web", marcado
         "Ocupado" y con VACACIONES en el título (para que cierre aunque a
         alguien se le ocurra abrirlo como "Disponible" después). Con
         sucursal puesta cierra solo esa cabina en ese rango; sin sucursal
         (Ambas) cierra las dos. No hace falta "forzar": crear un bloqueo no
         choca con nada en Google, así que solo avisa cuántas citas ya
         agendadas caen dentro del rango — la Dra. decide si las mueve. */
      if (path === '/api/bloqueos/crear' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.CAL_CITAS) return json({ ok: false, error: 'Falta el secret CAL_CITAS.' }, 500, request, env);

        const desde = String(b.desde || '').trim();
        const hasta = String(b.hasta || b.desde || '').trim();
        if (!isDate(desde) || !isDate(hasta)) return json({ ok: false, error: 'Fechas inválidas.' }, 400, request, env);
        if (hasta < desde) return json({ ok: false, error: 'La fecha "hasta" no puede ser antes que "desde".' }, 400, request, env);
        const hoy = localNow().date;
        if (hasta < hoy) return json({ ok: false, error: 'Esas fechas ya pasaron.' }, 400, request, env);
        if (hasta > addDays(desde, 366)) return json({ ok: false, error: 'El rango es demasiado largo (máximo un año).' }, 400, request, env);

        const sucKey = claveSucursal(b.sucursal);
        if (b.sucursal && !sucKey) {
          return json({ ok: false, error: 'Sucursal no reconocida. Elige Gazcue, Santo Domingo Norte o deja "Ambas".' }, 400, request, env);
        }
        const info = sucKey ? SUCURSALES[sucKey] : null;

        const motivo = String(b.motivo || '').trim().slice(0, 200);
        const titulo = `VACACIONES${info ? ' · ' + info.nombre : ''}${motivo ? ' · ' + motivo : ''}`.slice(0, 300);
        const descripcion = [
          motivo ? `Motivo: ${motivo}` : '',
          `Bloqueo creado desde el panel el ${hoy}.`
        ].filter(Boolean).join('\n');

        const token = await getToken(env);
        const cuerpo = {
          summary: titulo,
          description: descripcion,
          start: { date: desde },
          end: { date: addDays(hasta, 1) },
          transparency: 'opaque'
        };
        if (info) { cuerpo.location = info.nombre; cuerpo.colorId = info.color; } else { cuerpo.colorId = '8'; }

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.CAL_CITAS)}/events`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }
        );
        const data = await res.json();
        if (!res.ok) {
          return json({ ok: false, error: 'No se pudo crear el bloqueo: ' + ((data.error && data.error.message) || res.status) }, 502, request, env);
        }

        // aviso informativo: no bloquea la creación, solo dice cuántas citas
        // ya agendadas caen dentro de ese rango y esa sucursal. Se descuentan
        // los bloqueos (este mismo incluido): no son pacientes.
        let citasAfectadas = 0;
        try {
          const citas = await listarCitas(env, instant(desde, 0), instant(addDays(hasta, 1), 0));
          citasAfectadas = citas.filter(c =>
            c.estado === 'Agendada' && !c.diaCompleto && !CIERRE_TOTAL.test(c.nombre || '')
            && (!info || c.sucursal === info.nombre)).length;
        } catch (e) { /* informativo; si falla no tumbamos la creación */ }

        return json({ ok: true, id: data.id, desde, hasta, sucursal: info ? info.nombre : 'Ambas', citasAfectadas }, 200, request, env);
      }

      /* ── panel: quitar un bloqueo ── */
      if (path === '/api/bloqueos/borrar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        const id = String(b.id || '').trim();
        if (!id) return json({ ok: false, error: 'Falta el id del bloqueo.' }, 400, request, env);
        if (!env.CAL_CITAS) return json({ ok: false, error: 'Falta el secret CAL_CITAS.' }, 500, request, env);

        const token = await getToken(env);
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.CAL_CITAS)}/events/${encodeURIComponent(id)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          const d = await res.json().catch(() => ({}));
          return json({ ok: false, error: 'No se pudo quitar el bloqueo: ' + ((d.error && d.error.message) || res.status) }, 502, request, env);
        }
        return json({ ok: true }, 200, request, env);
      }

      /* ── un paciente firma su consentimiento (público, sin clave —
         el enlace mismo, con su token que vence a los 20 min, es el acceso) ── */
      if (path === '/api/consentimientos' && request.method === 'POST') {
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));

        let tok;
        try { tok = JSON.parse(decodeURIComponent(escape(atob(String(b.token || ''))))); }
        catch (e) { return json({ ok: false, error: 'Enlace inválido.' }, 400, request, env); }
        if (!tok.t || Date.now() - tok.t > 20 * 60 * 1000) {
          return json({ ok: false, error: 'Este enlace ya venció.' }, 410, request, env);
        }

        const p = b.patient || {};
        if (!String(p.name || '').trim() || !String(p.identification || '').trim()) {
          return json({ ok: false, error: 'Faltan el nombre o la identificación del paciente.' }, 400, request, env);
        }
        if (!b.signature) return json({ ok: false, error: 'Falta la firma.' }, 400, request, env);

        const pacienteId = await upsertPaciente(env, {
          nombre: p.name, identificacion: p.identification, telefono: p.phone, correo: p.email, antecedentes: p.history
        });
        const res = await env.DB.prepare(
          `INSERT INTO consentimientos (paciente_id, procedimiento, sucursal, nota, foto_autorizada, texto, firma, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Firmado')`
        ).bind(pacienteId, String(b.procedure || ''), String(b.branch || ''), String(b.note || ''),
          b.photoConsent ? 1 : 0, String(b.text || ''), String(b.signature || '')).run();

        return json({ ok: true, id: res.meta.last_row_id }, 200, request, env);
      }

      /* ── migración: trae los consentimientos que quedaron guardados en el
         localStorage de un navegador viejo (antes de tener base de datos).
         Se usa una sola vez por dispositivo, desde migrar.html. Conserva la
         fecha original de firma en vez de usar la fecha de hoy. ── */
      if (path === '/api/consentimientos/importar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const registros = Array.isArray(b.registros) ? b.registros : [];
        if (!registros.length) return json({ ok: false, error: 'No se recibió ningún registro.' }, 400, request, env);
        if (registros.length > 500) return json({ ok: false, error: 'Máximo 500 registros por importación.' }, 400, request, env);

        let importados = 0;
        const omitidos = [];
        for (const rec of registros) {
          const p = (rec && rec.patient) || {};
          if (!String(p.name || '').trim()) { omitidos.push({ id: rec && rec.id, motivo: 'sin nombre de paciente' }); continue; }
          try {
            const pacienteId = await upsertPaciente(env, {
              nombre: p.name, identificacion: p.identification, telefono: p.phone, correo: p.email, antecedentes: p.history
            });
            const fecha = rec.date ? new Date(rec.date).toISOString() : null;
            await env.DB.prepare(
              `INSERT INTO consentimientos (paciente_id, procedimiento, sucursal, nota, foto_autorizada, texto, firma, estado, creado_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'Firmado', COALESCE(?, datetime('now')))`
            ).bind(pacienteId, String(rec.procedure || ''), String(rec.branch || ''), String(rec.note || ''),
              rec.photoConsent ? 1 : 0, String(rec.text || ''), String(rec.signature || ''), fecha).run();
            importados++;
          } catch (e) { omitidos.push({ id: rec && rec.id, motivo: e.message || 'error al guardar' }); }
        }
        return json({ ok: true, importados, omitidos }, 200, request, env);
      }

      /* ── panel: lista de pacientes (cruce de consentimientos + notas) ── */
      if (path === '/api/pacientes' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const { results } = await env.DB.prepare(`
          SELECT p.*,
            (SELECT COUNT(*) FROM consentimientos c WHERE c.paciente_id = p.id) AS consentimientos,
            (SELECT COUNT(*) FROM notas_seguimiento n WHERE n.paciente_id = p.id) AS notas,
            (SELECT COUNT(*) FROM citas ct WHERE ct.paciente_id = p.id) AS citas,
            (SELECT MAX(fecha) FROM (
               SELECT fecha FROM citas WHERE paciente_id = p.id
               UNION ALL SELECT date(creado_en) FROM consentimientos WHERE paciente_id = p.id
               UNION ALL SELECT date(creado_en) FROM notas_seguimiento WHERE paciente_id = p.id
             )) AS ultima_actividad
          FROM pacientes p
          ORDER BY p.actualizado_en DESC
          LIMIT 500
        `).all();
        return json({ ok: true, pacientes: results }, 200, request, env);
      }

      /* ── panel: historial completo de un paciente ── */
      if (path === '/api/pacientes/historial' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const id = parseInt(b.id, 10);
        if (!id) return json({ ok: false, error: 'Falta el id del paciente.' }, 400, request, env);
        const paciente = await env.DB.prepare('SELECT * FROM pacientes WHERE id = ?').bind(id).first();
        const consentimientos = (await env.DB.prepare(
          'SELECT id, procedimiento, sucursal, nota, foto_autorizada, estado, creado_en FROM consentimientos WHERE paciente_id = ? ORDER BY creado_en DESC'
        ).bind(id).all()).results;
        const notas = (await env.DB.prepare(
          'SELECT id, cita_id, nota, creado_en FROM notas_seguimiento WHERE paciente_id = ? ORDER BY creado_en DESC'
        ).bind(id).all()).results;
        const citas = (await env.DB.prepare(
          'SELECT id, cita_id, fecha, hora, servicio, sucursal, estado, origen FROM citas WHERE paciente_id = ? ORDER BY fecha DESC, hora DESC'
        ).bind(id).all()).results;
        return json({ ok: true, paciente, consentimientos, notas, citas }, 200, request, env);
      }

      /* ── panel: lista de documentos firmados ── */
      if (path === '/api/consentimientos/lista' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const { results } = await env.DB.prepare(`
          SELECT c.id, c.paciente_id, c.procedimiento, c.sucursal, c.estado, c.creado_en,
                 p.nombre, p.identificacion, p.telefono, p.correo
          FROM consentimientos c JOIN pacientes p ON p.id = c.paciente_id
          ORDER BY c.creado_en DESC
          LIMIT 500
        `).all();
        return json({ ok: true, consentimientos: results }, 200, request, env);
      }

      /* ── panel: un documento completo (para ver / imprimir) ── */
      if (path === '/api/consentimientos/uno' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const id = parseInt(b.id, 10);
        const row = await env.DB.prepare(`
          SELECT c.*, p.nombre, p.identificacion, p.telefono, p.correo, p.antecedentes
          FROM consentimientos c JOIN pacientes p ON p.id = c.paciente_id
          WHERE c.id = ?
        `).bind(id).first();
        if (!row) return json({ ok: false, error: 'No se encontró ese documento.' }, 404, request, env);
        return json({ ok: true, consentimiento: row }, 200, request, env);
      }

      /* ── panel: borrar un documento firmado ── */
      if (path === '/api/consentimientos/borrar' && request.method === 'POST') {
        if (!env.PANEL_CLAVE) return json({ ok: false, error: 'Falta el secret PANEL_CLAVE en Cloudflare.' }, 500, request, env);
        const b = await request.json().catch(() => ({}));
        if (!claveOk(String(b.clave || ''), env.PANEL_CLAVE)) {
          await new Promise(r => setTimeout(r, 700));
          return json({ ok: false, error: 'Clave incorrecta.' }, 401, request, env);
        }
        if (!env.DB) return json({ ok: false, error: 'Falta conectar la base de datos en Cloudflare.' }, 500, request, env);
        const id = parseInt(b.id, 10);
        if (!id) return json({ ok: false, error: 'Falta el id.' }, 400, request, env);
        await env.DB.prepare('DELETE FROM consentimientos WHERE id = ?').bind(id).run();
        return json({ ok: true }, 200, request, env);
      }

      return json({ ok: false, error: 'Ruta no encontrada.' }, 404, request, env);

    } catch (e) {
      return json({ ok: false, error: e.message || 'Error interno.' }, 500, request, env);
    }
  }
};

/* ── Exportado solo para las pruebas (node test-agenda.mjs) ──
   Cloudflare usa el "export default" de arriba; estos nombres extra no le
   estorban ni cambian nada en producción. */
export {
  clasificarEventos, mezclarAgendas, sinEvento, cierraPara, pico,
  citasDraDelDia, conflictoDra, freeSlots, sugerenciaPara,
  esServicioDra, eventoEsDra, claveSucursal, normDra,
  SUCURSALES, SERVICIOS_DRA, PALABRAS_DRA,
  TRASLADO_MIN, MAX_CAMBIOS_SEDE, BUFFER_DRA_MIN, AGENDA_VACIA
};
