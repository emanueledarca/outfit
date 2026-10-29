// Lettura di capo ed etichetta con l'API Gemini, piano gratuito.
// Sul piano gratuito Google può usare i contenuti inviati: qui partono solo foto di vestiti.

import { CATEGORIES, COLORS } from './rules.js';
import { FABRICS, FAMILIES, TARGET_BRIEF } from './style.js';
import { blobToBase64, toJpeg } from './images.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

async function generate(key, model, parts) {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error('Quota gratuita di Gemini esaurita per ora: riprova più tardi o compila a mano.');
    if (/API key/i.test(body.error?.message ?? '')) throw new Error('Chiave Gemini non valida: controllala nelle impostazioni.');
    throw new Error(body.error?.message ?? `Gemini ha risposto ${res.status}`);
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Risposta di Gemini non leggibile: riprova.');
  }
}

export async function testKey(key, model) {
  const out = await generate(key, model, [{ text: 'Rispondi esattamente con il JSON {"ok": true}.' }]);
  if (!out?.ok) throw new Error('La chiave risponde, ma in modo inatteso.');
  return true;
}

const PROMPT = `Analizza il capo d'abbigliamento nella prima foto e, se c'è, la sua etichetta nella seconda.
Rispondi solo con un oggetto JSON con questi campi:
- "nome": nome breve in italiano, per esempio "Cappotto tweed marrone";
- "descrizione_en": descrizione breve in inglese per un generatore di immagini, per esempio "brown herringbone tweed overcoat";
- "categoria": una tra ${Object.keys(CATEGORIES).join(', ')};
- "colore": il colore principale, uno tra ${COLORS.map((c) => c[0]).join(', ')};
- "fantasia": true se il capo ha un motivo evidente (righe, quadri, jacquard), altrimenti false;
- "logo": true se ha un logo o una stampa grafica ben visibile, altrimenti false;
- "tessuto": uno tra ${Object.keys(FABRICS).join(', ')};
- "vestibilita": per le scarpe "slanciata", "media" o "robusta"; per tutto il resto "aderente", "regolare" o "ampio";
- "stili": da una a due famiglie tra ${Object.keys(FAMILIES).join(', ')};
- "aderenza_stile": da 1 a 5, quanto il capo sta nello stile di chi lo indossa, descritto così: ${TARGET_BRIEF};
- "motivo_stile": se aderenza_stile è 1 o 2, il motivo in al massimo sei parole, altrimenti "";
- "composizione": dall'etichetta, per esempio "80% lana, 20% poliammide", oppure "";
- "lavaggio": istruzioni brevi in italiano dai simboli dell'etichetta, per esempio "lana 30°, no asciugatrice", oppure "";
- "taglia": dall'etichetta, oppure "";
- "marca": dall'etichetta, oppure "";
- "calore": da 1 (leggerissimo) a 5 (pesante da inverno);
- "formalita": da 1 (sportivo) a 5 (elegante);
- "impermeabile": true solo se il capo è fatto per la pioggia.
Se un dato non si legge, usa una stringa vuota.`;

const VOLUMES = { aderente: 1, slanciata: 1, regolare: 2, media: 2, ampio: 3, robusta: 3 };

// Una stringa vuota non è zero: vuol dire "non letto".
const clamp = (n, lo, hi, fallback) => (n !== '' && n != null && Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : fallback);

export async function analyzeGarment(key, model, photo, label) {
  const parts = [{ text: PROMPT }];
  for (const blob of [photo, label].filter(Boolean)) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: await blobToBase64(await toJpeg(blob)) } });
  }
  const r = await generate(key, model, parts);
  const colorNames = new Set(COLORS.map((c) => c[0]));
  return {
    name: String(r.nome ?? '').trim(),
    descriptionEn: String(r.descrizione_en ?? '').trim(),
    category: CATEGORIES[r.categoria] ? r.categoria : null,
    color: colorNames.has(r.colore) ? r.colore : null,
    pattern: Boolean(r.fantasia),
    composition: String(r.composizione ?? '').trim(),
    care: String(r.lavaggio ?? '').trim(),
    size: String(r.taglia ?? '').trim(),
    brand: String(r.marca ?? '').trim(),
    warmth: clamp(r.calore, 1, 5, null),
    formality: clamp(r.formalita, 1, 5, null),
    waterproof: Boolean(r.impermeabile),
    logo: Boolean(r.logo),
    fabric: FABRICS[r.tessuto] ? r.tessuto : null,
    volume: VOLUMES[r.vestibilita] ?? null,
    families: Array.isArray(r.stili) ? r.stili.filter((f) => FAMILIES[f]).slice(0, 2) : [],
    styleScore: clamp(r.aderenza_stile, 1, 5, null),
    styleWhy: String(r.motivo_stile ?? '').trim(),
  };
}
