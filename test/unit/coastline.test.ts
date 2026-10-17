import { describe, it, expect } from 'vitest'
import { facingFromGeometry, estimateFacing } from '../../src/core/coastline.js'

// A straight east-west coastline just north of the point, drawn west->east: land on the left (north), water on the right (south).
const ew = (lat = 49.29) => [{ geometry: [{ lat, lon: -0.30 }, { lat, lon: -0.26 }, { lat, lon: -0.22 }] }]

describe('facingFromGeometry', () => {
  it('derives the beach orientation from the way direction (water on the right)', () => {
    const f = facingFromGeometry(49.2865, -0.26, ew())!
    expect(f.facing_deg).toBe(180); expect(f.distance_m).toBeCloseTo(387, -1)
    const rev = facingFromGeometry(49.2865, -0.26, [{ geometry: [...ew()[0].geometry].reverse() }])!
    expect(rev.facing_deg).toBe(0)
  })
  it('smooths over nearby segments and ignores a short kink', () => {
    const ways = [{ geometry: [{ lat: 49.29, lon: -0.30 }, { lat: 49.29, lon: -0.262 }, { lat: 49.2902, lon: -0.2615 }, { lat: 49.29, lon: -0.261 }, { lat: 49.29, lon: -0.22 }] }]
    expect(facingFromGeometry(49.2865, -0.2615, ways)!.facing_deg).toBeCloseTo(180, -1)
  })
  it('returns null without geometry', () => { expect(facingFromGeometry(1, 1, [])).toBeNull(); expect(facingFromGeometry(1, 1, [{ geometry: [{ lat: 1, lon: 1 }] }])).toBeNull() })
})

describe('estimateFacing', () => {
  it('queries Overpass around the point and falls back to the next mirror on failure', async () => {
    const calls: string[] = []
    const fetchImpl: any = async (url: string) => { calls.push(url); if (calls.length === 1) return new Response('busy', { status: 504 }); return new Response(JSON.stringify({ elements: ew() })) }
    const f = await estimateFacing(49.2865, -0.26, { fetchImpl })
    expect(f!.facing_deg).toBe(180); expect(calls).toHaveLength(2); expect(decodeURIComponent(calls[0])).toContain('around:1500,49.28650,-0.26000')
  })
  it('returns null when every mirror fails or times out', async () => {
    const fetchImpl: any = async () => { throw new Error('network') }
    expect(await estimateFacing(1, 1, { fetchImpl })).toBeNull()
  })
})

describe('complex coastlines', () => {
  it('refuses to estimate inside a cove where segments point every way', () => {
    // a U-shaped bay around the point
    const bay = [{ geometry: [{ lat: 49.30, lon: -0.263 }, { lat: 49.2885, lon: -0.263 }, { lat: 49.2885, lon: -0.257 }, { lat: 49.30, lon: -0.257 }] }]
    expect(facingFromGeometry(49.29, -0.26, bay)).toBeNull()
  })
})
