/** JSON API for the iOS app and widget. No accounts; rider profile travels in the query string and is never stored. */
import { fetchForecast, geocode } from './core/openmeteo.js'
import { dayVerdict, type Rider, type Sport, type Level } from './core/verdict.js'
import { renderVerdict } from './core/verdict-i18n.js'
import { tideEvents, significantTides, tideRange } from './core/analysis.js'
import { nearestStation, noaaTides } from './core/noaa.js'
import { nwsAlerts, isBlocking } from './core/alerts.js'
import type { Store, SpotCard } from './core/store.js'
import { type Lang, LANGS } from './i18n.js'

const json = (body: unknown, status = 200, maxAge = 0) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store' } })

export function parseRider(q: URLSearchParams): Rider | string {
  const sport = (q.get('sport') ?? 'kitesurf') as Sport
  if (!['kitesurf', 'wingfoil', 'windsurf'].includes(sport)) return 'sport must be kitesurf, wingfoil or windsurf'
  const weightKg = Number(q.get('weight') ?? 75)
  if (!(weightKg >= 30 && weightKg <= 150)) return 'weight must be between 30 and 150 kg'
  const sizes = (q.get('sizes') ?? (sport === 'kitesurf' ? '9,12' : sport === 'wingfoil' ? '4,5.5' : '5,6.5')).split(',').map(Number).filter(n => n > 0 && n < 25)
  if (!sizes.length) return 'sizes must be a comma-separated list, e.g. 9,12'
  const level = (q.get('level') ?? 'intermediate') as Level
  if (!['beginner', 'intermediate', 'expert'].includes(level)) return 'level must be beginner, intermediate or expert'
  return { sport, weightKg, sizes, level }
}

export async function verdictFor(store: Store, q: URLSearchParams) {
  const rider = parseRider(q)
  if (typeof rider === 'string') return { error: rider }
  const lang = (LANGS as string[]).includes(q.get('lang') ?? '') ? q.get('lang') as Lang : 'en'
  let card: SpotCard | null = null
  if (q.get('spot')) card = await store.getSpot(q.get('spot')!)
  const lat = card?.lat ?? Number(q.get('lat') ?? NaN), lon = card?.lon ?? Number(q.get('lon') ?? NaN)
  // An unknown spot id falls back to the coordinates sent alongside it
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: 'give spot=<id> or lat and lon' }
  const facing = q.get('facing') != null ? Number(q.get('facing')) : card?.facing_deg ?? null
  const fc = await fetchForecast({ lat, lon, days: 2 })
  // Tide events for the verdict: official NOAA when close, otherwise the model when the range matters
  let tide: { time: string; type: 'high' | 'low' }[] = []
  const st = nearestStation(lat, lon)
  if (st) { try { tide = (await noaaTides(st.id, fc.hours[0].time.slice(0, 10), 2)).map(e => ({ time: e.time.replace(' ', 'T'), type: e.type })) } catch { /* model below */ } }
  if (!tide.length && tideRange(fc.seaLevel) >= 0.3 && card?.tide_offset_min != null) tide = significantTides(tideEvents(fc.hours.map(h => h.time), fc.seaLevel, card.tide_offset_min)).map(e => ({ time: e.time.replace(' ', 'T'), type: e.type }))
  const alerts = await nwsAlerts(lat, lon)
  const nearby = await store.nearbySpots(lat, lon, 30, 20).catch(() => [])
  const days = (['today', 'tomorrow'] as const).map(day => renderVerdict(dayVerdict(fc, rider, { day, facing, card, tide, nearby, alerts: alerts.map(x => ({ event: x.event, blocking: isBlocking(x.event) })) }), lang))
  try { await store.logRequest({ spot_id: card?.id ?? null, lat, lon, day: days[0].date, sport: rider.sport }) } catch { /* stats never block */ }
  return { stale: !!fc.stale, alerts: alerts.map(x => x.event), spot: card ? { id: card.id, name: card.name, status: card.status, facing_deg: card.facing_deg } : { lat, lon }, issued: fc.issued, timezone: fc.timezone, models: fc.models, lang, rider, days }
}

export async function handleApi(request: Request, url: URL, store: Store, db?: D1Database): Promise<Response | null> {
  if (!url.pathname.startsWith('/v1/')) return null
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } })
  const q = url.searchParams
  try {
    if (url.pathname === '/v1/verdict' && request.method === 'GET') {
      const r = await verdictFor(store, q)
      return 'error' in r ? json(r, 400) : json(r, 200, 600)
    }
    if (url.pathname === '/v1/spots' && request.method === 'GET') {
      const query = (q.get('q') ?? '').trim()
      if (query.length < 2) return json({ error: 'q must have at least 2 characters' }, 400)
      const known = (await store.searchSpots(query, 8)).filter(s => s.kind === 'spot')
      const geo = await geocode(query).catch(() => [])
      const near = geo[0] ? (await store.nearbySpots(geo[0].lat, geo[0].lon, 20, 8)).filter(s => s.kind === 'spot' && !known.some(k => k.id === s.id)) : []
      const spots = [...known, ...near].map(s => ({ id: s.id, name: s.name, country: s.country, lat: s.lat, lon: s.lon, status: s.status, facing_deg: s.facing_deg }))
      return json({ spots, places: geo.map(g => ({ name: g.name, admin: g.admin, country: g.country, lat: g.lat, lon: g.lon })) }, 200, 3600)
    }
    if (url.pathname === '/v1/report' && request.method === 'POST' && db) {
      const b: any = await request.json().catch(() => null)
      const feel = b?.feeling
      if (!b || !['underpowered', 'ok', 'overpowered', 'skipped', 'no_wind'].includes(feel)) return json({ error: 'feeling must be underpowered, ok, overpowered, skipped or no_wind' }, 400)
      const day = String(b.day ?? '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'day must be YYYY-MM-DD' }, 400)
      const lat = Number(b.lat), lon = Number(b.lon)
      if (!b.spot_id && !(isFinite(lat) && isFinite(lon))) return json({ error: 'give spot_id or lat and lon' }, 400)
      await db.prepare('INSERT INTO sessions (spot_id, lat, lon, day, sport, rider_kg, gear, verdict, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(b.spot_id ?? null, isFinite(lat) ? Math.round(lat * 100) / 100 : null, isFinite(lon) ? Math.round(lon * 100) / 100 : null, day, String(b.sport ?? '').slice(0, 20), Number(b.weight) || null, String(b.gear ?? '').slice(0, 20), feel, String(b.predicted ?? '').slice(0, 20)).run()
      return json({ ok: true })
    }
    return json({ error: 'not found' }, 404)
  } catch (e) {
    return json({ error: 'upstream weather service unavailable, try again shortly' }, 502)
  }
}
