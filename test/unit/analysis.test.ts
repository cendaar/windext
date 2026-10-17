import { describe, it, expect } from 'vitest'
import { compass, shoreRelation, summarizeHour, findWindows, gustDiagnostics, renderTable } from '../../src/core/analysis.js'
import type { Forecast, Hour } from '../../src/core/openmeteo.js'

const hour = (time: string, models: Record<string, [number, number, number]>, extra: Partial<Hour> = {}): Hour => ({
  time, models: Object.fromEntries(Object.entries(models).map(([m, [speed, gust, dir]]) => [m, { speed, gust, dir }])),
  temp: 12, precip: 0, cape: 0, cloud: 50, speed80: 16, ...extra,
})

describe('compass', () => {
  it('maps degrees to 16 sectors with wrap-around', () => {
    expect(compass(0)).toBe('N'); expect(compass(11)).toBe('N'); expect(compass(12)).toBe('NNE')
    expect(compass(90)).toBe('E'); expect(compass(180)).toBe('S'); expect(compass(270)).toBe('W')
    expect(compass(340)).toBe('NNW'); expect(compass(349)).toBe('N'); expect(compass(360)).toBe('N')
  })
})

describe('shoreRelation', () => {
  it('classifies wind against a north-facing beach', () => {
    expect(shoreRelation(0, 0)).toBe('onshore'); expect(shoreRelation(30, 0)).toBe('onshore')
    expect(shoreRelation(45, 0)).toBe('side-on'); expect(shoreRelation(90, 0)).toBe('side')
    expect(shoreRelation(130, 0)).toBe('side-off'); expect(shoreRelation(180, 0)).toBe('offshore'); expect(shoreRelation(200, 0)).toBe('offshore')
  })
  it('wraps around 360', () => { expect(shoreRelation(350, 10)).toBe('onshore'); expect(shoreRelation(190, 10)).toBe('offshore') })
})

describe('summarizeHour', () => {
  it('averages models, computes spread, gust factor and agreement', () => {
    const s = summarizeHour(hour('2026-10-18T12:00', { a: [10, 20, 20], b: [14, 24, 60] }), 0)!
    expect(s.speed).toBe(12); expect(s.gust).toBe(22); expect(s.spread).toBe(4); expect(s.gustFactor).toBe(1.8)
    expect(s.dir).toBe(40); expect(s.agreement).toBe('high'); expect(s.shore).toBe('side-on')
  })
  it('uses a circular mean for directions across north', () => {
    const s = summarizeHour(hour('2026-10-18T12:00', { a: [10, 12, 350], b: [10, 12, 10] }))!
    expect(s.dir).toBe(0); expect(s.shore).toBeUndefined()
  })
  it('grades agreement medium then low on speed spread', () => {
    expect(summarizeHour(hour('t', { a: [10, 12, 0], b: [16, 18, 0] }))!.agreement).toBe('medium')
    expect(summarizeHour(hour('t', { a: [10, 12, 0], b: [20, 22, 0] }))!.agreement).toBe('low')
  })
  it('grades agreement low on direction disagreement even with equal speeds', () => {
    expect(summarizeHour(hour('t', { a: [12, 14, 0], b: [12, 14, 90] }))!.agreement).toBe('low')
    expect(summarizeHour(hour('t', { a: [12, 14, 0], b: [12, 14, 60] }))!.agreement).toBe('medium')
    expect(summarizeHour(hour('t', { a: [12, 14, 0], b: [12, 14, 30] }))!.agreement).toBe('high')
  })
  it('ignores null models and returns null when nothing is available', () => {
    expect(summarizeHour({ ...hour('t', { a: [12, 14, 0] }), models: { a: { speed: 12, gust: 14, dir: 0 }, b: { speed: null, gust: null, dir: null } } })!.spread).toBe(0)
    expect(summarizeHour({ ...hour('t', {}), models: { a: { speed: null, gust: null, dir: null } } })).toBeNull()
  })
  it('gust factor is 0 when the wind is calm', () => { expect(summarizeHour(hour('t', { a: [0, 5, 0] }))!.gustFactor).toBe(0) })
})

describe('findWindows', () => {
  const mk = (h: number, speed: number, dir = 20, day = '2026-10-18', spread = 0) => summarizeHour(hour(`${day}T${String(h).padStart(2, '0')}:00`, { a: [speed - spread / 2, speed + 4, dir], b: [speed + spread / 2, speed + 4, dir] }), 0)!
  it('finds a contiguous run inside the range and ignores single hours', () => {
    const hs = [mk(8, 5), mk(9, 14), mk(10, 15), mk(11, 16), mk(12, 5), mk(13, 14), mk(14, 5)]
    const w = findWindows(hs, 12, 30)
    expect(w).toHaveLength(1); expect(w[0]).toMatchObject({ start: '2026-10-18T09:00', end: '2026-10-18T11:00', hours: 3, avgSpeed: 15, dir: 'NNE', shore: 'onshore' })
  })
  it('excludes offshore hours unless allowed', () => {
    const hs = [mk(9, 14, 180), mk(10, 15, 180), mk(11, 16, 180)]
    expect(findWindows(hs, 12, 30)).toHaveLength(0)
    expect(findWindows(hs, 12, 30, { allowOffshore: true })).toHaveLength(1)
  })
  it('respects daytime bounds and max wind', () => {
    const hs = [mk(5, 14), mk(6, 14), mk(22, 14), mk(23, 14)]
    expect(findWindows(hs, 12, 30)).toHaveLength(0)
    expect(findWindows([mk(10, 40), mk(11, 40)], 12, 30)).toHaveLength(0)
  })
  it('reports the worst agreement of the run', () => {
    const w = findWindows([mk(10, 15, 20, '2026-10-18', 0), mk(11, 15, 20, '2026-10-18', 10)], 12, 30)
    expect(w[0].agreement).toBe('low')
  })
  it('splits runs across nights and across filtered-out hours', () => {
    expect(findWindows([mk(20, 15), mk(21, 15), mk(7, 15, 20, '2026-10-19'), mk(8, 15, 20, '2026-10-19')], 12, 30)).toHaveLength(2)
    expect(findWindows([mk(9, 15), mk(10, 15), mk(13, 15), mk(14, 15)], 12, 30)).toHaveLength(2) // 11-12 removed upstream (forbidden sector)
  })
})

describe('gustDiagnostics', () => {
  const fc = (hours: Hour[], seaTemp: number | null = 17): Forecast => ({ lat: 0, lon: 0, timezone: 'UTC', models: ['a'], hours, seaTemp, waveHeight: [], seaLevel: [], waves: [], sun: [], issued: '2026-10-17 10:00', utcOffsetSeconds: 0 })
  const sum = (hs: Hour[]) => hs.map(h => summarizeHour(h)!)
  const day = (f: (h: number) => Hour) => Array.from({ length: 24 }, (_, h) => f(h))
  it('calls a steady wind steady and says nothing about the sea when air and sea match', () => {
    const hs = day(h => hour(`2026-10-18T${String(h).padStart(2, '0')}:00`, { a: [15, 17, 0] }, { temp: 17 }))
    const d = gustDiagnostics(fc(hs), sum(hs))
    expect(d[0]).toMatch(/steady/); expect(d.join()).not.toMatch(/sea warmer|Air warmer|Showery|shear|disagree/)
  })
  it('flags convective gusts when the sea is warmer and a showery regime with CAPE and rain', () => {
    const hs = day(h => hour(`2026-10-18T${String(h).padStart(2, '0')}:00`, { a: [10, 22, 0] }, { temp: 12, cape: 200, precip: h === 10 ? 2 : 0 }))
    const d = gustDiagnostics(fc(hs, 17), sum(hs)).join('\n')
    expect(d).toMatch(/Gust factor 2.2/); expect(d).toMatch(/sea warmer by 5/); expect(d).toMatch(/Showery regime/)
  })
  it('flags a stable layer when the air is much warmer than the sea', () => {
    const hs = day(h => hour(`2026-10-18T${String(h).padStart(2, '0')}:00`, { a: [12, 14, 0] }, { temp: 25 }))
    expect(gustDiagnostics(fc(hs, 15), sum(hs)).join()).toMatch(/Air warmer than the sea by 10/)
  })
  it('skips the air-sea line on a lake (no sea temperature)', () => {
    const hs = day(h => hour(`2026-10-18T${String(h).padStart(2, '0')}:00`, { a: [12, 14, 0] }, { temp: 5 }))
    expect(gustDiagnostics(fc(hs, null), sum(hs)).join()).not.toMatch(/sea/)
  })
  it('flags shear when the 80 m wind is much stronger, and model disagreement', () => {
    const hs = day(h => hour(`2026-10-18T${String(h).padStart(2, '0')}:00`, { a: [10, 12, 0], b: [20, 22, 90] }, { speed80: 25 }))
    const d = gustDiagnostics(fc(hs), sum(hs)).join('\n')
    expect(d).toMatch(/Wind at 80 m is ~10 kn stronger/); expect(d).toMatch(/Models disagree on 100%/)
  })
  it('returns nothing when there are no daytime hours', () => { expect(gustDiagnostics(fc([]), [])).toEqual([]) })
})

describe('renderTable', () => {
  it('renders one line per hour inside the bounds, with day headers and spot columns', () => {
    const hours = Array.from({ length: 48 }, (_, i) => hour(`2026-10-${18 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`, { a: [10, 20, 20], b: [14, 24, 40] }))
    const f: Forecast = { lat: 0, lon: 0, timezone: 'Europe/Paris', models: ['a', 'b'], hours, seaTemp: 17, waveHeight: [], seaLevel: [], waves: [], sun: [], issued: '2026-10-17 10:00', utcOffsetSeconds: 0 }
    const t = renderTable(f, hours.map(h => summarizeHour(h, 0)!), { from: 9, to: 10 })
    const lines = t.split('\n')
    expect(lines[1]).toBe('Time | a | b | MEAN | SPREAD | AGREE')
    expect(lines.filter(l => l.startsWith('-- '))).toEqual(['-- Sun 2026-10-18 --', '-- Mon 2026-10-19 --'])
    expect(lines.filter(l => /^\d\d:\d\d/.test(l))).toHaveLength(4)
    expect(lines[3]).toBe('09:00 | 10/20 NNE | 14/24 NE | 12/22 NNE onshore | 4 | high')
  })
  it('collapses to consensus-only rows after the first three days', () => {
    const hours = Array.from({ length: 24 * 5 }, (_, i) => hour(`2026-10-${18 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`, { a: [10, 20, 20], b: [14, 24, 40] }))
    const f: Forecast = { lat: 0, lon: 0, timezone: 'UTC', models: ['a', 'b'], hours, seaTemp: null, waveHeight: [], seaLevel: [], waves: [], sun: [], issued: '2026-10-17 10:00', utcOffsetSeconds: 0 }
    const lines = renderTable(f, hours.map(h => summarizeHour(h)!), { from: 9, to: 9 }).split('\n')
    expect(lines[0]).toMatch(/From day 4 only the consensus is shown/)
    expect(lines.filter(l => /^\d\d:\d\d/.test(l)).map(l => l.split(' | ').length)).toEqual([6, 6, 6, 4, 4])
  })
  it('prints a dash for a model without data', () => {
    const h = { ...hour('2026-10-18T09:00', { a: [10, 20, 20] }), models: { a: { speed: 10, gust: 20, dir: 20 }, b: { speed: null, gust: null, dir: null } } }
    const f: Forecast = { lat: 0, lon: 0, timezone: 'UTC', models: ['a', 'b'], hours: [h], seaTemp: null, waveHeight: [], seaLevel: [], waves: [], sun: [], issued: '2026-10-17 10:00', utcOffsetSeconds: 0 }
    expect(renderTable(f, [summarizeHour(h)!], { from: 9, to: 9 }).split('\n').pop()).toContain('| - |')
  })
})
