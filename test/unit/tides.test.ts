import { describe, it, expect } from 'vitest'
import { tideEvents, renderTides } from '../../src/core/analysis.js'

const times = Array.from({ length: 48 }, (_, i) => `2026-10-${18 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`)
// Semi-diurnal tide, period 12.42 h, 3 m amplitude, high water at 02:30.
const level = times.map((_, i) => Math.round(3 * Math.cos(2 * Math.PI * (i - 2.5) / 12.42) * 100) / 100)

describe('tideEvents', () => {
  it('finds alternating highs and lows with interpolated times and heights', () => {
    const ev = tideEvents(times, level)
    expect(ev.length).toBeGreaterThanOrEqual(7)
    expect(ev[0]).toMatchObject({ type: 'high', height: 3 }); expect(ev[0].time).toBe('2026-10-18 02:30')
    expect(ev[1].type).toBe('low'); expect(ev[1].time).toBe('2026-10-18 08:43'); expect(ev[1].height).toBe(-3)
    for (let i = 1; i < ev.length; i++) expect(ev[i].type).not.toBe(ev[i - 1].type)
  })
  it('ignores gaps and flat water', () => {
    expect(tideEvents(times, times.map(() => 0))).toEqual([])
    expect(tideEvents(times, times.map(() => null))).toEqual([])
    expect(tideEvents(times, [])).toEqual([])
    const gappy = level.map((v, i) => (i >= 1 && i <= 4 ? null : v))
    expect(tideEvents(times, gappy).find(e => e.time.startsWith('2026-10-18 02'))).toBeUndefined()
  })
})

describe('renderTides', () => {
  it('groups by day and prints HW/LW with signed heights', () => {
    const t = renderTides(tideEvents(times, level))
    expect(t.split('\n')).toHaveLength(2)
    expect(t.split('\n')[0]).toMatch(/^2026-10-18: HW 02:30 \(\+3 m\), LW 08:43 \(-3 m\), HW 14:55 \(\+3 m\), LW 21:08 \(-3 m\)$/)
    expect(renderTides([])).toBe('')
  })
})
