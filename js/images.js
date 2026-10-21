// Foto: ridimensionamento, miniature e colore dominante. Tutto in locale.

import { nearestColorName } from './rules.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasToBlob(c, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversione immagine non riuscita'))), type, quality);
  });
}

// Vero se l'immagine ha zone trasparenti: è un capo già scontornato
// (su iPhone: pressione lunga sul capo nella foto, poi "Copia").
function hasTransparency(c) {
  const ctx = c.getContext('2d');
  const step = Math.max(1, Math.floor(Math.min(c.width, c.height) / 64));
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) if (data[(y * c.width + x) * 4 + 3] < 250) return true;
  }
  return false;
}

// Ridimensiona. Un ritaglio trasparente resta PNG (il JPEG renderebbe nero lo sfondo).
export async function resizeImage(blob, max = 1280, quality = 0.85) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return hasTransparency(c) ? canvasToBlob(c, 'image/png') : canvasToBlob(c, 'image/jpeg', quality);
}

// JPEG su fondo bianco, per Gemini e per i fogli da condividere.
export async function toJpeg(blob, max = 1024, quality = 0.85) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return canvasToBlob(c, 'image/jpeg', quality);
}

export const isCutout = (blob) => blob?.type === 'image/png';

export const makeThumb = (blob) => resizeImage(blob, 360, 0.8);

// Immagine dagli appunti (capo copiato da Foto). Null se non ce n'è una.
export async function imageFromClipboard() {
  if (!navigator.clipboard?.read) return null;
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) return item.getType(type);
  }
  return null;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Colore del capo: k-means sui pixel, pesati verso il centro perché i bordi della foto
// sono quasi sempre sfondo. In un ritaglio contano solo i pixel non trasparenti.
export async function dominantColor(blob) {
  const bmp = await createImageBitmap(blob);
  const N = 48;
  const c = canvas(N, N);
  const cut = isCutout(blob);
  const f = cut ? 0 : 0.2;
  c.getContext('2d').drawImage(bmp, bmp.width * f, bmp.height * f, bmp.width * (1 - 2 * f), bmp.height * (1 - 2 * f), 0, 0, N, N);
  bmp.close?.();
  const px = c.getContext('2d').getImageData(0, 0, N, N).data;
  const points = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if (px[i + 3] < 128) continue;
      const r2 = ((x - N / 2) ** 2 + (y - N / 2) ** 2) / (N / 2) ** 2;
      points.push({ rgb: [px[i], px[i + 1], px[i + 2]], w: cut ? 1 : Math.exp(-2 * r2) });
    }
  }
  if (!points.length) return { rgb: [128, 128, 128], name: nearestColorName([128, 128, 128]) };
  let centers = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].map((p) => [...p.rgb]);
  let weights = [0, 0, 0];
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((ctr, k) => {
        const d = (p.rgb[0] - ctr[0]) ** 2 + (p.rgb[1] - ctr[1]) ** 2 + (p.rgb[2] - ctr[2]) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      });
      const s = sums[best];
      s[0] += p.rgb[0] * p.w; s[1] += p.rgb[1] * p.w; s[2] += p.rgb[2] * p.w; s[3] += p.w;
    }
    centers = sums.map((s, k) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[k]));
    weights = sums.map((s) => s[3]);
  }
  const rgb = centers[weights.indexOf(Math.max(...weights))].map(Math.round);
  return { rgb, name: nearestColorName(rgb) };
}
