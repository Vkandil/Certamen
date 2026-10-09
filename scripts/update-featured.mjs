// Weekly refresh of public/featured-models.json (run by .github/workflows/featured-models.yml).
// Recomputes the suggested lineups from the live OpenRouter catalog with the same code the app uses,
// keeps the hand-edited pin/exclude/labs lists, and drops pins that left the catalog.
//
//   node --experimental-strip-types scripts/update-featured.mjs [--catalog models.json]
import { readFile, writeFile } from 'node:fs/promises';
import { isTextModel, normalizeModel } from '../src/domain/catalog.ts';
import { buildPreset, flagshipFor, MAJOR_LABS } from '../src/domain/lineup.ts';

const FILE = new URL('../public/featured-models.json', import.meta.url);
const catalogArg = process.argv.indexOf('--catalog');

async function loadCatalog() {
  if (catalogArg > -1) return JSON.parse(await readFile(process.argv[catalogArg + 1], 'utf8'));
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) throw new Error(`OpenRouter catalog unavailable (${response.status})`);
  return response.json();
}

const raw = await loadCatalog();
const models = (raw.data ?? []).map(normalizeModel).filter(isTextModel);
if (models.length === 0) throw new Error('Empty catalog, refusing to overwrite featured-models.json');

const current = JSON.parse(await readFile(FILE, 'utf8'));
const ids = new Set(models.map((model) => model.id));
const overlay = {
  pin: (current.pin ?? []).filter((id) => ids.has(id)),
  exclude: current.exclude ?? [],
  labs: current.labs ?? []
};
const ctx = { models, featured: overlay };
const snapshot = Object.fromEntries(['best', 'fast', 'open'].map((kind) => [kind, buildPreset(kind, ctx).map((item) => item.model.id)]));
// per-lab picks, so a reviewer can spot a wrong flagship at a glance
snapshot.flagships = Object.fromEntries(MAJOR_LABS.map((lab) => [lab, flagshipFor(models, lab, overlay)?.id ?? null]).filter(([, id]) => id));

const next = { updatedAt: current.updatedAt, ...overlay, snapshot };
if (JSON.stringify(next) === JSON.stringify(current)) {
  console.log('featured-models.json is up to date');
} else {
  next.updatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log('featured-models.json updated:', JSON.stringify(snapshot));
}
