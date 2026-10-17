import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defaultModels, fetchForecast, geocode, setCache } from '../../src/core/openmeteo.js'
import { noCache, type Cache } from '../../src/core/cache.js'
import { stubOpenMeteo } from '../fixtures/openmeteo.js'

afterEach(() => { vi.unstubAllGlobals(); setCache(noCache) })

describe('defaultModels', () => {
  it('adds KNMI and DMI only inside Europe', () => {
    expect(defaultModels(49.3, -0.26)).toContain('knmi_seamless')
    expect(defaultModels(36.0, -5.6)).toContain('dmi_seamless')           // Tarifa
    expect(defaultModels(-2.8, -40.5)).not.toContain('knmi_seamless')     // Brazil
    expect(defaultModels(-33.9, 18.4)).not.toContain('dmi_seamless')      // Cape Town
    expect(defaultModels(21.3, -157.8)).toHaveLength(5)                   // Hawaii
  })
  it('always includes the five global models', () => {
    for (const [lat, lon] of [[0, 0], [70, 30], [-45, 170]]) expect(defaultModels(lat, lon)).toEqual(expect.arrayContaining(['meteofrance_seamless', 'icon_seamless', 'ecmwf_ifs', 'gfs_seamless', 'ukmo_seamless']))
  })
})

describe('fetchForecast', () => {
  it('requests knots, all default models, rounded coordinates, and parses per-model series', async () => {
    const s = stubOpenMeteo({ speed: (m, h) => (m === 'gfs_seamless' ? 20 : 10) }); vi.stubGlobal('fetch', s.fetch)
    const fc = await fetchForecast({ lat: 49.27566, lon: -0.2591, days: 1 })
    const multi = new URL(s.urls.find(u => new URL(u).searchParams.get('hourly')?.startsWith('wind_speed_10m'))!)
    expect(multi.searchParams.get('wind_speed_unit')).toBe('kn')
    expect(multi.searchParams.get('latitude')).toBe('49.276'); expect(multi.searchParams.get('longitude')).toBe('-0.259')
    expect(multi.searchParams.get('models')!.split(',')).toHaveLength(7)
    expect(multi.searchParams.get('forecast_days')).toBe('1')
    expect(fc.hours).toHaveLength(24); expect(fc.hours[0].models.gfs_seamless.speed).toBe(20); expect(fc.hours[0].models.icon_seamless.speed).toBe(10)
    expect(fc.seaTemp).toBe(17); expect(fc.timezone).toBe('Europe/Paris')
  })
  it('uses start_date/end_date when a start date is given', async () => {
    const s = stubOpenMeteo({ days: 3 }); vi.stubGlobal('fetch', s.fetch)
    await fetchForecast({ lat: 1, lon: 2, days: 3, startDate: '2026-10-30' })
    const u = new URL(s.urls[0]); expect(u.searchParams.get('start_date')).toBe('2026-10-30'); expect(u.searchParams.get('end_date')).toBe('2026-11-01'); expect(u.searchParams.get('forecast_days')).toBeNull()
  })
  it('parses a single-model response, whose keys carry no suffix', async () => {
    const s = stubOpenMeteo(); vi.stubGlobal('fetch', s.fetch)
    const fc = await fetchForecast({ lat: 1, lon: 2, days: 1, models: ['icon_d2'] })
    expect(fc.models).toEqual(['icon_d2']); expect(fc.hours[5].models.icon_d2).toEqual({ speed: 15, gust: 20, dir: 20 })
  })
  it('tolerates a failing marine API (lake, inland)', async () => {
    const s = stubOpenMeteo({ marine: 'fail' }); vi.stubGlobal('fetch', s.fetch)
    const fc = await fetchForecast({ lat: 46.5, lon: 6.5, days: 1 })
    expect(fc.seaTemp).toBeNull(); expect(fc.waveHeight).toEqual([])
  })
  it('throws on an HTTP error from the forecast API', async () => {
    vi.stubGlobal('fetch', async () => new Response('bad', { status: 400 }))
    await expect(fetchForecast({ lat: 1, lon: 2, days: 1 })).rejects.toThrow(/HTTP 400/)
  })
  it('serves from the cache and fills it on a miss', async () => {
    const mem = new Map<string, any>(); const puts: number[] = []
    const cache: Cache = { async get(k) { return mem.get(k) ?? null }, async put(k, v, ttl) { mem.set(k, v); puts.push(ttl) } }
    setCache(cache)
    const s = stubOpenMeteo(); vi.stubGlobal('fetch', s.fetch)
    await fetchForecast({ lat: 1, lon: 2, days: 1 }); const n = s.urls.length
    await fetchForecast({ lat: 1.0004, lon: 2, days: 1 })   // same 3-decimal cell -> cache hit
    expect(s.urls.length).toBe(n); expect(puts.every(t => t >= 60)).toBe(true); expect(mem.size).toBe(3)
  })
})

describe('geocode', () => {
  it('maps results and returns an empty list when nothing matches', async () => {
    const s = stubOpenMeteo(); vi.stubGlobal('fetch', s.fetch)
    expect(await geocode('Ouistreham')).toEqual([{ name: 'Ouistreham', admin: 'Normandie', country: 'France', lat: 49.27566, lon: -0.2591 }])
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }))
    expect(await geocode('zzzz')).toEqual([])
  })
})
