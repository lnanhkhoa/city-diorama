/// <reference types="node" />
/**
 * Each asset needs one reference image for Rodin Image-to-3D: a three-quarter
 * view, made by hand in Gemini (AI Studio) or ChatGPT from `imagePrompt` and saved as
 * `.rodin/refs/<name>.<png|jpg|jpeg|webp>`. One image is enough for Rodin; the
 * three-quarter view shows the most of any object.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { RodinAsset } from './assets';

export const REFS_DIR = '.rodin/refs';

// Formats the image tools download and Rodin accepts.
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

/** The saved reference image, whatever its extension. */
export function findRef(a: RodinAsset): string | undefined {
  return IMAGE_EXTS.map((ext) => `${REFS_DIR}/${a.name}.${ext}`).find(existsSync);
}

/**
 * Whether a saved reference really has a transparent background: all four
 * corner pixels of a PNG must be fully transparent. JPEG/WebP and painted
 * checkerboards fail.
 */
export function isTransparent(path: string): boolean {
  if (!path.endsWith('.png')) return false;
  const png = PNG.sync.read(readFileSync(path));
  const corners = [0, png.width - 1, (png.height - 1) * png.width, png.height * png.width - 1];
  return corners.every((i) => png.data[i * 4 + 3] === 0);
}

// Image-to-3D reconstructs clean silhouettes and solid volumes; shadows, ground
// planes, fine texture and extra objects all turn into wrong geometry.
const RULES = [
  'Square 1:1 image.',
  'Exactly one object, complete and uncropped, centred, filling about 70% of the image with even empty margin on every side.',
  // Asking Gemini for transparency makes it paint a fake checkerboard; Rodin removes a plain white background itself.
  'Background: plain solid pure white (#ffffff), one flat colour edge to edge. No checkerboard, no gradient, no vignette. ' +
    'No ground plane, no floor, no horizon, no cast shadow, no reflection.',
  'Lighting: soft, even, shadowless studio light from all sides; no side of the object in dark shadow; no shiny highlights.',
  'Style: a clean stylised 3D miniature model, like a museum scale model: solid smooth volumes, crisp edges, simplified details. ' +
    'Not a photo, not a painting, no outlines or line art, no fine surface texture, no grain or noise.',
  'Colours: matte and flat, using only the colour areas listed; each area one even colour with no gradients, patterns or dirt.',
];

/** Prompt for the reference image (Gemini or ChatGPT). Attach the poster crop first when the asset has one. */
export function imagePrompt(a: RodinAsset): string {
  const exclude = ['text, labels or watermark', 'people or animals not described', 'other buildings or objects', ...(a.exclude ?? [])];
  return [
    a.poster
      ? `I attached a picture that shows ${a.subject} inside a city diorama. Make a new image of that same subject alone, ` +
        'with the same shape and proportions, following every rule below.'
      : `Make an image of ${a.subject}, following every rule below.`,
    '',
    `Subject: ${a.look}`,
    '',
    'Colour areas (use exactly these, nothing else):',
    ...a.colours.map((c) => `- ${c}`),
    '',
    "View: camera turned 45 degrees between the front and the object's left side, raised about 25 degrees above it and looking down. " +
      'Almost no perspective distortion, like a long telephoto lens.',
    '',
    ...RULES.map((r) => `- ${r}`),
    `- Do not include: ${exclude.join(', ')}.`,
  ].join('\n');
}

/** What to look for before saving a generated image. */
export const REJECT_IF = [
  'any part of the object is cut off by the image edge',
  'there is a ground, floor, shadow, water or base that was not described',
  'the background is coloured, patterned or a checkerboard painted into the image (plain white is fine: Rodin removes it)',
  'colours other than the listed areas appear, or an area has patterns or gradients',
  'the object is drawn with outlines or looks like a painting or a photo',
];

/** Write the poster crop to attach to the image prompt, upscaled bilinearly so its long side is 768 px. */
export function writePosterCrop(a: RodinAsset): string {
  const { name, crop } = a.poster!;
  const src = jpeg.decode(readFileSync(`assets/${name}.jpeg`), { useTArray: true, formatAsRGBA: true });
  const [cx, cy, cw, ch] = crop;
  if (cx < 0 || cy < 0 || cx + cw > src.width || cy + ch > src.height) throw new Error(`${a.name}: crop is outside assets/${name}.jpeg`);
  const scale = 768 / Math.max(cw, ch);
  const png = new PNG({ width: Math.round(cw * scale), height: Math.round(ch * scale) });
  for (let y = 0; y < png.height; y++) {
    const sy = Math.min(ch - 1.001, Math.max(0, (y + 0.5) / scale - 0.5)) + cy;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let x = 0; x < png.width; x++) {
      const sx = Math.min(cw - 1.001, Math.max(0, (x + 0.5) / scale - 0.5)) + cx;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const i00 = (y0 * src.width + x0) * 4 + c;
        const i01 = i00 + src.width * 4;
        const top = src.data[i00] * (1 - fx) + src.data[i00 + 4] * fx;
        const bottom = src.data[i01] * (1 - fx) + src.data[i01 + 4] * fx;
        png.data[(y * png.width + x) * 4 + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  const out = `${REFS_DIR}/${a.name}.poster.png`;
  mkdirSync(REFS_DIR, { recursive: true });
  writeFileSync(out, PNG.sync.write(png));
  return out;
}
