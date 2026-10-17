/** Open-Meteo access layer. Free, no API key, non-commercial use. https://open-meteo.com */
import { type Cache, noCache } from './cache.js'

let cache: Cache = noCache
export const setCache = (c: Cache) => { cache = c }
const CACHE_TTL = 1800

export const MODEL_LABELS: Record<string, string> = {
  meteofrance_seamless: 'AROME/ARPEGE',
  icon_seamless: 'ICON',
  ecmwf_ifs: 'ECMWF 9km',
  ecmwf_ifs025: 'ECMWF 25km',
  gfs_seamless: 'GFS',
  ukmo_seamless: 'UKMO',
  knmi_seamless: 'KNMI',
  dmi_seamless: 'DMI',
  jma_seamless: 'JMA',
  gem_seamless: 'GEM',
  bom_access_global: 'BOM',
}

const GLOBAL_MODELS = ['meteofrance_seamless', 'icon_seamless', 'ecmwf_ifs', 'gfs_seamless', 'ukmo_seamless']
const EUROPE_EXTRA = ['knmi_seamless', 'dmi_seamless']

export function defaultModels(lat: number, lon: number): string[] {
  const inEurope = lat > 34 && lat < 72 && lon > -25 && lon < 45
  return inEurope ? [...GLOBAL_MODELS, ...EUROPE_EXTRA] : GLOBAL_MODELS
}

export interface HourModel { speed: number | null; gust: number | null; dir: number | null }
export interface Hour {
  time: string
  models: Record<string, HourModel>
  temp: number | null
  precip: number | null
  cape: number | null
  cloud: number | null
  speed80: number | null
}
export interface Forecast {
  lat: number
  lon: number
  timezone: string
  models: string[]
  hours: Hour[]
  seaTemp: number | null
  waveHeight: (number | null)[]
  seaLevel: (number | null)[]   // tide height vs mean sea level, metres, hourly (Open-Meteo marine model, approximate)
}

async function getJson(url: string): Promise<any> {
  const hit = await cache.get(url)
  if (hit) return hit
  const res = await fetch(url, { headers: { 'User-Agent': 'windext-mcp (https://github.com/baptisterousseau/windext)' } })
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  await cache.put(url, data, CACHE_TTL)
  return data
}

export async function fetchForecast(opts: { lat: number; lon: number; days: number; models?: string[]; startDate?: string }): Promise<Forecast> {
  const models = opts.models?.length ? opts.models : defaultModels(opts.lat, opts.lon)
  const base = { latitude: opts.lat.toFixed(3), longitude: opts.lon.toFixed(3), timezone: 'auto', wind_speed_unit: 'kn' }
  const range: Record<string, string> = opts.startDate
    ? { start_date: opts.startDate, end_date: addDays(opts.startDate, opts.days - 1) }
    : { forecast_days: String(opts.days) }

  const multi = new URLSearchParams({ ...base, ...range, hourly: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m', models: models.join(',') })
  // Context variables from the finest model available (first in list): instability, rain, shear.
  const ctx = new URLSearchParams({ ...base, ...range, hourly: 'temperature_2m,precipitation,cape,cloud_cover,wind_speed_80m', models: models[0] })
  const marine = new URLSearchParams({ latitude: base.latitude, longitude: base.longitude, timezone: 'auto', ...range, hourly: 'sea_surface_temperature,wave_height,sea_level_height_msl' })

  const [m, c, s] = await Promise.all([
    getJson(`https://api.open-meteo.com/v1/forecast?${multi}`),
    getJson(`https://api.open-meteo.com/v1/forecast?${ctx}`),
    getJson(`https://marine-api.open-meteo.com/v1/marine?${marine}`).catch(() => null),
  ])

  const h = m.hourly
  const hours: Hour[] = h.time.map((time: string, i: number) => {
    const per: Record<string, HourModel> = {}
    for (const mod of models) {
      const suffix = models.length === 1 ? '' : `_${mod}`
      per[mod] = { speed: h[`wind_speed_10m${suffix}`]?.[i] ?? null, gust: h[`wind_gusts_10m${suffix}`]?.[i] ?? null, dir: h[`wind_direction_10m${suffix}`]?.[i] ?? null }
    }
    return {
      time, models: per,
      temp: c.hourly.temperature_2m?.[i] ?? null, precip: c.hourly.precipitation?.[i] ?? null,
      cape: c.hourly.cape?.[i] ?? null, cloud: c.hourly.cloud_cover?.[i] ?? null, speed80: c.hourly.wind_speed_80m?.[i] ?? null,
    }
  })
  const sst = s?.hourly?.sea_surface_temperature?.find((v: number | null) => v != null) ?? null
  return { lat: opts.lat, lon: opts.lon, timezone: m.timezone, models, hours, seaTemp: sst, waveHeight: s?.hourly?.wave_height ?? [], seaLevel: s?.hourly?.sea_level_height_msl ?? [] }
}

export async function geocode(name: string): Promise<{ name: string; admin: string; country: string; lat: number; lon: number }[]> {
  const u = new URLSearchParams({ name, count: '5', language: 'fr', format: 'json' })
  const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${u}`)
  return (d.results ?? []).map((r: any) => ({ name: r.name, admin: r.admin1 ?? '', country: r.country ?? '', lat: r.latitude, lon: r.longitude }))
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
