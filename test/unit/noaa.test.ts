import { describe, it, expect } from 'vitest'
import { nearestStation, noaaTides } from '../../src/core/noaa.js'
import { significantTides, tideRange, type TideEvent } from '../../src/core/analysis.js'

describe('nearestStation', () => {
  it('finds a NOAA station near US and Pacific spots, none in Europe or far offshore', () => {
    expect(nearestStation(35.22, -75.63)!.km).toBeLessThan(25)            // Hatteras
    expect(nearestStation(20.90, -156.43)!.name).toMatch(/Kahului/i)      // Maui
    expect(nearestStation(49.29, -0.26)).toBeNull()                       // Ouistreham
    expect(nearestStation(-3.62, -38.73)).toBeNull()                      // Brazil
    expect(nearestStation(30, -60)).toBeNull()
  })
})

describe('noaaTides', () => {
  it('maps hi/lo predictions and builds the right request', async () => {
    let url = ''
    const f: any = async (u: string) => { url = u; return new Response(JSON.stringify({ predictions: [{ t: '2026-10-17 04:12', v: '0.512', type: 'H' }, { t: '2026-10-17 10:30', v: '-0.43', type: 'L' }] })) }
    const ev = await noaaTides('8654467', '2026-10-17', 2, f)
    expect(ev).toEqual([{ time: '2026-10-17 04:12', type: 'high', height: 0.5 }, { time: '2026-10-17 10:30', type: 'low', height: -0.4 }])
    expect(url).toContain('station=8654467'); expect(url).toContain('begin_date=20261017'); expect(url).toContain('range=48'); expect(url).toContain('interval=hilo')
  })
  it('throws on a NOAA error payload', async () => {
    const f: any = async () => new Response(JSON.stringify({ error: { message: 'No Predictions data was found' } }))
    await expect(noaaTides('1', '2026-10-17', 1, f)).rejects.toThrow(/No Predictions/)
  })
})

describe('significantTides and tideRange', () => {
  const ev = (type: 'high' | 'low', height: number, time = 't'): TideEvent => ({ type, height, time })
  it('removes wiggles smaller than the threshold and keeps the extreme of a run', () => {
    expect(significantTides([ev('high', 1), ev('low', 0.95), ev('high', 1.05), ev('low', -1), ev('high', 1.2)])).toEqual([ev('high', 1.05), ev('low', -1), ev('high', 1.2)])
  })
  it('computes the range and ignores nulls', () => { expect(tideRange([null, -1.2, 0.3, 2.1, null])).toBe(3.3); expect(tideRange([])).toBe(0) })
})
