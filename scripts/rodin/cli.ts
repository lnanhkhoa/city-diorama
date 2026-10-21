/// <reference types="node" />
/**
 * Batch flow for Rodin shapes (docs/rodin-pipeline.md). Manifest: ./assets.ts.
 *
 *   bun run rodin status           what each asset needs next (default)
 *   bun run rodin brief [names…]   .rodin/BRIEF.md: Gemini chat prompts for missing
 *                                  reference images, Rodin upload lists for the rest
 *   bun run rodin bake [names…]    bake every new or changed GLB, in parallel
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ASSETS, type RodinAsset } from './assets';
import { bakeShape } from './bake';
import { findRef, imagePrompt, isTransparent, REFS_DIR, REJECT_IF, writePosterCrop } from './prompts';

const RODIN_DIR = '.rodin';
const SHAPES_DIR = 'src/cities/shapes';

const glbPath = (a: RodinAsset) => `${RODIN_DIR}/${a.from ?? a.name}.glb`;
const shapePath = (a: RodinAsset) => `${SHAPES_DIR}/${a.name}.shape.ts`;

/** Identifies a bake: the GLB content plus every option that changes the output. */
function stamp(a: RodinAsset): string {
  const sha = createHash('sha256').update(readFileSync(glbPath(a))).digest('hex').slice(0, 16);
  return `sha256=${sha} tris=${a.tris} parts=${a.colours.length} clean=${a.clean ?? 2}`;
}

type State = 'need refs' | 'need glb' | 'ready' | 'stale' | 'baked' | 'placed';

function stateOf(a: RodinAsset): State {
  if (!existsSync(glbPath(a))) return findRef(a) ? 'need glb' : 'need refs';
  if (!existsSync(shapePath(a))) return 'ready';
  const baked = /^\/\/ rodin: (.*)$/m.exec(readFileSync(shapePath(a), 'utf8'))?.[1];
  if (baked !== stamp(a)) return 'stale';
  const placed = a.cities.every((slug) => readFileSync(`src/cities/list/${slug}.ts`, 'utf8').includes(`shapes/${a.name}.shape'`));
  return placed ? 'placed' : 'baked';
}

const NEXT: Record<State, string> = {
  'need refs': 'Gemini image (bun run rodin brief)',
  'need glb': 'Image-to-3D in Rodin (bun run rodin brief)',
  ready: 'bun run rodin bake',
  stale: 'bun run rodin bake',
  baked: 'place in city',
  placed: 'done',
};

function status(): void {
  const rows = ASSETS.map((a) => {
    const state = stateOf(a);
    return [a.name, a.cities.join(', '), state, NEXT[state]];
  });
  const head = ['asset', 'cities', 'state', 'next'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  for (const r of [head, ...rows]) console.log(r.map((c, i) => c.padEnd(widths[i])).join('  '));
  const known = new Set(ASSETS.map((a) => `${a.name}.glb`));
  const strays = existsSync(RODIN_DIR) ? readdirSync(RODIN_DIR).filter((f) => f.endsWith('.glb') && !known.has(f)) : [];
  if (strays.length) console.log(`\nnot in scripts/rodin/assets.ts (rename or add): ${strays.join(', ')}`);
}

/** Run `fn` over `items`, at most `limit` at a time. Resolves false if any call threw. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<boolean> {
  const queue = [...items];
  let ok = true;
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try {
        await fn(item);
      } catch (err) {
        ok = false;
        console.error(err instanceof Error ? err.message : err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(items.length, limit) }, worker));
  return ok;
}

function select(names: string[], fallback: (a: RodinAsset) => boolean): RodinAsset[] {
  const unknown = names.filter((n) => !ASSETS.some((a) => a.name === n));
  if (unknown.length) throw new Error(`not in scripts/rodin/assets.ts: ${unknown.join(', ')}`);
  return names.length ? ASSETS.filter((a) => names.includes(a.name)) : ASSETS.filter(fallback);
}

/** Gemini prompts for assets missing a reference image, Rodin upload lists for the rest. */
function brief(names: string[]): void {
  const todo = select(names, (a) => ['need refs', 'need glb'].includes(stateOf(a)));
  const gemini = todo.filter((a) => !findRef(a));
  const rodin = todo.filter((a) => findRef(a));

  const geminiSections = gemini.map((a) =>
    [
      `### ${a.name} → \`${REFS_DIR}/${a.name}.png\``,
      '',
      `For ${a.cities.join(', ')}; replaces ${a.replaces}.` + (a.poster ? ` Attach \`${writePosterCrop(a)}\` with the prompt.` : ''),
      '',
      '```text',
      imagePrompt(a),
      '```',
    ].join('\n'),
  );
  const rodinSections = rodin.map((a) => {
    const ref = findRef(a)!;
    return `- \`${ref}\` → \`${glbPath(a)}\`${isTransparent(ref) ? '' : ' (opaque background: paint out the Gemini watermark, bottom right, before uploading)'}`;
  });

  const doc = [
    `# Rodin batch: ${gemini.length} assets need an image, ${rodin.length} ready for Rodin`,
    '',
    '## 1. Reference images in Gemini',
    '',
    'One prompt per asset, each in its own Gemini chat; several can run at once. Save each image under the name shown',
    '(PNG, JPG or WebP; the name before the extension matters). Regenerate instead of saving when:',
    '',
    ...REJECT_IF.map((r) => `- ${r}`),
    '',
    gemini.length ? geminiSections.join('\n\n') : 'Nothing: every asset in this batch has its image.',
    '',
    '## 2. Image-to-3D in Rodin',
    '',
    'One Rodin tab per asset, all at once: **Image to 3D**, upload the image, no prompt; **Gen-2.5**, effort **High**,',
    'presets **Use Recommended**, Agentic Mode off. Check the geometry preview (one object, no ground disc) and **Confirm**;',
    'then **Generate** the material and **Confirm** it too (without it the model is untextured and cannot be baked).',
    'Download **GLB** (not FBX): the zip holds `base_basic_pbr.glb`; save that one under the name shown. Then run',
    '`bun run rodin bake`.',
    '',
    rodin.length ? rodinSections.join('\n') : 'Nothing yet: run `bun run rodin brief` again once images are saved.',
    '',
  ].join('\n');
  mkdirSync(RODIN_DIR, { recursive: true });
  writeFileSync(`${RODIN_DIR}/BRIEF.md`, doc);
  console.log(`${RODIN_DIR}/BRIEF.md: ${gemini.length} assets need a Gemini image, ${rodin.length} ready for Rodin`);
}

/** Child-process entry: bake one asset and write its module. */
async function bakeOne(a: RodinAsset): Promise<void> {
  const r = await bakeShape(new Uint8Array(readFileSync(glbPath(a))), { tris: a.tris, parts: a.colours.length, clean: a.clean ?? 2 });
  const total = r.parts.reduce((s, p) => s + p.tris, 0);
  const src = `// rodin: ${stamp(a)}
// Generated by \`bun run rodin bake\` from ${glbPath(a)}. Regenerate instead of editing.
// Replaces ${a.replaces}.
// Parts, darkest first (sampled colour; pick one palette material each):
${r.parts.map((p, i) => `//   ${i}: ${p.hex}, ${p.tris} tris`).join('\n')}
import type { ShapeData } from '../../kit';

const shape: ShapeData = ${JSON.stringify(r.data, null, 2)};

export default shape;
`;
  mkdirSync(SHAPES_DIR, { recursive: true });
  writeFileSync(shapePath(a), src);
  console.log(`${a.name}: ${total} tris from ${r.sourceTris}, size ${r.data.size.join(' x ')}; parts ${r.parts.map((p) => p.hex).join(' ')}`);
}

/** Bakes run as separate processes so large meshes use every core. */
async function bake(names: string[]): Promise<boolean> {
  const todo = select(names, (a) => ['ready', 'stale'].includes(stateOf(a)));
  const missing = todo.filter((a) => !existsSync(glbPath(a)));
  if (missing.length) throw new Error(`no GLB yet for: ${missing.map((a) => a.name).join(', ')}`);
  if (!todo.length) {
    console.log('nothing to bake; every GLB is already baked');
    return true;
  }
  const self = fileURLToPath(import.meta.url);
  return pool(todo, availableParallelism(), async (a) => {
    const { promise, resolve } = Promise.withResolvers<number | null>();
    const child = spawn(process.execPath, [self, '_bake', a.name]);
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', resolve);
    if ((await promise) !== 0) throw new Error(`${a.name}: FAILED\n${out.trimEnd()}`);
    console.log(out.trimEnd());
  });
}

if (new Set(ASSETS.map((a) => a.name)).size !== ASSETS.length) throw new Error('duplicate asset names in scripts/rodin/assets.ts');

const [command = 'status', ...args] = process.argv.slice(2);
if (command === 'status') status();
else if (command === 'brief') brief(args);
else if (command === 'bake') process.exitCode = (await bake(args)) ? 0 : 1;
else if (command === '_bake') await bakeOne(ASSETS.find((a) => a.name === args[0])!);
else {
  console.error('usage: bun run rodin [status | brief [names…] | bake [names…]]');
  process.exitCode = 1;
}
