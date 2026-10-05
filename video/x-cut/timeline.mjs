// Builds x-cut/data/timeline.json from the aligned voice-over.
// Shared by the page (visuals) and audio.py (score + SFX).
import { readFileSync, writeFileSync } from 'node:fs';

// CTA gap: the voice-over is split after "Open source." and GAP seconds are inserted for the call to action
const base = JSON.parse(readFileSync(new URL('./data/words_base.json', import.meta.url)));
const SPLIT = base.find((w) => w.k === 'source').e + 0.15;
export const GAP = 4.2;
const words = base.map((w) => (w.s >= SPLIT ? { ...w, s: +(w.s + GAP).toFixed(2), e: +(w.e + GAP).toFixed(2) } : w));
writeFileSync(new URL('./data/words.json', import.meta.url), JSON.stringify(words, null, 0));
const W = Object.fromEntries(words.map((w) => [w.k, w]));
const S = (k) => W[k].s;

export const DURATION = +(31.5 + GAP).toFixed(2);
const CTA0 = +(W.source.e + 0.12).toFixed(3);

// the four AIs of the hook (2×2 grid), with the price each one slams
const main = [
  { logo: 'openai', name: 'ChatGPT', say: '$9', unit: '/mo', sub: 'Go cheap. Win volume.', focus: S('gpt'), slam: S('nine') },
  { logo: 'claude', name: 'Claude', say: '$99', unit: '/mo', sub: 'Charge for the value.', focus: S('claude'), slam: S('ninety') },
  { logo: 'gemini', name: 'Gemini', say: 'IT DEPENDS.', unit: '', sub: 'On market, ICP, churn…', focus: S('gemini'), slam: S('depends'), small: true },
  { logo: 'grok', name: 'Grok', say: 'FREE.', unit: '', sub: 'Monetize later.', focus: S('grok'), slam: S('free') }
];
// end of the loop: the four windows slam back in
const reprise = [S('let') + 0.0, S('them2') + 0.04, S('argue') + 0.02, S('argue') + 0.26];

// swarm (Four AIs. Four answers. Zero clue.)
const swarmStart = S('four2') - 0.05, swarmEnd = S('enough') - 0.32;
const extraWins = [
  { logo: 'meta', name: 'Meta AI', say: '$19' }, { logo: 'mistral', name: 'Mistral', say: '$49/seat' },
  { logo: 'deepseek', name: 'DeepSeek', say: '$0.99' }, { logo: 'qwen', name: 'Qwen', say: '$299/yr' },
  { logo: 'meta', name: 'Meta AI', say: 'USAGE-BASED' }, { logo: 'mistral', name: 'Mistral', say: 'LIFETIME DEAL' },
  { logo: 'deepseek', name: 'DeepSeek', say: '$499' }, { logo: 'qwen', name: 'Qwen', say: 'FREEMIUM' }
];
const tagTexts = ['$0', '$5', '$19', '$29', '$49', '$79', '$149', '$999', 'PER SEAT', 'USAGE-BASED', 'FREEMIUM', 'TRIAL?', 'ANNUAL −20%', 'PAY WHAT YOU WANT', '$9.99', '$12'];
// spawn times accelerate toward the freeze
const n = extraWins.length + tagTexts.length;
const spawns = Array.from({ length: n }, (_, i) => +(swarmStart + (swarmEnd - swarmStart) * Math.pow(i / n, 0.72)).toFixed(3));
const swarm = spawns.map((t, i) => (i % 3 === 1 && extraWins.length ? { kind: 'win', t, ...extraWins.shift() } : { kind: 'tag', t, text: tagTexts.shift() ?? '$$$' }));

const sfx = [];
const cue = (t, type, gain = 1, extra = {}) => sfx.push({ t: +Math.max(0, t).toFixed(3), type, gain, ...extra });

// hook: slams already happening at frame 0, then rewind
cue(0.0, 'impact', 1.0);
cue(0.0, 'kaching', 0.5);
cue(0.18, 'slam', 0.6);
cue(0.55, 'rewind', 0.9);
cue(S('saas'), 'pulse', 0.6);
// the four answers
main.forEach((m, i) => {
  cue(m.focus - 0.12, 'whip', 0.7);
  cue(m.slam, 'slam', 1.0);
  if (m.say.startsWith('$')) cue(m.slam + 0.03, 'kaching', 0.75);
  if (i === 2) cue(S('it') - 0.35, 'sigh', 0.4);
});
cue(S('free') + 0.5, 'whoosh', 0.6);
// swarm
swarm.forEach((s, i) => cue(s.t, s.kind === 'win' ? 'pop' : i % 2 ? 'glitch' : 'tick', s.kind === 'win' ? 0.55 : 0.45));
cue(S('zero') - 0.6, 'riser', 0.8, { dur: S('enough') - 0.32 - (S('zero') - 0.6) });
cue(S('enough') - 0.32, 'tapestop', 0.9);
cue(S('enough'), 'boom', 0.75);
cue(S('enough'), 'slice', 0.45);
// arena
cue(S('so') - 0.05, 'open', 0.8);
cue(S('so') + 0.1, 'crowd', 0.35, { dur: 3.2 });
[0, 1, 2, 3].forEach((i) => cue(S('made') + 0.1 + i * 0.08, 'thud', 0.55));
[0, 1, 2, 3].forEach((i) => cue(S('names') + i * 0.08 + 0.18, 'flip', 0.6));
cue(S('hidden') + 0.12, 'shuffle', 0.55);
[0, 1, 2, 3].forEach((i) => cue(S('only') + i * 0.12, 'type3', 0.35));
cue(S('tear'), 'clash', 0.9);
cue(S('tear') + 0.05, 'rip', 0.7);
cue(S('others'), 'clash', 0.8);
cue(S('others') + 0.05, 'rip', 0.7);
cue(S('apart'), 'clash', 1.0);
cue(S('an') - 0.1, 'whoosh', 0.45);
cue(S('rules'), 'gavel', 1.0);
cue(S('twenty'), 'kaching', 0.8);
cue(S('twenty'), 'chime', 0.6, { note: 0 });
cue(S('one'), 'stamp', 0.55);
cue(S('raise'), 'stamp', 0.55);
for (let i = 0; i < 10; i++) cue(S('ten') + i * 0.07, 'tick', 0.35);
cue(S('customers') + 0.25, 'chime', 0.5, { note: 2 });
// Certamen
cue(S('this') - 0.05, 'whoosh', 0.6);
cue(S('this') + 0.12, 'stonethud', 1.0);
for (let i = 0; i < 8; i++) cue(S('certamen') + i * 0.06, 'chisel', 0.5);
cue(S('source') + 0.02, 'stamp', 0.9);
// CTA: price gag, then try / star
const c = (dt) => CTA0 + dt;
cue(c(0.0), 'whoosh', 0.6);
[0.15, 0.35, 0.55].forEach((dt) => { cue(c(dt), 'pop', 0.5); cue(c(dt + 0.12), 'slash', 0.6); });
cue(c(0.85), 'slam', 0.9);
cue(c(0.85), 'chime', 0.6, { note: 2 });
cue(c(1.25), 'stamp', 0.8);
cue(c(2.0), 'whoosh', 0.5);
cue(c(2.2), 'pop', 0.5);
cue(c(2.35), 'pop', 0.5);
cue(c(3.3), 'click', 0.8);
cue(c(3.32), 'chime', 0.7, { note: 1 });
// question + loop back
cue(S('what2') - 0.04, 'scratch', 0.8);
cue(S('what2') + 0.35, 'type3', 0.4);
reprise.forEach((t, i) => { cue(t, 'slam', 0.85); if (i !== 2) cue(t + 0.03, 'kaching', 0.4); });

const timeline = { duration: DURATION, main, reprise, swarm, sfx, cta: { t0: CTA0, split: SPLIT, gap: GAP } };
writeFileSync(new URL('./data/timeline.json', import.meta.url), JSON.stringify(timeline, null, 1));
console.log(`x-cut timeline: ${sfx.length} cues, ${swarm.length} swarm spawns, ${DURATION}s`);
