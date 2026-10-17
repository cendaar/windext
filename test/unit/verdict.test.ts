import { describe, it, expect } from 'vitest'
import { dayVerdict, riderRange, idealSize, sessionScore, CODES, type Rider } from '../../src/core/verdict.js'
import { renderVerdict, VERDICT_TEXT } from '../../src/core/verdict-i18n.js'
import { LANGS } from '../../src/i18n.js'
import type { Forecast, Hour } from '../../src/core/openmeteo.js'
import type { SpotCard } from '../../src/core/store.js'

const kite: Rider = { sport: 'kitesurf', weightKg: 80, sizes: [9, 12], level: 'intermediate' }
type HourFn = (h: number) => { s: number; g?: number; d?: number; spread?: number; cape?: number; p?: number; t?: number }

/** Two days of hourly forecast from a function of the hour; two models around the given mean, `spread` apart. */
function fc(f: HourFn, f2: HourFn = f, extra: Partial<Forecast> = {}): Forecast {
  const hours: Hour[] = []
  for (const [day, fn] of [['2026-10-17', f], ['2026-10-18', f2]] as const) for (let h = 0; h < 24; h++) {
    const v = fn(h), sp = v.spread ?? 1
    hours.push({ time: `${day}T${String(h).padStart(2, '0')}:00`, models: { a: { speed: v.s - sp / 2, gust: v.g ?? v.s * 1.25, dir: v.d ?? 90 }, b: { speed: v.s + sp / 2, gust: v.g ?? v.s * 1.25, dir: (v.d ?? 90) + 2 } }, temp: v.t ?? 18, precip: v.p ?? 0, cape: v.cape ?? 0, cloud: 50, speed80: v.s + 2 })
  }
  return { lat: 0, lon: 0, timezone: 'Europe/Paris', models: ['a', 'b'], hours, seaTemp: 18, waveHeight: [], seaLevel: [], waves: hours.map(() => ({ height: 0.5, dir: 0, period: 5 })), sun: [{ date: '2026-10-17', sunrise: '08:25', sunset: '19:07' }, { date: '2026-10-18', sunrise: '08:26', sunset: '19:05' }], issued: '2026-10-17 06:00', utcOffsetSeconds: 7200, ...extra }
}
const card = (wind: SpotCard['wind'] = []): SpotCard => ({ id: 'x', name: 'X', aliases: [], lat: 0, lon: 0, country: '', water: 'sea', facing_deg: 0, facing_source: 'user', sports: [], tide_notes: '', tide_offset_min: null, hazards: '', rules: '', launch_notes: '', season: '', kind: 'spot', status: 'community', sources: [], submissions: 1, updated_at: '', wind })
const V = (f: Forecast, o: Partial<Parameters<typeof dayVerdict>[2]> = {}, r: Rider = kite) => dayVerdict(f, r, { day: 'tomorrow', facing: 0, ...o })

describe('sizing', () => {
  it('matches common charts', () => {
    expect(idealSize('kitesurf', 75, 16)).toBeCloseTo(10.3, 1)
    expect(idealSize('wingfoil', 75, 18)).toBeCloseTo(4.4, 1)
    expect(idealSize('windsurf', 75, 20)).toBeCloseTo(5.4, 1)
  })
  it('derives the usable range from the quiver and caps it by level', () => {
    expect(riderRange(kite)).toEqual({ min: 12.8, max: 26.1 })
    expect(riderRange({ ...kite, level: 'beginner' }).max).toBe(20)
    expect(riderRange({ sport: 'wingfoil', weightKg: 60, sizes: [6], level: 'expert' }).min).toBe(9.1)
  })
})

describe('dayVerdict', () => {
  it('says yes with window, gear and a good score on a steady, agreed, side-shore day', () => {
    const v = V(fc(h => ({ s: h >= 11 && h <= 17 ? 17 : 6, d: 90 })))
    expect(v.status).toBe('go'); expect(v.window).toEqual({ start: '11:00', end: '18:00' }); expect(v.gear).toEqual({ size: 9, unit: 'm' })
    expect(v.score).toBeGreaterThanOrEqual(7); expect(v.codes).toEqual(expect.arrayContaining(['MODELS_AGREE', 'STEADY', 'SIDE_IDEAL', 'LONG_WINDOW']))
  })
  it('picks the bigger kite in lighter wind', () => { expect(V(fc(h => ({ s: h >= 10 && h <= 16 ? 13.5 : 5 }))).gear!.size).toBe(12) })
  it('says no when too light, with the peak', () => {
    const v = V(fc(h => ({ s: h === 14 ? 8 : 5 })))
    expect(v.status).toBe('no'); expect(v.score).toBe(0); expect(v.reasons[0].code).toBe('TOO_LIGHT'); expect(v.reasons[0].vars.peakTime).toBe('14:00')
  })
  it('distinguishes too light for the gear from no wind at all, and scores it 1', () => {
    const v = V(fc(() => ({ s: 11 })))
    expect(v.reasons[0].code).toBe('TOO_LIGHT_FOR_GEAR'); expect(v.score).toBe(1)
  })
  it('turns a gear-limited day into a check when the models disagree, with a morning rule', () => {
    const v = V(fc(() => ({ s: 11.5, spread: 12 })))
    expect(v.status).toBe('check'); expect(v.codes).toEqual(expect.arrayContaining(['MODELS_DISAGREE', 'CHECK_RULE'])); expect(v.score).toBe(2)
  })
  it('says no offshore, and no in a forbidden sector even onshore', () => {
    expect(V(fc(() => ({ s: 18, d: 180 }))).reasons[0].code).toBe('OFFSHORE')
    const f = V(fc(() => ({ s: 18, d: 0 })), { card: card([{ sector: 'N', quality: 'forbidden', note: '' }]) })
    expect(f.status).toBe('no'); expect(f.reasons[0].code).toBe('FORBIDDEN')
  })
  it('flags side-off as experts only and makes it a check for an intermediate', () => {
    const v = V(fc(() => ({ s: 17, d: 135 })))
    expect(v.status).toBe('check'); expect(v.reasons[0].code).toBe('SIDE_OFF_EXPERT')
    expect(V(fc(() => ({ s: 17, d: 135 })), {}, { ...kite, level: 'expert' }).codes).toContain('SIDE_OFF_EXPERT')
  })
  it('says too strong, and too strong for a beginner', () => {
    expect(V(fc(() => ({ s: 32, g: 40 }))).reasons[0].code).toBe('TOO_STRONG')
    expect(V(fc(() => ({ s: 23, g: 27 })), {}, { ...kite, level: 'beginner' }).reasons[0].code).toBe('BEGINNER_TOO_STRONG')
  })
  it('catches storms', () => { expect(V(fc(() => ({ s: 18, cape: 1500, p: 4 }))).reasons[0].code).toBe('STORM') })
  it('downgrades to check when the models disagree inside the window, and adds the rule', () => {
    const v = V(fc(() => ({ s: 17, spread: 12 })))
    expect(v.status).toBe('check'); expect(v.confidence).toBe('low'); expect(v.codes).toContain('CHECK_RULE')
  })
  it('names gusty and dangerously gusty days, and leans small', () => {
    const g = V(fc(() => ({ s: 16, g: 27 })))
    expect(g.codes).toContain('GUSTY'); expect(g.gear!.size).toBe(9)
    const d = V(fc(() => ({ s: 16, g: 31 })))
    expect(d.codes).toContain('GUSTY_DANGER'); expect(d.status).toBe('check')
  })
  it('reports late build, early drop and short windows', () => {
    expect(V(fc(h => ({ s: h >= 14 && h <= 18 ? 17 : 6 }))).codes).toContain('BUILDS_LATE')
    expect(V(fc(h => ({ s: h >= 9 && h <= 13 ? 17 : 6 }))).codes).toContain('DROPS_EARLY')
    const short = V(fc(h => ({ s: h === 12 || h === 13 ? 17 : 6 })))
    expect(short.codes).toContain('SHORT_WINDOW'); expect(short.window).toEqual({ start: '12:00', end: '14:00' })
    expect(V(fc(h => ({ s: h === 12 || h === 13 ? 17 : 6, spread: 6 }))).status).toBe('check')   // short and not clearly agreed
  })
  it('mentions showers, onshore waves, cold and tide inside the window', () => {
    const v = V(fc(() => ({ s: 17, d: 0, cape: 200, p: 1, t: 10 }), undefined, { waves: Array(48).fill({ height: 1.4, dir: 0, period: 6 }), seaTemp: 12 }), { tide: [{ time: '2026-10-18T13:00', type: 'high' }] })
    expect(v.codes).toEqual(expect.arrayContaining(['SHOWERS', 'ONSHORE_WAVES', 'COLD', 'TIDE_HIGH']))
  })
  it('only considers the hours left today, and says the day is over in the evening', () => {
    const f = fc(h => ({ s: h >= 9 && h <= 12 ? 17 : 6 }))
    expect(dayVerdict(f, kite, { day: 'today', facing: 0, nowLocal: '2026-10-17 14:30' }).status).toBe('no')
    expect(dayVerdict(f, kite, { day: 'today', facing: 0, nowLocal: '2026-10-17 20:10' }).codes).toContain('DAY_OVER')
    expect(dayVerdict(f, kite, { day: 'today', facing: 0, nowLocal: '2026-10-17 07:00' }).window).toEqual({ start: '09:00', end: '13:00' })
  })
  it('never starts before sunrise or ends after sunset', () => {
    const v = V(fc(() => ({ s: 17 })))
    expect(v.window).toEqual({ start: '09:00', end: '20:00' }); expect(v.codes).toContain('DARK_SOON')
  })
  it('keeps a safety note when the orientation is unknown', () => {
    const v = V(fc(() => ({ s: 17 })), { facing: null })
    expect(v.reasons.at(-1)!.code).toBe('NO_ORIENTATION'); expect(v.reasons.length).toBeLessThanOrEqual(4)
  })
  it('a blocking official warning makes today a no, and is cited tomorrow', () => {
    const f = fc(() => ({ s: 17 }))
    const t = dayVerdict(f, kite, { day: 'today', facing: 0, nowLocal: '2026-10-17 07:00', alerts: [{ event: 'Gale Warning', blocking: true }] })
    expect(t.status).toBe('no'); expect(t.reasons[0]).toEqual({ code: 'ALERT', vars: { event: 'Gale Warning' } }); expect(t.score).toBe(0)
    const m = V(f, { alerts: [{ event: 'Gale Warning', blocking: true }] }); expect(m.status).toBe('check'); expect(m.codes).toContain('ALERT')
  })
  it('never says go below a score of 5, and shows at most 3 reasons plus the orientation note', () => {
    for (const s of [12, 14, 16, 18, 20, 24]) for (const g of [1.1, 1.5, 1.9]) for (const d of [0, 45, 90, 135]) {
      const v = V(fc(() => ({ s, g: s * g, d })))
      if (v.status === 'go') expect(v.score).toBeGreaterThanOrEqual(5)
      expect(v.reasons.filter(r => r.code !== 'NO_ORIENTATION').length).toBeLessThanOrEqual(3)
      expect(v.score).toBeGreaterThanOrEqual(0); expect(v.score).toBeLessThanOrEqual(10)
    }
  })
})

describe('sessionScore', () => {
  it('is monotonic in length, fit, gusts and confidence', () => {
    const base = { hours: 5, speed: 17, gust: 20, idealKn: 17, gustFactor: 1.2, confidence: 'high' as const, shore: 'side', level: 'intermediate' as const }
    expect(sessionScore(base)).toBe(10)
    expect(sessionScore({ ...base, hours: 2 })).toBeLessThan(10)
    expect(sessionScore({ ...base, speed: 12 })).toBeLessThan(sessionScore(base))
    expect(sessionScore({ ...base, gustFactor: 1.9 })).toBeLessThan(sessionScore(base))
    expect(sessionScore({ ...base, confidence: 'low' })).toBe(6)
    expect(sessionScore({ ...base, shore: 'side-off' })).toBe(5)
  })
})

describe('templates', () => {
  it('exist for every code, headline and language, with the same placeholders as English', () => {
    const keys = ['GO', 'CHECK_W', 'CHECK', 'NO', 'TODAY', 'TOMORROW', ...CODES]
    const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort()
    for (const l of LANGS) for (const k of keys) {
      const t = (VERDICT_TEXT[l] as any)[k]
      expect(t, `${l}:${k}`).toBeTruthy(); expect(ph(t), `${l}:${k}`).toEqual(ph((VERDICT_TEXT.en as any)[k]))
    }
  })
  it('render with no leftover placeholder, local decimals and local compass names', () => {
    const v = V(fc(() => ({ s: 17, d: 270 }), undefined, { waves: Array(48).fill({ height: 1.4, dir: 0, period: 6 }) }), { facing: 270 })
    for (const l of LANGS) { const r = renderVerdict(v, l); expect([r.headline, ...r.reasons].join(' '), l).not.toMatch(/\{|\}|undefined|NaN/) }
    const fr = renderVerdict(V(fc(() => ({ s: 17, d: 225 })), { facing: 135 }), 'fr')
    expect(fr.reasons.join(' ')).toMatch(/Vent de SO/)
    const w = renderVerdict(V(fc(() => ({ s: 17, d: 0 }), undefined, { waves: Array(48).fill({ height: 1.4, dir: 0, period: 6 }) })), 'fr')
    expect(w.reasons.join(' ')).toMatch(/1,4 m/)
  })
})
