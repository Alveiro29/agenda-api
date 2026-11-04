/* Cahier — motor de la app. Depende de contenido.js (FR, ES, PLACE_FR, PLACE_ES). */
(() => {
"use strict";

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const uniq = (a) => [...new Set(a)];
const fmtDate = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => fmtDate(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDate(d); };
const stripTilde = (s) => s.normalize("NFD").replace(/́/g, "").normalize("NFC");
const noAcc = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const normFr = (s) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[.,!?;:¿¡«»"]/g, " ").replace(/\s+/g, " ").trim();
const normEs = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const atStart = (pre) => /^[¿¡]?$/.test(pre);
/* Rellena el hueco y pone mayúscula si la palabra abre la frase */
function fillWord(ctx, word) { const pre = ctx.split("___")[0]; return atStart(pre) ? cap(word) : word; }
function fill(ctx, word) { return ctx.replace("___", fillWord(ctx, word)); }

const ICON = {
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 5 5.6 5 10.4A5 5 0 0 1 12 22a5 5 0 0 1-5-5c0-2.5 1.4-3.9 2.5-5 .3 1.6 1.1 2.6 2 3 0-3.6-.7-6.6.5-13Z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8 2.9-6Z" fill="currentColor"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9Z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  turtle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15c0-4 3.5-7 8-7s8 3 8 7H4Z" fill="currentColor"/><circle cx="21" cy="13" r="1.8" fill="currentColor"/><path d="M6 15v3M18 15v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 19a2 2 0 0 1 2-2h13" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const icon = (n, cls = "ic") => h("span", { class: cls, html: ICON[n] });

/* ---------- estado ---------- */
const KEY = "cahier.v1";
const blankPanel = () => ({ placed: false, lvl: 0, start: 1, initial: null, plan: [], done: {}, srs: {}, session: 0, final: null, best: 0 });
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.panels && s.panels.fr && s.panels.es) return s; } catch (e) { /* sin almacenamiento */ }
  return { name: "", goal: 60, sound: true, streak: 0, last: null, xp: 0, xpDay: {}, panels: { fr: blankPanel(), es: blankPanel() } };
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ } }

const P = {
  fr: { key: "fr", name: "Francés", sub: "De cero a conversar en 30 días", units: FR, place: PLACE_FR,
        levels: [{ n: "A0 · Principiante", start: 1 }, { n: "A1 · Básico", start: 5 }, { n: "A2 · Elemental", start: 11 }, { n: "B1 · Intermedio", start: 15 }],
        group: 3, need: 2, lang: "fr-FR", gname: ["A0", "A1", "A2", "B1"] },
  es: { key: "es", name: "Ortografía", sub: "Escribe sin dudas en 30 días", units: ES, place: PLACE_ES,
        levels: [{ n: "Básico", start: 1 }, { n: "Intermedio", start: 7 }, { n: "Avanzado", start: 11 }],
        group: 4, need: 3, lang: "es-ES", gname: ["Básico", "Intermedio", "Avanzado"] },
};
const unit = (pk, id) => P[pk].units.find((u) => u.id === id);

/* ---------- audio: voz y efectos ---------- */
const TTS = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
if (TTS) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { /* nada */ } }
function speak(text, lang, slow) {
  if (!TTS) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const base = lang.slice(0, 2);
    const v = voices.find((x) => x.lang === lang) || voices.find((x) => (x.lang || "").startsWith(base));
    if (v) u.voice = v;
    u.rate = slow ? 0.6 : base === "fr" ? 0.88 : 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz */ }
}
let actx = null;
function beep(ok) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [220, 180];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = ok ? "triangle" : "sawtooth"; o.frequency.value = f;
      const t = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(ok ? 0.12 : 0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.18);
    });
  } catch (e) { /* sin audio */ }
}

/* ---------- XP y racha ---------- */
function addXp(n) {
  S.xp += n; const d = today(); S.xpDay[d] = (S.xpDay[d] || 0) + n;
  if (S.last !== d) { S.streak = S.last === yesterday() ? S.streak + 1 : 1; S.last = d; }
  save();
}
const xpToday = () => S.xpDay[today()] || 0;
const streakNow = () => (S.last === today() || S.last === yesterday() ? S.streak : 0);

/* ---------- plan de 30 días ---------- */
const REVIEW_DAYS = [6, 13, 20];
const FINAL_DAY = 29;
function buildPlan(pk, start) {
  const units = P[pk].units;
  const primary = units.filter((u) => u.id >= start), before = units.filter((u) => u.id < start);
  const q = [];
  primary.forEach((u) => { q.push({ k: "learn", u: u.id }, { k: "practice", u: u.id }); });
  before.forEach((u) => q.push({ k: "boost", u: u.id }));
  const plan = [];
  for (let d = 0; d < 30; d++) {
    if (d === FINAL_DAY) plan.push({ k: "final" });
    else if (REVIEW_DAYS.includes(d)) plan.push({ k: "review" });
    else plan.push(q.shift() || { k: "mix" });
  }
  return plan;
}
const KIND = {
  learn: { label: "Aprende", desc: "Lección nueva con explicación y minijuegos." },
  practice: { label: "Practica", desc: "Más ejercicios de producción para fijar lo aprendido." },
  boost: { label: "Refuerzo", desc: "Repaso rápido de una base que conviene asegurar." },
  review: { label: "Repaso semanal", desc: "Mezcla de todo lo de la semana, con prioridad a tus errores." },
  mix: { label: "Repaso mixto", desc: "Práctica libre de todas las unidades estudiadas." },
  final: { label: "Examen final", desc: "La misma prueba del inicio para medir cuánto avanzaste." },
};
const dayTitle = (pk, e) => (e.u ? KIND[e.k].label + ": " + unit(pk, e.u).t : KIND[e.k].label);
const currentDay = (pp) => { for (let i = 0; i < 30; i++) if (!pp.done[i]) return i; return 30; };
function studiedUnits(pk) {
  const pp = S.panels[pk];
  const ids = uniq(pp.plan.filter((e, i) => e.u && pp.done[i]).map((e) => e.u));
  return ids.length ? ids : [pp.start];
}

/* ---------- repetición espaciada (cajas de Leitner) ---------- */
const GAPS = [1, 2, 4, 7, 12];
function srsMark(pk, ref, ok) {
  if (!ref) return;
  const pp = S.panels[pk], key = ref.u + "." + ref.k + "." + ref.i;
  const cur = pp.srs[key];
  if (!ok) pp.srs[key] = { b: 0, due: pp.session + 1 };
  else if (cur) { const b = Math.min(cur.b + 1, GAPS.length - 1); pp.srs[key] = { b, due: pp.session + GAPS[b] }; }
  else pp.srs[key] = { b: 1, due: pp.session + GAPS[1] };
}
function dueRefs(pk, n, excludeUnit) {
  const pp = S.panels[pk];
  return Object.entries(pp.srs)
    .filter(([, v]) => v.due <= pp.session)
    .sort((a, b) => a[1].b - b[1].b || a[1].due - b[1].due)
    .map(([k]) => { const [u, kk, i] = k.split("."); return { u: +u, k: kk, i: +i }; })
    .filter((r) => r.u !== excludeUnit && unit(pk, r.u))
    .slice(0, n);
}
const weakCount = (pk) => Object.values(S.panels[pk].srs).filter((v) => v.b === 0).length;

/* ---------- generadores de ejercicios ---------- */
const data = (pk, ref) => unit(pk, ref.u)[ref.k][ref.i];
const refs = (u, k) => u[k].map((_, i) => ({ u: u.id, k, i }));

function frDistract(pk, ref, side, n) {
  const u = unit(pk, ref.u), mine = data(pk, ref)[side];
  let pool = uniq(u.v.map((x) => x[side]).filter((x) => x !== mine));
  if (pool.length < n) pool = uniq(pool.concat(P[pk].units.flatMap((x) => x.v.map((y) => y[side])).filter((x) => x !== mine)));
  return shuffle(pool).slice(0, n);
}
const MK = {
  /* Francés */
  esfr(pk, ref) { const [fr, es] = data(pk, ref); return { type: "mc", ref, title: "¿Cómo se dice en francés?", prompt: es, opts: shuffle([fr, ...frDistract(pk, ref, 0, 3)]), ok: fr, speakOk: fr, note: es }; },
  fres(pk, ref) { const [fr, es] = data(pk, ref); return { type: "mc", ref, title: "¿Qué significa?", prompt: fr, promptSpeak: fr, opts: shuffle([es, ...frDistract(pk, ref, 1, 3)]), ok: es, speakOk: fr, note: fr + " = " + es }; },
  listen(pk, ref) { if (!TTS) return null; const [fr, es] = data(pk, ref); return { type: "mc", ref, title: "Escucha y elige lo que oíste", audio: fr, opts: shuffle([fr, ...frDistract(pk, ref, 0, 3)]), ok: fr, speakOk: fr, note: fr + " = " + es }; },
  write(pk, ref) { const [fr, es] = data(pk, ref); return { type: "write", ref, title: "Escríbelo en francés", prompt: es, ok: fr, lang: "fr", speakOk: fr, note: es }; },
  order(pk, ref) {
    const [fr, es] = data(pk, ref), u = unit(pk, ref.u);
    const toks = fr.split(" ");
    const extra = shuffle(uniq(u.s.filter((s) => s[0] !== fr).flatMap((s) => s[0].split(" ")).filter((t) => !toks.includes(t) && /\p{L}/u.test(t)))).slice(0, 2);
    return { type: "order", ref, title: "Ordena la frase en francés", prompt: es, bank: shuffle([...toks, ...extra]), ok: fr, speakOk: fr, note: es };
  },
  listenorder(pk, ref) { if (!TTS) return null; const ex = MK.order(pk, ref); return { ...ex, title: "Escucha y ordena lo que oíste", prompt: null, audio: ex.ok }; },
  cloze(pk, ref) { const [q, ok, no] = data(pk, ref); return { type: "mc", ref, title: "Completa la frase", sentence: q, opts: shuffle([ok, ...no]), ok, speakOk: q.replace("___", ok), note: unit(pk, ref.u).r }; },
  pairs(pk, rs) { return { type: "pairs", refs: rs, title: "Une cada palabra con su traducción", items: rs.map((r) => data(pk, r)) }; },
  /* Ortografía */
  ctx(pk, ref) { const [ok, bad, ctx] = data(pk, ref); return { type: "mc", ref, title: "Elige la forma correcta", sentence: ctx, opts: shuffle([ok, ...bad.split("|")]).map((o) => fillWord(ctx, o)), ok: fillWord(ctx, ok), note: unit(pk, ref.u).r, full: fill(ctx, ok) }; },
  letter(pk, ref) {
    const [ok0, bad0, ctx] = data(pk, ref); const ok = fillWord(ctx, ok0), bad = fillWord(ctx, bad0.split("|")[0]);
    let a = 0; while (a < ok.length && a < bad.length && ok[a] === bad[a]) a++;
    let b = 0; while (b < ok.length - a && b < bad.length - a && ok[ok.length - 1 - b] === bad[bad.length - 1 - b]) b++;
    const so = ok.slice(a, ok.length - b), sb = bad.slice(a, bad.length - b);
    if (so.length > 3 || sb.length > 3 || so.includes(" ") || sb.includes(" ") || (a + b) === 0) return null;
    return { type: "letter", ref, title: "¿Qué falta?", pre: ok.slice(0, a), post: ok.slice(ok.length - b), opts: shuffle([so, sb]), ok: so, word: ok, sentence: ctx, note: unit(pk, ref.u).r, full: fill(ctx, ok0) };
  },
  hunt(pk, ref) { const [ok, bad, ctx] = data(pk, ref); return { type: "hunt", ref, title: "Caza el error: toca la palabra mal escrita", ctx, okW: fillWord(ctx, ok), badW: fillWord(ctx, bad.split("|")[0]), note: unit(pk, ref.u).r, full: fill(ctx, ok) }; },
  dictation(pk, ref) {
    if (!TTS) return null;
    const [ok, bad, ctx] = data(pk, ref);
    if (/[¿¡]/.test(ok) || ok.toLowerCase() === bad.toLowerCase()) return null;
    return { type: "write", ref, title: "Dictado: escribe la palabra que falta", sentence: ctx, audio: fill(ctx, ok), ok: fillWord(ctx, ok), lang: "es", note: unit(pk, ref.u).r, full: fill(ctx, ok) };
  },
  tilde(pk, ref) {
    const [ok0, bad0, ctx] = data(pk, ref); const ok = fillWord(ctx, ok0), bad = fillWord(ctx, bad0.split("|")[0]);
    if (ok.includes(" ") || stripTilde(ok) !== stripTilde(bad) || ok === bad) return null;
    const chars = [...ok]; const base = chars.map(stripTilde);
    const target = chars.findIndex((c, i) => c !== base[i]);
    return { type: "tilde", ref, title: "¿Dónde va la tilde?", base, target, word: ok, sentence: ctx, note: unit(pk, ref.u).r, full: fill(ctx, ok0) };
  },
};
const POOL = { v: ["esfr", "fres", "listen", "write"], s: ["order", "listenorder"], q: ["cloze"], w: ["ctx", "letter", "hunt", "dictation", "tilde"] };
function make(pk, ref, prefs) {
  const list = (prefs || shuffle(POOL[ref.k])).concat(shuffle(POOL[ref.k]));
  for (const t of list) { const ex = MK[t](pk, ref); if (ex) { ex.mk = t; return ex; } }
  return null;
}

function buildLesson(pk, entry) {
  const out = [];
  const add = (ref, prefs) => { if (!ref) return; const ex = make(pk, ref, prefs); if (ex) out.push(ex); };
  const u = entry.u ? unit(pk, entry.u) : null;
  if (u && pk === "fr") {
    const v = shuffle(refs(u, "v")), s = shuffle(refs(u, "s")), q = shuffle(refs(u, "q"));
    if (entry.k === "practice") {
      add(v[0], ["write"]); add(s[0], ["order"]); add(q[0]); add(v[1], ["write"]); add(s[1], ["listenorder", "order"]);
      out.push(MK.pairs(pk, v.slice(5, 10))); add(q[1]); add(v[2], ["listen", "fres"]); add(s[2], ["order"]);
      add(v[3], ["write"]); add(q[2]); add(s[3], ["listenorder", "order"]); add(v[4], ["fres"]);
    } else {
      add(v[0], ["esfr"]); add(v[1], ["esfr"]); add(v[2], ["listen", "fres"]); out.push(MK.pairs(pk, v.slice(0, 5)));
      add(q[0]); add(v[3], ["fres"]); add(s[0], ["order"]); add(v[4], ["listen", "esfr"]);
      if (entry.k === "learn") { add(q[1]); add(v[5], ["write"]); add(s[1], ["order"]); add(v[6], ["esfr"]); }
    }
  } else if (u) {
    const w = shuffle(refs(u, "w"));
    if (entry.k === "practice") {
      [["dictation", "hunt"], ["hunt"], ["tilde", "letter", "ctx"], ["dictation", "ctx"], ["hunt"], ["letter", "ctx"], ["dictation", "hunt"], ["ctx"], ["tilde", "hunt"], ["dictation", "letter"], ["hunt"]]
        .forEach((p, i) => add(w[i % w.length], p));
    } else {
      const seq = [["ctx"], ["letter", "ctx"], ["tilde", "ctx"], ["hunt"], ["ctx"], ["dictation", "letter"], ["letter", "hunt"], ["hunt"]];
      if (entry.k === "learn") seq.push(["tilde", "ctx"], ["dictation", "hunt"]);
      seq.forEach((p, i) => add(w[i % w.length], p));
    }
  }
  /* repaso espaciado de unidades anteriores */
  const nReview = u ? (entry.k === "practice" ? 4 : 3) : 12;
  const due = dueRefs(pk, nReview, u ? u.id : -1);
  due.forEach((r) => add(r));
  if (!u) {
    const pool = studiedUnits(pk).map((id) => unit(pk, id)).flatMap((x) => pk === "fr" ? [...refs(x, "v"), ...refs(x, "s"), ...refs(x, "q")] : refs(x, "w"));
    shuffle(pool).slice(0, Math.max(0, 12 - out.length)).forEach((r) => add(r));
    if (pk === "fr") { const vv = shuffle(pool.filter((r) => r.k === "v")).slice(0, 5); if (vv.length >= 4) out.splice(4, 0, MK.pairs(pk, vv)); }
  }
  return out;
}

/* ---------- navegación ---------- */
const app = () => $("#app");
let cleanup = null;
function screen(node, cls) {
  if (cleanup) { cleanup(); cleanup = null; }
  if (TTS) try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
  const root = app(); root.className = "app " + (cls || ""); root.replaceChildren(node);
  window.scrollTo(0, 0);
  const f = root.querySelector("[data-autofocus]"); if (f) setTimeout(() => f.focus(), 30);
}
function toast(msg) {
  const t = h("div", { class: "toast", role: "status" }, msg); document.body.append(t);
  setTimeout(() => t.classList.add("out"), 1900); setTimeout(() => t.remove(), 2300);
}

/* ---------- bienvenida ---------- */
function Welcome() {
  let goal = S.goal || 60;
  const goals = [[30, "Relajado", "unos 10 min al día"], [60, "Constante", "unos 20 min al día"], [90, "Intenso", "unos 30 min al día"]];
  const chips = h("div", { class: "goal-row", role: "radiogroup", "aria-label": "Meta diaria" },
    goals.map(([xp, n, d]) => h("button", { class: "goal" + (xp === goal ? " on" : ""), role: "radio", "aria-checked": xp === goal ? "true" : "false", onclick: (e) => { goal = xp; chips.querySelectorAll(".goal").forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); }); e.currentTarget.classList.add("on"); e.currentTarget.setAttribute("aria-checked", "true"); } },
      h("b", null, n), h("span", null, d), h("small", null, xp + " XP"))));
  const name = h("input", { id: "name", type: "text", placeholder: "Tu nombre", value: S.name || "", autocomplete: "given-name", maxlength: "24", "data-autofocus": true });
  const go = () => { S.name = name.value.trim() || "Estudiante"; S.goal = goal; save(); Home(); };
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  screen(h("main", { class: "welcome" },
    h("div", { class: "brand" }, h("span", { class: "brand-mark" }, "C"), h("span", null, "Cahier")),
    h("h1", { class: "display" }, "Dos cuadernos, un mes, avance de verdad."),
    h("p", { class: "lead" }, "Un cuaderno de ", h("b", { class: "t-es" }, "ortografía en español"), " y otro de ", h("b", { class: "t-fr" }, "francés"), ". Cada uno empieza con una prueba corta, te arma un plan de 30 días a tu nivel y repite justo lo que fallas hasta que se te queda."),
    h("label", { class: "field", for: "name" }, h("span", null, "¿Cómo te llamas?"), name),
    h("div", { class: "field" }, h("span", null, "Meta diaria"), chips),
    h("button", { class: "btn primary big", onclick: go }, "Abrir mis cuadernos")
  ), "paper");
}

/* ---------- inicio ---------- */
function ring(val, max) {
  const r = 22, c = 2 * Math.PI * r, p = Math.min(1, val / max);
  return h("span", { class: "ring", html: `<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" class="ring-bg"/><circle cx="26" cy="26" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>` });
}
function PanelCard(pk) {
  const meta = P[pk], pp = S.panels[pk];
  const day = currentDay(pp);
  const doneN = Object.keys(pp.done).length;
  const body = pp.placed
    ? [h("div", { class: "pc-meta" }, h("span", { class: "chip" }, meta.levels[pp.lvl].n), h("span", { class: "muted" }, "Día " + Math.min(day + 1, 30) + " de 30")),
       h("div", { class: "bar", "aria-label": doneN + " de 30 días" }, h("i", { style: "width:" + (doneN / 30 * 100) + "%" })),
       h("p", { class: "pc-next" }, day < 30 ? dayTitle(pk, pp.plan[day]) : "Plan completado. Puedes seguir repasando."),
       h("button", { class: "btn primary", onclick: () => Panel(pk) }, day < 30 ? "Continuar" : "Ver mi cuaderno")]
    : [h("p", { class: "pc-next" }, pk === "fr" ? "12 preguntas, unos 3 minutos. Si no sabes nada de francés, marca «No lo sé» y empezamos desde cero." : "12 preguntas, unos 3 minutos. Medimos tildes, letras dudosas y homófonos."),
       h("button", { class: "btn primary", onclick: () => TestIntro(pk) }, "Hacer prueba de nivel")];
  return h("section", { class: "panel-card " + pk },
    h("div", { class: "pc-head" },
      h("span", { class: "pc-tab" }, pk === "fr" ? "FR" : "ES"),
      h("div", null, h("h2", null, meta.name), h("p", { class: "muted" }, meta.sub))),
    body);
}
function Home() {
  if (!S.name) return Welcome();
  const goal = S.goal || 60;
  screen(h("main", { class: "home" },
    h("header", { class: "topbar" },
      h("div", { class: "brand" }, h("span", { class: "brand-mark" }, "C"), h("span", null, "Cahier")),
      h("div", { class: "stats" },
        h("span", { class: "stat flame", title: "Racha" }, icon("flame"), h("b", null, streakNow()), h("span", { class: "sr" }, " días de racha")),
        h("span", { class: "stat xp", title: "XP total" }, icon("bolt"), h("b", null, S.xp)))),
    h("section", { class: "hello" },
      h("div", null, h("h1", { class: "display" }, "Hola, " + S.name + "."),
        h("p", { class: "muted" }, xpToday() >= goal ? "Meta de hoy cumplida. Lo que hagas ahora es extra." : "Te faltan " + (goal - xpToday()) + " XP para la meta de hoy.")),
      h("div", { class: "goal-ring" }, ring(xpToday(), goal), h("span", null, h("b", null, xpToday()), "/" + goal))),
    PanelCard("es"), PanelCard("fr"),
    h("footer", { class: "foot" },
      h("button", { class: "link", onclick: () => { S.sound = !S.sound; save(); Home(); } }, S.sound ? "Sonidos: activados" : "Sonidos: desactivados"),
      h("button", { class: "link", onclick: Settings }, "Ajustes y progreso"),
      !TTS ? h("p", { class: "muted small" }, "Este navegador no tiene voz sintética: los ejercicios de escuchar y dictado se reemplazan por otros.") : null)
  ), "paper");
}
function Settings() {
  const row = (label, action, danger) => {
    const b = h("button", { class: "btn " + (danger ? "danger" : "ghost") }, label);
    let armed = false;
    b.addEventListener("click", () => { if (!danger) return action(); if (!armed) { armed = true; b.textContent = "Toca otra vez para confirmar"; setTimeout(() => { armed = false; b.textContent = label; }, 3000); } else action(); });
    return b;
  };
  screen(h("main", { class: "settings" },
    h("header", { class: "subbar" }, h("button", { class: "icon-btn", "aria-label": "Volver", onclick: Home }, icon("back")), h("h1", null, "Ajustes")),
    h("section", { class: "card" }, h("h3", null, "Meta diaria"),
      h("div", { class: "row-wrap" }, [30, 60, 90].map((g) => h("button", { class: "btn " + (S.goal === g ? "primary" : "ghost"), onclick: () => { S.goal = g; save(); Settings(); } }, g + " XP")))),
    ["es", "fr"].map((pk) => h("section", { class: "card" }, h("h3", null, P[pk].name),
      h("p", { class: "muted" }, S.panels[pk].placed ? "Nivel " + P[pk].levels[S.panels[pk].lvl].n + " · " + Object.keys(S.panels[pk].done).length + " días hechos" : "Sin prueba de nivel todavía."),
      S.panels[pk].placed ? row("Reiniciar este cuaderno", () => { S.panels[pk] = blankPanel(); save(); toast("Cuaderno de " + P[pk].name.toLowerCase() + " reiniciado"); Settings(); }, true) : null)),
    h("section", { class: "card" }, h("h3", null, "Todo"), row("Borrar todo y empezar de cero", () => { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } S = load(); Welcome(); }, true)),
    h("p", { class: "muted small" }, "Tu progreso se guarda solo en este navegador.")
  ), "paper");
}

/* ---------- prueba de nivel ---------- */
function TestIntro(pk) {
  const meta = P[pk];
  screen(h("main", { class: "center-col " + pk },
    h("header", { class: "subbar" }, h("button", { class: "icon-btn", "aria-label": "Volver", onclick: Home }, icon("back")), h("h1", null, "Prueba de nivel · " + meta.name)),
    h("div", { class: "sheet-card" },
      h("p", { class: "hand big" }, "Sin presión."),
      h("p", null, "Las preguntas van de fácil a difícil. Cuando un nivel se te complica, paramos ahí: ese es tu punto de partida."),
      h("ul", { class: "ticks" },
        h("li", null, "Unas 12 preguntas, 3 minutos."),
        h("li", null, "Usa «No lo sé» en vez de adivinar: así el plan sale más preciso."),
        h("li", null, "Al final ves tu nivel y tu plan de 30 días.")),
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: () => Test(pk, false) }, "Empezar"))
  ), "paper");
}
function Test(pk, isFinal) {
  const meta = P[pk];
  const qs = [...meta.place].sort((a, b) => a.g - b.g);
  let extra = [];
  if (isFinal) {
    const pool = studiedUnits(pk).map((id) => unit(pk, id)).flatMap((u) => refs(u, pk === "fr" ? "q" : "w"));
    extra = shuffle(pool).slice(0, 8).map((r) => {
      const d = data(pk, r);
      return pk === "fr" ? { g: 9, q: d[0], ok: d[1], no: d[2] } : { g: 9, q: d[2], ok: fillWord(d[2], d[0]), no: d[1].split("|").map((x) => fillWord(d[2], x)) };
    });
  }
  const all = qs.concat(extra);
  const ans = [];
  let i = 0;
  const wrongIn = (g) => ans.filter((a) => a.g === g && !a.ok).length;
  const next = () => {
    if (!isFinal && ans.length) {
      const last = ans[ans.length - 1];
      if (wrongIn(last.g) > meta.group - meta.need) return finish();
    }
    if (i >= all.length) return finish();
    render(all[i]);
  };
  const finish = () => {
    let passed = 0;
    for (let g = 0; g < meta.gname.length; g++) {
      const c = ans.filter((a) => a.g === g && a.ok).length;
      if (c >= meta.need) passed++; else break;
    }
    const placeScore = Math.round(ans.filter((a) => a.g < 9 && a.ok).length / qs.length * 100);
    if (isFinal) return FinalResult(pk, placeScore, extra.length ? Math.round(ans.filter((a) => a.g === 9 && a.ok).length / extra.length * 100) : null, passed);
    TestResult(pk, Math.min(passed, meta.levels.length - 1), placeScore, passed);
  };
  const render = (q) => {
    let chosen = null;
    const opts = shuffle([q.ok, ...q.no]);
    const optBtns = opts.map((o, k) => h("button", { class: "opt", "data-k": k + 1, onclick: (e) => choose(o, e.currentTarget) }, h("kbd", null, k + 1), h("span", { lang: pk === "fr" && /___/.test(q.q) ? "fr" : null }, o)));
    const dont = h("button", { class: "opt dont", onclick: (e) => choose("__nose", e.currentTarget) }, "No lo sé");
    const checkBtn = h("button", { class: "btn primary big", disabled: true, onclick: () => { if (!chosen) return; ans.push({ g: q.g, ok: chosen === q.ok }); i++; next(); } }, "Siguiente");
    const choose = (o, el) => { chosen = o; [...optBtns, dont].forEach((b) => b.classList.remove("sel")); el.classList.add("sel"); checkBtn.disabled = false; };
    const qText = /___/.test(q.q) ? sentenceNode(q.q, pk === "fr" ? "fr" : "es") : h("p", { class: "q-text" }, q.q);
    const view = h("main", { class: "lesson " + pk },
      h("header", { class: "lbar" },
        h("button", { class: "icon-btn", "aria-label": "Salir", onclick: Home }, icon("close")),
        h("div", { class: "bar grow" }, h("i", { style: "width:" + (i / all.length * 100) + "%" })),
        h("span", { class: "chip ghost" }, isFinal ? "Final" : meta.gname[q.g] || "Repaso")),
      h("section", { class: "stage" }, h("p", { class: "ex-title" }, isFinal ? "Examen final" : "Prueba de nivel"), qText,
        h("div", { class: "opts" }, optBtns, dont)),
      h("footer", { class: "checkbar" }, checkBtn));
    screen(view, "lesson-screen");
    keyHandler((e) => {
      const n = +e.key; if (n >= 1 && n <= optBtns.length) optBtns[n - 1].click();
      if (e.key === "Enter" && !checkBtn.disabled) checkBtn.click();
    });
  };
  next();
}
function keyHandler(fn) {
  const f = (e) => { if (e.target && e.target.tagName === "INPUT" && e.key !== "Enter") return; fn(e); };
  document.addEventListener("keydown", f); cleanup = () => document.removeEventListener("keydown", f);
}
function TestResult(pk, lvl, score, passed) {
  const meta = P[pk], pp = S.panels[pk];
  pp.placed = true; pp.lvl = lvl; pp.start = meta.levels[lvl].start; pp.initial = score; pp.plan = buildPlan(pk, pp.start);
  pp.done = {}; pp.srs = {}; pp.session = 0; pp.final = null; save();
  const week = pp.plan.slice(0, 7);
  screen(h("main", { class: "center-col " + pk },
    h("div", { class: "sheet-card result" },
      h("p", { class: "ex-title" }, "Tu nivel en " + meta.name.toLowerCase()),
      h("p", { class: "level-big" }, meta.levels[lvl].n),
      h("p", null, passed === 0
        ? (pk === "fr" ? "Empezamos desde la base: saludos, presentarte y los dos verbos más usados." : "Empezamos por las letras que más confunden: b/v, h, g/j, ll/y y c/s/z.")
        : "Ya dominas lo de " + meta.gname.slice(0, passed).join(", ") + ". Tu plan arranca en la unidad " + pp.start + " y refuerza las bases al final."),
      h("p", { class: "muted small" }, "Acertaste el " + score + "% de la prueba. En el día 30 la repites para comparar."),
      h("h3", { class: "week-h" }, "Tu primera semana"),
      h("ol", { class: "week" }, week.map((e, i) => h("li", null, h("span", { class: "d" }, "Día " + (i + 1)), h("span", null, dayTitle(pk, e))))),
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: () => Panel(pk) }, "Ver mi plan de 30 días"))
  ), "paper");
}
function FinalResult(pk, score, unitScore, passed) {
  const meta = P[pk], pp = S.panels[pk];
  pp.final = score; pp.done[FINAL_DAY] = { stars: score >= 85 ? 3 : score >= 60 ? 2 : 1, acc: score };
  pp.session++; addXp(50); save();
  const delta = score - (pp.initial || 0);
  const lvlNow = meta.levels[Math.min(passed, meta.levels.length - 1)].n;
  screen(h("main", { class: "center-col " + pk },
    h("div", { class: "sheet-card result" },
      h("p", { class: "ex-title" }, "Examen final · " + meta.name),
      h("p", { class: "hand big" }, delta > 0 ? "+" + delta + " puntos en 30 días" : "Terminaste el mes"),
      h("div", { class: "compare" },
        h("div", null, h("span", { class: "muted small" }, "Día 1"), h("div", { class: "cbar" }, h("i", { class: "before", style: "width:" + (pp.initial || 0) + "%" })), h("b", null, (pp.initial || 0) + "%")),
        h("div", null, h("span", { class: "muted small" }, "Día 30"), h("div", { class: "cbar" }, h("i", { style: "width:" + score + "%" })), h("b", null, score + "%"))),
      unitScore != null ? h("p", null, "En las preguntas de tus unidades acertaste el " + unitScore + "%.") : null,
      h("p", null, "Nivel actual estimado: ", h("b", null, lvlNow), "."),
      h("p", { class: "muted small" }, "Puedes seguir con repasos mixtos o reiniciar el cuaderno desde Ajustes para un nuevo plan con la prueba actualizada."),
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: () => Panel(pk) }, "Volver al cuaderno"))
  ), "paper");
}

/* ---------- panel con el camino de 30 días ---------- */
function Panel(pk) {
  const meta = P[pk], pp = S.panels[pk];
  if (!pp.placed) return TestIntro(pk);
  const cur = currentDay(pp);
  const weak = weakCount(pk);
  const path = h("ol", { class: "path" });
  for (let i = 0; i < 30; i++) {
    if (i % 7 === 0) path.append(h("li", { class: "week-label" }, i === 28 ? "Cierre" : "Semana " + (i / 7 + 1)));
    const e = pp.plan[i], done = pp.done[i], open = i <= cur;
    const x = Math.round((Math.sin(i * 0.85) + 1) / 2 * 38);
    const special = e.k === "review" || e.k === "final" || e.k === "mix";
    const stars = done ? h("span", { class: "stars" }, [0, 1, 2].map((s) => h("span", { class: s < done.stars ? "on" : "", html: ICON.star }))) : null;
    path.append(h("li", { class: "node-row", style: "--x:" + x + "%" },
      h("button", { class: "node " + (done ? "done" : i === cur ? "current" : open ? "" : "locked") + (special ? " special " + e.k : ""), "aria-label": "Día " + (i + 1) + ": " + dayTitle(pk, e) + (done ? ", completado" : open ? "" : ", bloqueado"), onclick: () => (open ? DaySheet(pk, i) : toast("Completa el día " + (cur + 1) + " primero")) },
        done ? icon("check") : open ? h("b", null, i + 1) : icon("lock")),
      h("span", { class: "node-label" }, h("small", null, "Día " + (i + 1)), h("span", null, e.u ? unit(pk, e.u).t : KIND[e.k].label), stars)));
  }
  screen(h("main", { class: "panel-view " + pk },
    h("header", { class: "subbar sticky" },
      h("button", { class: "icon-btn", "aria-label": "Volver al inicio", onclick: Home }, icon("back")),
      h("div", { class: "grow" }, h("h1", null, meta.name), h("p", { class: "muted small" }, meta.levels[pp.lvl].n + " · " + Object.keys(pp.done).length + "/30 días")),
      h("span", { class: "stat flame" }, icon("flame"), h("b", null, streakNow()))),
    h("div", { class: "quick" },
      cur < 30 ? h("button", { class: "btn primary", onclick: () => DaySheet(pk, cur) }, "Día " + (cur + 1) + ": " + KIND[pp.plan[cur].k].label) : null,
      h("button", { class: "btn ghost", onclick: () => Sprint(pk) }, icon("timer"), "Contrarreloj"),
      weak ? h("button", { class: "btn ghost", onclick: () => startLesson(pk, null, { k: "mix", weak: true }) }, "Repasar errores (" + weak + ")") : null,
      h("button", { class: "btn ghost", onclick: () => Notes(pk) }, icon("book"), "Reglas")),
    path
  ), "paper");
  const curNode = app().querySelector(".node.current");
  if (curNode) setTimeout(() => curNode.scrollIntoView({ block: "center" }), 40);
}
function DaySheet(pk, i) {
  const pp = S.panels[pk], e = pp.plan[i], u = e.u ? unit(pk, e.u) : null;
  const close = () => ov.remove();
  const ov = h("div", { class: "overlay", onclick: (ev) => { if (ev.target === ov) close(); } },
    h("div", { class: "modal " + pk, role: "dialog", "aria-modal": "true", "aria-label": "Día " + (i + 1) },
      h("p", { class: "ex-title" }, "Día " + (i + 1) + " · " + KIND[e.k].label),
      h("h2", null, u ? u.t : KIND[e.k].label),
      h("p", null, KIND[e.k].desc),
      u ? h("p", { class: "rule" }, u.r) : null,
      pp.done[i] ? h("p", { class: "muted small" }, "Ya lo hiciste con " + pp.done[i].acc + "% de aciertos. Repetirlo también suma XP.") : null,
      h("div", { class: "row-wrap" },
        h("button", { class: "btn ghost", onclick: close }, "Cerrar"),
        h("button", { class: "btn primary", "data-autofocus": true, onclick: () => { close(); e.k === "final" ? Test(pk, true) : startLesson(pk, i, e); } }, pp.done[i] ? "Repetir" : "Empezar"))));
  document.body.append(ov);
  setTimeout(() => { const b = ov.querySelector("[data-autofocus]"); if (b) b.focus(); }, 30);
  const esc = (ev) => { if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc); } };
  document.addEventListener("keydown", esc);
}
function Notes(pk) {
  const pp = S.panels[pk];
  const ids = uniq(pp.plan.filter((e) => e.u).map((e) => e.u)).sort((a, b) => a - b);
  screen(h("main", { class: "notes " + pk },
    h("header", { class: "subbar sticky" }, h("button", { class: "icon-btn", "aria-label": "Volver", onclick: () => Panel(pk) }, icon("back")), h("h1", null, "Reglas de " + P[pk].name.toLowerCase())),
    ids.map((id) => { const u = unit(pk, id); return h("article", { class: "note-card" }, h("p", { class: "ex-title" }, "Unidad " + u.id + " · " + P[pk].gname[u.g]), h("h3", null, u.t), h("p", { html: u.tip })); })
  ), "paper");
}

/* ---------- intro de unidad ---------- */
function UnitIntro(pk, u, onGo) {
  const list = pk === "fr"
    ? h("ul", { class: "vocab" }, u.v.map(([fr, es]) => h("li", null,
        TTS ? h("button", { class: "icon-btn sm", "aria-label": "Escuchar " + fr, onclick: () => speak(fr, "fr-FR") }, icon("speaker")) : null,
        h("b", { lang: "fr" }, fr), h("span", { class: "muted" }, es))))
    : h("ul", { class: "vocab ortho" }, u.w.slice(0, 8).map(([ok, bad, ctx]) => h("li", null, h("b", null, fillWord(ctx, ok)), h("s", { class: "red-pen" }, fillWord(ctx, bad.split("|")[0])))));
  screen(h("main", { class: "center-col " + pk },
    h("header", { class: "subbar" }, h("button", { class: "icon-btn", "aria-label": "Salir", onclick: () => Panel(pk) }, icon("close")), h("h1", null, "Unidad " + u.id)),
    h("article", { class: "sheet-card intro" },
      h("p", { class: "ex-title" }, P[pk].gname[u.g] + " · " + (pk === "fr" ? "Gramática" : "Regla")),
      h("h2", { class: "display" }, u.t),
      h("p", { class: "tip", html: u.tip }),
      h("h3", null, pk === "fr" ? "Palabras de hoy" : "Bien escrito / mal escrito"),
      list,
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: onGo }, "Empezar ejercicios"))
  ), "paper");
}

/* ---------- motor de lección ---------- */
let L = null;
function startLesson(pk, dayIdx, entry) {
  let queue;
  if (entry.weak) {
    const pp = S.panels[pk];
    const weakRefs = Object.entries(pp.srs).filter(([, v]) => v.b === 0).map(([k]) => { const [u, kk, i] = k.split("."); return { u: +u, k: kk, i: +i }; });
    queue = shuffle(weakRefs).slice(0, 12).map((r) => make(pk, r)).filter(Boolean);
  } else queue = buildLesson(pk, entry);
  if (!queue.length) { toast("No hay ejercicios para este día"); return; }
  queue.forEach((ex, n) => { ex.id = n; ex.tries = 0; });
  L = { pk, dayIdx, entry, queue, pos: 0, base: queue.length, first: 0, xp: 0, combo: 0, maxCombo: 0, t0: Date.now(), seen: new Set() };
  const u = entry.u ? unit(pk, entry.u) : null;
  if (u && (entry.k === "learn" || entry.k === "boost")) UnitIntro(pk, u, runEx); else runEx();
}
function runEx() {
  if (L.pos >= L.queue.length) return finishLesson();
  const ex = L.queue[L.pos];
  const pk = L.pk;
  const state = { answer: null, done: false };
  const checkBtn = h("button", { class: "btn primary big", disabled: true }, "Comprobar");
  const setAnswer = (a) => { state.answer = a; checkBtn.disabled = a == null || a === "" || (Array.isArray(a) && !a.length); };
  const fb = h("div", { class: "feedback", hidden: true, "aria-live": "polite" });
  const resolve = (ok, extra) => {
    if (state.done) return; state.done = true;
    beep(ok);
    stage.classList.add(ok ? "is-ok" : "is-bad");
    if (ex.type === "pairs") (ex.missed || []).forEach((r) => srsMark(pk, r, false));
    if (ex.refs && ex.type === "pairs") ex.refs.forEach((r) => { if (!(ex.missed || []).includes(r)) srsMark(pk, r, true); });
    else srsMark(pk, ex.ref, ok);
    if (ok) { L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo); if (ex.tries === 0) L.first++; L.xp += ex.tries === 0 ? 10 + (L.combo >= 5 ? 5 : 0) : 5; }
    else {
      L.combo = 0;
      if (ex.tries < 2) {
        let again = ex.type === "pairs" ? MK.pairs(pk, ex.refs) : MK[ex.mk](pk, ex.ref);
        if (again) { again.mk = ex.mk; again.id = ex.id; again.tries = ex.tries + 1; L.queue.push(again); }
      }
    }
    showFeedback(ok, extra);
  };
  const showFeedback = (ok, extra) => {
    const warn = extra && extra.warn;
    const okMsg = pk === "fr" ? pickOne(["Très bien !", "¡Exacto!", "Parfait !", "¡Eso es!"]) : pickOne(["¡Perfecto!", "¡Bien escrito!", "¡Exacto!", "¡Eso es!"]);
    const answerLine = ex.type === "pairs" ? null : (ex.full || ex.speakOk || ex.ok);
    fb.replaceChildren(
      h("div", { class: "fb-inner" },
        h("p", { class: "hand fb-title" }, ok ? (warn ? "Casi perfecto" : okMsg) : "Ojo aquí"),
        warn ? h("p", null, warn) : null,
        !ok && ex.tries < 2 ? h("p", { class: "small" }, "Este ejercicio vuelve al final de la lección.") : null,
        !ok && answerLine ? h("p", null, "Correcto: ", h("b", { lang: pk === "fr" ? "fr" : "es" }, answerLine)) : (ok && ex.full ? h("p", null, h("b", null, ex.full)) : null),
        ex.note ? h("p", { class: "fb-note" + (ok ? " muted" : "") }, ex.note) : null,
        h("div", { class: "fb-actions" },
          TTS && ex.speakOk ? h("button", { class: "icon-btn", "aria-label": "Escuchar", onclick: () => speak(ex.speakOk, "fr-FR") }, icon("speaker")) : null,
          h("button", { class: "btn " + (ok ? "ok" : "bad") + " big", "data-cont": true, onclick: () => { L.pos++; runEx(); } }, "Continuar"))));
    fb.className = "feedback " + (ok ? "ok" : "bad"); fb.hidden = false;
    checkBtn.hidden = true;
    setTimeout(() => { const c = fb.querySelector("[data-cont]"); if (c) c.focus(); }, 20);
    if (pk === "fr" && ok && ex.speakOk && TTS && ex.type !== "pairs") speak(ex.speakOk, "fr-FR");
  };
  checkBtn.addEventListener("click", () => { if (state.answer == null) return; const g = grade(ex, state.answer); resolve(g.ok, g); });

  const body = renderBody(ex, pk, setAnswer, resolve);
  const stage = h("section", { class: "stage" },
    h("p", { class: "ex-title" }, ex.tries ? "Otra vez: " + ex.title.charAt(0).toLowerCase() + ex.title.slice(1) : ex.title), body);
  const view = h("main", { class: "lesson " + pk },
    h("header", { class: "lbar" },
      h("button", { class: "icon-btn", "aria-label": "Salir de la lección", onclick: () => Panel(pk) }, icon("close")),
      h("div", { class: "bar grow", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": L.queue.length, "aria-valuenow": L.pos }, h("i", { style: "width:" + (L.pos / L.queue.length * 100) + "%" })),
      h("span", { class: "combo" + (L.combo >= 3 ? " hot" : "") }, icon("flame"), L.combo)),
    stage,
    h("footer", { class: "checkbar" }, checkBtn, fb));
  screen(view, "lesson-screen");
  if (ex.audio) setTimeout(() => speak(ex.audio, pk === "fr" ? "fr-FR" : "es-ES"), 250);
  keyHandler((e) => {
    if (!fb.hidden) { if (e.key === "Enter") { e.preventDefault(); const c = fb.querySelector("[data-cont]"); if (c) c.click(); } return; }
    if (e.key === "Enter" && !checkBtn.disabled && !checkBtn.hidden) { e.preventDefault(); checkBtn.click(); return; }
    const n = +e.key; if (n >= 1 && n <= 9) { const b = stage.querySelector('[data-k="' + n + '"]'); if (b) b.click(); }
  });
}
function grade(ex, a) {
  if (ex.type === "mc") return { ok: a === ex.ok };
  if (ex.type === "order") return { ok: a.join(" ") === ex.ok };
  if (ex.type === "write") {
    if (ex.lang === "fr") {
      const want = normFr(ex.ok), got = normFr(a);
      if (got === want) return { ok: true };
      if (noAcc(got) === noAcc(want)) return { ok: true, warn: "Revisa los acentos: se escribe «" + ex.ok + "»." };
      return { ok: false };
    }
    return { ok: normEs(a) === normEs(ex.ok) };
  }
  return { ok: false };
}
function sentenceNode(s, lang, fillText) {
  const [pre, post] = s.split("___");
  return h("p", { class: "sentence", lang }, pre, h("span", { class: "blank" + (fillText ? " filled" : "") }, fillText || " "), post);
}
function audioBtns(text, lang) {
  return h("div", { class: "audio-row" },
    h("button", { class: "audio-btn", "aria-label": "Escuchar", onclick: () => speak(text, lang) }, icon("speaker")),
    h("button", { class: "audio-btn sm", "aria-label": "Escuchar despacio", onclick: () => speak(text, lang, true) }, icon("turtle")));
}
function accentKeys(input, lang) {
  const keys = lang === "fr" ? ["é", "è", "ê", "à", "â", "ç", "î", "ô", "ù", "û", "ë", "œ", "'"] : ["á", "é", "í", "ó", "ú", "ñ", "ü"];
  return h("div", { class: "keys", "aria-label": "Letras especiales" }, keys.map((k) => h("button", { class: "key", type: "button", onmousedown: (e) => e.preventDefault(), onclick: () => {
    const s = input.selectionStart ?? input.value.length, e2 = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + k + input.value.slice(e2); input.focus(); input.setSelectionRange(s + 1, s + 1); input.dispatchEvent(new Event("input"));
  } }, k)));
}
function renderBody(ex, pk, setAnswer, resolve) {
  const lang = pk === "fr" ? "fr-FR" : "es-ES";
  const wrap = h("div", { class: "ex-body" });
  if (ex.type === "mc") {
    if (ex.audio) wrap.append(audioBtns(ex.audio, lang));
    if (ex.prompt) wrap.append(h("p", { class: "prompt", lang: ex.promptSpeak ? "fr" : null }, ex.promptSpeak && TTS ? h("button", { class: "icon-btn sm", "aria-label": "Escuchar", onclick: () => speak(ex.promptSpeak, lang) }, icon("speaker")) : null, ex.prompt));
    let blank = null;
    if (ex.sentence) { const sn = sentenceNode(ex.sentence, pk === "fr" ? "fr" : "es"); blank = sn.querySelector(".blank"); wrap.append(sn); }
    const btns = ex.opts.map((o, k) => h("button", { class: "opt", "data-k": k + 1, lang: pk === "fr" && ex.mk !== "fres" ? "fr" : null, onclick: (e) => {
      btns.forEach((b) => b.classList.remove("sel")); e.currentTarget.classList.add("sel"); setAnswer(o);
      if (blank) { blank.textContent = o; blank.classList.add("filled"); }
      if (pk === "fr" && ex.mk !== "fres" && ex.mk !== "cloze" && TTS) speak(o, lang);
    } }, h("kbd", null, k + 1), h("span", null, o)));
    wrap.append(h("div", { class: "opts" + (ex.opts.some((o) => o.length > 18) ? " stack" : "") }, btns));
  } else if (ex.type === "write") {
    if (ex.audio) wrap.append(audioBtns(ex.audio, lang));
    if (ex.prompt) wrap.append(h("p", { class: "prompt" }, ex.prompt));
    if (ex.sentence) wrap.append(sentenceNode(ex.sentence, "es"));
    const inp = h("input", { id: "answer", class: "answer", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: ex.lang, placeholder: ex.lang === "fr" ? "Escribe en francés" : "Escribe la palabra", "data-autofocus": true });
    inp.addEventListener("input", () => setAnswer(inp.value.trim() ? inp.value : null));
    wrap.append(inp, accentKeys(inp, ex.lang));
  } else if (ex.type === "order") {
    if (ex.audio) wrap.append(audioBtns(ex.audio, lang));
    if (ex.prompt) wrap.append(h("p", { class: "prompt" }, ex.prompt));
    const line = h("div", { class: "tile-line", lang: "fr", "aria-label": "Tu frase" });
    const bank = h("div", { class: "tile-bank", lang: "fr" });
    const chosen = [];
    const sync = () => setAnswer(chosen.map((c) => c.t));
    ex.bank.forEach((t, k) => {
      const tile = h("button", { class: "tile", "data-k": k + 1 <= 9 ? k + 1 : null }, t);
      tile.addEventListener("click", () => {
        if (tile.parentNode === bank) { line.append(tile); chosen.push({ t, tile }); if (TTS) speak(t, lang); }
        else { bank.append(tile); const idx = chosen.findIndex((c) => c.tile === tile); chosen.splice(idx, 1); }
        sync();
      });
      bank.append(tile);
    });
    wrap.append(line, bank);
  } else if (ex.type === "pairs") {
    const left = shuffle(ex.items.map((x, k) => ({ t: x[0], k }))), right = shuffle(ex.items.map((x, k) => ({ t: x[1], k })));
    let selL = null, selR = null, matched = 0, errors = 0; ex.missed = [];
    const colL = h("div", { class: "pcol", lang: "fr" }), colR = h("div", { class: "pcol" });
    const tryMatch = () => {
      if (!selL || !selR) return;
      const a = selL, b = selR; selL = selR = null;
      if (a.k === b.k) {
        a.el.classList.add("matched"); b.el.classList.add("matched"); a.el.disabled = b.el.disabled = true; a.el.classList.remove("sel"); b.el.classList.remove("sel");
        matched++; if (matched === ex.items.length) setTimeout(() => resolve(errors <= 1, null), 250);
      } else {
        errors++; if (!ex.missed.includes(ex.refs[a.k])) ex.missed.push(ex.refs[a.k]);
        [a.el, b.el].forEach((el) => { el.classList.add("wrong"); setTimeout(() => el.classList.remove("wrong", "sel"), 450); });
        beep(false);
      }
    };
    left.forEach((it) => { const el = h("button", { class: "pbtn" }, it.t); it.el = el; el.addEventListener("click", () => { colL.querySelectorAll(".pbtn").forEach((b) => b.classList.remove("sel")); el.classList.add("sel"); selL = it; if (TTS) speak(it.t, lang); tryMatch(); }); colL.append(el); });
    right.forEach((it) => { const el = h("button", { class: "pbtn" }, it.t); it.el = el; el.addEventListener("click", () => { colR.querySelectorAll(".pbtn").forEach((b) => b.classList.remove("sel")); el.classList.add("sel"); selR = it; tryMatch(); }); colR.append(el); });
    wrap.append(h("div", { class: "pairs" }, colL, colR), h("p", { class: "muted small center" }, "Máximo un error para que cuente como perfecto."));
  } else if (ex.type === "letter") {
    wrap.append(sentenceNode(ex.sentence, "es"));
    const word = h("p", { class: "word-gap" }, ex.pre, h("span", { class: "gap" }, "?"), ex.post);
    const btns = ex.opts.map((o, k) => h("button", { class: "letter-btn", "data-k": k + 1, onclick: () => {
      word.querySelector(".gap").textContent = o || "∅"; btns.forEach((b) => (b.disabled = true)); resolve(o === ex.ok, null);
    } }, o === "" ? "nada" : o));
    wrap.append(word, h("div", { class: "letter-row" }, btns));
  } else if (ex.type === "hunt") {
    const [pre, post] = ex.ctx.split("___");
    const pw = pre.split(" "), lead = pw.pop(), qw = post.split(" "), tail = qw.shift();
    const chips = [];
    let k = 0;
    const mk = (t, isT) => { k++; const b = h("button", { class: "word-chip", "data-k": k <= 9 ? k : null }, t); b.addEventListener("click", () => {
      chips.forEach((c) => (c.disabled = true));
      const target = chips.find((c) => c.dataset.t === "1");
      target.classList.add("target");
      if (isT) { target.textContent = lead + ex.okW + tail; target.classList.add("fixed"); resolve(true, null); }
      else { b.classList.add("miss"); resolve(false, null); }
    }); if (isT) b.dataset.t = "1"; chips.push(b); return b; };
    const line = h("p", { class: "hunt-line" });
    pw.filter(Boolean).forEach((t) => line.append(mk(t, false), " "));
    line.append(mk(lead + ex.badW + tail, true), " ");
    qw.filter(Boolean).forEach((t) => line.append(mk(t, false), " "));
    wrap.append(line);
  } else if (ex.type === "tilde") {
    wrap.append(sentenceNode(ex.sentence, "es"));
    const row = h("div", { class: "tilde-row" });
    const btns = [];
    ex.base.forEach((c, i) => {
      if (/[aeiouAEIOU]/.test(c)) { const b = h("button", { class: "tl vowel", "aria-label": "Tilde en la " + c }, c); b.addEventListener("click", () => pick(i, b)); btns.push(b); row.append(b); }
      else row.append(h("span", { class: "tl" }, c));
    });
    const none = h("button", { class: "btn ghost", "data-k": 1 }, "No lleva tilde");
    none.addEventListener("click", () => pick(-1, none));
    const pick = (i, b) => {
      btns.concat(none).forEach((x) => (x.disabled = true));
      if (ex.target >= 0) { const t = row.children[ex.target]; t.textContent = [...ex.word][ex.target]; t.classList.add("fixed"); }
      if (i !== ex.target) b.classList.add("miss");
      resolve(i === ex.target, null);
    };
    wrap.append(row, h("div", { class: "center" }, none));
  }
  return wrap;
}
function finishLesson() {
  const pk = L.pk, pp = S.panels[pk];
  const acc = Math.round(L.first / L.base * 100);
  const stars = acc >= 90 ? 3 : acc >= 70 ? 2 : 1;
  const bonus = 20 + (L.dayIdx != null && !pp.done[L.dayIdx] ? 10 : 0);
  const mins = Math.max(1, Math.round((Date.now() - L.t0) / 60000));
  let dayLabel = null;
  if (L.dayIdx != null) {
    const prev = pp.done[L.dayIdx];
    pp.done[L.dayIdx] = { stars: Math.max(stars, prev ? prev.stars : 0), acc: Math.max(acc, prev ? prev.acc : 0) };
    dayLabel = "Día " + (L.dayIdx + 1) + " completado";
  }
  pp.session++;
  addXp(L.xp + bonus);
  const goalHit = xpToday() >= (S.goal || 60);
  screen(h("main", { class: "center-col " + pk },
    h("div", { class: "sheet-card result" },
      h("p", { class: "hand big" }, dayLabel || "Repaso terminado"),
      h("div", { class: "stars big" }, [0, 1, 2].map((s) => h("span", { class: s < stars ? "on" : "", html: ICON.star }))),
      h("div", { class: "result-grid" },
        h("div", null, h("b", null, "+" + (L.xp + bonus)), h("span", null, "XP")),
        h("div", null, h("b", null, acc + "%"), h("span", null, "a la primera")),
        h("div", null, h("b", null, L.maxCombo), h("span", null, "mejor racha")),
        h("div", null, h("b", null, mins), h("span", null, mins === 1 ? "minuto" : "minutos"))),
      h("p", { class: "muted" }, acc < 70 ? "Lo que fallaste vuelve mañana en el repaso, hasta que salga solo." : goalHit ? "Meta diaria cumplida. Racha de " + streakNow() + (streakNow() === 1 ? " día." : " días.") : "Vas bien. Te faltan " + Math.max(0, (S.goal || 60) - xpToday()) + " XP para la meta de hoy."),
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: () => Panel(pk) }, "Volver al plan"))
  ), "paper");
  L = null;
}

/* ---------- contrarreloj ---------- */
function Sprint(pk) {
  const pp = S.panels[pk];
  const ids = studiedUnits(pk);
  const items = ids.map((id) => unit(pk, id)).flatMap((u) => pk === "fr" ? u.v.map((x) => ({ q: x[1], ok: x[0], pool: u.v.map((y) => y[0]) })) : u.w.map((x) => ({ q: x[2], ok: fillWord(x[2], x[0]), bad: fillWord(x[2], x[1].split("|")[0]) })));
  let score = 0, left = 60, n = 0, timer = null;
  const ready = () => screen(h("main", { class: "center-col " + pk },
    h("header", { class: "subbar" }, h("button", { class: "icon-btn", "aria-label": "Volver", onclick: () => Panel(pk) }, icon("back")), h("h1", null, "Contrarreloj")),
    h("div", { class: "sheet-card" },
      h("p", { class: "hand big" }, "60 segundos."),
      h("p", null, pk === "fr" ? "Te mostramos una palabra en español: toca su traducción. Solo palabras de unidades que ya viste." : "Toca la forma bien escrita para completar cada frase. Solo reglas que ya viste."),
      h("p", { class: "muted" }, "Tu mejor marca: " + (pp.best || 0)),
      h("button", { class: "btn primary big", "data-autofocus": true, onclick: run }, "Empezar"))), "paper");
  const run = () => {
    const view = h("main", { class: "lesson sprint " + pk });
    screen(view, "lesson-screen");
    const tbar = h("i", { style: "width:100%" });
    const sc = h("b", null, "0");
    const stage = h("section", { class: "stage" });
    view.append(h("header", { class: "lbar" }, h("button", { class: "icon-btn", "aria-label": "Salir", onclick: () => Panel(pk) }, icon("close")), h("div", { class: "bar grow timebar" }, tbar), h("span", { class: "combo hot" }, icon("bolt"), sc)), stage);
    const nextQ = () => {
      const it = pickOne(items); n++;
      const wrong = pk === "fr" ? pickOne(uniq(it.pool.filter((x) => x !== it.ok)).concat(frAllFallback(it.ok))) : it.bad;
      const opts = shuffle([it.ok, wrong]);
      stage.replaceChildren(
        pk === "fr" ? h("p", { class: "prompt big-prompt" }, it.q) : sentenceNode(it.q, "es"),
        h("div", { class: "opts two" }, opts.map((o, k) => h("button", { class: "opt", "data-k": k + 1, lang: pk === "fr" ? "fr" : null, onclick: (e) => {
          const ok = o === it.ok; beep(ok); e.currentTarget.classList.add(ok ? "right" : "miss");
          if (ok) { score++; sc.textContent = score; } else left = Math.max(0, left - 3);
          setTimeout(nextQ, ok ? 120 : 450);
        } }, h("kbd", null, k + 1), h("span", null, o)))));
    };
    keyHandler((e) => { const k = +e.key; if (k === 1 || k === 2) { const b = stage.querySelector('[data-k="' + k + '"]'); if (b) b.click(); } });
    const prevCleanup = cleanup;
    timer = setInterval(() => { left -= 0.1; tbar.style.width = Math.max(0, left / 60 * 100) + "%"; if (left <= 0) end(); }, 100);
    cleanup = () => { clearInterval(timer); if (prevCleanup) prevCleanup(); };
    nextQ();
  };
  const end = () => {
    clearInterval(timer);
    const record = score > (pp.best || 0);
    if (record) pp.best = score;
    addXp(score * 2);
    screen(h("main", { class: "center-col " + pk },
      h("div", { class: "sheet-card result" },
        h("p", { class: "hand big" }, record ? "¡Nuevo récord!" : "Tiempo"),
        h("div", { class: "result-grid" }, h("div", null, h("b", null, score), h("span", null, "aciertos")), h("div", null, h("b", null, "+" + score * 2), h("span", null, "XP")), h("div", null, h("b", null, pp.best), h("span", null, "mejor marca"))),
        h("div", { class: "row-wrap" }, h("button", { class: "btn ghost", onclick: () => Panel(pk) }, "Volver"), h("button", { class: "btn primary", "data-autofocus": true, onclick: () => { score = 0; left = 60; n = 0; run(); } }, "Otra vez")))), "paper");
  };
  ready();
}
function frAllFallback(ok) { return [pickOne(FR.flatMap((u) => u.v.map((x) => x[0])).filter((x) => x !== ok))]; }

/* ---------- arranque ---------- */
Home();
})();
