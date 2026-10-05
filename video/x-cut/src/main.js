// Certamen — X cut (1080×1080). Every visual is a pure function of time t (seconds).
// Rendered frame by frame by ../render.mjs (--page x-cut/src/index.html).

const words = await (await fetch('/x-cut/data/words.json')).json();
const TL = await (await fetch('/x-cut/data/timeline.json')).json();
const ICON = {};
for (const n of ['openai', 'claude', 'gemini', 'mistral', 'meta', 'grok', 'deepseek', 'qwen']) {
  const svg = await (await fetch(`/node_modules/@lobehub/icons-static-svg/icons/${n}.svg`)).text();
  ICON[n] = svg.replace(/<title>.*?<\/title>/, '').replace(/ (width|height)="1em"/g, '').replace(/ style="[^"]*"/, '');
}
const WD = Object.fromEntries(words.map((w, i) => [w.k, { ...w, i }]));
const S = (k) => WD[k].s;
const DUR = TL.duration;

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
  const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
}
const wobble = (t, k = 6, w = 18) => (t <= 0 ? 0 : Math.exp(-t * k) * Math.sin(t * w));
const punch = (t, k = 7, w = 12) => (t < 0 ? 0 : Math.exp(-t * k) * Math.cos(t * w));
const decay = (t, k = 8) => (t < 0 ? 0 : Math.exp(-t * k));
// collision bump: 0 → 1 at tau = 0.16 (impact), then springs back
const bump = (tau) => (tau < 0 ? 0 : tau < 0.16 ? outCubic(tau / 0.16) : Math.exp(-(tau - 0.16) * 7) * Math.cos((tau - 0.16) * 13));
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(p)))).join(',')})`; };
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

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
function $s(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
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
// keyframed camera: [t, cx, cy, s, ease?] — (cx,cy) is the world point shown at the centre
function cam(kf, t) {
  if (t <= kf[0][0]) return kf[0].slice(1, 4);
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (t <= b[0]) { const p = (b[4] || inOutCubic)(map(t, a[0], b[0])); return [lerp(a[1], b[1], p), lerp(a[2], b[2], p), lerp(a[3], b[3], p)]; }
  }
  return kf[kf.length - 1].slice(1, 4);
}
const camCss = (cx, cy, s, dx = 0, dy = 0, r = 0) => `translate(${(540 - cx * s + dx).toFixed(2)}px,${(540 - cy * s + dy).toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;

const C = { dPage: '#15140F', dSurface: '#1D1B15', dRaised: '#26231A', dHair: '#35312A', dHair2: '#4C463A', dInk: '#EDE6D6', dMuted: '#A79E8B',
  lPage: '#F4EEE3', lSurface: '#FBF7EF', lRaised: '#FFFDF8', lHair: '#DBD1BE', lHair2: '#B9AC93', lInk: '#1B1A17', lMuted: '#5C574D', hot: '#FF3D2E' };
const P = ['#A8452F', '#BF8526', '#5F6B3E', '#2F4E7E'];
const LETTERS = 'ABCD';
const PETAL_POS = [[1, -1], [-1, 1], [-1, -1], [1, 1]];
function petalRadii(j, size) { const m = size * 0.44, h = size, s = size * 0.06; return [[s, m, s, h], [s, h, s, m], [m, s, h, s], [h, s, m, s]][j]; }
const radiusCss = (r) => r.map((v) => `${v.toFixed(1)}px`).join(' ');

/* ---------------------------------------------------------------- particles */
const bursts = [];
function burst(parent, o) {
  const r = rng(o.seed || 1);
  const parts = [];
  for (let i = 0; i < o.n; i++) {
    const a = (o.angle ?? -Math.PI / 2) + (r() - 0.5) * (o.spread ?? Math.PI * 2);
    const sp = lerp(o.speed[0], o.speed[1], r()), size = lerp(o.size[0], o.size[1], r());
    const el = $('div', { cls: 'abs', style: { width: `${size}px`, height: `${size}px`, background: o.colors[i % o.colors.length], display: 'none', zIndex: 50 } }, parent);
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
      T(p.el, { x: b.x + (p.vx * drag) / 3 - p.size / 2, y: b.y + (p.vy * drag) / 3 + 0.5 * (b.g ?? 900) * tau * tau - p.size / 2, r: p.rot * tau, op: 1 - tau / p.life, s: 1 - 0.5 * (tau / p.life) });
    }
  }
}

/* ---------------------------------------------------------------- layers */
const stage = document.getElementById('stage');
const darkRoot = $('div', { cls: 'layer' }, stage);
const world1 = $('div', { cls: 'layer' }, darkRoot);
const bgWordsL = $('div', { cls: 'layer' }, world1);
const winL = $('div', { cls: 'layer' }, world1);
const swarmL = $('div', { cls: 'layer' }, world1);
const hud = $('div', { cls: 'layer' }, darkRoot);
const vhsL = $('div', { cls: 'layer' }, stage);
const glitchL = $('div', { cls: 'layer' }, stage);
const flashL = $('div', { cls: 'fx', style: { background: '#fff', opacity: 0 } }, stage);
const enoughL = $('div', { cls: 'layer' }, stage);
const light = $('div', { cls: 'layer', style: { background: `${C.lPage} url(/x-cut/assets/stone.jpg) center/cover`, display: 'none' } }, stage);
const arenaCam = $('div', { cls: 'layer' }, light);
const arenaImg = $('div', { cls: 'layer', style: { background: 'url(/x-cut/assets/arena.jpg) center/cover' } }, arenaCam);
const arenaShade = $('div', { cls: 'layer', style: { background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 40%, rgba(60,40,20,.35) 100%)' } }, arenaCam);
const fightL = $('div', { cls: 'layer', style: { perspective: '1400px' } }, arenaCam);
const verdictDim = $('div', { cls: 'layer', style: { background: rgba(C.lPage, 0.86), opacity: 0 } }, light);
const verdictL = $('div', { cls: 'layer' }, light);
const tabletL = $('div', { cls: 'layer' }, light);
const hud2 = $('div', { cls: 'layer' }, light);
const askL = $('div', { cls: 'layer', style: { background: C.dPage, display: 'none' } }, stage);
const capL = $('div', { cls: 'layer' }, stage);
const grain = $('div', { cls: 'fx' }, stage);
const vignette = $('div', { cls: 'fx' }, stage);
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); const img = g.createImageData(256, 256); const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  Object.assign(grain.style, { backgroundImage: `url(${cv.toDataURL()})`, mixBlendMode: 'overlay' });
}

/* ================================================================ HOOK + CHAOS (dark) */
// HUD: hook title + question bar (stay readable while the camera punches in)
const title = $('div', { cls: 'abs', style: { left: 0, top: '34px', width: '1080px', display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', fontWeight: 900, fontSize: '56px', color: C.dInk, letterSpacing: '-0.02em' } }, hud);
$('span', { text: '4 AIs. 1 question.' }, title);
const titleHot = $('span', { text: '4 prices.', style: { background: C.hot, color: '#fff', padding: '0 14px', borderRadius: '4px' } }, title);
const qbar = $('div', { cls: 'abs', style: { left: '80px', top: '128px', width: '920px', height: '86px', background: C.dSurface, border: `2px solid ${C.dHair2}`, borderRadius: '43px', display: 'flex', alignItems: 'center', gap: '18px', padding: '0 30px' } }, hud);
$('span', { cls: 'serif', text: '?', style: { width: '48px', height: '48px', borderRadius: '50%', background: C.dInk, color: C.dPage, fontSize: '34px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, qbar);
const qtext = $('span', { cls: 'serif', html: 'What should I charge for my <b style="font-weight:600">SaaS?</b>', style: { fontSize: '38px', color: C.dInk } }, qbar);

const WIN_POS = [[300, 425, -3], [780, 425, 2.5], [300, 712, 2], [780, 712, -2.5]];
function makeWin(parent, logo, name) {
  const el = $('div', { cls: 'win' }, parent);
  const hd = $('div', { cls: 'hd' }, el);
  $('span', { html: ICON[logo], style: { display: 'flex' } }, hd);
  $('span', { cls: 'nm', text: name }, hd);
  $('span', { cls: 'ctl', html: '<i></i><i></i><i></i>' }, hd);
  const dots = $('div', { cls: 'dots', html: '<i></i><i></i><i></i>' }, el);
  const ans = $('div', { cls: 'ans' }, el);
  const ansB = $('b', {}, ans), ansU = $('u', {}, ans), ansS = $('span', {}, ans);
  const dim = $('div', { cls: 'dim', style: { opacity: 0 } }, el);
  return { el, dots, dotEls: [...dots.children], ans, ansB, ansU, ansS, dim };
}
const MAIN = TL.main.map((m, i) => {
  const w = makeWin(winL, m.logo, m.name);
  w.ansB.textContent = m.say; w.ansU.textContent = m.unit; w.ansS.textContent = m.sub;
  if (m.small) w.ansB.style.fontSize = '66px';
  if (m.small) w.ansS.style.marginTop = '22px';
  return { ...m, ...w, i, x: WIN_POS[i][0], y: WIN_POS[i][1], r: WIN_POS[i][2] };
});
MAIN.forEach((m) => burst(winL, { t0: m.slam + 0.06, x: m.x - 60, y: m.y + 20, n: 18, colors: [C.dInk, C.hot, '#fff'], speed: [800, 1700], size: [5, 10], life: 0.55, g: 1300, seed: 30 + m.i }));
// swarm
const SW_R = rng(91);
const SWARM = TL.swarm.map((s, i) => {
  let el, inner = null;
  const x = 90 + SW_R() * 900, y = 260 + SW_R() * 620, r = (SW_R() - 0.5) * 34;
  if (s.kind === 'win') {
    const w = makeWin(swarmL, s.logo, s.name);
    w.ansB.textContent = s.say; w.ansB.style.fontSize = s.say.length > 6 ? '58px' : '96px'; w.ansS.textContent = '';
    show(w.dots, false); el = w.el; inner = w.ans;
  } else {
    el = $('div', { cls: 'tag' + (i % 4 === 0 ? ' hot' : ''), text: s.text }, swarmL);
  }
  el.style.zIndex = 20 + i;
  return { ...s, el, inner, x, y, r, s0: s.kind === 'win' ? 0.62 + SW_R() * 0.18 : 0.8 + SW_R() * 0.5, vx: (SW_R() - 0.5) * 120, vy: (SW_R() - 0.5) * 80 };
});
const BG_WORDS = [['$9', 160, -200, 180], ['$99', 420, 1100, -230], ['FREE', 700, -400, 210], ['IT DEPENDS', 980, 1200, -160], ['$$$', 300, -300, 260]];
BG_WORDS.forEach((b) => (b.el = $('div', { cls: 'abs', text: b[0], style: { fontWeight: 900, fontSize: '280px', lineHeight: '1', color: 'transparent', WebkitTextStroke: `2px ${C.dHair2}`, whiteSpace: 'nowrap' } }, bgWordsL)));
// VHS rewind overlay
const vhsTag = $('div', { cls: 'abs mono', text: '◀◀ REWIND', style: { left: '40px', top: '236px', fontSize: '30px', color: '#fff', fontWeight: 600, letterSpacing: '0.1em', textShadow: '2px 0 rgba(255,40,70,.8), -2px 0 rgba(40,210,255,.8)' } }, vhsL);
const vhsLines = Array.from({ length: 6 }, () => $('div', { cls: 'abs', style: { left: 0, width: '1080px', height: '6px', background: 'rgba(255,255,255,.35)' } }, vhsL));
const GLITCH = Array.from({ length: 5 }, () => $('div', { cls: 'abs', style: { left: 0, width: '1080px', display: 'none' } }, glitchL));

const REWIND = [0.55, 0.95];
const SW0 = TL.swarm[0].t;
const TAPE0 = S('enough') - 0.32, FREEZE = S('enough');
const REP = TL.reprise;
const chaosTime = (t) => { if (t < TAPE0 || t >= REP[0] - 0.05) return t; const p = map(t, TAPE0, FREEZE); return TAPE0 + (FREEZE - TAPE0) * (p - (p * p) / 2); };
// loop-continuous hook clock: u = t at the start, t - DUR at the end
const hookU = (t) => (t >= REP[0] - 0.05 ? t - DUR : t);
// when does window i show its answer (returns slam time) — hook, normal, or reprise
function slamTime(m, t) {
  if (t >= REP[0] - 0.05) return REP[m.i];
  if (t < REWIND[1]) return -0.5;
  return m.slam;
}
const rampAt = (t) => (t >= REP[0] - 0.05 ? 0 : map(t, SW0, TAPE0));

function updateChaos(t) {
  const reprise = t >= REP[0] - 0.05;
  const on = t < 16.2 || reprise;
  show(darkRoot, on);
  if (!on) { show(glitchL, false); show(vhsL, false); flashL.style.opacity = 0; return; }
  const tc = chaosTime(t);
  const frozen = t >= FREEZE && !reprise;
  const u = hookU(t);
  const tapeK = 1 - map(t, TAPE0, FREEZE);
  // which window has the camera's focus
  const focusW = MAIN.map((m, i) => {
    if (reprise) return 0;
    const next = i < 3 ? MAIN[i + 1].focus : S('free') + 0.45;
    return outCubic(map(tc, m.focus - 0.15, m.focus + 0.05)) * (1 - outCubic(map(tc, next - 0.15, next + 0.05)));
  });
  const anyF = Math.max(...focusW);
  MAIN.forEach((m, i) => {
    const st = slamTime(m, tc);
    let vis = 1, sp = 1;
    if (reprise) { sp = spring(t - (REP[i] - 0.06), 2.4, 0.55); vis = t >= REP[i] - 0.06 ? 1 : 0; }
    const f = focusW[i];
    const jx = 6 * rampAt(tc) * vnoise(tc * 9, i + 3), jy = 6 * rampAt(tc) * vnoise(tc * 9, i + 9);
    const kick = 0.05 * wobble(tc - st, 9, 24) * (st > 0 ? 1 : 0) + (st < 0 ? 0.05 * wobble(u - (i < 2 ? 0 : 0.18), 9, 24) : 0);
    T(m.el, { x: m.x - 220 + jx, y: m.y - 135 + jy, s: lerp(reprise ? 1.8 : 1, 1, sp) * (1 + kick), r: m.r * (reprise ? lerp(3, 1, sp) : 1) + 2 * wobble(tc - st, 8, 25), op: vis * map(sp, 0, 0.15) });
    m.dim.style.opacity = (0.62 * (anyF - f)).toFixed(3);
    m.el.style.zIndex = f > 0.5 ? 15 : 10;
    // answer: shown at the hook, rewound, then slammed on the VO
    const answered = tc >= st;
    let ap = map(tc, st, st + 0.15), aScale = 1 + 1.9 * (1 - outExpo(ap)), aOp = map(tc, st, st + 0.04), aBlur = 10 * (1 - ap);
    if (!reprise && tc >= REWIND[0] && tc < REWIND[1]) { const rp = inExpo(map(tc, REWIND[0], REWIND[1])); aScale = 1 - rp; aOp = 1 - rp; aBlur = 12 * rp; }
    if (!reprise && tc < REWIND[0]) { aScale = 1; aOp = 1; aBlur = 0; }
    show(m.ans, answered || (tc < REWIND[1] && !reprise));
    T(m.ans, { s: aScale, op: aOp, blur: aBlur });
    m.ansS.style.opacity = tc < REWIND[1] && !reprise ? 1 - map(tc, REWIND[0], REWIND[0] + 0.1) : reprise ? map(t, REP[i] + 0.1, REP[i] + 0.3) : map(tc, st + 0.15, st + 0.35);
    show(m.dots, !answered && tc >= REWIND[1] && !reprise);
    m.dotEls.forEach((d, j) => T(d, { y: -11 * Math.max(0, Math.sin(tc * 9 - j * 0.9)) }));
  });
  // swarm
  SWARM.forEach((s) => {
    const on_ = tc >= s.t && !reprise;
    show(s.el, on_);
    if (!on_) return;
    const tau = tc - s.t, sp = spring(tau, 2.4, 0.5);
    const jx = 8 * rampAt(tc) * vnoise(tc * 8, s.t * 10), jy = 8 * rampAt(tc) * vnoise(tc * 8, s.t * 13);
    T(s.el, { x: s.x - (s.kind === 'win' ? 220 : 90) + s.vx * tau + jx, y: s.y - (s.kind === 'win' ? 135 : 34) + s.vy * tau + jy, s: s.s0 * lerp(2.2, 1, sp), r: s.r * (2 - sp), op: map(tau, 0, 0.04) });
  });
  BG_WORDS.forEach((b, i) => { T(b.el, { x: b[2] + b[3] * (tc - 3) * (1 + rampAt(tc)), y: b[1] - 140, op: reprise ? 0 : 0.6 * map(tc, 3.2 + i * 0.6, 4.2 + i * 0.6) }); });

  // camera
  let cx, cy, cs;
  if (reprise) [cx, cy, cs] = cam([[REP[0] - 0.05, 540, 540, 1.0], [DUR, 540, 540, 1.06, (p) => p]], t);
  else {
    const E = inOutExpo;
    [cx, cy, cs] = cam([[0, 540, 540, 1.06], [0.45, 540, 540, 1.0, outCubic], [MAIN[0].focus - 0.15, 540, 540, 1.0],
      [MAIN[0].focus + 0.05, 300, 425, 1.5, E], [MAIN[1].focus - 0.15, 300, 425, 1.58], [MAIN[1].focus + 0.05, 780, 425, 1.5, E],
      [MAIN[2].focus - 0.15, 780, 425, 1.58], [MAIN[2].focus + 0.05, 300, 712, 1.5, E], [MAIN[3].focus - 0.15, 300, 712, 1.58],
      [MAIN[3].focus + 0.05, 780, 712, 1.5, E], [S('free') + 0.45, 780, 712, 1.58], [S('free') + 0.8, 540, 560, 1.0, E], [TAPE0, 540, 570, 1.12]], tc);
  }
  let imp = 0;
  for (const m of MAIN) { const st = slamTime(m, tc); if (tc >= st && st > 0) imp += decay(tc - st, 7); }
  if (!reprise) imp += decay(u, 6) + 0.5 * decay(u - 0.18, 7) * (u >= 0.18 ? 1 : 0);
  for (const s of SWARM) if (tc >= s.t && !reprise) imp += decay(tc - s.t, 12) * 0.22;
  const amp = (18 * imp + 14 * rampAt(tc)) * tapeK * (frozen ? 0 : 1);
  const fi = Math.floor(t * 60);
  const rewinding = !reprise && t >= REWIND[0] && t < REWIND[1];
  const gChance = frozen || reprise ? 0 : clamp(map(tc, SW0 + 1, TAPE0) * 0.55 + (SWARM.some((s) => tc >= s.t && tc < s.t + 0.04) ? 0.7 : 0) + (rewinding ? 0.6 : 0));
  const glitchOn = hash(fi * 1.37) < gChance;
  const gx = glitchOn ? (hash(fi * 3.1) - 0.5) * 50 : 0;
  world1.style.transform = camCss(cx, cy, cs, amp * vnoise(tc * 38, 1) + gx, amp * vnoise(tc * 38, 2), amp * 0.05 * vnoise(tc * 30, 3));
  T(hud, { x: amp * 0.4 * vnoise(tc * 30, 5) + gx * 0.5, y: amp * 0.4 * vnoise(tc * 30, 6) });
  // hook HUD: present at frame 0, slams back for the loop
  if (reprise) { const hp = spring(t - (REP[0] - 0.05), 2.6, 0.55); T(title, { s: lerp(1.4, 1, hp), op: map(hp, 0, 0.2) }); T(qbar, { s: lerp(1.3, 1, spring(t - REP[1], 2.6, 0.55)), op: map(t, REP[1], REP[1] + 0.05) }); }
  else { T(title, { s: 1 + 0.04 * wobble(u, 9, 24), op: 1 }); T(qbar, { s: 1 + 0.03 * wobble(tc - S('saas'), 8, 20) * (tc >= S('saas') ? 1 : 0), op: 1 }); }
  const qg = !reprise ? map(tc, S('what') - 0.05, S('what') + 0.2) * (1 - map(tc, S('saas') + 0.6, S('saas') + 0.9)) : 0;
  qbar.style.borderColor = mix(C.dHair2, C.dInk, qg);
  qbar.style.boxShadow = `0 0 ${(60 * qg).toFixed(0)}px ${rgba(C.dInk, 0.18 * qg)}`;
  titleHot.style.background = C.hot;
  // chromatic split + freeze grade
  const ca = (7 * imp + 7 * rampAt(tc) + (glitchOn ? 9 : 0)) * (frozen ? 0 : 1);
  let filter = ca > 0.4 ? `drop-shadow(${ca.toFixed(1)}px 0 0 rgba(255,40,70,.55)) drop-shadow(${(-ca).toFixed(1)}px 0 0 rgba(40,210,255,.5))` : 'none';
  if (frozen) { const fp = outExpo(map(t, FREEZE, FREEZE + 0.3)); filter = `grayscale(${fp}) brightness(${lerp(1, 0.22, fp).toFixed(3)}) blur(${(4.5 * map(t, FREEZE, FREEZE + 1.2)).toFixed(2)}px)`; }
  winL.style.filter = filter; swarmL.style.filter = filter;
  darkRoot.style.filter = frozen ? `grayscale(1) brightness(${lerp(1, 0.35, outExpo(map(t, FREEZE, FREEZE + 0.3))).toFixed(3)})` : 'none';
  // rewind VHS
  show(vhsL, rewinding || (!reprise && t >= REWIND[0] - 0.05 && t < REWIND[1] + 0.12));
  vhsTag.style.opacity = (fi % 8 < 6 ? 1 : 0.4);
  vhsLines.forEach((l, k) => { l.style.top = `${Math.floor(hash(fi * 3 + k) * 1080)}px`; l.style.opacity = 0.2 + 0.5 * hash(fi + k * 7); });
  // glitch bars
  show(glitchL, glitchOn);
  GLITCH.forEach((g, k) => {
    const v = glitchOn && k < 2 + Math.floor(hash(fi + k) * 3);
    show(g, v);
    if (v) { g.style.top = `${Math.floor(hash(fi * 7 + k * 13) * 1040)}px`; g.style.height = `${4 + Math.floor(hash(fi * 11 + k) * 40)}px`; g.style.background = hash(fi + k * 5) < 0.35 ? C.hot : rgba(C.dInk, 0.85); g.style.opacity = 0.35 + 0.5 * hash(fi * 2 + k); T(g, { x: (hash(fi * 5 + k) - 0.5) * 180 }); }
  });
  let fl = 0;
  for (const m of MAIN) { const st = slamTime(m, tc); if (tc >= st && st > 0) fl = Math.max(fl, 0.2 * decay(tc - st, 18)); }
  flashL.style.opacity = frozen ? 0 : fl.toFixed(3);
}

/* ================================================================ Enough. */
const cutLine = $('div', { cls: 'abs', style: { left: 0, top: '589px', width: '1080px', height: '2px', background: C.dInk, transformOrigin: '0 50%' } }, enoughL);
const enoughWord = $('div', { cls: 'abs serif', style: { left: 0, top: '370px', width: '1080px', textAlign: 'center', fontSize: '200px', fontWeight: 600, lineHeight: '1', color: C.dInk } }, enoughL);
const enoughLetters = [...'Enough.'].map((ch) => $('span', { text: ch, style: { display: 'inline-block' } }, enoughWord));
function updateEnough(t) {
  const on = t >= FREEZE && t < S('so') + 0.8;
  show(enoughL, on);
  if (!on) return;
  T(cutLine, { sx: outExpo(map(t, FREEZE, FREEZE + 0.22)) });
  enoughLetters.forEach((l, i) => { const p = outExpo(map(t - (FREEZE + i * 0.03), 0, 0.3)); T(l, { y: 40 * (1 - p), s: lerp(1.5, 1, p), op: map(t - (FREEZE + i * 0.03), 0, 0.06), blur: 16 * (1 - p) }); });
  T(enoughWord, { s: 1 + 0.05 * map(t, FREEZE, S('so')), y: 0 });
}

/* ================================================================ ARENA (light) */
function updateLight(t) {
  const on = t >= S('so') - 0.06 && t < S('what2') - 0.04;
  show(light, on);
  if (!on) return;
  const p = outExpo(map(t, S('so') - 0.06, S('so') + 0.55));
  light.style.clipPath = p >= 1 ? 'none' : `inset(${(590 * (1 - p)).toFixed(1)}px 0 ${(490 * (1 - p)).toFixed(1)}px 0)`;
}
const CARD_POS = [[310, 420], [770, 420], [310, 662], [770, 662]];
const PERM = [2, 0, 3, 1];
const ARGS = ['Value-based. Not cost-plus.', '$9 or nobody pays.', 'Free first. Charge later.', 'Start mid. Raise often.'];
const TORN = { 1: S('tear') + 0.02, 2: S('others') + 0.02 };
const CARDS = TL.main.map((m, i) => {
  const slot = PERM[i];
  const el = $('div', { cls: 'card' }, fightL);
  const front = $('div', { cls: 'face front' }, el);
  $('span', { html: ICON[m.logo], style: { display: 'flex' } }, front);
  $('span', { cls: 'nm', text: m.name }, front);
  const back = $('div', { cls: 'face back' }, el);
  $('div', { cls: 'band', style: { background: P[slot] } }, back);
  $('div', { cls: 'helm', style: { background: P[slot] } }, back);
  $('div', { cls: 'lt', text: LETTERS[slot], style: { color: P[slot] } }, back);
  const shadow = $('div', { cls: 'abs', style: { width: '230px', height: '150px', background: 'rgba(40,25,10,.35)', filter: 'blur(14px)', borderRadius: '8px' } }, fightL);
  fightL.insertBefore(shadow, el);
  return { el, shadow, i, slot };
});
// argument bubbles (two halves so they can be torn apart)
const BUB = ARGS.map((txt, slot) => {
  const [x, y] = CARD_POS[slot];
  const by = slot < 2 ? y - 128 : y + 128;
  const halves = [0, 1].map((h) => {
    const b = $('div', { cls: 'bubble', text: txt }, fightL);
    b.style.clipPath = h === 0 ? 'polygon(0 0, 52% 0, 47% 30%, 53% 55%, 46% 80%, 50% 100%, 0 100%)' : 'polygon(52% 0, 100% 0, 100% 100%, 50% 100%, 46% 80%, 53% 55%, 47% 30%)';
    return b;
  });
  return { halves, x, by, slot, w: 0, h: 0 };
});
const CLASHES = [
  { t: S('tear'), pairs: [[0, 1]], at: [540, 420] },
  { t: S('others'), pairs: [[2, 3]], at: [540, 662] },
  { t: S('apart'), pairs: [[0, 3], [1, 2]], at: [540, 541], all: true }
];
CLASHES.forEach((c, k) => burst(fightL, { t0: c.t, x: c.at[0], y: c.at[1], n: c.all ? 34 : 20, colors: [...P, '#fff', C.lInk], speed: [700, 1700], size: [5, 11], life: 0.6, g: 600, seed: 200 + k }));
const arbiter = $('div', { cls: 'abs', style: { left: '380px', top: '504px', width: '320px', height: '74px', background: C.lInk, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 } }, fightL);
$('span', { cls: 'mono', text: 'ARBITER', style: { color: C.lPage, fontSize: '26px', letterSpacing: '0.42em', fontWeight: 600, marginLeft: '0.42em' } }, arbiter);
const ring = $('div', { cls: 'abs', style: { left: '380px', top: '504px', width: '320px', height: '74px', border: `3px solid ${C.lInk}`, zIndex: 29 } }, fightL);
burst(fightL, { t0: S('rules'), x: 540, y: 541, n: 26, colors: [C.lInk, C.lHair2, C.lMuted], speed: [400, 1000], size: [4, 9], life: 0.7, g: 900, seed: 300 });
const flowSvg = $s('svg', { width: 1080, height: 1080, style: 'position:absolute;left:0;top:0;z-index:25' }, fightL);
const FLOWS = CARD_POS.map(([x, y], slot) => {
  const tx = 540 + (slot % 2 ? 60 : -60), ty = slot < 2 ? 504 : 578;
  const d = `M ${x} ${y + (slot < 2 ? 75 : -75)} C ${x} ${ty + (slot < 2 ? -40 : 40)}, ${tx} ${ty + (slot < 2 ? -40 : 40)}, ${tx} ${ty}`;
  return $s('path', { d, fill: 'none', stroke: P[slot], 'stroke-width': 5, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, flowSvg);
});
const pathDraw = (p, v) => p.setAttribute('stroke-dashoffset', (1 - clamp(v)).toFixed(4));

function cardPos(c, t) {
  // fall into the arena, flip (names hidden), shuffle to anonymous slots, then fight
  const land = S('made') + 0.1 + c.i * 0.08;
  const fp = map(t, land - 0.42, land);
  const s = lerp(2.6, 1, inQuad(fp)) * (1 + (t >= land ? 0.06 * wobble(t - land, 9, 26) : 0));
  const sp = inOutCubic(map(t, S('hidden') + 0.1, S('hidden') + 0.55));
  const [ax, ay] = CARD_POS[c.i], [bx, by] = CARD_POS[c.slot];
  let x = lerp(ax, bx, sp), y = lerp(ay, by, sp) + (c.i % 2 ? -50 : 50) * Math.sin(Math.PI * sp);
  // clashes: pull toward the partner, impact at the cue time
  for (const k of CLASHES) for (const [a, b] of k.pairs) {
    if (c.slot !== a && c.slot !== b) continue;
    const o = c.slot === a ? b : a;
    const [ox, oy] = CARD_POS[o];
    const v = bump(t - (k.t - 0.16)) * (k.all ? 0.42 : 0.36);
    x += (ox - CARD_POS[c.slot][0]) * v * (t >= S('hidden') + 0.55 ? 1 : 0);
    y += (oy - CARD_POS[c.slot][1]) * v * (t >= S('hidden') + 0.55 ? 1 : 0);
  }
  return { x, y, s, fp, land };
}
function updateArena(t) {
  const on = t >= S('so') - 0.06 && t < S('this') + 0.4;
  show(arenaCam, on); show(fightL, on);
  if (!on) return;
  // camera: descend from the sky, slow drift, pull back for the arbiter, shake on hits
  let [cx, cy, cs] = cam([[S('so') - 0.06, 540, 540, 1.9], [S('debate') + 0.3, 540, 540, 1.0, outExpo], [S('an') - 0.15, 540, 540, 1.04], [S('rules'), 540, 541, 0.96, inOutExpo], [S('twenty'), 540, 541, 0.96], [S('this'), 540, 541, 1.03]], t);
  let sh = 0;
  for (const k of CLASHES) sh += (k.all ? 16 : 10) * decay(t - k.t, 8) * (t >= k.t ? 1 : 0);
  sh += 12 * decay(t - S('rules'), 8) * (t >= S('rules') ? 1 : 0);
  const rot = -10 * (1 - outExpo(map(t, S('so') - 0.06, S('debate') + 0.3)));
  arenaCam.style.transform = camCss(cx, cy, cs, sh * vnoise(t * 40, 1), sh * vnoise(t * 40, 2), rot);
  const vd = map(t, S('twenty') - 0.12, S('twenty') + 0.12);
  arenaCam.style.filter = vd > 0 ? `blur(${(6 * vd).toFixed(2)}px)` : 'none';
  arenaCam.style.opacity = 1 - map(t, S('this') - 0.15, S('this') + 0.2);
  CARDS.forEach((c) => {
    const { x, y, s, fp, land } = cardPos(c, t);
    const ft = S('names') + c.i * 0.08;
    const ry = 180 * inOutCubic(map(t, ft, ft + 0.4));
    show(c.el, fp > 0); show(c.shadow, fp > 0);
    T(c.el, { x: x - 115, y: y - 75, s, ry, op: map(fp, 0, 0.15) });
    T(c.shadow, { x: x - 115 + 10 * s, y: y - 75 + 16 * s, s: s * 1.02, op: 0.9 * map(fp, 0.3, 1) * (t >= land ? 1 : 0.6) });
  });
  // bubbles
  BUB.forEach((b) => {
    const c = CARDS.find((k) => k.slot === b.slot);
    const { x, y } = cardPos(c, t);
    const appear = S('only') + b.slot * 0.12;
    const p = spring(t - appear, 2.6, 0.55);
    const torn = TORN[b.slot];
    const out = 1 - map(t, S('an') - 0.2, S('an') + 0.1);
    b.halves.forEach((h, k) => {
      show(h, t >= appear && out > 0);
      if (!b.w) { b.w = h.offsetWidth; b.h = h.offsetHeight; }
      let dx = 0, dy = 0, r = 0, op = map(t - appear, 0, 0.06) * out;
      if (torn && t >= torn) { const tau = t - torn; dx = (k ? 1 : -1) * 70 * outCubic(Math.min(tau / 0.25, 1)); dy = 900 * Math.max(0, tau - 0.1) ** 2; r = (k ? 1 : -1) * 30 * tau; op *= 1 - map(tau, 0.3, 0.55); }
      const bx = x + (y < 541 ? 0 : 0), by = b.by + (y - CARD_POS[b.slot][1]);
      T(h, { x: bx - b.w / 2 + dx, y: by - b.h / 2 + dy, s: lerp(0.4, 1, p), r, op });
      h.style.zIndex = 40;
    });
  });
  // arbiter + converging lines
  const ap = outExpo(map(t, S('an') - 0.1, S('an') + 0.25));
  const pr = t >= S('rules') ? 0.12 * punch(t - S('rules'), 8, 14) : 0;
  T(arbiter, { sy: ap * (1 + pr), sx: 1 + pr, op: ap });
  const rp = map(t, S('rules'), S('rules') + 0.5);
  T(ring, { s: 1 + 0.7 * outCubic(rp), op: (t >= S('rules') ? 1 : 0) * (1 - rp) });
  FLOWS.forEach((f, j) => pathDraw(f, outCubic(map(t, S('arbiter') + j * 0.05, S('arbiter') + 0.4 + j * 0.05))));
  flowSvg.style.opacity = 1 - map(t, S('twenty') - 0.1, S('twenty') + 0.1);
}

/* ---------------------------------------------------------------- round labels */
const roundPill = $('div', { cls: 'abs mono', style: { left: '50%', top: '38px', height: '58px', padding: '0 26px', background: C.lInk, color: C.lPage, fontSize: '26px', fontWeight: 600, letterSpacing: '0.24em', display: 'flex', alignItems: 'flex-start', overflow: 'hidden', whiteSpace: 'nowrap' } }, hud2);
const roundStrip = $('div', { style: { display: 'flex', flexDirection: 'column' } }, roundPill);
['ROUND 1 · THE DEBATE', 'ROUND 2 · THE VERDICT'].forEach((s) => $('div', { text: s, style: { height: '58px', lineHeight: '58px' } }, roundStrip));
function updateHud2(t) {
  const p = outExpo(map(t, S('so') + 0.2, S('so') + 0.6)) * (1 - map(t, S('this') - 0.2, S('this')));
  show(hud2, p > 0);
  const k = outExpo(map(t, S('an') - 0.1, S('an') + 0.25));
  T(roundStrip, { y: -58 * k });
  roundPill.style.transform = `translateX(-50%) scale(${(0.6 + 0.4 * p + 0.08 * wobble(t - S('an') + 0.1, 9, 22)).toFixed(4)})`;
  roundPill.style.opacity = p.toFixed(3);
}

/* ---------------------------------------------------------------- verdict */
const laurel = $('img', { cls: 'abs', style: { left: `${540 - 300}px`, top: '128px', width: '600px' } }, verdictL);
laurel.src = '/x-cut/assets/laurel.png';
const vPrice = $('div', { cls: 'abs serif', text: '$29', style: { left: 0, top: '228px', width: '1080px', textAlign: 'center', fontSize: '220px', fontWeight: 600, lineHeight: '1', color: C.lInk, letterSpacing: '-0.03em', fontVariantNumeric: 'lining-nums' } }, verdictL);
const vMonth = $('div', { cls: 'abs mono', text: '/ MONTH', style: { left: 0, top: '458px', width: '1080px', textAlign: 'center', fontSize: '34px', letterSpacing: '0.3em', color: C.lMuted } }, verdictL);
const vOne = $('div', { cls: 'abs mono', text: 'ONE PLAN', style: { left: `${540 - 160}px`, top: '650px', width: '320px', height: '66px', lineHeight: '66px', textAlign: 'center', background: C.lInk, color: C.lPage, fontSize: '30px', fontWeight: 600, letterSpacing: '0.24em' } }, verdictL);
const vRaise = $('div', { cls: 'abs mono', text: 'RAISE AFTER 10 CUSTOMERS', style: { left: `${540 - 330}px`, top: '734px', width: '660px', height: '66px', lineHeight: '62px', textAlign: 'center', border: `3px solid ${C.lInk}`, color: C.lInk, fontSize: '28px', fontWeight: 600, letterSpacing: '0.14em', background: C.lRaised } }, verdictL);
const vDots = Array.from({ length: 10 }, (_, i) => $('div', { cls: 'abs', style: { left: `${540 - 245 + i * 50}px`, top: '820px', width: '40px', height: '40px', border: `3px solid ${C.lInk}`, background: 'transparent' } }, verdictL));
const vArrow = $('div', { cls: 'abs', text: '↑', style: { left: `${540 + 265}px`, top: '804px', fontSize: '62px', fontWeight: 900, color: C.lInk } }, verdictL);
burst(verdictL, { t0: S('twenty'), x: 540, y: 380, n: 30, colors: [...P, C.lInk], speed: [700, 1600], size: [5, 11], life: 0.8, g: 600, seed: 400 });
function updateVerdict(t) {
  const on = t >= S('twenty') - 0.15 && t < S('this') + 0.4;
  show(verdictL, on); show(verdictDim, on);
  if (!on) return;
  const out = inCubic(map(t, S('this') - 0.15, S('this') + 0.2));
  verdictDim.style.opacity = (map(t, S('twenty') - 0.15, S('twenty') + 0.1) * (1 - out)).toFixed(3);
  T(verdictL, { y: -600 * out, op: 1 - out });
  const lp = outCubic(map(t, S('twenty') - 0.05, S('twenty') + 0.6));
  laurel.style.clipPath = `inset(${(100 - 100 * lp).toFixed(1)}% 0 0 0)`;
  const pp = outExpo(map(t, S('twenty'), S('twenty') + 0.18));
  T(vPrice, { s: lerp(2.4, 1, pp) * (1 + 0.04 * Math.sin((t - S('twenty')) * 2.5) * map(t, S('twenty') + 0.4, S('twenty') + 1)), op: map(t, S('twenty'), S('twenty') + 0.04), blur: 12 * (1 - pp) });
  const mp = outCubic(map(t, S('month'), S('month') + 0.3)); T(vMonth, { y: 14 * (1 - mp), op: mp });
  const stamp = (e, t0) => { const p = outExpo(map(t, t0 - 0.08, t0)); T(e, { s: lerp(1.7, 1, p) * (1 + 0.05 * wobble(t - t0, 9, 24)), op: map(t, t0 - 0.08, t0 - 0.04), r: t0 === S('one') ? -2 : 1.5 }); };
  stamp(vOne, S('one')); stamp(vRaise, S('raise'));
  vDots.forEach((d, i) => { const ti = S('ten') + i * 0.07; const on_ = t >= ti; d.style.background = on_ ? P[i % 4] : 'transparent'; d.style.borderColor = on_ ? P[i % 4] : C.lInk; T(d, { s: (on_ ? 1 + 0.25 * wobble(t - ti, 10, 26) : 1) * outBack(map(t, S('raise') + 0.1 + i * 0.02, S('raise') + 0.35 + i * 0.02)), op: map(t, S('raise') + 0.1, S('raise') + 0.2) }); });
  const ar = outExpo(map(t, S('customers') + 0.2, S('customers') + 0.5)); T(vArrow, { y: 30 * (1 - ar), op: ar });
}

/* ---------------------------------------------------------------- Certamen tablet */
const tablet = $('img', { cls: 'abs', style: { left: `${540 - 480}px`, top: `${520 - 271}px`, width: '960px', filter: 'drop-shadow(0 18px 30px rgba(60,40,15,.35))' } }, tabletL);
tablet.src = '/x-cut/assets/tablet.png';
const tLogo = $('div', { cls: 'abs', style: { left: `${540 - 63}px`, top: '318px', width: '126px', height: '126px' } }, tabletL);
const tPetals = [0, 1, 2, 3].map((j) => { const [px, py] = PETAL_POS[j]; return $('div', { cls: 'abs', style: { width: '60px', height: '60px', left: `${px > 0 ? 66 : 0}px`, top: `${py > 0 ? 66 : 0}px`, background: P[j], borderRadius: radiusCss(petalRadii(j, 60)) } }, tLogo); });
const wordmark = $('div', { cls: 'abs', style: { left: 0, top: '478px', width: '1080px', textAlign: 'center', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '104px', lineHeight: '1', letterSpacing: '0.1em', color: 'rgba(78,58,38,.92)', textShadow: '0 2px 1px rgba(255,250,240,.75), 0 -2px 1px rgba(40,28,15,.4)' } }, tabletL);
const wmLetters = [...'CERTAMEN'].map((ch) => $('span', { text: ch, style: { display: 'inline-block' } }, wordmark));
const tStamp = $('div', { cls: 'abs mono', text: 'OPEN SOURCE · MIT', style: { left: '600px', top: '690px', padding: '10px 20px', border: `4px solid ${C.lInk}`, background: rgba(C.lRaised, 0.92), fontSize: '30px', fontWeight: 600, letterSpacing: '0.16em', color: C.lInk } }, tabletL);
const tUrl = $('div', { cls: 'abs mono', text: 'vkandil.github.io/Certamen', style: { left: 0, top: '820px', width: '1080px', textAlign: 'center', fontSize: '34px', color: C.lInk } }, tabletL);
const ctaL = $('div', { cls: 'layer' }, light);
const discL = $('div', { cls: 'layer' }, light);
const disclaimer = $('div', { cls: 'abs', text: 'Dramatization: AI answers are illustrative. Trademarks belong to their owners; no affiliation.', style: { left: 0, top: '1046px', width: '1080px', textAlign: 'center', fontSize: '15px', color: C.lMuted } }, discL);
burst(tabletL, { t0: S('this') + 0.12, x: 540, y: 790, n: 34, colors: [C.lHair2, C.lMuted, '#cbb89a'], speed: [300, 900], size: [4, 10], life: 0.9, g: 1200, angle: -Math.PI / 2, spread: Math.PI * 1.2, seed: 500 });
function initChisel() {
  wmLetters.forEach((l, i) => { const r = l.getBoundingClientRect(); burst(tabletL, { t0: S('certamen') + i * 0.06 + 0.02, x: r.left + r.width / 2, y: 560, n: 8, colors: ['rgba(78,58,38,.9)', C.lHair2], speed: [250, 650], size: [3, 7], life: 0.55, g: 1600, angle: -Math.PI / 2, spread: Math.PI * 0.9, seed: 600 + i }); });
}
function updateTablet(t) {
  const on = t >= S('this') - 0.1 && t < CTA0 + 0.25;
  show(tabletL, on);
  disclaimer.style.opacity = map(t, S('this') + 0.3, S('this') + 0.6).toFixed(3);
  show(discL, t >= S('this') && t < S('what2') - 0.04);
  if (!on) return;
  const tout = map(t, CTA0 - 0.05, CTA0 + 0.18);
  T(tabletL, { y: -80 * inCubic(tout), op: 1 - tout });
  const land = S('this') + 0.12;
  const p = inQuad(map(t, land - 0.3, land));
  const sh = t >= land ? 10 * decay(t - land, 9) : 0;
  T(tablet, { s: lerp(1.5, 1, p) * (1 + (t >= land ? 0.02 * wobble(t - land, 10, 30) : 0)), op: map(t, land - 0.3, land - 0.2), x: sh * vnoise(t * 40, 1), y: sh * vnoise(t * 40, 2) });
  tPetals.forEach((pt, j) => { const tt = S('is') + j * 0.05; const sp = spring(t - tt, 2.4, 0.55); const [px, py] = PETAL_POS[j]; T(pt, { x: px * 160 * (1 - sp), y: py * 160 * (1 - sp), s: sp, r: 90 * (1 - sp) }); });
  wmLetters.forEach((l, i) => { const tau = t - (S('certamen') + i * 0.06); const q = outExpo(map(tau, 0, 0.2)); T(l, { s: lerp(1.4, 1, q), op: map(tau, 0, 0.04), blur: 5 * (1 - q) }); });
  const st = S('source') + 0.02; const sp = outExpo(map(t, st - 0.09, st));
  T(tStamp, { s: lerp(1.9, 1, sp), r: -7, op: map(t, st - 0.09, st - 0.05) });
  const up = outCubic(map(t, S('open'), S('open') + 0.35)); T(tUrl, { y: 16 * (1 - up), op: up });
}

/* ---------------------------------------------------------------- CTA: Certamen's own price + try / star */
const CTA0 = TL.cta.t0;
const ctaTitle = $('div', { cls: 'abs serif', text: 'Certamen’s price?', style: { left: 0, top: '110px', width: '1080px', textAlign: 'center', fontSize: '80px', fontWeight: 600, color: C.lInk } }, ctaL);
const CROSSED = ['$9', '$99', '$29'].map((p, i) => {
  const x = [250, 540, 830][i];
  const el = $('div', { cls: 'abs', text: p, style: { left: `${x - 150}px`, top: '245px', width: '300px', textAlign: 'center', fontWeight: 900, fontSize: '112px', lineHeight: '1', color: C.lInk, letterSpacing: '-0.03em' } }, ctaL);
  const slash = $('div', { cls: 'abs', style: { left: `${x - 105}px`, top: '297px', width: '210px', height: '12px', background: P[0], transformOrigin: '0 50%' } }, ctaL);
  return { el, slash, t: 0.15 + i * 0.2 };
});
const ctaGroup = $('div', { cls: 'layer', style: { transformOrigin: '540px 584px' } }, ctaL);
const laurel2 = $('img', { cls: 'abs', style: { left: '270px', top: '360px', width: '540px' } }, ctaGroup);
laurel2.src = '/x-cut/assets/laurel.png';
const zero = $('div', { cls: 'abs serif', text: '$0', style: { left: 0, top: '455px', width: '1080px', textAlign: 'center', fontSize: '250px', fontWeight: 600, lineHeight: '1', color: C.lInk, letterSpacing: '-0.03em', fontVariantNumeric: 'lining-nums' } }, ctaGroup);
const freeStamp = $('div', { cls: 'abs mono', text: '100% FREE · OPEN SOURCE', style: { left: '50%', top: '800px', padding: '14px 26px', background: C.lInk, color: C.lPage, fontSize: '32px', fontWeight: 600, letterSpacing: '0.14em', whiteSpace: 'nowrap' } }, ctaL);
function ctaButton(top, primary, titleHtml, url) {
  const b = $('div', { cls: 'abs', style: { left: '140px', top: `${top}px`, width: '800px', height: '150px', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: primary ? C.lInk : C.lRaised, border: `3px solid ${C.lInk}`, color: primary ? C.lPage : C.lInk, boxShadow: '0 14px 30px rgba(60,40,15,.18)' } }, ctaL);
  const ttl = $('div', { html: titleHtml, style: { fontWeight: 800, fontSize: '52px', letterSpacing: '-0.01em' } }, b);
  $('div', { cls: 'mono', text: url, style: { fontSize: '28px', color: primary ? C.lHair : C.lMuted } }, b);
  return { b, ttl };
}
const BTN1 = ctaButton(452, true, 'Try it free&nbsp;&nbsp;→', 'vkandil.github.io/Certamen');
const BTN2 = ctaButton(632, false, '<span class="star">☆</span>&nbsp;Star it on GitHub', 'github.com/Vkandil/Certamen');
const starEl = BTN2.ttl.querySelector('.star');
const ctaTag = $('div', { cls: 'abs', text: 'No account. No paywall. Bring your own OpenRouter key.', style: { left: 0, top: '814px', width: '1080px', textAlign: 'center', fontSize: '31px', fontWeight: 700, color: C.lMuted } }, ctaL);
const cursor = $s('svg', { width: 54, height: 54, viewBox: '0 0 24 24', style: 'position:absolute;left:0;top:0;z-index:60' }, ctaL);
$s('path', { d: 'M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L18 13.3 Z', fill: C.lInk, stroke: '#fff', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, cursor);
const plusOne = $('div', { cls: 'abs', text: '+1 ★', style: { fontWeight: 900, fontSize: '44px', color: P[1], zIndex: 61 } }, ctaL);
let STAR_XY = [300, 690];
function initCTA() {
  const r = starEl.getBoundingClientRect();
  STAR_XY = [r.left + r.width / 2, r.top + r.height / 2];
  burst(ctaL, { t0: CTA0 + 3.3, x: STAR_XY[0], y: STAR_XY[1], n: 22, colors: [P[1], P[0], P[2], P[3]], speed: [400, 1000], size: [5, 10], life: 0.7, g: 500, seed: 700 });
  burst(ctaL, { t0: CTA0 + 0.88, x: 540, y: 560, n: 26, colors: [...P, C.lInk], speed: [600, 1400], size: [5, 11], life: 0.75, g: 600, seed: 701 });
}
function updateCTA(t) {
  const on = t >= CTA0 - 0.05 && t < S('what2') - 0.04;
  show(ctaL, on);
  if (!on) return;
  const c = t - CTA0;
  const pB = inOutCubic(map(c, 2.0, 2.45)); // phase B: buttons
  const outA = map(c, 2.0, 2.25);
  const tp = spring(c, 2.8, 0.6); T(ctaTitle, { y: -40 * (1 - tp) - 40 * outA, op: map(c, 0, 0.06) * (1 - outA) });
  CROSSED.forEach((x) => {
    const p = spring(c - x.t, 3, 0.55);
    T(x.el, { s: lerp(1.6, 1, p), op: map(c, x.t, x.t + 0.04) * (1 - 0.45 * map(c, 0.85, 1.0)) * (1 - outA), y: -40 * outA });
    T(x.slash, { sx: outExpo(map(c, x.t + 0.12, x.t + 0.24)), r: -14, op: (1 - outA) * map(c, x.t + 0.12, x.t + 0.14), y: -40 * outA });
  });
  const lp = outCubic(map(c, 0.8, 1.25));
  laurel2.style.clipPath = `inset(${(100 - 100 * lp).toFixed(1)}% 0 0 0)`;
  const zp = outExpo(map(c, 0.85, 1.03));
  T(zero, { s: lerp(2.4, 1, zp) * (1 + 0.04 * wobble(c - 1.03, 8, 20)), op: map(c, 0.85, 0.89), blur: 12 * (1 - zp) });
  ctaGroup.style.transform = `translateY(${(-354 * pB).toFixed(1)}px) scale(${lerp(1, 0.5, pB).toFixed(4)})`;
  const sp = outExpo(map(c, 1.17, 1.25));
  freeStamp.style.transform = `translate(-50%, ${(-420 * pB).toFixed(1)}px) rotate(-3deg) scale(${(lerp(1.8, 1, sp) * lerp(1, 0.8, pB)).toFixed(4)})`;
  freeStamp.style.opacity = map(c, 1.17, 1.21).toFixed(3);
  [[BTN1, 2.2], [BTN2, 2.35]].forEach(([b, t0]) => { const p = spring(c - t0, 2.6, 0.6); T(b.b, { y: 90 * (1 - p), op: map(c, t0, t0 + 0.08) }); });
  const tg = outCubic(map(c, 2.6, 2.9)); T(ctaTag, { y: 14 * (1 - tg), op: tg });
  // cursor clicks the star
  const mv = outCubic(map(c, 2.65, 3.22));
  const click = c >= 3.3;
  show(cursor, c >= 2.65);
  const [sx, sy] = STAR_XY;
  T(cursor, { x: lerp(1010, sx - 4, mv), y: lerp(1050, sy - 2, mv), s: c >= 3.26 && c < 3.4 ? 0.82 : 1, op: map(c, 2.65, 2.75) });
  const press = click ? 0.03 * punch(c - 3.3, 9, 18) : 0;
  BTN2.b.style.transform += ` scale(${(1 - press).toFixed(4)})`;
  starEl.textContent = click ? '★' : '☆';
  starEl.style.color = click ? P[1] : C.lInk;
  starEl.style.display = 'inline-block';
  starEl.style.transform = `scale(${(click ? 1 + 0.6 * decay(c - 3.3, 6) : 1).toFixed(3)})`;
  const pf = map(c, 3.32, 4.0);
  show(plusOne, c >= 3.32);
  T(plusOne, { x: sx + 20, y: sy - 40 - 90 * outCubic(pf), op: 1 - map(pf, 0.6, 1) });
}

/* ---------------------------------------------------------------- What would you charge? */
const askWords = [['What', 'what2'], ['would', 'would'], ['you', 'you'], ['charge?', 'charge2']];
const askLine1 = $('div', { cls: 'abs serif', style: { left: 0, top: '260px', width: '1080px', textAlign: 'center', fontSize: '128px', fontWeight: 600, lineHeight: '1.1', color: C.dInk } }, askL);
const askEls = askWords.map(([w, k], i) => { if (i === 2) $('br', {}, askLine1); const e = $('span', { text: w + ' ', style: { display: 'inline-block', marginRight: '0.22em' } }, askLine1); if (k === 'charge2') { e.style.fontStyle = 'italic'; e.style.color = C.hot; } return { e, k }; });
const replyBox = $('div', { cls: 'abs', style: { left: '120px', top: '620px', width: '840px', height: '104px', borderRadius: '52px', border: `2px solid ${C.dHair2}`, background: C.dSurface, display: 'flex', alignItems: 'center', padding: '0 40px', fontSize: '44px', fontWeight: 700, color: C.dInk } }, askL);
const replyTxt = $('span', {}, replyBox);
const replyCaret = $('span', { style: { display: 'inline-block', width: '4px', height: '50px', background: C.dInk, marginLeft: '4px' } }, replyBox);
const replyPh = $('span', { text: 'Reply with your price…', style: { color: C.dMuted, fontWeight: 500, position: 'absolute', left: '48px' } }, replyBox);
function updateAsk(t) {
  const on = t >= S('what2') - 0.04 && t < REP[0] - 0.05;
  show(askL, on);
  if (!on) return;
  askEls.forEach(({ e, k }) => { const p = spring(t - (S(k) - 0.04), 3, 0.55); T(e, { y: 50 * (1 - p), s: lerp(0.7, 1, p), op: map(t, S(k) - 0.04, S(k) + 0.02) }); });
  const bp = outExpo(map(t, S('what2') + 0.15, S('what2') + 0.5)); T(replyBox, { y: 30 * (1 - bp), op: bp });
  const typed = '$49/mo';
  const n = Math.max(0, Math.min(typed.length, Math.floor((t - (S('charge2') + 0.2)) * 16)));
  replyTxt.textContent = typed.slice(0, n);
  replyPh.style.display = n > 0 ? 'none' : '';
  replyCaret.style.opacity = (n > 0 && n < typed.length) || (t * 2) % 1 < 0.55 ? 1 : 0;
  T(askLine1, { s: 1 + 0.03 * (t - S('what2')) });
}

/* ================================================================ captions */
const EM = new Set(['saas', 'debate', 'hidden', 'arguments', 'apart', 'arbiter', 'rules', 'plan', 'customers', 'certamen', 'source', 'argue']);
const SHOUT = new Set(['nine', 'ninety', 'depends', 'free', 'clue', 'twenty']);
const CHUNKS = [
  ['i', 'ais'], ['what', 'saas'], ['gpt', 'dollars', 'chaos'], ['claude', 'nine2', 'chaos'], ['gemini', 'depends', 'chaos'], ['grok', 'free', 'chaos'],
  ['four2', 'ais2', 'chaos'], ['four3', 'answers', 'chaos'], ['zero', 'clue', 'chaos'],
  ['so', 'debate'], ['names', 'hidden'], ['only', 'arguments'], ['they', 'others'], ['logic', 'apart'], ['and', 'rules'],
  ['twenty', 'month'], ['one', 'plan'], ['raise', 'customers'], ['this', 'certamen'], ['open', 'source'], ['let', 'argue', 'chaos']
].map(([a, b, mode]) => ({ ws: words.slice(WD[a].i, WD[b].i + 1).filter((w) => w.t), mode }));
CHUNKS.forEach((c, i) => {
  c.in = i === 0 ? -1 : c.ws[0].s - 0.08;
  const next = CHUNKS[i + 1];
  c.out = next ? Math.min(next.ws[0].s - 0.1, c.ws[c.ws.length - 1].e + 0.7) : 99;
  c.dark = c.in < S('so') - 0.2 || c.in >= S('what2') - 0.1;
  c.el = $('div', { cls: 'chunk' }, capL);
  c.row = $('div', { cls: 'row' }, c.el);
  c.hl = $('div', { cls: 'hl' }, c.row);
  c.wEls = c.ws.map((w) => { const shout = SHOUT.has(w.k); const e = $('span', { cls: 'w' + (shout ? ' shout' : EM.has(w.k) ? ' em' : ''), text: w.t }, c.row); return { e, w, shout }; });
});
function measureCaptions() {
  CHUNKS.forEach((c) => { c.el.style.display = ''; c.pos = c.wEls.map((x) => ({ x: x.e.offsetLeft, w: x.e.offsetWidth })); c.fit = Math.min(1, 1010 / c.row.offsetWidth); c.el.style.display = 'none'; });
}
function updateCaptions(t) {
  const hideAll = (t >= FREEZE - 0.05 && t < S('so') - 0.1) || (t >= S('what2') - 0.1 && t < REP[0] - 0.08);
  CHUNKS.forEach((c, ci) => {
    const on = !hideAll && t >= c.in && t < c.out + 0.1;
    show(c.el, on);
    if (!on) return;
    const ink_ = c.dark ? C.dInk : C.lInk, page_ = c.dark ? C.dPage : C.lPage;
    const shadow = c.dark ? '0 3px 22px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.6)' : `0 2px 18px ${rgba(C.lPage, 0.95)}, 0 0 4px ${rgba(C.lPage, 0.95)}`;
    const q = map(t, c.out - 0.12, c.out + 0.08);
    let active = -1;
    c.wEls.forEach((x, i) => {
      const tau = ci === 0 ? 1 : t - (x.w.s - 0.06);
      const p = spring(tau, 3.0, 0.6);
      const jit = c.mode === 'chaos' ? 3 * vnoise(t * 7, i + ci) : 0;
      T(x.e, { y: 30 * (1 - p) - 16 * q, s: (0.82 + 0.18 * p) * (x.shout && t >= x.w.s ? 1 + 0.25 * decay(t - x.w.s, 6) : 1), r: jit, op: map(tau, 0, 0.08) * (1 - q), blur: 6 * (1 - map(tau, 0, 0.12)) });
      if (t >= x.w.s - 0.02 || (ci === 0 && i === 0)) active = i;
    });
    c.row.style.transform = `scale(${c.fit})`;
    c.wEls.forEach((x, i) => { x.e.style.color = i === active ? (x.shout && c.dark ? '#fff' : page_) : ink_; x.e.style.textShadow = i === active ? 'none' : shadow; });
    if (active >= 0) {
      const cur = c.pos[active], prev = c.pos[Math.max(0, active - 1)];
      const m = active === 0 ? 1 : outExpo(map(t, c.wEls[active].w.s - 0.02, c.wEls[active].w.s + 0.14));
      c.hl.style.left = `${lerp(prev.x, cur.x, m).toFixed(1)}px`; c.hl.style.width = `${lerp(prev.w, cur.w, m).toFixed(1)}px`;
      c.hl.style.background = c.wEls[active].shout && c.dark ? C.hot : ink_;
      T(c.hl, { sy: ci === 0 ? 1 : spring(t - c.wEls[0].w.s + 0.02, 3.2, 0.65), op: 1 - q, r: c.mode === 'chaos' ? 2.5 * vnoise(t * 6, ci) : 0 });
    } else c.hl.style.opacity = 0;
  });
}

/* ================================================================ frame */
function updateFX(t) {
  const fi = Math.floor(t * 60);
  const lightOn = t >= S('so') + 0.3 && t < S('what2') - 0.04;
  grain.style.opacity = lightOn ? 0.05 : 0.09;
  grain.style.backgroundPosition = `${Math.floor(hash(fi) * 256)}px ${Math.floor(hash(fi + 0.5) * 256)}px`;
  vignette.style.background = lightOn ? 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(80,55,20,.22) 100%)' : 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.6) 100%)';
}

window.renderFrame = (t) => {
  updateChaos(t);
  updateEnough(t);
  updateLight(t);
  updateArena(t);
  updateHud2(t);
  updateVerdict(t);
  updateTablet(t);
  updateCTA(t);
  updateAsk(t);
  updateBursts(t);
  updateCaptions(t);
  updateFX(t);
};

await document.fonts.ready;
for (const f of ['500 20px Inter', '700 20px Inter', '800 20px Inter', '900 20px Inter', '400 20px Gelasio', '600 20px Gelasio', 'italic 600 20px Gelasio', '700 20px Cinzel', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"']) await document.fonts.load(f);
await Promise.all([laurel, tablet].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = r)))));
for (const src of ['/x-cut/assets/arena.jpg', '/x-cut/assets/stone.jpg', '/x-cut/assets/helmet.png']) await new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = src; });
show(light, true); show(tabletL, true); light.style.clipPath = 'none';
initChisel();
initCTA();
measureCaptions();
window.DURATION = DUR;
window.renderFrame(0);
window.__ready = true;
