/** Session verdict: "is it worth going, when, with what", for today and tomorrow.
 *  Fully deterministic rules over the multi-model forecast; the text comes from pre-written templates (verdict-i18n.ts).
 *  Shared by the iOS app (/v1/verdict) and the MCP tool. */
import type { Forecast } from './openmeteo.js'
import { summarizeHour, compass, daylightMap, type HourSummary } from './analysis.js'
import type { SpotCard, WindQuality } from './store.js'

export type Sport = 'kitesurf' | 'wingfoil' | 'windsurf'
export type Level = 'beginner' | 'intermediate' | 'expert'
export interface Rider { sport: Sport; weightKg: number; sizes: number[]; level: Level }
export type Status = 'go' | 'check' | 'no'

/** Reason codes, in priority order for display. Each has a template per language. */
export const CODES = [
  // blockers and safety first: they decide the verdict and must always be visible
  'ALERT', 'NIGHT_ONLY', 'DAY_OVER', 'STORM', 'OFFSHORE', 'FORBIDDEN', 'TOO_STRONG', 'BEGINNER_TOO_STRONG', 'TOO_LIGHT', 'TOO_LIGHT_FOR_GEAR',
  'ALT_SPOT', 'GUSTY_DANGER', 'SIDE_OFF_EXPERT', 'MODELS_DISAGREE', 'CHECK_RULE', 'ONSHORE_WAVES',
  // then the character of the wind and the timing
  'MODELS_AGREE', 'GUSTY', 'STEADY', 'SHOWERS', 'BUILDS_LATE', 'DROPS_EARLY', 'SHORT_WINDOW', 'TIDE_HIGH', 'TIDE_LOW',
  'SIDE_IDEAL', 'ONSHORE', 'UNSTABLE_SEA', 'LONG_WINDOW', 'GEAR_BETWEEN', 'COLD', 'DARK_SOON', 'NO_ORIENTATION',
] as const
export type Code = typeof CODES[number]

export interface Reason { code: Code; vars: Record<string, string | number> }
export interface DayVerdict {
  day: 'today' | 'tomorrow'
  date: string
  status: Status
  headline: { code: 'GO' | 'CHECK' | 'NO'; vars: Record<string, string | number> }
  reasons: Reason[]           // at most 3, most important first
  window: { start: string; end: string } | null   // 'HH:MM' local
  gear: { size: number; unit: 'm' | 'm²' } | null
  wind: { speed: number; gust: number; dir: string } | null   // averages over the window (or the daylight hours when no window)
  confidence: 'high' | 'medium' | 'low'
  score: number              // windext score, 0-10: one number for the day
  codes: Code[]               // every code that applied, for tests and statistics
}

/** Size that gives an average rider normal power at `kn` knots. Rules of thumb, tuned to common charts. */
export function idealSize(sport: Sport, weightKg: number, kn: number): number {
  const k = sport === 'kitesurf' ? 2.2 : sport === 'wingfoil' ? 1.05 : 1.45
  return (k * weightKg) / Math.max(kn, 1)
}
export const unitFor = (sport: Sport): 'm' | 'm²' => (sport === 'windsurf' ? 'm²' : 'm')

/** Wind range the rider's quiver covers: from the biggest gear stretched 15% to the smallest gear held 25% beyond its ideal. */
export function riderRange(r: Rider): { min: number; max: number } {
  const k = r.sport === 'kitesurf' ? 2.2 : r.sport === 'wingfoil' ? 1.05 : 1.45
  const big = Math.max(...r.sizes), small = Math.min(...r.sizes)
  const absoluteMin = r.sport === 'wingfoil' ? 9 : r.sport === 'kitesurf' ? 10 : 11
  let min = Math.max(absoluteMin, (k * r.weightKg) / (big * 1.15))
  let max = (k * r.weightKg) / (small * 0.75)
  if (r.level === 'beginner') max = Math.min(max, 20)
  if (r.level === 'intermediate') max = Math.min(max, 30)
  return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 }
}

const hm = (iso: string) => iso.slice(11, 16)
const hourOf = (iso: string) => +iso.slice(11, 13)
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
const r0 = (v: number) => Math.round(v)
const sectorQuality = (card: SpotCard | null | undefined, dir: number): WindQuality | undefined => card?.wind.find(w => w.sector === compass(dir))?.quality

/** windext score, 0-10. Window length and how well the wind suits the rider's gear, scaled down by gusts, model disagreement and a poor direction.
 *  Calibration: 8-10 a day to remember, 6-7 a good session, 4-5 rideable with compromises, 1-3 marginal, 0 do not go. */
export function sessionScore(p: { hours: number; speed: number; gust: number; idealKn: number; gustFactor: number; confidence: 'high' | 'medium' | 'low'; shore?: string; level: Level }): number {
  const length = Math.min(p.hours / 5, 1)
  const fit = Math.max(0, 1 - Math.abs(p.speed - p.idealKn) / (0.4 * p.idealKn))
  const gust = p.gustFactor <= 1.35 ? 1 : Math.max(0.45, 1 - (p.gustFactor - 1.35) * 0.9)
  const conf = p.confidence === 'high' ? 1 : p.confidence === 'medium' ? 0.85 : 0.6
  const shore = p.shore === 'side' || p.shore === 'side-on' ? 1 : p.shore === 'onshore' ? 0.85 : p.shore === 'side-off' ? (p.level === 'expert' ? 0.75 : 0.5) : 0.9
  return Math.max(1, Math.min(10, Math.round(10 * (0.3 * length + 0.7 * fit) * gust * conf * shore)))
}

/** A nearby known spot where wind from `dir` is side or side-on (and not a forbidden sector). */
export function alternativeSpot(dir: number, nearby: (SpotCard & { distance_km: number })[] = [], excludeId?: string): { name: string; km: number } | null {
  const ang = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
  const ok = nearby
    .filter(n => n.id !== excludeId && n.kind === 'spot' && n.facing_deg != null && n.distance_km > 0.5)
    .filter(n => { const q = n.wind.find(w => w.sector === compass(dir))?.quality; if (q === 'forbidden' || q === 'marginal') return false; if (q === 'best' || q === 'ok') return true; const d = ang(dir, n.facing_deg!); return d > 30 && d <= 100 })
    .sort((a, b) => a.distance_km - b.distance_km)
  return ok[0] ? { name: ok[0].name, km: Math.round(ok[0].distance_km) } : null
}

interface HourEval { s: HourSummary; ok: boolean; why: Code | null; storm: boolean; cape: number; precip: number }

export function dayVerdict(fc: Forecast, rider: Rider, opts: { day: 'today' | 'tomorrow'; facing?: number | null; card?: SpotCard | null; nowLocal?: string; tide?: { time: string; type: 'high' | 'low' }[]; alerts?: { event: string; blocking: boolean }[]; nearby?: (SpotCard & { distance_km: number })[] }): DayVerdict {
  const nowLocal = opts.nowLocal ?? fc.issued                      // 'YYYY-MM-DD HH:MM' at the spot
  const today = nowLocal.slice(0, 10)
  const date = opts.day === 'today' ? today : (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) })()
  const dl = daylightMap(fc)[date] ?? [7, 19]
  const sun = fc.sun.find(s => s.date === date)
  const facing = opts.facing ?? opts.card?.facing_deg ?? undefined
  const range = riderRange(rider)
  const codes = new Set<Code>()
  if (facing == null) codes.add('NO_ORIENTATION')

  const dayHours = fc.hours.filter(h => h.time.startsWith(date))
  const nowHour = opts.day === 'today' ? +nowLocal.slice(11, 13) + (+nowLocal.slice(14, 16) > 0 ? 1 : 0) : -1
  const usable = dayHours.filter(h => hourOf(h.time) >= dl[0] && hourOf(h.time) <= dl[1] && hourOf(h.time) >= nowHour)

  const base = (status: Status, head: DayVerdict['headline'], reasons: Reason[], extra: Partial<DayVerdict> = {}): DayVerdict => {
    const shown = reasons.filter(r => r.code !== 'NO_ORIENTATION').slice(0, 3)
    // Safety note stays visible whenever the verdict is not a plain no
    if (status !== 'no' && codes.has('NO_ORIENTATION')) shown.push({ code: 'NO_ORIENTATION', vars: {} })
    return { day: opts.day, date, status, headline: head, reasons: shown, window: null, gear: null, wind: null, confidence: 'medium', score: 0, codes: [...codes], ...extra }
  }

  if (!dayHours.length) { codes.add('NIGHT_ONLY'); return base('no', { code: 'NO', vars: {} }, [{ code: 'NIGHT_ONLY', vars: {} }]) }
  if (!usable.length) {
    codes.add(opts.day === 'today' && hourOf(dayHours[0].time) <= dl[1] ? 'DAY_OVER' : 'NIGHT_ONLY')
    return base('no', { code: 'NO', vars: {} }, [{ code: [...codes].includes('DAY_OVER') ? 'DAY_OVER' : 'NIGHT_ONLY', vars: { sunset: sun?.sunset ?? '' } }])
  }

  const blocking = (opts.alerts ?? []).find(a => a.blocking)
  if (blocking && opts.day === 'today') {
    codes.add('ALERT')
    return base('no', { code: 'NO', vars: {} }, [{ code: 'ALERT', vars: { event: blocking.event } }], { score: 0, confidence: 'high' })
  }

  /** Two hours before `fromHour`, never before 06:00 and never in the past today. */
  const checkAt = (fromHour: number) => `${String(Math.max(fromHour - 2, 6, opts.day === 'today' ? nowHour : 0)).padStart(2, '0')}:00`

  const evals: HourEval[] = usable.map(h => {
    const s = summarizeHour(h, facing)!
    const cape = h.cape ?? 0, precip = h.precip ?? 0
    const storm = cape >= 800 && precip >= 1
    const q = sectorQuality(opts.card, s.dir)
    let why: Code | null = null
    if (storm) why = 'STORM'
    else if (q === 'forbidden') why = 'FORBIDDEN'
    else if (s.shore === 'offshore') why = 'OFFSHORE'
    else if (s.speed < range.min) why = s.speed >= (rider.sport === 'kitesurf' ? 10 : 9) ? 'TOO_LIGHT_FOR_GEAR' : 'TOO_LIGHT'
    else if (s.speed > range.max || s.gust > range.max * 1.35) why = rider.level === 'beginner' && s.speed <= range.max * 1.5 ? 'BEGINNER_TOO_STRONG' : 'TOO_STRONG'
    return { s, ok: why == null, why, storm, cape, precip }
  })

  // Longest contiguous rideable run
  let best: HourEval[] = [], run: HourEval[] = []
  for (const e of evals) { if (e.ok) { run.push(e); if (run.length > best.length) best = [...run] } else run = [] }

  const all = evals.map(e => e.s)
  const showers = evals.some(e => e.cape >= 100 && e.precip >= 0.5)
  const daySea = fc.seaTemp
  const airs = usable.map(h => h.temp).filter((t): t is number => t != null)
  const dayAir: number | null = airs.length ? mean(airs) : null

  if (best.length < 2) {
    // Why not? The most frequent blocker during daylight.
    const counts = new Map<Code, number>(); for (const e of evals) if (e.why) counts.set(e.why, (counts.get(e.why) ?? 0) + 1)
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'TOO_LIGHT'
    for (const c of counts.keys()) codes.add(c)
    const avg = { speed: r0(mean(all.map(s => s.speed))), gust: r0(mean(all.map(s => s.gust))), dir: compass(mean(all.map(s => s.dir))) }
    const peak = all.reduce((a, b) => (b.speed > a.speed ? b : a))
    const reasons: Reason[] = [{ code: main, vars: { speed: avg.speed, gust: avg.gust, peak: r0(peak.speed), peakTime: hm(peak.time), min: r0(range.min), max: r0(range.max), dir: avg.dir } }]
    if ((main === 'OFFSHORE' || main === 'FORBIDDEN') && opts.nearby?.length) {
      const blockedHours = evals.filter(e => e.why === main)
      const alt = alternativeSpot(mean(blockedHours.map(e => e.s.dir)), opts.nearby, opts.card?.id)
      const strongEnough = mean(blockedHours.map(e => e.s.speed)) >= range.min
      if (alt && strongEnough) { codes.add('ALT_SPOT'); reasons.push({ code: 'ALT_SPOT', vars: { dir: avg.dir, alt: alt.name, km: alt.km } }) }
    }
    // Single rideable hour: say so, it is useful
    if (best.length === 1) { codes.add('SHORT_WINDOW'); reasons.push({ code: 'SHORT_WINDOW', vars: { start: hm(best[0].s.time), end: `${String(hourOf(best[0].s.time) + 1).padStart(2, '0')}:00` } }) }
    const disagree = all.filter(s => s.agreement === 'low').length / all.length >= 0.5
    if (disagree && (main === 'TOO_LIGHT_FOR_GEAR' || main === 'TOO_STRONG')) { codes.add('MODELS_DISAGREE'); reasons.push({ code: 'MODELS_DISAGREE', vars: { spread: r0(mean(all.map(s => s.spread))) } }) }
    const status: Status = disagree && (main === 'TOO_LIGHT_FOR_GEAR' || best.length === 1) ? 'check' : 'no'
    if (status === 'check') { codes.add('CHECK_RULE'); reasons.push({ code: 'CHECK_RULE', vars: { min: r0(range.min), max: r0(range.max), checkTime: checkAt(best.length ? hourOf(best[0].s.time) : dl[0] + 1) } }) }
    const hard = ['STORM', 'OFFSHORE', 'FORBIDDEN', 'TOO_LIGHT'].includes(main)
    const score = status === 'check' ? 2 : hard ? 0 : 1   // a maybe is never scored 0
    return base(status, { code: status === 'check' ? 'CHECK' : 'NO', vars: {} }, reasons, { wind: avg, confidence: disagree ? 'low' : 'medium', score })
  }

  // There is a window
  const w = best.map(e => e.s)
  const start = hm(w[0].time), end = hm(w[w.length - 1].time)
  const nextHour = `${String(+end.slice(0, 2) + 1).padStart(2, '0')}:00`   // the last rideable hour lasts until the next one, but not past sunset
  const endPlus = sun?.sunset && sun.sunset < nextHour ? sun.sunset : nextHour
  const avg = { speed: r0(mean(w.map(s => s.speed))), gust: r0(mean(w.map(s => s.gust))), dir: compass(mean(w.map(s => s.dir))) }
  const gf = mean(w.map(s => s.gustFactor))
  const lowShare = w.filter(s => s.agreement === 'low').length / w.length
  const highShare = w.filter(s => s.agreement === 'high').length / w.length
  const spread = r0(mean(w.map(s => s.spread)))
  const confidence: DayVerdict['confidence'] = lowShare >= 0.5 ? 'low' : highShare >= 0.5 ? 'high' : 'medium'

  // Gear: size for an effective wind a bit above the mean when gusty; on a tie, the smaller one when gusty
  const effKn = avg.speed + (gf >= 1.5 ? 0.3 * (avg.gust - avg.speed) : 0)
  const target = idealSize(rider.sport, rider.weightKg, effKn) * (gf >= 1.5 ? 0.93 : 1)   // gusty: lean small
  const sizes = [...rider.sizes].sort((a, b) => a - b)
  const pick = sizes.reduce((a, b) => { const da = Math.abs(a - target), db = Math.abs(b - target); return db < da - 0.05 || (Math.abs(db - da) <= 0.05 && gf >= 1.5 ? b < a : false) ? b : a })
  const gear = { size: pick, unit: unitFor(rider.sport) }

  const reasons: Reason[] = []
  const add = (code: Code, vars: Record<string, string | number> = {}) => { codes.add(code); reasons.push({ code, vars }) }

  if (lowShare >= 0.5) add('MODELS_DISAGREE', { spread })
  else if (highShare >= 0.5) add('MODELS_AGREE', {})
  if (gf >= 1.9 && avg.gust > range.max) add('GUSTY_DANGER', { gust: avg.gust, speed: avg.speed })
  else if (gf >= 1.6) add('GUSTY', { gust: avg.gust, speed: avg.speed })
  else if (gf < 1.35) add('STEADY', { speed: avg.speed })
  if (showers) add('SHOWERS', {})
  const midShore = w[Math.floor(w.length / 2)].shore
  if (daySea != null && dayAir != null && daySea - dayAir >= 3 && midShore !== 'offshore' && midShore !== 'side-off' && gf >= 1.5) add('UNSTABLE_SEA', { sea: r0(daySea), air: r0(dayAir) })
  if (midShore === 'side' || midShore === 'side-on') add('SIDE_IDEAL', { dir: avg.dir })
  else if (midShore === 'onshore') { const waves = fc.waves.find((_, i) => fc.hours[i]?.time === w[0].time)?.height ?? 0; add(waves >= 1 ? 'ONSHORE_WAVES' : 'ONSHORE', { waves: Math.round(waves * 10) / 10 }) }
  else if (midShore === 'side-off') add('SIDE_OFF_EXPERT', { dir: avg.dir })
  const firstRideable = w[0].time, lastRideable = w[w.length - 1].time
  if (hourOf(firstRideable) - Math.max(dl[0], nowHour) >= 3) add('BUILDS_LATE', { start })
  if (dl[1] - hourOf(lastRideable) >= 3) add('DROPS_EARLY', { end: endPlus })
  if (w.length <= 2) add('SHORT_WINDOW', { start, end: endPlus })
  else if (w.length >= 6) add('LONG_WINDOW', { hours: w.length })
  if (sizes.length > 1 && Math.abs(pick - target) / target > 0.25) add('GEAR_BETWEEN', { size: pick })
  if (dayAir != null && daySea != null && Math.min(daySea, dayAir) <= 14) add('COLD', { water: r0(daySea), air: r0(dayAir) })
  if (dl[1] - hourOf(lastRideable) <= 0 && sun?.sunset) add('DARK_SOON', { sunset: sun.sunset })
  for (const t of opts.tide ?? []) {
    if (!t.time.startsWith(date)) continue
    const th = +t.time.slice(11, 13)
    if (th >= hourOf(firstRideable) && th <= hourOf(lastRideable)) { add(t.type === 'high' ? 'TIDE_HIGH' : 'TIDE_LOW', { time: t.time.slice(11, 16) }); break }
  }

  const risky = codes.has('GUSTY_DANGER') || codes.has('SIDE_OFF_EXPERT') && rider.level !== 'expert' || !!blocking
  const score = sessionScore({ hours: w.length, speed: effKn, gust: avg.gust, idealKn: (rider.sport === 'kitesurf' ? 2.2 : rider.sport === 'wingfoil' ? 1.05 : 1.45) * rider.weightKg / pick, gustFactor: gf, confidence, shore: midShore, level: rider.level })
  // A plain yes needs a decent score: below 5 the session is rideable but not worth driving for without checking
  const status: Status = confidence === 'low' || risky || score < 5 || (w.length <= 2 && confidence !== 'high') ? 'check' : 'go'
  if (midShore === 'side-off' && opts.nearby?.length) { const alt = alternativeSpot(mean(w.map(x => x.dir)), opts.nearby, opts.card?.id); if (alt) add('ALT_SPOT', { dir: avg.dir, alt: alt.name, km: alt.km }) }
  if (status === 'check') add('CHECK_RULE', { min: r0(range.min), max: r0(Math.min(range.max, avg.gust + 5)), checkTime: checkAt(+start.slice(0, 2)) })
  if (blocking) add('ALERT', { event: blocking.event })
  // Order: priority list
  reasons.sort((a, b) => CODES.indexOf(a.code) - CODES.indexOf(b.code))
  // Keep the decisive ones first: disagreement or danger, then the wind character, then the shore/timing
  return base(status, { code: status === 'go' ? 'GO' : 'CHECK', vars: { start, end: endPlus, size: pick, unit: gear.unit } }, reasons, {
    window: { start, end: endPlus }, gear, wind: avg, confidence,
    score,
  })
}
