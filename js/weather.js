// Meteo da Open-Meteo: gratuito, senza chiave.

const WMO = {
  0: 'sereno', 1: 'poco nuvoloso', 2: 'parzialmente nuvoloso', 3: 'coperto', 45: 'nebbia', 48: 'nebbia',
  51: 'pioggerella', 53: 'pioggerella', 55: 'pioggerella', 56: 'pioggerella gelata', 57: 'pioggerella gelata',
  61: 'pioggia debole', 63: 'pioggia', 65: 'pioggia forte', 66: 'pioggia gelata', 67: 'pioggia gelata',
  71: 'neve debole', 73: 'neve', 75: 'neve forte', 77: 'nevischio',
  80: 'rovesci', 81: 'rovesci', 82: 'rovesci forti', 85: 'rovesci di neve', 86: 'rovesci di neve',
  95: 'temporale', 96: 'temporale', 99: 'temporale',
};

export const STOCKHOLM = { name: 'Stoccolma', lat: 59.3293, lon: 18.0686 };

const HOURLY = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'snowfall', 'snow_depth', 'wind_speed_10m'];

export async function fetchForecast({ lat, lon }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    forecast_days: '3',
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max',
      'apparent_temperature_min', 'precipitation_sum', 'precipitation_probability_max', 'snowfall_sum',
    ].join(','),
    hourly: HOURLY.join(','),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meteo non disponibile (${res.status})`);
  const body = await res.json();
  const d = body.daily;
  const hr = body.hourly;
  return d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    label: WMO[d.weather_code[i]] ?? '',
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    appMax: d.apparent_temperature_max[i],
    appMin: d.apparent_temperature_min[i],
    precipSum: d.precipitation_sum[i] ?? 0,
    precipProb: d.precipitation_probability_max[i] ?? 0,
    snow: d.snowfall_sum[i] ?? 0,
    // 24 valori orari per variabile, dalle 0 alle 23 del giorno.
    hours: hr ? Object.fromEntries(HOURLY.map((k) => [k, hr[k].slice(i * 24, i * 24 + 24)])) : null,
  }));
}

// Il tragitto: un'ora attorno all'uscita e una attorno al rientro.
export function commuteOf(day, outHour = 8, backHour = 18) {
  const h = day?.hours;
  if (!h) return null;
  const at = (k, hour) => h[k]?.[Math.max(0, Math.min(23, hour))] ?? 0;
  const window = [outHour, outHour + 1, backHour - 1, backHour];
  return {
    outHour,
    backHour,
    outApp: at('apparent_temperature', outHour),
    backApp: at('apparent_temperature', backHour),
    outT: at('temperature_2m', outHour),
    backT: at('temperature_2m', backHour),
    precipProb: Math.max(...window.map((x) => at('precipitation_probability', x))),
    precip: Math.max(...window.map((x) => at('precipitation', x))),
    snowfall: Math.max(...window.map((x) => at('snowfall', x))),
    snowDepth: at('snow_depth', outHour),
    wind: Math.max(at('wind_speed_10m', outHour), at('wind_speed_10m', backHour)),
  };
}

export async function geocode(name) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name, count: '1', language: 'it', format: 'json' });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ricerca città non riuscita (${res.status})`);
  const hit = (await res.json()).results?.[0];
  if (!hit) throw new Error(`Nessuna città trovata per "${name}"`);
  return { name: hit.country ? `${hit.name}, ${hit.country}` : hit.name, lat: hit.latitude, lon: hit.longitude };
}
