// Certamen promo — every visual is a pure function of time t (seconds).
// render.mjs calls window.renderFrame(t) for each frame and screenshots the stage.

const words = await (await fetch('/data/words.json')).json();
const TL = await (await fetch('/data/timeline.json')).json();
const ICON = {};
for (const n of ['openai', 'claude', 'gemini', 'mistral', 'meta', 'grok', 'deepseek', 'qwen']) {
  const svg = await (await fetch(`/node_modules/@lobehub/icons-static-svg/icons/${n}.svg`)).text();
  ICON[n] = svg.replace(/<title>.*?<\/title>/, '').replace(/ (width|height)="1em"/g, '').replace(/ style="[^"]*"/, '');
}

const WD = Object.fromEntries(words.map((w, i) => [w.k, { ...w, i }]));
const S = (k) => WD[k].s;
const E = (k) => WD[k].e;

/* ---------------------------------------------------------------- helpers */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const map = (t, a, b) => clamp((t - a) / (b - a));
const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const inExpo = (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10));
const inOutExpo = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);
const outCubic = (p) => 1 - Math.pow(1 - p, 3);
const inCubic = (p) => p * p * p;
const inOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const inQuad = (p) => p * p;
const outBack = (p, s = 1.7) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
function spring(t, freq = 2, damp = 0.5) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
}
// damped wobble that starts at 0, peaks quickly, settles back to 0
const wobble = (t, k = 6, w = 18) => (t <= 0 ? 0 : Math.exp(-t * k) * Math.sin(t * w));
// starts at 1, decays with oscillation (for punches)
const punch = (t, k = 7, w = 12) => (t < 0 ? 0 : Math.exp(-t * k) * Math.cos(t * w));
const decay = (t, k = 8) => (t < 0 ? 0 : Math.exp(-t * k));
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function mix(a, b, p) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(p)))).join(',')})`; }
function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }

function $(tag, o = {}, parent) {
  const e = document.createElement(tag);
  if (o.cls) e.className = o.cls;
  if (o.html != null) e.innerHTML = o.html;
  if (o.text != null) e.textContent = o.text;
  if (o.style) Object.assign(e.style, o.style);
  if (parent) parent.appendChild(e);
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
function $s(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function T(e, o) {
  let tr = `translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px)`;
  if (o.r) tr += ` rotate(${o.r.toFixed(3)}deg)`;
  if (o.ry != null) tr += ` rotateY(${o.ry.toFixed(2)}deg)`;
  tr += ` scale(${(o.sx ?? o.s ?? 1).toFixed(4)},${(o.sy ?? o.s ?? 1).toFixed(4)})`;
  e.style.transform = tr;
  if (o.op != null) e.style.opacity = clamp(o.op).toFixed(3);
  if (o.blur != null) e.style.filter = o.blur > 0.05 ? `blur(${o.blur.toFixed(2)}px)` : 'none';
}
const show = (e, v) => { const d = v ? '' : 'none'; if (e.style.display !== d) e.style.display = d; };
// keyframed camera [t, x, y, s]
function cam(kf, t) {
  if (t <= kf[0][0]) return kf[0].slice(1);
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (t <= b[0]) { const p = inOutCubic(map(t, a[0], b[0])); return [lerp(a[1], b[1], p), lerp(a[2], b[2], p), lerp(a[3], b[3], p)]; }
  }
  return kf[kf.length - 1].slice(1);
}

const C = {
  dPage: '#15140F', dSurface: '#1D1B15', dRaised: '#26231A', dHair: '#35312A', dHair2: '#4C463A', dInk: '#EDE6D6', dMuted: '#A79E8B',
  lPage: '#F4EEE3', lSurface: '#FBF7EF', lRaised: '#FFFDF8', lHair: '#DBD1BE', lHair2: '#B9AC93', lInk: '#1B1A17', lMuted: '#5C574D',
  hot: '#FF3D2E'
};
const P = ['#A8452F', '#BF8526', '#5F6B3E', '#2F4E7E']; // contendens A B C D
const LETTERS = 'ABCD';
// petal geometry: which logo corner each contendens occupies, and its CSS border radii (TL TR BR BL)
const PETAL_POS = [[1, -1], [-1, 1], [-1, -1], [1, 1]]; // A→TR, B→BL, C→TL, D→BR
function petalRadii(j, size) {
  const m = size * 0.44, h = size, s = size * 0.06;
  return [[s, m, s, h], [s, h, s, m], [m, s, h, s], [h, s, m, s]][j];
}
const radiusCss = (r) => r.map((v) => `${v.toFixed(1)}px`).join(' ');

/* ---------------------------------------------------------------- particles */
const bursts = [];
function burst(parent, o) {
  const r = rng(o.seed || 1);
  const parts = [];
  for (let i = 0; i < o.n; i++) {
    const a = (o.angle ?? -Math.PI / 2) + (r() - 0.5) * (o.spread ?? Math.PI * 2);
    const sp = lerp(o.speed[0], o.speed[1], r());
    const size = lerp(o.size[0], o.size[1], r());
    const el = $('div', { cls: 'abs', style: { width: `${size}px`, height: `${size}px`, background: o.colors[i % o.colors.length], display: 'none' } }, parent);
    parts.push({ el, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, rot: (r() - 0.5) * 720, life: o.life * lerp(0.6, 1, r()) });
  }
  bursts.push({ ...o, parts });
}
function updateBursts(t) {
  for (const b of bursts) {
    const tau = t - b.t0;
    for (const p of b.parts) {
      if (tau < 0 || tau > p.life) { show(p.el, false); continue; }
      show(p.el, true);
      const drag = 1 - Math.exp(-tau * 3);
      const x = b.x + (p.vx * drag) / 3 - p.size / 2;
      const y = b.y + (p.vy * drag) / 3 + 0.5 * (b.g ?? 900) * tau * tau - p.size / 2;
      T(p.el, { x, y, r: p.rot * tau, op: 1 - tau / p.life, s: 1 - 0.5 * (tau / p.life) });
    }
  }
}

/* ---------------------------------------------------------------- layers */
const stage = document.getElementById('stage');
const world1 = $('div', { cls: 'layer' }, stage); // dark world: question + chaos
const qL = $('div', { cls: 'layer' }, world1);
const bgWordsL = $('div', { cls: 'layer' }, world1);
const chaosL = $('div', { cls: 'layer' }, world1);
const glitchL = $('div', { cls: 'layer' }, stage);
const flashL = $('div', { cls: 'fx', style: { background: '#fff', opacity: 0 } }, stage);
const enoughL = $('div', { cls: 'layer' }, stage);
const stone = $('div', { cls: 'layer', style: { background: C.lPage, display: 'none' } }, stage);
const world2 = $('div', { cls: 'layer' }, stone);
const gridL = $('div', { cls: 'layer' }, world2);
const debateL = $('div', { cls: 'layer', style: { perspective: '1800px' } }, world2);
const dimL = $('div', { cls: 'layer' }, world2);
const wordL = $('div', { cls: 'layer' }, world2);
const protoTrack = $('div', { cls: 'layer' }, world2);
const privTrack = $('div', { cls: 'layer' }, world2);
const finL = $('div', { cls: 'layer' }, world2);
const endL = $('div', { cls: 'layer' }, world2);
const logoL = $('div', { cls: 'layer' }, world2);
const brandL = $('div', { cls: 'layer' }, stone);
const fxL = $('div', { cls: 'layer' }, stone);
const capL = $('div', { cls: 'cap' }, stage);
const grain = $('div', { cls: 'fx' }, stage);
const vignette = $('div', { cls: 'fx' }, stage);
const fadeL = $('div', { cls: 'fx', style: { background: C.lPage, opacity: 0 } }, stage);

// film grain: one noise tile, offset every frame
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); const img = g.createImageData(256, 256); const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  Object.assign(grain.style, { backgroundImage: `url(${cv.toDataURL()})`, mixBlendMode: 'overlay' });
}

/* ================================================================ ACT I — the question */
const qMark = $('div', { cls: 'abs serif', text: '?', style: { fontSize: '1150px', lineHeight: '1', color: C.dInk, left: '1080px', top: '-120px' } }, qL);
const qGroup = $('div', { cls: 'layer' }, qL);
const qLabel = $('div', { cls: 'abs mono caps', text: 'Quaestio', style: { left: '410px', top: '350px', fontSize: '18px', color: C.dMuted } }, qGroup);
const chip = $('div', { cls: 'abs mono', style: { left: '1290px', top: '340px', width: '220px', height: '38px', overflow: 'hidden', border: `1px solid ${C.dHair2}`, color: C.dInk } }, qGroup);
const chipStrip = $('div', { cls: 'abs', style: { left: 0, top: 0, width: '220px' } }, chip);
['', 'CAREER', 'STRATEGY', 'CODE'].forEach((s) => $('div', { text: s, style: { height: '38px', lineHeight: '38px', textAlign: 'center', fontSize: '16px', letterSpacing: '0.3em' } }, chipStrip));
const barLine = $('div', { cls: 'abs', style: { left: '410px', top: '469px', width: '1100px', height: '2px', background: C.dInk } }, qGroup);
const bar = $('div', { cls: 'abs', style: { left: '410px', top: '405px', width: '1100px', height: '130px', background: C.dSurface, border: `1.5px solid ${C.dHair2}`, borderRadius: '2px', overflow: 'hidden' } }, qGroup);
const barText = $('div', { cls: 'abs serif', style: { left: '44px', top: 0, height: '127px', display: 'flex', alignItems: 'center', fontSize: '50px', color: C.dInk, whiteSpace: 'nowrap' } }, bar);
const qTxt = $('span', {}, barText);
const caret = $('span', { style: { display: 'inline-block', width: '3px', height: '58px', background: C.dInk, marginLeft: '6px' } }, barText);
const enterKey = $('div', { cls: 'abs mono', text: '↵', style: { right: '30px', left: 'auto', top: '36px', width: '56px', height: '56px', lineHeight: '52px', textAlign: 'center', fontSize: '30px', border: `1.5px solid ${C.dHair2}`, color: C.dMuted } }, bar);

function typedAt(t) {
  let cur = '', typing = false;
  for (const seg of TL.typing) {
    const start = seg.eraseAt ?? seg.t0;
    if (t < start) break;
    if (seg.eraseAt != null && t < seg.t0) { return { text: cur.slice(0, Math.round(cur.length * (1 - map(t, seg.eraseAt, seg.t0)))), typing: true }; }
    const n = Math.min(seg.text.length, Math.floor((t - seg.t0) * seg.cps) + 1);
    cur = seg.text.slice(0, n);
    typing = n < seg.text.length;
  }
  return { text: cur, typing };
}

function updateQuestion(t) {
  const on = t < 7.9;
  show(qL, on);
  if (!on) return;
  // giant question mark, drifting
  T(qMark, { x: -40 * map(t, 0, 8), y: 20 * Math.sin(t * 0.6), r: -6 + t * 1.4, op: 0.045 * map(t, 0, 1.2) * (1 - map(t, 7.25, 7.8)) });
  // bar draws from a line
  const lp = outExpo(map(t, 0.05, 0.5));
  T(barLine, { sx: lp, op: 1 - map(t, 0.55, 0.75) });
  const h = 2 + 128 * outExpo(map(t, 0.38, 0.85));
  bar.style.height = `${h}px`; bar.style.top = `${470 - h / 2}px`;
  show(bar, t >= 0.38);
  T(qLabel, { y: 12 * (1 - outExpo(map(t, 0.45, 1.0))), op: map(t, 0.45, 0.9) * (1 - map(t, S('so'), S('so') + 0.25)) });
  // "matters": glow + pulse
  const g = decay(t - S('matters'), 2.2) * (t >= S('matters') ? 1 : 0);
  bar.style.borderColor = mix(C.dHair2, C.dInk, Math.max(g, 0.25 * map(t, 1.8, 2.2)));
  bar.style.boxShadow = `0 0 ${(80 * g).toFixed(1)}px ${rgba(C.dInk, 0.16 * g)}`;
  // category chip rolls
  let idx = 0, rollStart = 0;
  [['a2', 1], ['a3', 2], ['code', 3]].forEach(([k, i]) => { if (t >= S(k) - 0.08) { idx = i; rollStart = S(k) - 0.08; } });
  const prev = Math.max(0, idx - 1);
  const rp = outExpo(map(t, rollStart, rollStart + 0.35));
  T(chipStrip, { y: -38 * lerp(prev, idx, idx === 0 ? 1 : rp) });
  T(chip, { op: map(t, S('a2') - 0.1, S('a2') + 0.1) * (1 - map(t, S('so'), S('so') + 0.25)), s: 1 + 0.08 * wobble(t - rollStart, 9, 20) });
  // typing
  const ty = typedAt(t);
  qTxt.textContent = ty.text;
  const blink = ty.typing || (t * 1.8) % 1 < 0.55;
  caret.style.opacity = t > S('so') ? 0 : blink ? 1 : 0;
  // enter key hint & press
  T(enterKey, { op: map(t, 6.3, 6.6), s: t >= S('so') ? 1 - 0.18 * wobble(t - S('so'), 10, 22) * 3 : 1 });
  enterKey.style.background = t >= S('so') && t < S('so') + 0.15 ? C.dInk : 'transparent';
  enterKey.style.color = t >= S('so') && t < S('so') + 0.15 ? C.dPage : C.dMuted;
  // send: text flies up, bar dissolves into windows
  const sp = map(t, S('so') + 0.05, S('so') + 0.3);
  T(barText, { y: -90 * inCubic(sp), op: 1 - sp });
  const bp = map(t, S('so') + 0.12, S('so') + 0.3);
  T(bar, { sx: 1 - 0.55 * outExpo(bp), sy: 1 + 1.2 * outExpo(bp), op: 1 - bp });
  const gs = 1 + 0.025 * wobble(t - S('matters'), 5, 16);
  T(qGroup, { s: gs });
}

/* ================================================================ ACT II — the noise */
function makeWin(parent, logo, name) {
  const el = $('div', { cls: 'win' }, parent);
  const hd = $('div', { cls: 'hd' }, el);
  $('span', { html: ICON[logo], style: { display: 'flex' } }, hd);
  $('span', { cls: 'nm', text: name }, hd);
  $('span', { cls: 'ctl', html: '<i></i><i></i><i></i>' }, hd);
  $('div', { cls: 'q', text: 'Is this migration safe to run in prod?' }, el);
  const dots = $('div', { cls: 'dots', html: '<i></i><i></i><i></i>' }, el);
  const ans = $('div', { cls: 'ans' }, el);
  const ansB = $('b', {}, ans);
  const ansS = $('span', {}, ans);
  const dim = $('div', { cls: 'abs', style: { inset: 0, width: '100%', height: '100%', background: C.dPage, opacity: 0 } }, el);
  return { el, dots, dotEls: [...dots.children], ans, ansB, ansS, dim };
}
const MAIN = [
  { logo: 'openai', name: 'ChatGPT', x: 410, y: 430, r: -2.5, say: 'YES.', sub: 'Ship it. Zero risk.', focus: S('gpt'), slam: S('yes') },
  { logo: 'claude', name: 'Claude', x: 960, y: 410, r: 0.5, say: 'NO.', sub: 'Never in prod. Way too risky.', focus: S('claude'), slam: S('no') },
  { logo: 'gemini', name: 'Gemini', x: 1510, y: 430, r: 2.5, say: 'IT DEPENDS.', sub: 'On scale, context, risk, timing…', focus: S('gemini'), slam: S('depends'), small: true }
];
MAIN.forEach((m, i) => { Object.assign(m, makeWin(chaosL, m.logo, m.name)); m.spawn = S('so') + 0.17 + i * 0.07; m.ansB.textContent = m.say; m.ansS.textContent = m.sub; if (m.small) m.ansB.style.fontSize = '74px'; });
const EX_POS = [[250, 190, -8, 0.74], [1680, 200, 7, 0.72], [300, 820, 6, 0.74], [1640, 830, -6, 0.76], [960, 150, -3, 0.66],
  [600, 700, 10, 0.86], [1320, 690, -9, 0.86], [190, 480, -12, 0.82], [1750, 520, 11, 0.82], [860, 830, 5, 0.84], [1150, 220, -7, 0.8], [960, 560, 3, 0.9]];
const EXTRAS = TL.extras.map((x, i) => {
  const w = makeWin(chaosL, x.logo, x.name);
  w.ansB.textContent = x.say; w.ansB.style.fontSize = '76px'; w.ansS.textContent = '';
  w.el.style.zIndex = i < 5 ? 1 : 20 + i;
  show(w.dots, false);
  const [px, py, r, s] = EX_POS[i];
  return { ...w, ...x, x: px, y: py, r, s };
});
MAIN.forEach((m) => (m.el.style.zIndex = 10));
// big outlined words drifting behind
const BG_WORDS = [['YES', 120, 140, 160], ['NO', 340, 1900, -210], ['MAYBE', 600, -900, 190], ['IT DEPENDS', 860, 2000, -150], ['NEVER', 250, -700, 260], ['ALWAYS', 760, 900, -240]];
BG_WORDS.forEach((b) => (b.el = $('div', { cls: 'abs', text: b[0], style: { fontWeight: 900, fontSize: '260px', lineHeight: '1', color: 'transparent', WebkitTextStroke: `2px ${C.dHair2}`, whiteSpace: 'nowrap', letterSpacing: '-0.02em' } }, bgWordsL)));
// sparks at slams
MAIN.forEach((m, i) => burst(chaosL, { t0: m.slam + 0.08, x: m.x - 60, y: m.y + 50, n: 16, colors: [C.dInk, C.hot, C.dInk], speed: [700, 1500], size: [4, 9], life: 0.55, g: 1200, seed: 30 + i }));
MAIN.forEach((m) => { for (const p of bursts[bursts.length - 1].parts) p.el.style.zIndex = 30; });

// glitch bars (pool)
const GLITCH = Array.from({ length: 5 }, () => $('div', { cls: 'abs', style: { left: 0, width: '1920px', display: 'none' } }, glitchL));

const TAPE0 = 16.1, FREEZE = S('enough');
function chaosTime(t) {
  if (t < TAPE0) return t;
  const p = map(t, TAPE0, FREEZE);
  return TAPE0 + (FREEZE - TAPE0) * (p - (p * p) / 2);
}
function slamImpulses(t) {
  let a = 0;
  for (const m of MAIN) if (t >= m.slam) a += decay(t - m.slam, 7) * (m.small ? 0.7 : 1);
  for (const x of EXTRAS) if (t >= x.t) a += decay(t - x.t, 12) * 0.25;
  return a;
}
const rampAt = (t) => map(t, 13.6, 16.05);

function updateChaos(t) {
  const on = t >= S('so') + 0.1 && t < 18.4;
  show(chaosL, on); show(bgWordsL, on);
  if (!on) { show(glitchL, false); flashL.style.opacity = 0; return; }
  const tc = chaosTime(t);
  const frozen = t >= FREEZE;
  const tapeK = 1 - map(t, TAPE0, FREEZE);

  // focus weights
  const fw = MAIN.map((m, i) => {
    const next = i < 2 ? MAIN[i + 1].focus : 99;
    return outCubic(map(tc, m.focus - 0.05, m.focus + 0.2)) * (1 - outCubic(map(tc, next - 0.05, next + 0.2)));
  });
  const anyF = Math.max(...fw);
  MAIN.forEach((m, i) => {
    const sp = spring(tc - m.spawn, 1.7, 0.55);
    const f = fw[i];
    const jx = 6 * rampAt(tc) * vnoise(tc * 9, i + 3), jy = 6 * rampAt(tc) * vnoise(tc * 9, i + 9);
    const x = lerp(960, m.x + (960 - m.x) * 0.1 * f, sp) + jx;
    const y = lerp(470, m.y - 24 * f, sp) + jy;
    const s = lerp(0.3, 1, sp) * (1 + 0.14 * f - 0.07 * (anyF - f)) * (1 + 0.06 * decay(tc - m.slam, 9) * (tc >= m.slam ? 1 : 0));
    T(m.el, { x: x - 230, y: y - 150, s, r: m.r * sp + 2 * wobble(tc - m.slam, 8, 25), op: map(tc, m.spawn, m.spawn + 0.08) });
    m.dim.style.opacity = (0.5 * (anyF - f)).toFixed(3);
    m.el.style.zIndex = f > 0.5 ? 15 : 10;
    // typing dots until the answer slams
    const typingOn = tc < m.slam;
    show(m.dots, typingOn && tc > m.spawn + 0.25);
    m.dotEls.forEach((d, j) => T(d, { y: -10 * Math.max(0, Math.sin(tc * 9 - j * 0.9)) }));
    const ap = map(tc, m.slam, m.slam + 0.16);
    show(m.ans, tc >= m.slam);
    T(m.ans, { s: 1 + 1.8 * (1 - outExpo(ap)), op: map(tc, m.slam, m.slam + 0.04), blur: 10 * (1 - ap) });
    m.ansS.style.opacity = map(tc, m.slam + 0.15, m.slam + 0.35);
  });
  EXTRAS.forEach((x) => {
    const sp = spring(tc - x.t, 2.2, 0.5);
    show(x.el, tc >= x.t);
    const jx = 8 * rampAt(tc) * vnoise(tc * 8, x.t * 10), jy = 8 * rampAt(tc) * vnoise(tc * 8, x.t * 13);
    T(x.el, { x: x.x - 230 + jx, y: x.y - 150 + jy, s: x.s * lerp(0.4, 1, sp), r: x.r * (2.2 - 1.2 * sp), op: map(tc, x.t, x.t + 0.05) });
    const ap = map(tc, x.t + 0.05, x.t + 0.18);
    T(x.ans, { s: 1 + 1.2 * (1 - outExpo(ap)), op: map(tc, x.t + 0.05, x.t + 0.08) });
  });
  BG_WORDS.forEach((b, i) => {
    const age = tc - 9.0;
    T(b.el, { x: b[2] + b[3] * age * (1 + rampAt(tc) * 0.8), y: b[1] - 130, op: 0.55 * map(tc, 9.0 + i * 0.4, 10.0 + i * 0.4) });
  });

  // camera: slow push in + shake
  const [cx, cy, cs] = cam([[S('so'), 0, 0, 1.0], [S('gpt'), 0, 0, 1.0], [FREEZE, 0, 10, 1.1]], tc);
  const imp = slamImpulses(tc);
  const amp = (22 * imp + 14 * rampAt(tc)) * tapeK * (frozen ? 0 : 1);
  const sx = amp * vnoise(tc * 38, 1), sy = amp * vnoise(tc * 38, 2), sr = amp * 0.05 * vnoise(tc * 30, 3);
  // glitch frame decision
  const fi = Math.floor(t * 60);
  const gChance = frozen ? 0 : clamp(map(tc, 14.4, 16.0) * 0.55 + (EXTRAS.some((x) => tc >= x.t && tc < x.t + 0.05) ? 0.8 : 0));
  const glitchOn = hash(fi * 1.37) < gChance;
  const gx = glitchOn ? (hash(fi * 3.1) - 0.5) * 60 : 0;
  T(world1, { x: cx + sx + gx, y: cy + sy, s: cs, r: sr });
  // chromatic split
  const ca = (8 * imp + 7 * rampAt(tc) + (glitchOn ? 10 : 0)) * (frozen ? 0 : 1);
  let filter = ca > 0.4 ? `drop-shadow(${ca.toFixed(1)}px 0 0 rgba(255,40,70,.55)) drop-shadow(${(-ca).toFixed(1)}px 0 0 rgba(40,210,255,.5))` : '';
  if (frozen) {
    const fp = outExpo(map(t, FREEZE, FREEZE + 0.3));
    filter = `grayscale(${fp}) brightness(${lerp(1, 0.2, fp).toFixed(3)}) blur(${(4.5 * map(t, FREEZE, FREEZE + 1.2)).toFixed(2)}px)`;
  }
  chaosL.style.filter = filter || 'none';
  bgWordsL.style.filter = frozen ? chaosL.style.filter : 'none';
  // glitch bars
  show(glitchL, glitchOn);
  GLITCH.forEach((g, k) => {
    const v = glitchOn && k < 2 + Math.floor(hash(fi + k) * 3);
    show(g, v);
    if (v) {
      g.style.top = `${Math.floor(hash(fi * 7 + k * 13) * 1040)}px`;
      g.style.height = `${4 + Math.floor(hash(fi * 11 + k) * 46)}px`;
      g.style.background = hash(fi + k * 5) < 0.35 ? C.hot : rgba(C.dInk, 0.85);
      g.style.opacity = 0.35 + 0.5 * hash(fi * 2 + k);
      T(g, { x: (hash(fi * 5 + k) - 0.5) * 200 });
    }
  });
  // white flash on the three slams
  let fl = 0;
  for (const m of MAIN) if (t >= m.slam) fl = Math.max(fl, 0.22 * decay(t - m.slam, 18));
  flashL.style.opacity = frozen ? 0 : fl.toFixed(3);
}

/* ================================================================ ACT III — Enough. */
const cutLine = $('div', { cls: 'abs', style: { left: 0, top: '639px', width: '1920px', height: '2px', background: C.dInk, transformOrigin: '0 50%' } }, enoughL);
const enoughWord = $('div', { cls: 'abs serif', style: { left: 0, top: '330px', width: '1920px', textAlign: 'center', fontSize: '250px', fontWeight: 600, lineHeight: '1', color: C.dInk, letterSpacing: '-0.01em' } }, enoughL);
const enoughLetters = [...'Enough.'].map((ch) => $('span', { text: ch, style: { display: 'inline-block' } }, enoughWord));
function updateEnough(t) {
  const on = t >= FREEZE && t < 18.4;
  show(enoughL, on);
  if (!on) return;
  T(cutLine, { sx: outExpo(map(t, FREEZE, FREEZE + 0.22)) });
  enoughLetters.forEach((l, i) => {
    const tau = t - (FREEZE + i * 0.03);
    const p = outExpo(map(tau, 0, 0.3));
    T(l, { y: 40 * (1 - p), s: lerp(1.5, 1, p), op: map(tau, 0, 0.06), blur: 16 * (1 - p) });
  });
  T(enoughWord, { s: 1 + 0.04 * map(t, FREEZE, S('lets')) });
}

/* ================================================================ ACT IV — honest debate */
// stone reveal opens from the cut line
function updateStone(t) {
  const on = t >= S('lets') - 0.02;
  show(stone, on);
  if (!on) return;
  const p = outExpo(map(t, S('lets') - 0.02, S('lets') + 0.6));
  stone.style.clipPath = p >= 1 ? 'none' : `inset(${(640 * (1 - p)).toFixed(1)}px 0 ${(440 * (1 - p)).toFixed(1)}px 0)`;
}

// Roman grid
const GRID = [];
for (let k = 1; k <= 15; k++) GRID.push({ v: true, k, el: $('div', { cls: 'abs', style: { left: `${k * 120}px`, top: 0, width: '1px', height: '1080px', background: C.lInk, transformOrigin: '50% 0' } }, gridL) });
for (let k = 1; k <= 8; k++) GRID.push({ v: false, k, el: $('div', { cls: 'abs', style: { left: 0, top: `${k * 120}px`, width: '1920px', height: '1px', background: C.lInk, transformOrigin: '0 50%' } }, gridL) });
function updateGrid(t) {
  const flash = 1 + 2.5 * decay(t - S('verdict'), 4) * (t >= S('verdict') ? 1 : 0);
  const base = 0.065 * flash * (1 - map(t, 46.4, 47));
  GRID.forEach((g) => {
    const t0 = S('lets') + 0.25 + g.k * (g.v ? 0.025 : 0.035) + (g.v ? 0 : 0.1);
    const p = outExpo(map(t, t0, t0 + 0.7));
    T(g.el, g.v ? { sy: p, op: base } : { sx: p, op: base });
  });
}

const SLOT_X = [450, 790, 1130, 1470];
const CARD_Y = 470;
const MODELS = [
  { logo: 'openai', name: 'ChatGPT', id: 'openai' },
  { logo: 'claude', name: 'Claude', id: 'anthropic' },
  { logo: 'gemini', name: 'Gemini', id: 'google' },
  { logo: 'mistral', name: 'Mistral', id: 'mistralai' }
];
const PERM = [2, 0, 3, 1]; // anonymised + shuffled: card i lands in slot PERM[i]
const ARGS = [
  ['Safe if it runs', 'in a transaction.'],
  ['40M rows: the lock', 'is the real risk.'],
  ['Rehearse it on', 'a replica first.'],
  ['Ship behind a flag,', 'backfill later.']
];
const CARDS = MODELS.map((m, i) => {
  const slot = PERM[i];
  const el = $('div', { cls: 'card' }, debateL);
  const front = $('div', { cls: 'face front' }, el);
  $('span', { html: ICON[m.logo], style: { display: 'flex' } }, front);
  $('div', { cls: 'nm', text: m.name }, front);
  $('div', { cls: 'id', text: m.id + '/…' }, front);
  const back = $('div', { cls: 'face back' }, el);
  $('div', { cls: 'band', style: { background: P[slot] } }, back);
  $('div', { cls: 'letter', text: LETTERS[slot], style: { color: P[slot] } }, back);
  $('div', { cls: 'lab', text: 'CONTENDENS' }, back);
  const arg = $('div', { cls: 'arg' }, back);
  const lines = ARGS[slot].map((s) => $('div', { text: s }, arg));
  return { el, i, slot, lines, r0: [-14, 10, -9, 13][i] };
});
// "equal footing" dimension marks
const DIMS = SLOT_X.map((x) => {
  const g = $('div', { cls: 'abs', style: { left: `${x - 150}px`, top: '236px', width: '300px', height: '24px' } }, dimL);
  const line = $('div', { cls: 'abs', style: { left: 0, top: '11px', width: '300px', height: '1.5px', background: C.lInk } }, g);
  const t1 = $('div', { cls: 'abs', style: { left: 0, top: 0, width: '1.5px', height: '24px', background: C.lInk } }, g);
  const t2 = $('div', { cls: 'abs', style: { left: '298.5px', top: 0, width: '1.5px', height: '24px', background: C.lInk } }, g);
  const lab = $('div', { cls: 'abs mono', text: '1/4', style: { left: '120px', top: '-34px', width: '60px', textAlign: 'center', fontSize: '17px', color: C.lMuted, letterSpacing: '0.1em' } }, g);
  return { g, line, t1, t2, lab };
});
const baseRule = $('div', { cls: 'abs', style: { left: '280px', top: '694px', width: '1360px', height: '1.5px', background: C.lInk } }, dimL);
const dimTitle = $('div', { cls: 'abs mono caps', text: 'Equal footing', style: { left: 0, top: '170px', width: '1920px', textAlign: 'center', fontSize: '16px', color: C.lMuted } }, dimL);

function updateDebate(t) {
  const on = t >= S('lets') + 0.05 && t < S('this') + 0.02;
  show(debateL, on);
  CARDS.forEach((c) => {
    const land = S('lets') + 0.55 + c.i * 0.07;
    const fp = map(t, land - 0.45, land);
    let y = lerp(-320, CARD_Y, inQuad(fp));
    const squash = t >= land ? 0.05 * wobble(t - land, 9, 26) : 0;
    let r = c.r0 * (1 - outCubic(fp));
    // flip (anonymise)
    const ft = S('no2') + 0.02 + c.i * 0.09;
    const ry = 180 * inOutCubic(map(t, ft, ft + 0.45));
    // shuffle into anonymous slots
    const sp = inOutCubic(map(t, S('no2') + 0.55, S('no2') + 1.0));
    const x = lerp(SLOT_X[c.i], SLOT_X[c.slot], sp);
    y += (c.i % 2 ? -70 : 70) * Math.sin(Math.PI * sp);
    // "honestly": all snap to the same baseline with a mechanical tick
    const hk = t >= S('honestly') ? 0.03 * wobble(t - S('honestly'), 10, 30) : 0;
    T(c.el, { x: x - 150, y: y - 200, r, ry, sx: 1 + squash + hk, sy: 1 - squash + hk });
    c.lines.forEach((l, k) => {
      const lp = outCubic(map(t, S('only') + c.slot * 0.1 + k * 0.12, S('only') + c.slot * 0.1 + k * 0.12 + 0.35));
      l.style.clipPath = `inset(0 ${(100 - 100 * lp).toFixed(1)}% 0 0)`;
    });
  });
  // dimension marks
  const don = t >= S('honestly') - 0.05 && t < S('this');
  show(dimL, don);
  if (don) {
    const out = 1 - map(t, S('no2') - 0.1, S('no2') + 0.15);
    DIMS.forEach((d, i) => {
      const p = outExpo(map(t, S('honestly') + i * 0.05, S('honestly') + 0.45 + i * 0.05));
      T(d.line, { sx: p }); T(d.t1, { op: p }); T(d.t2, { op: p });
      T(d.lab, { y: 8 * (1 - p), op: p });
      d.g.style.opacity = out;
    });
    T(baseRule, { sx: outExpo(map(t, S('honestly'), S('honestly') + 0.6)), op: 1 - map(t, S('this') - 0.3, S('this')) });
    T(dimTitle, { op: map(t, S('honestly') + 0.1, S('honestly') + 0.4) * out, y: 0 });
  }
}

/* ================================================================ ACT V — Certamen */
const LOGO_C = [960, 390];
const PETALS = [0, 1, 2, 3].map((j) => {
  const el = $('div', { cls: 'abs', style: { overflow: 'hidden' } }, logoL);
  const letter = $('div', { cls: 'abs serif', text: LETTERS[j], style: { left: '28px', top: '34px', fontSize: '140px', lineHeight: '1', color: P[j] } }, el);
  return { el, letter, j };
});
function setPetal(pt, cx, cy, w, h, rot, radii, bg, border, op = 1) {
  pt.el.style.width = `${w}px`; pt.el.style.height = `${h}px`;
  pt.el.style.borderRadius = radiusCss(radii);
  pt.el.style.background = bg;
  pt.el.style.border = border;
  T(pt.el, { x: cx - w / 2, y: cy - h / 2, r: rot, op });
}
const rot2 = (x, y, deg) => { const a = (deg * Math.PI) / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };

// wordmark carved letter by letter
const wordmark = $('div', { cls: 'abs', style: { left: 0, top: '575px', width: '1920px', textAlign: 'center', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '118px', lineHeight: '1', letterSpacing: '0.14em', color: C.lInk, textShadow: `0 2px 0 ${rgba('#FFFFFF', 0.9)}, 0 -1px 0 ${rgba(C.lInk, 0.35)}` } }, wordL);
const wmLetters = [...'CERTAMEN'].map((ch) => $('span', { text: ch, style: { display: 'inline-block' } }, wordmark));
const dictRule = $('div', { cls: 'abs', style: { left: '580px', top: '735px', width: '760px', height: '1.5px', background: C.lInk } }, wordL);
const dictRow = $('div', { cls: 'abs', style: { left: 0, top: '758px', width: '1920px', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '26px', color: C.lInk } }, wordL);
const dWord = $('span', { cls: 'serif', text: 'cer·ta·men', style: { fontStyle: 'italic', fontSize: '42px' } }, dictRow);
const dLat = $('span', { cls: 'mono', text: 'lat. n.', style: { fontSize: '19px', color: C.lMuted, letterSpacing: '0.12em' } }, dictRow);
const dDash = $('span', { cls: 'serif', text: '—', style: { fontSize: '42px' } }, dictRow);
const dContest = $('span', { cls: 'serif', style: { position: 'relative', fontSize: '42px', padding: '0 14px' } }, dictRow);
const dHl = $('span', { cls: 'abs', style: { left: 0, top: '4px', width: '100%', height: '52px', background: C.lInk, transformOrigin: '0 50%' } }, dContest);
const dContestTxt = $('span', { text: 'contest', style: { position: 'relative' } }, dContest);

function updateWordmark(t) {
  const on = t >= S('certamen') - 0.05 && t < 26.7;
  show(wordL, on);
  if (!on) return;
  const out = inCubic(map(t, 26.05, 26.45));
  T(wordL, { y: -50 * out, op: 1 - out });
  wmLetters.forEach((l, i) => {
    const tau = t - (S('certamen') + i * 0.075);
    const p = outExpo(map(tau, 0, 0.22));
    T(l, { s: lerp(1.35, 1, p), op: map(tau, 0, 0.05), blur: 6 * (1 - p), y: 0 });
  });
  T(dictRule, { sx: outExpo(map(t, S('latin') - 0.15, S('latin') + 0.4)) });
  const fadeUp = (e, t0) => { const p = outCubic(map(t, t0, t0 + 0.3)); T(e, { y: 14 * (1 - p), op: p }); };
  fadeUp(dWord, S('latin') - 0.05); fadeUp(dLat, S('for')); fadeUp(dDash, S('contest') - 0.1); fadeUp(dContest, S('contest'));
  const hp = outExpo(map(t, S('contest'), S('contest') + 0.3));
  T(dHl, { sx: hp });
  dContestTxt.style.color = mix(C.lInk, C.lPage, hp);
}
// chisel dust per letter (positions measured after fonts load)
function initChisel() {
  const box = wordmark.getBoundingClientRect();
  wmLetters.forEach((l, i) => {
    const r = l.getBoundingClientRect();
    burst(wordL, { t0: S('certamen') + i * 0.075 + 0.02, x: r.left + r.width / 2, y: box.top + 100, n: 9, colors: [C.lInk, C.lHair2, C.lMuted], speed: [250, 700], size: [3, 7], life: 0.6, g: 1600, angle: -Math.PI / 2, spread: Math.PI * 0.9, seed: 100 + i });
  });
}

/* ================================================================ ACT VI — protocol */
const COL_L = [220, 600, 980, 1360];
const COL_TOP = 190;
const COL_H = 330;
const STREAM = [
  ['Yes — if it runs inside a', 'transaction. Keep a', 'rollback script ready', 'before you touch prod.'],
  ['No. On 40M rows this', 'ALTER locks writes for', 'minutes. Use an online', 'schema change instead.'],
  ['Unclear. Rehearse it on', 'a replica and measure', 'the lock time first.', 'Decide with numbers.'],
  ['Yes, behind a flag:', 'backfill in batches,', 'then flip the switch.', 'Lowest-risk path.']
];
// [challenger, target, struck line, note]
const CHALLENGES = [
  [2, 0, 0, 'C: measure the lock first.'],
  [3, 1, 2, 'D: batches avoid the lock.'],
  [0, 3, 0, 'A: a flag can’t undo DDL.'],
  [1, 2, 0, 'B: replicas lie about load.']
];
const proto = $('div', { cls: 'layer' }, protoTrack);
const COLS = COL_L.map((left, j) => {
  const el = $('div', { cls: 'col', style: { left: `${left}px`, top: `${COL_TOP}px`, height: `${COL_H}px` } }, proto);
  const hd = $('div', { cls: 'hd' }, el);
  const ic = $('i', { style: { background: P[j], borderRadius: radiusCss(petalRadii(j, 26)) } }, hd);
  $('span', { text: `CONTENDENS ${LETTERS[j]}` }, hd);
  const body = $('div', { cls: 'body' }, el);
  const lines = STREAM[j].map((s) => {
    const ln = $('div', { cls: 'ln' }, body);
    const tx = $('span', {}, ln);
    const cur = $('span', { style: { display: 'inline-block', width: '11px', height: '24px', background: C.lInk, verticalAlign: '-4px', marginLeft: '2px' } }, ln);
    const strike = $('div', { cls: 'strike' }, ln);
    return { s, tx, cur, strike };
  });
  const note = $('div', { cls: 'note' }, el);
  return { el, j, ic, lines, note };
});
const arcSvg = $s('svg', { width: 1920, height: 1080, style: 'position:absolute;left:0;top:0' }, proto);
const ARCS = CHALLENGES.map(([src, dst, line, note], k) => {
  const x1 = COL_L[src] + 170 + (dst > src ? 30 : -30), x2 = COL_L[dst] + 170 + (dst > src ? -30 : 30);
  const depth = 60 + Math.abs(x2 - x1) * 0.12;
  const y = COL_TOP + COL_H + 4;
  const d = `M ${x1} ${y} C ${x1} ${y + depth * 1.3}, ${x2} ${y + depth * 1.3}, ${x2} ${y + 10}`;
  const path = $s('path', { d, fill: 'none', stroke: P[src], 'stroke-width': 3.5, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, arcSvg);
  const head = $s('path', { d: `M ${x2 - 10} ${y + 22} L ${x2} ${y + 6} L ${x2 + 10} ${y + 22}`, fill: 'none', stroke: P[src], 'stroke-width': 3.5 }, arcSvg);
  COLS[dst].note.textContent = '↳ ' + note;
  COLS[dst].note.style.color = P[src];
  COLS[dst].lines[line].strike.style.background = P[src];
  const t0 = S('then') + 0.07 + k * 0.25;
  return { path, head, src, dst, line, t0, land: t0 + 0.45 };
});
// arbiter + verdict
const COL_SMALL_X = [637, 852, 1067, 1282];
const arbiter = $('div', { cls: 'abs', style: { left: '760px', top: '392px', width: '400px', height: '76px', background: C.lInk, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px' } }, proto);
$('span', { cls: 'mono', text: 'ARBITER', style: { color: C.lPage, fontSize: '20px', letterSpacing: '0.45em', fontWeight: 600 } }, arbiter);
$('span', { cls: 'serif', text: 'determinatio', style: { color: C.dMuted, fontSize: '20px', fontStyle: 'italic' } }, arbiter);
const ring = $('div', { cls: 'abs', style: { left: '760px', top: '392px', width: '400px', height: '76px', border: `2px solid ${C.lInk}` } }, proto);
const flowSvg = $s('svg', { width: 1920, height: 1080, style: 'position:absolute;left:0;top:0' }, proto);
const FLOWS = [0, 1, 2, 3].map((j) => {
  const x1 = COL_SMALL_X[j], y1 = 98 + COL_H * 0.5, x2 = 960 + (j - 1.5) * 70, y2 = 392;
  const d = `M ${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}`;
  const path = $s('path', { d, fill: 'none', stroke: P[j], 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, flowSvg);
  const dot = $s('circle', { r: 7, fill: P[j] }, flowSvg);
  return { path, dot };
});
const verdict = $('div', { cls: 'verdict' }, proto);
{
  const vh = $('div', { cls: 'vh' }, verdict);
  $('span', { cls: 'k', text: 'DETERMINATIO' }, vh);
  $('span', { cls: 't', text: 'The verdict' }, vh);
}
const VROWS = [
  { key: 'consensus', label: 'CONSENSUS', text: 'Rehearse on a replica, then migrate online.' },
  { key: 'dissent', label: 'DISSENSUS', text: 'Lock risk: serious for B and C, minor for A and D.' },
  { key: 'and', label: 'TO VERIFY', text: '' }
].map((r, i) => {
  const el = $('div', { cls: 'row', style: { top: `${72 + i * 86}px` } }, verdict);
  const lb = $('div', { cls: 'lb', text: r.label }, el);
  const viz = $('div', { cls: 'viz' }, el);
  const tx = $('div', { cls: 'tx', text: r.text }, el);
  return { ...r, el, lb, viz, tx };
});
// consensus viz: four dots merge into a check
const cDots = P.map((c) => $('div', { cls: 'abs', style: { width: '18px', height: '18px', borderRadius: '50%', background: c, top: '34px' } }, VROWS[0].viz));
const cCheck = $s('svg', { width: 60, height: 60, style: 'position:absolute;left:55px;top:13px' }, VROWS[0].viz);
const cCheckP = $s('path', { d: 'M 10 32 L 25 46 L 52 14', fill: 'none', stroke: C.lInk, 'stroke-width': 5, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, cCheck);
// dissent viz: dots split in two camps
const dDots = P.map((c) => $('div', { cls: 'abs', style: { width: '18px', height: '18px', borderRadius: '50%', background: c, top: '34px' } }, VROWS[1].viz));
const dNe = $('div', { cls: 'abs serif', text: '≠', style: { left: '72px', top: '18px', fontSize: '40px', color: C.lInk } }, VROWS[1].viz);
// verify viz: magnifier
const mag = $s('svg', { width: 70, height: 70, style: 'position:absolute;left:50px;top:8px' }, VROWS[2].viz);
const magC = $s('circle', { cx: 28, cy: 28, r: 18, fill: 'none', stroke: C.lInk, 'stroke-width': 4.5, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, mag);
const magH = $s('path', { d: 'M 41 41 L 58 58', fill: 'none', stroke: C.lInk, 'stroke-width': 5, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, mag);
const VITEMS = ['Lock time on a replica', 'Rollback script tested'].map((s, i) => {
  const it = $('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '12px', marginRight: '40px' } }, VROWS[2].tx);
  const box = $('span', { style: { display: 'inline-block', width: '22px', height: '22px', border: `2.5px solid ${C.lInk}` } }, it);
  $('span', { text: s }, it);
  return { it, box };
});

const pathDraw = (p, v) => p.setAttribute('stroke-dashoffset', (1 - clamp(v)).toFixed(4));

function updateProtocol(t) {
  const on = t >= S('every') - 0.2 && t < S('no3') + 0.1;
  show(protoTrack, on);
  if (!on) return;
  // columns: open, stream, then shrink toward the arbiter
  const shrink = inOutCubic(map(t, S('an') - 0.2, S('an') + 0.35));
  COLS.forEach((c) => {
    const j = c.j;
    const op = outExpo(map(t, S('every') - 0.1 + j * 0.06, S('every') + 0.4 + j * 0.06));
    c.el.style.clipPath = `inset(0 0 ${(100 - 100 * op).toFixed(2)}% 0)`;
    const cx = lerp(COL_L[j] + 170, COL_SMALL_X[j], shrink);
    const top = lerp(COL_TOP, 98, shrink);
    T(c.el, { x: cx - (COL_L[j] + 170), y: top - COL_TOP, s: lerp(1, 0.5, shrink) });
    // stream text like SSE tokens
    const st = S('every') + 0.2 + j * 0.12;
    let n = Math.max(0, Math.floor((t - st) * 70));
    let curSet = false;
    c.lines.forEach((l, k) => {
      const take = Math.min(l.s.length, n);
      l.tx.textContent = l.s.slice(0, take);
      n -= take;
      const isCur = !curSet && (take < l.s.length || k === c.lines.length - 1) && t >= st;
      l.cur.style.display = isCur && t < st + 1.6 && (take < l.s.length || (t * 3) % 1 < 0.5) ? 'inline-block' : 'none';
      if (isCur) curSet = true;
    });
  });
  // challenge arcs
  const arcOut = 1 - map(t, S('an') - 0.3, S('an') - 0.05);
  ARCS.forEach((a) => {
    pathDraw(a.path, outCubic(map(t, a.t0, a.land)));
    a.path.style.opacity = arcOut; a.head.style.opacity = map(t, a.land - 0.05, a.land) * arcOut;
    const tgt = COLS[a.dst];
    T(tgt.lines[a.line].strike, { sx: outExpo(map(t, a.land, a.land + 0.25)) });
    const np = outCubic(map(t, a.land + 0.05, a.land + 0.35));
    T(tgt.note, { y: 10 * (1 - np), op: np });
    if (t >= a.land) T(tgt.el, { x: lerp(COL_L[a.dst] + 170, COL_SMALL_X[a.dst], shrink) - (COL_L[a.dst] + 170), y: lerp(COL_TOP, 98, shrink) - COL_TOP + 6 * wobble(t - a.land, 9, 30), s: lerp(1, 0.5, shrink) });
  });
  // arbiter
  const ap = outExpo(map(t, S('an'), S('an') + 0.35));
  const pr = t >= S('rules') ? 0.1 * punch(t - S('rules'), 8, 14) : 0;
  T(arbiter, { sy: ap * (1 + pr), sx: 1 + pr, op: ap });
  const rp = map(t, S('rules'), S('rules') + 0.55);
  T(ring, { s: 1 + 0.6 * outCubic(rp), op: (t >= S('rules') ? 1 : 0) * (1 - rp) });
  FLOWS.forEach((f, j) => {
    const t0 = S('arbiter') + j * 0.05;
    pathDraw(f.path, outCubic(map(t, t0, t0 + 0.4)));
    const u = map(t, t0 + 0.1, t0 + 0.55);
    const show_ = u > 0 && u < 1;
    f.dot.style.opacity = show_ ? 1 : 0;
    if (show_) { const L = f.path.getTotalLength(); const pt = f.path.getPointAtLength(L * inOutCubic(u)); f.dot.setAttribute('cx', pt.x); f.dot.setAttribute('cy', pt.y); }
  });
  // verdict card
  const vp = outExpo(map(t, S('rules') + 0.2, S('rules') + 0.7));
  verdict.style.clipPath = `inset(0 0 ${(100 - 100 * vp).toFixed(2)}% 0)`;
  T(verdict, { y: -20 * (1 - vp) });
  const rowWin = [[S('consensus'), S('dissent')], [S('dissent'), S('and')], [S('and'), S('no3') - 0.4]];
  VROWS.forEach((r, i) => {
    const [a, b] = rowWin[i];
    const act = map(t, a - 0.04, a + 0.1) * (1 - map(t, b - 0.04, b + 0.1));
    r.lb.style.background = rgba(C.lInk, act);
    r.lb.style.color = mix(C.lMuted, C.lPage, act);
    const tp = outCubic(map(t, a + 0.05, a + 0.5));
    r.tx.style.clipPath = `inset(0 ${(100 - 100 * tp).toFixed(1)}% 0 0)`;
    r.viz.style.opacity = map(t, a - 0.05, a + 0.05);
  });
  // consensus: converge
  const cp = inOutCubic(map(t, S('consensus') + 0.05, S('consensus') + 0.45));
  cDots.forEach((d, j) => { T(d, { x: 76 + lerp((j - 1.5) * 36, 0, cp), op: 1 - map(t, S('consensus') + 0.42, S('consensus') + 0.55) }); });
  pathDraw(cCheckP, outCubic(map(t, S('consensus') + 0.45, S('consensus') + 0.75)));
  // dissent: split into camps (A,D) vs (B,C)
  const dp = outBack(map(t, S('dissent') + 0.05, S('dissent') + 0.45), 1.4);
  const camp = [-1, 1, 1, -1], inner = [1, 0, 1, 0];
  dDots.forEach((d, j) => T(d, { x: 76 + camp[j] * dp * (32 + 22 * (1 - inner[j])) }));
  dNe.style.opacity = map(t, S('dissent') + 0.25, S('dissent') + 0.45);
  // verify: magnifier + boxes
  pathDraw(magC, outCubic(map(t, S('and'), S('and') + 0.35)));
  pathDraw(magH, outCubic(map(t, S('and') + 0.25, S('and') + 0.45)));
  VITEMS.forEach((v, i) => { const p = outBack(map(t, S('what') + i * 0.18, S('what') + i * 0.18 + 0.3)); T(v.box, { s: p }); });
  T(mag, { x: 4 * Math.sin(Math.max(0, t - S('verify')) * 10) * decay(t - S('verify'), 2) });
}

/* ================================================================ ACT VII — privacy & open source */
const priv = $('div', { cls: 'layer' }, privTrack);
const ink = C.lInk;
function iconBox(w, h) { return $('div', { cls: 'abs', style: { left: `${960 - w / 2}px`, top: `${440 - h / 2}px`, width: `${w}px`, height: `${h}px` } }, priv); }
function serverSvg(parent) {
  const s = $s('svg', { width: 300, height: 270, viewBox: '0 0 300 270' }, parent);
  for (let i = 0; i < 3; i++) {
    const y = 10 + i * 88;
    $s('rect', { x: 10, y, width: 280, height: 72, fill: C.lRaised, stroke: ink, 'stroke-width': 6 }, s);
    $s('circle', { cx: 50, cy: y + 36, r: 9, fill: ink }, s);
    $s('circle', { cx: 82, cy: y + 36, r: 9, fill: 'none', stroke: ink, 'stroke-width': 4 }, s);
    for (let k = 0; k < 4; k++) $s('line', { x1: 160 + k * 28, y1: y + 22, x2: 160 + k * 28, y2: y + 50, stroke: ink, 'stroke-width': 5 }, s);
  }
  return s;
}
function loginSvg(parent) {
  const s = $s('svg', { width: 300, height: 270, viewBox: '0 0 300 270' }, parent);
  $s('rect', { x: 40, y: 5, width: 220, height: 260, fill: C.lRaised, stroke: ink, 'stroke-width': 6 }, s);
  $s('circle', { cx: 150, cy: 60, r: 26, fill: 'none', stroke: ink, 'stroke-width': 6 }, s);
  $s('rect', { x: 75, y: 112, width: 150, height: 26, fill: 'none', stroke: ink, 'stroke-width': 4 }, s);
  $s('rect', { x: 75, y: 150, width: 150, height: 26, fill: 'none', stroke: ink, 'stroke-width': 4 }, s);
  $s('rect', { x: 75, y: 196, width: 150, height: 40, fill: ink }, s);
  const tx = $s('text', { x: 150, y: 223, 'text-anchor': 'middle', fill: C.lPage, 'font-family': 'JetBrains Mono', 'font-size': 18, 'letter-spacing': 4 }, s);
  tx.textContent = 'SIGN UP';
  return s;
}
// an icon that gets slashed in two halves
const TAN = Math.tan((32 * Math.PI) / 180);
function slashable(build, key) {
  const w = 300, h = 270;
  const yl = h / 2 + (w / 2) * TAN, yr = h / 2 - (w / 2) * TAN;
  const halves = [`polygon(0 0, ${w}px 0, ${w}px ${yr}px, 0 ${yl}px)`, `polygon(0 ${yl}px, ${w}px ${yr}px, ${w}px ${h}px, 0 ${h}px)`].map((cp) => {
    const b = iconBox(w, h); b.style.clipPath = cp; build(b); return b;
  });
  const slash = $('div', { cls: 'abs', style: { left: `${960 - 280}px`, top: '438px', width: '560px', height: '5px', background: ink, transformOrigin: '0 50%' } }, priv);
  const cutT = S(key) + 0.02;
  burst(priv, { t0: cutT + 0.18, x: 960, y: 440, n: 18, colors: [ink, C.lHair2, C.lMuted], speed: [200, 600], size: [4, 9], life: 0.8, g: 1500, seed: key.length * 7 });
  return { halves, slash, cutT };
}
const SERVER = slashable(serverSvg, 'backend');
const LOGIN = slashable(loginSvg, 'account');
function updateSlashable(o, t, tIn, tOut) {
  const on = t >= tIn && t < tOut;
  o.halves.forEach((h) => show(h, on)); show(o.slash, on);
  if (!on) return;
  const ip = spring(t - tIn, 2.2, 0.55);
  const sp = outExpo(map(t, o.cutT, o.cutT + 0.14));
  T(o.slash, { y: 0, r: -32, sx: sp, op: (t >= o.cutT ? 1 : 0) * (1 - map(t, o.cutT + 0.3, o.cutT + 0.5)), x: 0 });
  o.slash.style.transform = `translate(280px,0) rotate(-32deg) translate(-280px,0) scale(${sp},1)`;
  const tau = t - (o.cutT + 0.12);
  o.halves.forEach((h, k) => {
    const sgn = k === 0 ? -1 : 1;
    const sep = tau > 0 ? 34 * outCubic(Math.min(tau / 0.2, 1)) : 0;
    const fall = tau > 0.12 ? 1100 * (tau - 0.12) ** 2 : 0;
    T(h, { x: sgn * sep * Math.sin((32 * Math.PI) / 180), y: sgn * sep * Math.cos((32 * Math.PI) / 180) + fall, r: tau > 0 ? sgn * 14 * tau : 0, s: lerp(0.5, 1, ip), op: (tIn < o.cutT - 0.4 ? 1 : map(t, tIn, tIn + 0.06)) * (1 - map(tau, 0.35, 0.6)) });
  });
}
// browser frame + key
const browser = $s('svg', { width: 920, height: 520, viewBox: '0 0 920 520', style: `position:absolute;left:${960 - 460}px;top:${440 - 260}px` }, priv);
const bFrame = $s('rect', { x: 3, y: 3, width: 914, height: 514, fill: C.lRaised, stroke: ink, 'stroke-width': 4, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, browser);
const bBar = $s('line', { x1: 3, y1: 62, x2: 917, y2: 62, stroke: ink, 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, browser);
const bDots = [0, 1, 2].map((i) => $s('circle', { cx: 36 + i * 30, cy: 32, r: 8, fill: 'none', stroke: ink, 'stroke-width': 3 }, browser));
const bUrl = $s('rect', { x: 150, y: 15, width: 620, height: 34, fill: C.lSurface, stroke: C.lHair2, 'stroke-width': 2 }, browser);
const bUrlT = $s('text', { x: 170, y: 39, fill: ink, 'font-family': 'JetBrains Mono', 'font-size': 20 }, browser);
const keyG = $('div', { cls: 'abs', style: { left: `${960 - 150}px`, top: `${470 - 60}px`, width: '300px', height: '120px' } }, priv);
{
  const s = $s('svg', { width: 300, height: 120, viewBox: '0 0 300 120' }, keyG);
  $s('circle', { cx: 60, cy: 60, r: 42, fill: 'none', stroke: ink, 'stroke-width': 12 }, s);
  $s('circle', { cx: 60, cy: 60, r: 12, fill: ink }, s);
  $s('path', { d: 'M 102 60 L 280 60 M 230 60 L 230 96 M 262 60 L 262 88', fill: 'none', stroke: ink, 'stroke-width': 12, 'stroke-linecap': 'square' }, s);
}
const keyNote = $('div', { cls: 'abs mono', style: { left: `${960 - 400}px`, top: '585px', width: '800px', textAlign: 'center', fontSize: '20px', color: C.lMuted, letterSpacing: '0.04em' } }, priv);
keyNote.innerHTML = '<span style="color:#1B1A17">■</span>&nbsp; key stored in your browser (IndexedDB) · sent only to openrouter.ai';
const CODE = [['// certamen', true], ['license   = "MIT"'], ['backend   = null'], ['accounts  = null'], ['telemetry = none']];
const codeBox = $('div', { cls: 'abs mono', style: { left: `${960 - 460 + 70}px`, top: '285px', fontSize: '36px', lineHeight: '56px', color: ink } }, priv);
const codeLines = CODE.map(([s, c]) => $('div', { style: { whiteSpace: 'pre', color: c ? C.lMuted : ink } }, codeBox));
const stamp = $('div', { cls: 'abs mono', text: 'OPEN SOURCE · MIT', style: { left: '1110px', top: '300px', padding: '12px 22px', border: `4px solid ${ink}`, fontSize: '28px', fontWeight: 600, letterSpacing: '0.18em', color: ink, background: C.lRaised } }, priv);

function updatePrivacy(t) {
  // whip pan from protocol to privacy
  const wp = inOutExpo(map(t, S('no3') - 0.6, S('no3') - 0.05));
  const blur = 14 * Math.sin(Math.PI * wp);
  protoTrack.style.transform = `translateX(${(-1920 * wp).toFixed(1)}px)`;
  privTrack.style.transform = `translateX(${(1920 * (1 - wp)).toFixed(1)}px)`;
  protoTrack.style.filter = privTrack.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
  const on = t >= S('no3') - 0.6 && t < S('let') + 0.5;
  show(privTrack, on);
  if (!on) return;
  updateSlashable(SERVER, t, S('no3') - 0.6, S('no4') - 0.2);
  updateSlashable(LOGIN, t, S('no4') - 0.2, S('your') - 0.05);
  // browser draws itself, then exits after open source
  const bon = t >= S('your') - 0.05;
  browser.style.display = bon ? '' : 'none';
  const exit = inCubic(map(t, S('let') - 0.15, S('let') + 0.25));
  const close = t >= S('key') ? 0.035 * punch(t - S('key'), 7, 14) : 0;
  browser.style.transform = `translateY(${(60 * exit).toFixed(1)}px) scale(${(1 - 0.15 * exit - close).toFixed(4)})`;
  browser.style.opacity = 1 - exit;
  pathDraw(bFrame, outCubic(map(t, S('your') - 0.05, S('your') + 0.55)));
  bFrame.setAttribute('stroke-width', t >= S('key') ? 6 : 4);
  pathDraw(bBar, outCubic(map(t, S('your') + 0.25, S('your') + 0.6)));
  bDots.forEach((d, i) => { d.style.opacity = map(t, S('your') + 0.3 + i * 0.06, S('your') + 0.4 + i * 0.06); });
  bUrl.style.opacity = map(t, S('browser'), S('browser') + 0.15);
  const url = 'vkandil.github.io/Certamen';
  bUrlT.textContent = url.slice(0, Math.max(0, Math.floor((t - S('browser') - 0.05) * 50)));
  // key drops in
  const kt = t - (S('your2') - 0.05);
  const kOut = map(t, S('open') - 0.1, S('open') + 0.15);
  show(keyG, kt > 0 && kOut < 1);
  T(keyG, { y: -560 * (1 - spring(kt, 2.1, 0.45)) - 40 * kOut, r: -25 * (1 - spring(kt, 1.6, 0.4)), op: (1 - kOut) * (1 - exit) });
  const np = outCubic(map(t, S('key') + 0.05, S('key') + 0.35));
  T(keyNote, { y: 12 * (1 - np), op: np * (1 - kOut) * (1 - exit) });
  // open source: code types in, stamp lands
  codeLines.forEach((l, i) => {
    const s = CODE[i][0];
    const t0 = S('open') - 0.02 + i * 0.13;
    l.textContent = s.slice(0, Math.max(0, Math.floor((t - t0) * 70)));
  });
  T(codeBox, { op: 1 - exit, y: 60 * exit });
  const st = S('source') + 0.02;
  const sp = outExpo(map(t, st - 0.1, st));
  T(stamp, { s: lerp(1.9, 1, sp) * (1 - 0.15 * exit), r: -7, op: map(t, st - 0.1, st - 0.05) * (1 - exit), y: 60 * exit });
}

/* ================================================================ ACT VIII — finale + end card */
const FIN_C = [960, 400];
const FIN_SIZE = 150;
const FIN = [0, 1, 2, 3].map((j) => {
  const el = $('div', { cls: 'abs', style: { width: `${FIN_SIZE}px`, height: `${FIN_SIZE}px`, background: P[j], borderRadius: radiusCss(petalRadii(j, FIN_SIZE)) } }, finL);
  const [px, py] = PETAL_POS[j];
  return { el, j, px, py, from: [960 + px * 1500, 400 + py * 900], loose: [px * 250, py * 150], rot0: [20, 15, -25, -20][j] };
});
const rings = [0, 1].map(() => $('div', { cls: 'abs', style: { width: '330px', height: '330px', left: `${960 - 165}px`, top: `${400 - 165}px`, border: `2px solid ${C.lInk}` } }, finL));
const CLASH1 = S('models') + 0.05, CLASH2 = S('argue');
burst(finL, { t0: CLASH1, x: 960, y: 250, n: 16, colors: [P[0], P[2], C.lInk], speed: [500, 1200], size: [5, 10], life: 0.6, g: 900, seed: 71 });
burst(finL, { t0: CLASH2, x: 960, y: 400, n: 26, colors: P, speed: [600, 1500], size: [5, 12], life: 0.7, g: 700, seed: 72 });
burst(finL, { t0: S('verdict'), x: 960, y: 400, n: 32, colors: [...P, C.lInk], speed: [700, 1700], size: [5, 12], life: 0.9, g: 500, seed: 73 });
const bump = (tau) => (tau < 0 ? 0 : tau < 0.16 ? outCubic(tau / 0.16) : Math.exp(-(tau - 0.16) * 6) * Math.cos((tau - 0.16) * 14));

// end card
const endWord = $('div', { cls: 'abs serif', text: 'Certamen', style: { left: '820px', top: '318px', fontSize: '150px', lineHeight: '1', color: C.lInk } }, endL);
const endTag = $('div', { cls: 'abs', text: 'Let the models argue. Get the verdict.', style: { left: '828px', top: '500px', fontSize: '32px', fontWeight: 500, color: C.lMuted } }, endL);
const endRule = $('div', { cls: 'abs', style: { left: '500px', top: '610px', width: '920px', height: '1.5px', background: C.lInk } }, endL);
const endLinks = $('div', { cls: 'abs mono', style: { left: 0, top: '644px', width: '1920px', textAlign: 'center', fontSize: '27px', color: C.lInk } }, endL);
endLinks.innerHTML = 'vkandil.github.io/Certamen<span style="color:#B9AC93">&nbsp;&nbsp;·&nbsp;&nbsp;</span>github.com/Vkandil/Certamen';
const badgeRow = $('div', { cls: 'abs', style: { left: 0, top: '722px', width: '1920px', display: 'flex', justifyContent: 'center', gap: '18px' } }, endL);
const BADGES = ['OPEN SOURCE · MIT', 'LOCAL-FIRST', 'NO BACKEND', 'NO TELEMETRY'].map((s) => $('span', { cls: 'mono', text: s, style: { padding: '9px 16px', border: `1.5px solid ${C.lHair2}`, fontSize: '16px', letterSpacing: '0.22em', color: C.lMuted } }, badgeRow));
const disclaimer = $('div', { cls: 'abs', text: 'All trademarks belong to their owners. Certamen is not affiliated with or endorsed by them.', style: { left: 0, top: '1024px', width: '1920px', textAlign: 'center', fontSize: '16px', color: C.lMuted } }, endL);

function updateFinale(t) {
  const on = t >= S('let') - 0.1;
  show(finL, on); show(endL, t >= 43.6);
  if (!on) return;
  const asm = outExpo(map(t, S('get') - 0.02, S('verdict') + 0.02));
  const endP = inOutCubic(map(t, 43.45, 44.2));
  const gc = [lerp(960, 655, endP), lerp(400, 452, endP)];
  const gs = lerp(1, 0.72, endP) * (1 + (t >= S('verdict') ? 0.12 * punch(t - S('verdict'), 7, 12) : 0));
  FIN.forEach((f) => {
    const enter = spring(t - (S('let') - 0.08), 1.25, 0.62);
    // loose "arguing" position with idle wobble and two clashes
    let [lx, ly] = f.loose;
    lx += 10 * vnoise(t * 2.2, f.j + 1); ly += 10 * vnoise(t * 2.2, f.j + 5);
    const c1 = f.j === 0 || f.j === 2 ? bump(t - (CLASH1 - 0.16)) : 0;
    lx += c1 * (f.j === 0 ? -1 : 1) * 160;
    const c2 = bump(t - (CLASH2 - 0.16));
    lx -= c2 * f.px * 140; ly -= c2 * f.py * 80;
    const ex = lerp(f.from[0] - 960, lx, enter), ey = lerp(f.from[1] - 400, ly, enter);
    const off = FIN_SIZE / 2 + 6;
    const ax = lerp(ex, f.px * off, asm), ay = lerp(ey, f.py * off, asm);
    const rot = lerp(f.rot0 * (1 + 2 * (1 - enter)) + 6 * vnoise(t * 3, f.j + 9) + 18 * c2 * (f.j % 2 ? 1 : -1), 0, asm);
    T(f.el, { x: gc[0] + ax * gs - FIN_SIZE / 2, y: gc[1] + ay * gs - FIN_SIZE / 2, r: rot, s: gs });
  });
  rings.forEach((r, i) => {
    const p = map(t, S('verdict') + i * 0.08, S('verdict') + 0.75 + i * 0.08);
    T(r, { s: 1 + (1.3 - i * 0.4) * outCubic(p), op: (t >= S('verdict') ? 0.9 : 0) * (1 - p) });
  });
  // end card
  if (t >= 43.6) {
    const wp = outExpo(map(t, 44.0, 44.6));
    endWord.style.clipPath = `inset(0 ${(100 - 100 * wp).toFixed(1)}% 0 0)`;
    T(endWord, { x: -24 * (1 - wp) });
    const fu = (e, t0) => { const p = outCubic(map(t, t0, t0 + 0.4)); T(e, { y: 16 * (1 - p), op: p }); };
    fu(endTag, 44.25);
    T(endRule, { sx: outExpo(map(t, 44.3, 44.9)) });
    fu(endLinks, 44.5);
    BADGES.forEach((b, i) => fu(b, 44.75 + i * 0.09));
    fu(disclaimer, 45.0);
  }
}

// small brand mark top-left (like the app header) during the protocol + privacy acts
const brand = $('div', { cls: 'abs', style: { left: '72px', top: '48px', display: 'flex', alignItems: 'center', gap: '16px' } }, brandL);
const brandLogo = $('div', { style: { position: 'relative', width: '48px', height: '48px' } }, brand);
[0, 1, 2, 3].forEach((j) => { const [px, py] = PETAL_POS[j]; $('div', { cls: 'abs', style: { width: '22px', height: '22px', left: `${px > 0 ? 26 : 0}px`, top: `${py > 0 ? 26 : 0}px`, background: P[j], borderRadius: radiusCss(petalRadii(j, 22)) } }, brandLogo); });
const brandTx = $('div', { html: '<div style="font-family:Gelasio;font-size:28px;color:#1B1A17;line-height:1.1">Certamen</div><div style="font-size:15px;color:#5C574D">multi-model debate</div>' }, brand);
function updateBrand(t) {
  const p = outCubic(map(t, 26.55, 26.95)) * (1 - map(t, S('let') - 0.2, S('let') + 0.1));
  show(brandL, p > 0);
  T(brand, { x: -20 * (1 - p), op: p });
}

/* ---------------------------------------------------------------- petals: cards → logo → columns */
function updateLogo(t) {
  const on = t >= S('this') && t < 26.95;
  show(logoL, on);
  if (!on) return;
  const mp = outExpo(map(t, S('this'), S('this') + 0.8));
  const theta = -90 * (1 - mp);
  const pk = t >= S('is') ? 0.06 * punch(t - S('is'), 7, 13) : 0;
  const breathe = 1 + 0.01 * Math.sin((t - S('is')) * 2.2) * map(t, S('is'), S('is') + 0.5);
  const fly = inOutCubic(map(t, 26.15, 26.85));
  PETALS.forEach((pt) => {
    const j = pt.j;
    const card = CARDS.find((c) => c.slot === j);
    const [px, py] = PETAL_POS[j];
    const size = 170, off = size / 2 + 7;
    const [ox, oy] = rot2(px * off, py * off, theta);
    const s = (1 + pk) * breathe;
    let cx = lerp(SLOT_X[j], LOGO_C[0] + ox * s, mp);
    let cy = lerp(CARD_Y, LOGO_C[1] + oy * s, mp);
    let w = lerp(300, size * s, mp), h = lerp(400, size * s, mp);
    let radii = petalRadii(j, size * s).map((v) => lerp(2, v, mp));
    // then fly to the protocol column headers
    const hx = COL_L[j] + 20 + 13, hy = COL_TOP + 30;
    cx = lerp(cx, hx, fly); cy = lerp(cy, hy, fly);
    w = lerp(w, 26, fly); h = lerp(h, 26, fly);
    radii = radii.map((v, k) => lerp(v, petalRadii(j, 26)[k], fly));
    const bg = mix(C.lRaised, P[j], map(mp, 0, 0.45));
    const border = mp < 0.3 ? `1.5px solid ${mix(C.lHair2, P[j], mp / 0.3)}` : 'none';
    setPetal(pt, cx, cy, w, h, theta * mp * (1 - fly), radii, bg, border, card ? 1 : 1);
    pt.letter.style.opacity = 1 - map(mp, 0, 0.25);
  });
  // column header icons take over once the petals have landed
  COLS.forEach((c) => (c.ic.style.opacity = t >= 26.85 ? 1 : 0));
}

/* ================================================================ captions */
const EM = new Set(['matters', 'ais', 'debate', 'honestly', 'names', 'arguments', 'certamen', 'contest', 'challenges', 'arbiter', 'consensus', 'dissent', 'verify', 'backend', 'account', 'key', 'source', 'argue', 'verdict']);
const SHOUT = new Set(['yes', 'no', 'depends']);
const CHUNKS = [
  ['you', 'matters'], ['a2', 'move'], ['a3', 'strategy'], ['code', 'work'], ['so', 'ais'],
  ['gpt', 'yes', 'chaos'], ['claude', 'no', 'chaos'], ['gemini', 'says3', 'chaos'], ['it', 'depends', 'chaos'],
  ['lets', 'debate'], ['honestly', 'honestly'], ['no2', 'names'], ['only', 'arguments'],
  ['this', 'certamen'], ['latin', 'contest'], ['every', 'answers'], ['then', 'others'], ['an', 'rules'],
  ['consensus', 'dissent'], ['and', 'verify'], ['no3', 'backend'], ['no4', 'account'], ['your', 'key'],
  ['open', 'source'], ['let', 'argue'], ['get', 'verdict']
].map(([a, b, mode]) => ({ ws: words.slice(WD[a].i, WD[b].i + 1), mode }));
CHUNKS.forEach((c, i) => {
  c.in = c.ws[0].s - 0.08;
  const next = CHUNKS[i + 1];
  const lastE = c.ws[c.ws.length - 1].e;
  c.out = Math.min(next ? next.ws[0].s - 0.1 : 99, lastE + (next ? 0.7 : 0.45));
  c.dark = c.in < S('lets') - 0.1;
  c.el = $('div', { cls: 'chunk' }, capL);
  c.row = $('div', { cls: 'row' }, c.el);
  c.hl = $('div', { cls: 'hl' }, c.row);
  c.wEls = c.ws.map((w) => {
    const shout = c.mode === 'chaos' && SHOUT.has(w.k);
    const e = $('span', { cls: 'w' + (shout ? ' shout' : EM.has(w.k) ? ' em' : ''), text: w.t }, c.row);
    return { e, w, shout };
  });
});
function measureCaptions() {
  CHUNKS.forEach((c) => {
    c.el.style.display = '';
    c.pos = c.wEls.map((x) => ({ x: x.e.offsetLeft, w: x.e.offsetWidth }));
    c.el.style.display = 'none';
  });
}
function updateCaptions(t) {
  const hideAll = t >= FREEZE - 0.05 && t < S('lets') - 0.1;
  CHUNKS.forEach((c) => {
    const on = !hideAll && t >= c.in && t < c.out + 0.1;
    show(c.el, on);
    if (!on) return;
    const ink_ = c.dark ? C.dInk : C.lInk, page_ = c.dark ? C.dPage : C.lPage;
    const shadow = c.dark ? '0 3px 22px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.5)' : `0 2px 16px ${rgba(C.lPage, 0.95)}, 0 0 3px ${rgba(C.lPage, 0.9)}`;
    const q = map(t, c.out - 0.12, c.out + 0.08);
    let active = -1;
    c.wEls.forEach((x, i) => {
      const tau = t - (x.w.s - 0.06);
      const p = spring(tau, 3.0, 0.6);
      const jit = c.mode === 'chaos' ? 3 * vnoise(t * 7, i + c.in) : 0;
      T(x.e, { y: 30 * (1 - p) - 16 * q, s: (0.82 + 0.18 * p) * (x.shout && t >= x.w.s ? 1 + 0.25 * decay(t - x.w.s, 6) : 1), r: jit, op: map(tau, 0, 0.08) * (1 - q), blur: 6 * (1 - map(tau, 0, 0.12)) });
      if (t >= x.w.s - 0.02) active = i;
    });
    // sliding highlight block on the spoken word
    c.wEls.forEach((x, i) => { x.e.style.color = i === active ? (x.shout ? '#fff' : page_) : ink_; x.e.style.textShadow = i === active ? 'none' : shadow; });
    if (active >= 0) {
      const cur = c.pos[active], prev = c.pos[Math.max(0, active - 1)];
      const m = active === 0 ? 1 : outExpo(map(t, c.wEls[active].w.s - 0.02, c.wEls[active].w.s + 0.14));
      const x = lerp(prev.x, cur.x, m), w = lerp(prev.w, cur.w, m);
      const shout = c.wEls[active].shout;
      c.hl.style.left = `${x.toFixed(1)}px`; c.hl.style.width = `${w.toFixed(1)}px`;
      c.hl.style.background = shout ? C.hot : ink_;
      const hp = spring(t - c.wEls[0].w.s + 0.02, 3.2, 0.65);
      T(c.hl, { sy: hp, op: 1 - q, r: c.mode === 'chaos' ? 2.5 * vnoise(t * 6, c.in) : 0 });
    } else c.hl.style.opacity = 0;
  });
}

/* ================================================================ frame */
function updateFX(t) {
  const fi = Math.floor(t * 60);
  const light = t >= S('lets') + 0.3;
  grain.style.opacity = light ? 0.05 : 0.08;
  grain.style.backgroundPosition = `${Math.floor(hash(fi) * 256)}px ${Math.floor(hash(fi + 0.5) * 256)}px`;
  vignette.style.background = light ? 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(80,60,20,.16) 100%)' : 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%)';
  fadeL.style.opacity = map(t, 46.55, 47).toFixed(3);
  // second camera (light world)
  const [x, y, s] = cam([[S('lets'), 0, 0, 1.07], [S('lets') + 1.1, 0, 0, 1.0], [S('this') - 0.1, 0, 0, 1.02], [S('this') + 0.7, 0, 0, 1.0], [26.0, 0, 0, 1.03], [26.9, 0, 0, 1.0], [S('an') - 0.3, 0, 0, 1.0], [S('rules') + 0.5, 0, -50, 1.08], [S('no3') - 0.75, 0, -55, 1.09], [S('no3') - 0.2, 0, 0, 1.0], [S('let') - 0.2, 0, 0, 1.03], [S('let') + 0.6, 0, 0, 1.0], [47, 0, 0, 1.025]], t);
  const pk = t >= S('verdict') ? 0.025 * punch(t - S('verdict'), 6, 10) : 0;
  const sh = t >= CLASH2 ? 9 * decay(t - CLASH2, 8) : 0;
  T(world2, { x: x + sh * vnoise(t * 40, 4), y: y + sh * vnoise(t * 40, 6), s: s + pk });
}

window.renderFrame = (t) => {
  updateQuestion(t);
  updateChaos(t);
  updateEnough(t);
  updateStone(t);
  updateGrid(t);
  updateDebate(t);
  updateLogo(t);
  updateWordmark(t);
  updateProtocol(t);
  updatePrivacy(t);
  updateFinale(t);
  updateBrand(t);
  updateBursts(t);
  updateCaptions(t);
  updateFX(t);
};

await document.fonts.ready;
for (const f of ['400 20px Inter', '700 20px Inter', '900 20px Inter', '600 20px Inter', '400 20px Gelasio', 'italic 600 20px Gelasio', 'italic 400 20px Gelasio', '600 20px Gelasio', '700 20px Cinzel', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"']) await document.fonts.load(f);
// measure layout-dependent things with everything visible
show(stone, true); stone.style.clipPath = 'none'; show(wordL, true);
initChisel();
measureCaptions();
window.DURATION = TL.duration;
window.renderFrame(0);
window.__ready = true;
