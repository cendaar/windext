import type { Forecast, Hour } from './openmeteo.js'
import { MODEL_LABELS } from './openmeteo.js'

export const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compass = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16]
const r1 = (v: number) => Math.round(v * 10) / 10
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const circMean = (degs: number[]) => {
  const x = mean(degs.map(d => Math.cos(d * Math.PI / 180))), y = mean(degs.map(d => Math.sin(d * Math.PI / 180)))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

export interface HourSummary {
  time: string
  speed: number; gust: number; dir: number
  spread: number          // max-min of model mean speeds, kn
  gustFactor: number      // gust / speed
  agreement: 'high' | 'medium' | 'low'
  shore?: 'onshore' | 'side-on' | 'side' | 'side-off' | 'offshore'
}

/** Angle of the wind relative to a beach: `facing` is the direction the beach faces (towards the sea), in degrees. */
export function shoreRelation(windFrom: number, facing: number): HourSummary['shore'] {
  const d = angDiff(windFrom, facing) // 0 = wind blowing straight from the sea onto the beach
  if (d <= 30) return 'onshore'
  if (d <= 60) return 'side-on'
  if (d <= 110) return 'side'
  if (d <= 150) return 'side-off'
  return 'offshore'
}

export function summarizeHour(h: Hour, facing?: number): HourSummary | null {
  const speeds = Object.values(h.models).map(m => m.speed).filter((v): v is number => v != null)
  const gusts = Object.values(h.models).map(m => m.gust).filter((v): v is number => v != null)
  const dirs = Object.values(h.models).map(m => m.dir).filter((v): v is number => v != null)
  if (!speeds.length) return null
  const speed = mean(speeds), gust = gusts.length ? mean(gusts) : speed, dir = dirs.length ? circMean(dirs) : 0
  const spread = Math.max(...speeds) - Math.min(...speeds)
  const dirSpread = dirs.length ? Math.max(...dirs.map(d => angDiff(d, dir))) : 0
  // dirSpread is the largest deviation from the mean direction: 20° means models sit within a 40° fan.
  const agreement = spread <= 4 && dirSpread <= 20 ? 'high' : spread <= 8 && dirSpread <= 40 ? 'medium' : 'low'
  return { time: h.time, speed: r1(speed), gust: r1(gust), dir: Math.round(dir), spread: r1(spread), gustFactor: r1(speed > 0 ? gust / speed : 0), agreement, shore: facing == null ? undefined : shoreRelation(dir, facing) }
}

export interface Window { start: string; end: string; hours: number; avgSpeed: number; avgGust: number; dir: string; agreement: HourSummary['agreement']; shore?: HourSummary['shore'] }

/** Contiguous runs where the model-mean wind sits inside [min,max] kn and the direction is usable. */
export function findWindows(hours: HourSummary[], min: number, max: number, opts: { allowOffshore?: boolean; dayStart?: number; dayEnd?: number } = {}): Window[] {
  const { allowOffshore = false, dayStart = 7, dayEnd = 21 } = opts
  const ok = (h: HourSummary) => {
    const hr = +h.time.slice(11, 13)
    return h.speed >= min && h.speed <= max && hr >= dayStart && hr <= dayEnd && (allowOffshore || h.shore !== 'offshore')
  }
  const out: Window[] = []; let run: HourSummary[] = []
  const flush = () => {
    if (run.length >= 2) {
      const ag = run.some(h => h.agreement === 'low') ? 'low' : run.some(h => h.agreement === 'medium') ? 'medium' : 'high'
      out.push({ start: run[0].time, end: run[run.length - 1].time, hours: run.length, avgSpeed: r1(mean(run.map(h => h.speed))), avgGust: r1(mean(run.map(h => h.gust))), dir: compass(circMean(run.map(h => h.dir))), agreement: ag, shore: run[Math.floor(run.length / 2)].shore })
    }
    run = []
  }
  const consecutive = (prev: HourSummary | undefined, h: HourSummary) => !prev || new Date(h.time).getTime() - new Date(prev.time).getTime() === 3.6e6
  for (const h of hours) {
    if (!consecutive(run[run.length - 1], h)) flush()   // a gap (night, filtered hour) ends the run
    if (ok(h)) run.push(h); else flush()
  }
  flush()
  return out
}

/** Why is it gusty? Returns short diagnostic lines a rider can act on. */
export function gustDiagnostics(fc: Forecast, hours: HourSummary[]): string[] {
  const out: string[] = []
  const daytime = fc.hours.filter(h => { const hr = +h.time.slice(11, 13); return hr >= 8 && hr <= 20 })
  if (!daytime.length) return out
  const avgGF = mean(hours.filter(h => +h.time.slice(11, 13) >= 8 && +h.time.slice(11, 13) <= 20).map(h => h.gustFactor).filter(v => v > 0))
  if (avgGF >= 1.8) out.push(`Gust factor ${r1(avgGF)}: gusts nearly double the mean wind, expect holes and overpowered spikes.`)
  else if (avgGF >= 1.4) out.push(`Gust factor ${r1(avgGF)}: moderately gusty.`)
  else out.push(`Gust factor ${r1(avgGF)}: steady wind.`)
  const temps = daytime.map(h => h.temp).filter((v): v is number => v != null)
  if (fc.seaTemp != null && temps.length) {
    const delta = r1(fc.seaTemp - mean(temps))
    if (delta >= 2) out.push(`Air ${r1(mean(temps))}°C over sea ${fc.seaTemp}°C (sea warmer by ${delta}°C): unstable marine layer, convective gusts bring faster air down from altitude.`)
    else if (delta <= -3) out.push(`Air warmer than the sea by ${-delta}°C: stable layer, wind at the surface may stay below forecast, especially near shore.`)
  }
  const cape = daytime.map(h => h.cape).filter((v): v is number => v != null)
  const rain = daytime.map(h => h.precip).filter((v): v is number => v != null)
  if (cape.length && Math.max(...cape) >= 100 && rain.some(p => p >= 0.5)) out.push(`Showery regime (CAPE up to ${Math.max(...cape)} J/kg, rain episodes): each shower brings a downdraft gust then a lull.`)
  const shear = daytime.map(h => h.speed80 != null ? h.speed80 - mean(Object.values(h.models).map(m => m.speed ?? 0)) : 0)
  if (mean(shear) >= 5) out.push(`Wind at 80 m is ~${r1(mean(shear))} kn stronger than at 10 m: strong shear, gusts are that upper wind touching the water.`)
  const low = hours.filter(h => h.agreement === 'low').length / Math.max(1, hours.length)
  if (low >= 0.4) out.push(`Models disagree on ${Math.round(low * 100)}% of hours: low predictability, re-check the morning run and live stations before driving.`)
  return out
}

/** Compact text rendering, built to cost few tokens. One line per hour, one column per model: speed/gust dir. */
export function renderTable(fc: Forecast, hours: HourSummary[], opts: { from?: number; to?: number } = {}): string {
  const { from = 6, to = 21 } = opts
  const cols = fc.models.map(m => MODEL_LABELS[m] ?? m)
  const lines: string[] = []
  lines.push(`Wind in knots, hourly, local time (${fc.timezone}). Cell = mean/gust dir. Last columns = model mean, spread between models, agreement.`)
  lines.push(['Time', ...cols, 'MEAN', 'SPREAD', 'AGREE'].join(' | '))
  let day = ''
  for (const h of fc.hours) {
    const hr = +h.time.slice(11, 13); if (hr < from || hr > to) continue
    const s = hours.find(x => x.time === h.time); if (!s) continue
    const d = h.time.slice(0, 10); if (d !== day) { day = d; lines.push(`-- ${d} --`) }
    const cells = fc.models.map(m => { const v = h.models[m]; return v.speed == null ? '-' : `${Math.round(v.speed)}/${Math.round(v.gust ?? v.speed)} ${compass(v.dir ?? 0)}` })
    lines.push([h.time.slice(11, 16), ...cells, `${Math.round(s.speed)}/${Math.round(s.gust)} ${compass(s.dir)}${s.shore ? ' ' + s.shore : ''}`, `${s.spread}`, s.agreement].join(' | '))
  }
  return lines.join('\n')
}
