// Foglio prova (persona a sinistra, capi numerati a destra) e testi per Gemini o ChatGPT.

import { COLOR_RGB } from './rules.js';
import { canvasToBlob } from './images.js';

// La descrizione della persona sta nelle impostazioni, sul dispositivo: il codice è pubblico.
export const PERSON_PLACEHOLDER = 'es. short dark hair, beard, 180 cm, slim build';
export const DEFAULT_RULES = 'nothing tucked into the trousers, no tight shirts, no skinny trousers, hems resting on the shoes, no logos';

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export const garmentLabel = (it) => it.descriptionEn?.trim() || it.name;

function fitText(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

export async function buildSheet(refPhoto, garments) {
  const H = 1600;
  const PAD = 30;
  const CELL = 560;
  const ref = await createImageBitmap(refPhoto);
  const refW = Math.round((ref.width * H) / ref.height);
  const rows = Math.ceil(garments.length / 2);
  const cellH = Math.floor((H - (rows + 1) * PAD) / rows);
  const W = refW + PAD + 2 * CELL + PAD;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ref, 0, 0, refW, H);
  ref.close?.();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, refW, 70);
  ctx.fillStyle = '#111';
  ctx.font = '38px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('ME (face and body reference)', 20, 36);

  ctx.font = '28px Helvetica, Arial, sans-serif';
  for (const [i, it] of garments.entries()) {
    const cx = refW + PAD + (i % 2) * CELL;
    const cy = PAD + Math.floor(i / 2) * (cellH + PAD);
    const boxW = CELL - 30;
    const boxH = cellH - 60;
    let drawnH = boxH;
    if (it.photo) {
      const bmp = await createImageBitmap(it.photo);
      const k = Math.min(boxW / bmp.width, boxH / bmp.height);
      const w = bmp.width * k;
      drawnH = bmp.height * k;
      ctx.drawImage(bmp, cx + (CELL - w) / 2, cy, w, drawnH);
      bmp.close?.();
    } else {
      const [r, g, b] = COLOR_RGB[it.color] ?? [150, 150, 150];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      drawnH = Math.min(boxH, boxW);
      ctx.fillRect(cx + 15, cy, boxW, drawnH);
    }
    ctx.fillStyle = '#111';
    ctx.fillText(fitText(ctx, `${i + 1}  ${garmentLabel(it)}`, CELL - 20), cx + 10, cy + drawnH + 28);
  }
  return canvasToBlob(c, 'image/jpeg', 0.9);
}

const count = (n) => NUMBERS[n] ?? String(n);
const list = (garments) => garments.map((it, i) => `${i + 1} ${garmentLabel(it)}`).join('\n');

export function tryOnPrompt(garments, { person = '', rules = DEFAULT_RULES, city = 'Stockholm' } = {}) {
  return [
    "The image I'm attaching is a reference sheet.",
    `LEFT: me. Use it only for my face and body${person ? ` (${person})` : ''}. Ignore the clothes I am wearing there.`,
    `RIGHT: ${count(garments.length)} numbered garments:`,
    list(garments),
    `Generate one vertical (2:3) full-body street-style photo of me wearing exactly these ${count(garments.length)} garments, keeping their colour, fabric and details. Replace ALL the clothing from the reference photo. Head to shoes visible. A street in ${city}, natural daylight.`,
    `Rules: ${rules}. Keep my face identical to the reference.`,
  ].join('\n');
}

export function fixPrompt(garments) {
  return [
    `Wrong clothes. Keep my face, hair, body, pose and the background exactly as in this image, but replace ALL my clothing with the ${count(garments.length)} garments from the right side of the sheet:`,
    list(garments),
    'Anything I am wearing that is not in this list must disappear completely.',
  ].join('\n');
}
