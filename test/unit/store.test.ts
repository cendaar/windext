import { describe, it, expect } from 'vitest'
import { MemoryStore, slugify, distanceKm, type SpotInput } from '../../src/core/store.js'

const card = (over: Partial<SpotInput> = {}): SpotInput => ({ name: 'Ouistreham Riva-Bella', aliases: ['riva'], lat: 49.2865, lon: -0.2605, country: 'France', water: 'sea', facing_deg: 15, facing_source: 'user', sports: ['kitesurf'], tide_notes: '', hazards: '', rules: '', launch_notes: '', season: '', sources: [], wind: [{ sector: 'NE', quality: 'best', note: '' }], ...over })

describe('slugify', () => {
  it('strips accents and punctuation', () => { expect(slugify('Plage de la Franqui, Leucate')).toBe('plage-de-la-franqui-leucate'); expect(slugify('Étang de Thau')).toBe('etang-de-thau'); expect(slugify('  Tarifa -- Los Lances ')).toBe('tarifa-los-lances') })
})
describe('distanceKm', () => {
  it('matches known distances', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0)
    expect(distanceKm({ lat: 49.2865, lon: -0.2605 }, { lat: 49.2865, lon: -0.2605 })).toBe(0)
    expect(distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 })).toBeCloseTo(343.5, 0)
  })
})
describe('MemoryStore', () => {
  it('creates, then dedupes a second submission within 500 m into an update', async () => {
    const s = new MemoryStore()
    expect(await s.submitSpot(card())).toEqual({ id: 'ouistreham-riva-bella', action: 'created', status: 'community' })
    const r = await s.submitSpot(card({ name: 'Riva Bella kite', lat: 49.2880, lon: -0.2600 }))
    expect(r).toEqual({ id: 'ouistreham-riva-bella', action: 'updated', status: 'community' })
    expect((await s.getSpot('ouistreham-riva-bella'))!.submissions).toBe(2)
  })
  it('never merges a launch spot into a nearby school, or the reverse', async () => {
    const s = new MemoryStore()
    await s.submitSpot(card({ name: 'Kite school', kind: 'school' }))
    expect(await s.submitSpot(card())).toMatchObject({ id: 'ouistreham-riva-bella', action: 'created' })
    expect(await s.submitSpot(card({ name: 'Other school', kind: 'school', lat: 49.2866 }))).toMatchObject({ id: 'kite-school', action: 'updated' })
  })
  it('keeps two spots 3 km apart separate and finds them by name, alias and distance', async () => {
    const s = new MemoryStore()
    await s.submitSpot(card()); await s.submitSpot(card({ name: 'Merville-Franceville', aliases: [], lat: 49.285, lon: -0.20 }))
    expect((await s.searchSpots('merville')).map(x => x.id)).toEqual(['merville-franceville'])
    expect((await s.searchSpots('riva')).map(x => x.id)).toEqual(['ouistreham-riva-bella'])
    const near = await s.nearbySpots(49.2865, -0.2605, 10)
    expect(near.map(x => x.id)).toEqual(['ouistreham-riva-bella', 'merville-franceville']); expect(near[1].distance_km).toBeCloseTo(4.4, 0)
    expect(await s.nearbySpots(49.2865, -0.2605, 1)).toHaveLength(1)
  })
})
