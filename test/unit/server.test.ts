import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer, INSTRUCTIONS } from '../../src/core/server.js'
import { MemoryStore } from '../../src/core/store.js'
import { stubOpenMeteo } from '../fixtures/openmeteo.js'

let client: Client, store: MemoryStore, urls: string[]
const call = async (name: string, args: any) => { const r: any = await client.callTool({ name, arguments: args }); return { text: r.content[0].text as string, isError: !!r.isError } }
const riva = { name: 'Ouistreham Riva-Bella', lat: 49.2865, lon: -0.2605, country: 'France', water: 'sea', facing_deg: 15, facing_source: 'user', sports: ['kitesurf'], wind: [{ sector: 'NNE', quality: 'best' }, { sector: 'SW', quality: 'forbidden', note: 'offshore' }], sources: ['https://example.org/g'] }

beforeEach(async () => {
  const s = stubOpenMeteo({ speed: () => 15, gust: () => 20, dir: () => 20, temp: 12 }); urls = s.urls; vi.stubGlobal('fetch', s.fetch)
  store = new MemoryStore()
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createServer(store).connect(b)
  client = new Client({ name: 't', version: '0' }); await client.connect(a)
})
afterEach(() => vi.unstubAllGlobals())

describe('server surface', () => {
  it('sends instructions and annotates every tool with title and read-only/destructive hints', async () => {
    expect(client.getInstructions()).toBe(INSTRUCTIONS)
    const tools = (await client.listTools()).tools
    expect(tools.map(t => t.name).sort()).toEqual(['find_spot', 'list_models', 'ride_windows', 'spot_forecast', 'spot_info', 'submit_spot', 'tides'])
    for (const t of tools) { expect(t.title, t.name).toBeTruthy(); expect(typeof t.annotations?.readOnlyHint, t.name).toBe('boolean'); expect(typeof t.annotations?.destructiveHint, t.name).toBe('boolean') }
    expect(tools.find(t => t.name === 'submit_spot')!.annotations!.readOnlyHint).toBe(false)
  })
  it('exposes the prompts', async () => { expect((await client.listPrompts()).prompts.map(p => p.name).sort()).toEqual(['explain_gusts', 'gear_advice', 'session_check', 'spot_compare', 'weekend_planner']) })
})

describe('find_spot', () => {
  it('falls back to geocoding and tells Claude to research and submit', async () => {
    const { text } = await call('find_spot', { query: 'Ouistreham' })
    expect(text).toMatch(/No spot card/); expect(text).toMatch(/lat 49.27566, lon -0.2591/); expect(text).toMatch(/search the web.*submit_spot/); expect(text).toMatch(/next rider/)
  })
  it('returns the card once submitted, by name, alias or proximity to the geocoded place', async () => {
    expect((await call('submit_spot', riva)).text).toMatch(/created with status community/)
    for (const q of ['riva-bella', 'Ouistreham', 'ouistreham riva']) { const { text } = await call('find_spot', { query: q }); expect(text, q).toMatch(/\[community\] Ouistreham Riva-Bella \(id: ouistreham-riva-bella\)/); expect(text).toMatch(/NNE:best, SW:forbidden \(offshore\)/) }
  })
  it('still answers when geocoding is down', async () => {
    vi.stubGlobal('fetch', async (u: string) => u.includes('geocoding') ? new Response('x', { status: 503 }) : new Response('{}'))
    await store.submitSpot({ ...riva, aliases: [], tide_notes: '', tide_offset_min: null, hazards: '', rules: '', launch_notes: '', season: '', wind: [] } as any)
    const { text } = await call('find_spot', { query: 'ouistreham' }); expect(text).toMatch(/Known spots/); expect(text).not.toMatch(/Geocoding:/)
  })
})

describe('submit_spot validation', () => {
  it('rejects a bad sector, a bad quality and a non-URL source', async () => {
    expect((await call('submit_spot', { ...riva, wind: [{ sector: 'NORTH', quality: 'best' }] })).isError).toBe(true)
    expect((await call('submit_spot', { ...riva, wind: [{ sector: 'N', quality: 'great' }] })).isError).toBe(true)
    expect((await call('submit_spot', { ...riva, sources: ['not a url'] })).isError).toBe(true)
    expect((await call('submit_spot', { ...riva, lat: 95 })).isError).toBe(true)
  })
})

describe('spot_forecast', () => {
  it('works from raw coordinates without orientation and says so', async () => {
    const { text } = await call('spot_forecast', { lat: 49.2757, lon: -0.2591, days: 1, start_date: '2026-10-18' })
    expect(text).toMatch(/^Issued (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day \d{4}-\d{2}-\d{2} \d{2}:\d{2} local/); expect(text).toMatch(/-- Sun 2026-10-18 \(sun 08:26-19:05\) --/); expect(text).toMatch(/Sea state \(daytime\):\n2026-10-18: waves 0.8-1.3 m from N, 5 s/)
    expect(text).toMatch(/Beach orientation unknown/); expect(text.split('\n').filter(l => /^\d\d:\d\d/.test(l)).join()).not.toMatch(/onshore|offshore/); expect(text).toMatch(/Models: AROME\/ARPEGE, ICON, ECMWF 9km, GFS, UKMO, KNMI, DMI/)
    expect(text.split('\n').filter(l => /^\d\d:\d\d/.test(l))).toHaveLength(16) // 06..21
  })
  it('uses the card orientation and sectors when given a spot_id, and flags forbidden hours', async () => {
    await call('submit_spot', riva)
    const { text } = await call('spot_forecast', { spot_id: 'ouistreham-riva-bella', days: 1, start_date: '2026-10-18', hours_from: 9, hours_to: 10 })
    expect(text).toMatch(/Spot: Ouistreham Riva-Bella \[community\]/); expect(text).toMatch(/Beach faces NNE/); expect(text).toMatch(/onshore/); expect(text).toMatch(/sectors best 24h/); expect(text).not.toMatch(/FORBIDDEN/)
    vi.stubGlobal('fetch', stubOpenMeteo({ dir: () => 225 }).fetch)
    const r2 = await call('spot_forecast', { spot_id: 'ouistreham-riva-bella', days: 1, start_date: '2026-10-18', hours_from: 9, hours_to: 10 })
    expect(r2.text).toMatch(/offshore/); expect(r2.text).toMatch(/FORBIDDEN sector at 00:00, 01:00/)
  })
  it('lets facing_deg override the card and rejects an unknown spot_id', async () => {
    await call('submit_spot', riva)
    const { text } = await call('spot_forecast', { spot_id: 'ouistreham-riva-bella', days: 1, facing_deg: 200, hours_from: 9, hours_to: 9 })
    expect(text).toMatch(/Beach faces SSW/); expect(text).toMatch(/offshore/)
    const bad = await call('spot_forecast', { spot_id: 'nope', days: 1 }); expect(bad.isError).toBe(true); expect(bad.text).toMatch(/Unknown spot_id/)
    expect((await call('spot_forecast', { days: 1 })).isError).toBe(true)
  })
  it('stays compact: 7 days on 7 models under 4000 tokens', async () => {
    vi.stubGlobal('fetch', stubOpenMeteo({ days: 7 }).fetch)
    const { text } = await call('spot_forecast', { lat: 49.28, lon: -0.26, days: 7 })
    expect(text.length / 3.5).toBeLessThan(4000)
  })
  it('keeps the forecast when the request log throws', async () => {
    store.logRequest = async () => { throw new Error('db down') }
    const { text, isError } = await call('spot_forecast', { lat: 49.28, lon: -0.26, days: 1 }); expect(isError).toBe(false); expect(text).toMatch(/Diagnosis/)
  })
})

describe('ride_windows', () => {
  it('finds the daytime window and tags it with the spot sector quality', async () => {
    await call('submit_spot', riva)
    const { text } = await call('ride_windows', { spot_id: 'ouistreham-riva-bella', days: 1, min_kn: 12, max_kn: 30 })
    expect(text).toMatch(/^Sunday 2026-10-18 09:00-19:00 \(11h\): 15 kn mean, gusts 20, NNE onshore \[spot: best\], agreement high/)
  })
  it('drops hours in a forbidden sector, and reports no window when too light', async () => {
    await call('submit_spot', riva)
    vi.stubGlobal('fetch', stubOpenMeteo({ dir: () => 225 }).fetch)
    expect((await call('ride_windows', { spot_id: 'ouistreham-riva-bella', days: 1 })).text).toMatch(/No window/)
    expect((await call('ride_windows', { spot_id: 'ouistreham-riva-bella', days: 1, allow_offshore: true })).text).toMatch(/SW offshore/)
    vi.stubGlobal('fetch', stubOpenMeteo({ speed: () => 6 }).fetch)
    expect((await call('ride_windows', { lat: 1, lon: 2, days: 1 })).text).toMatch(/No window between 12 and 35 kn/)
  })
})

describe('tides', () => {
  it('lists high and low waters for a coastal spot and appends them to spot_forecast with the spot note', async () => {
    await call('submit_spot', { ...riva, tide_notes: 'ride 2h around HW' })
    const { text } = await call('tides', { spot_id: 'ouistreham-riva-bella', days: 1 })
    expect(text).toMatch(/Ouistreham Riva-Bella\. Local time/); expect(text).toMatch(/HW 03:00 \(\+2 m\)/); expect(text).toMatch(/LW 09:1\d \(-2 m\)/); expect(text).toMatch(/Spot note: ride 2h around HW/)
    const f = await call('spot_forecast', { spot_id: 'ouistreham-riva-bella', days: 1, hours_from: 9, hours_to: 9 })
    expect(f.text).toMatch(/Tides \(MODEL TIDE, UNCALIBRATED.*spot note: ride 2h around HW\):\n2026-10-18: HW 03:00/)
  })
  it('applies and reports a submitted tide calibration', async () => {
    await call('submit_spot', { ...riva, tide_offset_min: 50 })
    const { text } = await call('tides', { spot_id: 'ouistreham-riva-bella', days: 1 })
    expect(text).toMatch(/calibrated for this spot \(\+50 min\)/); expect(text).toMatch(/HW 03:50/)
    expect((await call('spot_info', { spot_id: 'ouistreham-riva-bella' })).text).toMatch(/\[calibration \+50 min\]/)
    expect((await call('tides', { lat: 49.2757, lon: -0.2591, days: 1 })).text).toMatch(/UNCALIBRATED/)
  })
  it('says so on a lake', async () => {
    vi.stubGlobal('fetch', stubOpenMeteo({ marine: 'fail' }).fetch)
    expect((await call('tides', { lat: 46.5, lon: 6.5 })).text).toMatch(/No tidal signal/)
    const f = await call('spot_forecast', { lat: 46.5, lon: 6.5, days: 1, hours_from: 9, hours_to: 9 }); expect(f.text).not.toMatch(/Tides/)
  })
})

describe('list_models', () => {
  it('describes the regional set in Europe and the global set elsewhere', async () => {
    expect((await call('list_models', { lat: 49.3, lon: -0.26 })).text.split('\n')).toHaveLength(7)
    expect((await call('list_models', { lat: -33.9, lon: 18.4 })).text.split('\n')).toHaveLength(5)
  })
})

describe('seed cards and coastline estimate', () => {
  it('estimates and persists the orientation of a seed spot once, flags it, and still asks for research', async () => {
    let calls = 0
    const [a, b] = InMemoryTransport.createLinkedPair()
    const st = new MemoryStore()
    await st.submitSpot({ name: 'Seed beach', aliases: [], lat: 49.2757, lon: -0.2591, country: '', water: '', facing_deg: null, facing_source: 'seed', sports: ['kitesurf'], tide_notes: '', tide_offset_min: null, hazards: '', rules: '', launch_notes: '', season: '', sources: [], wind: [] });
    (await st.getSpot('seed-beach'))!.status = 'seed'
    await createServer(st, { estimateFacing: async () => { calls++; return { facing_deg: 15, distance_m: 300 } } }).connect(b)
    const c = new Client({ name: 't2', version: '0' }); await c.connect(a)
    const r1: any = await c.callTool({ name: 'find_spot', arguments: { query: 'Seed beach' } })
    expect(r1.content[0].text).toMatch(/\[seed\] Seed beach/); expect(r1.content[0].text).toMatch(/faces 15° NNE \(coastline, estimated: confirm with the user\)/); expect(r1.content[0].text).toMatch(/Next step: search the web/)
    await c.callTool({ name: 'find_spot', arguments: { query: 'Seed beach' } })
    expect(calls).toBe(1)
    const r2: any = await c.callTool({ name: 'spot_forecast', arguments: { spot_id: 'seed-beach', days: 1, hours_from: 9, hours_to: 9 } })
    expect(r2.content[0].text).toMatch(/Orientation estimated from the coastline, confirm it/); expect(r2.content[0].text).toMatch(/Beach faces NNE/)
    await c.close()
  })
  it('does not estimate for schools or when the coastline is too far', async () => {
    let calls = 0
    const [a, b] = InMemoryTransport.createLinkedPair(); const st = new MemoryStore()
    await st.submitSpot({ name: 'Kite school', kind: 'school', aliases: [], lat: 49.2757, lon: -0.2591, country: '', water: '', facing_deg: null, facing_source: 'seed', sports: ['kitesurf'], tide_notes: '', tide_offset_min: null, hazards: '', rules: '', launch_notes: '', season: '', sources: [], wind: [] })
    await st.submitSpot({ name: 'Inland lake', aliases: [], lat: 48.0, lon: 2.0, country: '', water: '', facing_deg: null, facing_source: 'seed', sports: ['windsurf'], tide_notes: '', tide_offset_min: null, hazards: '', rules: '', launch_notes: '', season: '', sources: [], wind: [] })
    await createServer(st, { estimateFacing: async () => { calls++; return { facing_deg: 90, distance_m: 5000 } } }).connect(b)
    const c = new Client({ name: 't3', version: '0' }); await c.connect(a)
    const r1: any = await c.callTool({ name: 'spot_info', arguments: { spot_id: 'kite-school' } }); expect(r1.content[0].text).toMatch(/school\/club/); expect(r1.content[0].text).toMatch(/faces unknown/)
    const r2: any = await c.callTool({ name: 'spot_info', arguments: { spot_id: 'inland-lake' } }); expect(r2.content[0].text).toMatch(/faces unknown/)
    expect(calls).toBe(1)
    await c.close()
  })
})
