// Builds data/timeline.json from the aligned voice-over words.
// The page (visuals) and audio/build_audio.py (music + SFX) both read it,
// so every cut, slam and tick stays locked to the narrator.
import { readFileSync, writeFileSync } from 'node:fs';

const words = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url)));
const W = Object.fromEntries(words.map((w) => [w.k, w]));
const S = (k) => W[k].s;
const E = (k) => W[k].e;

export const DURATION = 47.0;

// Question typed in the input bar (act I). Each entry erases the previous text first.
const typing = [
  { text: 'Is this the right call?', t0: 0.55, cps: 26 },
  { text: 'Should I take the offer in Berlin?', t0: S('a2') + 0.04, cps: 40, eraseAt: S('a2') - 0.1 },
  { text: 'Which market do we enter first?', t0: S('a3') + 0.04, cps: 38, eraseAt: S('a3') - 0.1 },
  { text: 'Is this migration safe to run in prod?', t0: S('code') + 0.04, cps: 36, eraseAt: S('code') - 0.1 }
];
const typeTimes = [];
for (const seg of typing) {
  for (let i = 0; i < seg.text.length; i++) {
    if (seg.text[i] !== ' ') typeTimes.push(+(seg.t0 + i / seg.cps).toFixed(3));
  }
}

// Extra contradicting chat windows during the escalation (act II).
const extras = [
  { logo: 'meta', name: 'Meta AI', say: 'MAYBE.', t: 13.42 },
  { logo: 'mistral', name: 'Mistral', say: 'ABSOLUTELY.', t: 13.72 },
  { logo: 'grok', name: 'Grok', say: 'NOPE.', t: 14.0 },
  { logo: 'deepseek', name: 'DeepSeek', say: 'YES, BUT…', t: 14.26 },
  { logo: 'qwen', name: 'Qwen', say: 'UNCLEAR.', t: 14.5 },
  { logo: 'openai', name: 'ChatGPT', say: 'DEFINITELY.', t: 15.62 },
  { logo: 'claude', name: 'Claude', say: 'TOO RISKY.', t: 15.76 },
  { logo: 'meta', name: 'Meta AI', say: 'PROBABLY.', t: 15.88 },
  { logo: 'gemini', name: 'Gemini', say: 'SOURCES?', t: 15.98 },
  { logo: 'mistral', name: 'Mistral', say: 'NEVER.', t: 16.06 },
  { logo: 'grok', name: 'Grok', say: 'OBVIOUSLY.', t: 16.13 },
  { logo: 'deepseek', name: 'DeepSeek', say: 'NO.', t: 16.2 }
];

// Sound-effect cues. Types are implemented in audio/build_audio.py.
const sfx = [];
const cue = (t, type, gain = 1, extra = {}) => sfx.push({ t: +t.toFixed(3), type, gain, ...extra });

cue(0.05, 'drawline', 0.5);
cue(S('matters') + 0.02, 'pulse', 0.7);
for (const k of ['a2', 'a3', 'code']) cue(S(k) - 0.06, 'roll', 0.55);
cue(S('so') + 0.02, 'enter', 0.8);
cue(S('so') + 0.18, 'whoosh', 0.7);
[0, 1, 2].forEach((i) => cue(S('so') + 0.17 + i * 0.07, 'pop', 0.55));
cue(S('gpt'), 'focus', 0.5);
cue(S('yes'), 'slam', 1.0);
cue(S('claude'), 'focus', 0.5);
cue(S('no'), 'slam', 1.0);
cue(S('gemini'), 'focus', 0.5);
cue(S('depends'), 'slam', 0.85);
extras.forEach((x, i) => cue(x.t, i < 5 ? 'pop' : 'glitch', i < 5 ? 0.55 : 0.6));
cue(15.1, 'riser', 0.8, { dur: 1.0 });
cue(16.1, 'tapestop', 0.9);
cue(S('enough'), 'boom', 0.75);
cue(S('enough'), 'slice', 0.45);
cue(S('lets') - 0.02, 'open', 0.8);
[0, 1, 2, 3].forEach((i) => cue(S('lets') + 0.55 + i * 0.07, 'thud', 0.5));
cue(S('honestly'), 'tick', 0.6);
[0, 1, 2, 3].forEach((i) => cue(S('no2') + i * 0.09 + 0.2, 'flip', 0.6));
cue(S('no2') + 0.55, 'shuffle', 0.6);
[0, 1, 2, 3].forEach((i) => cue(S('only') + i * 0.1, 'type3', 0.35));
cue(S('this'), 'whoosh', 0.6);
cue(S('is') + 0.02, 'lock', 0.8);
for (let i = 0; i < 8; i++) cue(S('certamen') + i * 0.075, 'chisel', 0.55);
cue(S('latin') - 0.1, 'drawline', 0.4);
cue(S('contest'), 'tick', 0.5);
cue(S('every') - 0.5, 'whoosh', 0.5);
[0, 1, 2, 3].forEach((i) => cue(S('every') + i * 0.06, 'open', 0.35));
cue(S('every') + 0.15, 'stream', 0.35, { dur: 1.5 });
[0, 1, 2, 3].forEach((i) => cue(S('then') + 0.07 + i * 0.25 + 0.45, 'ping', 0.5, { note: i }));
cue(S('an') - 0.15, 'whoosh', 0.45);
cue(S('rules'), 'gavel', 1.0);
cue(S('consensus'), 'chime', 0.6, { note: 0 });
cue(S('dissent'), 'chime', 0.6, { note: 1 });
cue(S('and'), 'chime', 0.6, { note: 2 });
cue(S('verify') + 0.1, 'tick', 0.5);
cue(S('no3') - 0.55, 'whip', 0.9);
cue(S('backend') + 0.02, 'slash', 0.9);
cue(S('backend') + 0.2, 'crumble', 0.6);
cue(S('no4') - 0.2, 'pop', 0.5);
cue(S('account') + 0.02, 'slash', 0.9);
cue(S('account') + 0.2, 'crumble', 0.6);
cue(S('your') + 0.02, 'drawline', 0.5);
cue(S('your2') + 0.05, 'whoosh', 0.4);
cue(S('key') + 0.0, 'lock', 0.9);
cue(S('open') - 0.02, 'type3', 0.5);
cue(S('source') + 0.02, 'stamp', 0.9);
cue(S('let') - 0.05, 'whoosh', 0.7);
cue(S('models') + 0.05, 'clash', 0.6);
cue(S('argue'), 'clash', 0.9);
cue(S('get') - 0.05, 'riser', 0.5, { dur: 0.35 });
cue(S('verdict'), 'hit', 1.0);
cue(43.75, 'drawline', 0.35);

const timeline = { duration: DURATION, typing, typeTimes, extras, sfx };
writeFileSync(new URL('../data/timeline.json', import.meta.url), JSON.stringify(timeline, null, 1));
console.log(`timeline: ${sfx.length} sfx cues, ${typeTimes.length} key ticks, duration ${DURATION}s`);
