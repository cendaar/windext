/** Deterministic Open-Meteo-shaped payloads for tests. */
export interface FakeOpts { day?: string; models?: string[]; speed?: (model: string, h: number) => number; gust?: (model: string, h: number) => number; dir?: (model: string, h: number) => number; temp?: number; cape?: number; precip?: (h: number) => number; speed80?: (h: number) => number; days?: number }

export function forecastPayload(o: FakeOpts = {}) {
  const day = o.day ?? '2026-10-18', models = o.models ?? ['a', 'b'], days = o.days ?? 1
  const time: string[] = []
  for (let d = 0; d < days; d++) for (let h = 0; h < 24; h++) { const dt = new Date(day + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + d); time.push(`${dt.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:00`) }
  const hourly: Record<string, any> = { time }
  const suffix = (m: string) => models.length === 1 ? '' : `_${m}`
  for (const m of models) {
    hourly[`wind_speed_10m${suffix(m)}`] = time.map((_, i) => (o.speed ?? (() => 15))(m, i % 24))
    hourly[`wind_gusts_10m${suffix(m)}`] = time.map((_, i) => (o.gust ?? (() => 20))(m, i % 24))
    hourly[`wind_direction_10m${suffix(m)}`] = time.map((_, i) => (o.dir ?? (() => 20))(m, i % 24))
  }
  return { timezone: 'Europe/Paris', utc_offset_seconds: 7200, hourly }
}
export function contextPayload(o: FakeOpts = {}) {
  const base = forecastPayload({ ...o, models: ['x'] })
  const n = base.hourly.time.length
  const days = Array.from(new Set(base.hourly.time.map((t: string) => t.slice(0, 10))))
  return { timezone: 'Europe/Paris', utc_offset_seconds: 7200, daily: { time: days, sunrise: days.map(d => `${d}T08:26`), sunset: days.map(d => `${d}T19:05`) }, hourly: { time: base.hourly.time, temperature_2m: Array(n).fill(o.temp ?? 12), precipitation: base.hourly.time.map((_: string, i: number) => (o.precip ?? (() => 0))(i % 24)), cape: Array(n).fill(o.cape ?? 0), cloud_cover: Array(n).fill(50), wind_speed_80m: base.hourly.time.map((_: string, i: number) => (o.speed80 ?? (() => 16))(i % 24)) } }
}
export function marinePayload(sst: number | null = 17, n = 24) {
  return { hourly: { time: Array(n).fill('x'), sea_surface_temperature: Array(n).fill(sst), wave_height: Array.from({ length: n }, (_, i) => 0.8 + 0.5 * ((i % 24) >= 12 ? 1 : 0)), wave_direction: Array(n).fill(10), wave_period: Array(n).fill(5), sea_level_height_msl: Array.from({ length: n }, (_, i) => Math.round(2 * Math.cos(2 * Math.PI * (i - 3) / 12.42) * 100) / 100) } }
}

/** Installs a fetch stub routing Open-Meteo URLs to the payloads. Returns the list of requested URLs. */
export function stubOpenMeteo(opts: FakeOpts & { marine?: number | null | 'fail'; geocode?: any[] } = {}) {
  const urls: string[] = []
  const fetch = async (url: string) => {
    urls.push(url)
    const u = new URL(url)
    const ok = (body: any) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.hostname.startsWith('marine')) { if (opts.marine === 'fail') return new Response('nope', { status: 500 }); return ok(marinePayload(opts.marine === undefined ? 17 : opts.marine, (opts.days ?? 1) * 24)) }
    if (u.hostname.startsWith('geocoding')) return ok({ results: opts.geocode ?? [{ name: 'Ouistreham', admin1: 'Normandie', country: 'France', latitude: 49.27566, longitude: -0.2591 }] })
    const models = (u.searchParams.get('models') ?? '').split(',').filter(Boolean)
    const hourly = u.searchParams.get('hourly') ?? ''
    if (hourly.includes('temperature_2m')) return ok(contextPayload(opts))
    return ok(forecastPayload({ ...opts, models }))
  }
  return { fetch, urls }
}
