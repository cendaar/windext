/** Runs the verdict engine on real forecasts: 40 spots x 7 days x 6 rider profiles, renders every verdict in 7 languages,
 *  checks invariants and reports which reason codes occur. Usage: npx tsx scripts/verdict-sweep.ts */
import { fetchForecast } from '../src/core/openmeteo.js'
import { dayVerdict, CODES, type Rider, type Code } from '../src/core/verdict.js'
import { renderVerdict } from '../src/core/verdict-i18n.js'
import { LANGS } from '../src/i18n.js'
import { SPOTS } from './sweep.js'
import { writeFileSync } from 'node:fs'

const PROFILES: [string, Rider][] = [
  ['kite 80kg 9/12 intermediate', { sport: 'kitesurf', weightKg: 80, sizes: [9, 12], level: 'intermediate' }],
  ['kite 60kg 7/9/12 beginner', { sport: 'kitesurf', weightKg: 60, sizes: [7, 9, 12], level: 'beginner' }],
  ['kite 95kg 12/15 expert', { sport: 'kitesurf', weightKg: 95, sizes: [12, 15], level: 'expert' }],
  ['wing 75kg 4/5.5 intermediate', { sport: 'wingfoil', weightKg: 75, sizes: [4, 5.5], level: 'intermediate' }],
  ['windsurf 85kg 4.7/5.8 expert', { sport: 'windsurf', weightKg: 85, sizes: [4.7, 5.8], level: 'expert' }],
  ['kite 70kg 5/7 expert (strong-wind quiver)', { sport: 'kitesurf', weightKg: 70, sizes: [5, 7], level: 'expert' }],
]
const codeCount = new Map<Code, number>(), status = { go: 0, check: 0, no: 0 }, scores = Array(11).fill(0)
const examples = new Map<Code, string>(), problems: string[] = [], combos = new Map<string, number>()
let n = 0
for (const s of SPOTS) {
  let fc
  try { fc = await fetchForecast({ lat: s.lat, lon: s.lon, days: 7 }) } catch (e) { problems.push(`${s.name}: fetch ${e}`); continue }
  const dates = [...new Set(fc.hours.map(h => h.time.slice(0, 10)))]
  for (let i = 0; i < dates.length - 1; i++) {
    // Pretend "now" is 06:00 on each date to get a today and a tomorrow verdict for every day of the week
    const nowLocal = i === 0 ? fc.issued : `${dates[i]} 06:00`
    for (const [pname, rider] of PROFILES) for (const day of ['today', 'tomorrow'] as const) {
      if (i > 0 && day === 'today' && false) continue
      const v = dayVerdict(fc, rider, { day, facing: s.facing ?? null, nowLocal })
      n++; status[v.status]++; scores[v.score]++
      for (const c of v.codes) { codeCount.set(c, (codeCount.get(c) ?? 0) + 1); if (!examples.has(c) && v.reasons.some(r => r.code === c)) examples.set(c, `${s.name}, ${v.date}, ${pname}: ${renderVerdict(v, 'en').headline} ${renderVerdict(v, 'en').reasons.join(' ')}`) }
      combos.set(`${v.status}:${v.reasons.map(r => r.code).join('+')}`, (combos.get(`${v.status}:${v.reasons.map(r => r.code).join('+')}`) ?? 0) + 1)
      // invariants
      if (v.status === 'go' && v.score < 5) problems.push(`go with score ${v.score}: ${s.name} ${v.date} ${pname}`)
      if (v.status === 'no' && v.score > 2) problems.push(`no with score ${v.score}: ${s.name} ${v.date} ${pname}`)
      if (v.window && v.window.start >= v.window.end) problems.push(`bad window ${v.window.start}-${v.window.end}: ${s.name}`)
      const sun = fc.sun.find(x => x.date === v.date)
      if (v.window && sun?.sunrise && v.window.start < sun.sunrise.slice(0, 2) + ':00') problems.push(`window before sunrise ${v.window.start} < ${sun.sunrise}: ${s.name} ${v.date}`)
      if (v.gear && !rider.sizes.includes(v.gear.size)) problems.push(`gear not in quiver: ${s.name}`)
      for (const l of LANGS) { const r = renderVerdict(v, l); const txt = [r.headline, ...r.reasons].join(' '); if (/\{|\}|undefined|NaN|null/.test(txt)) problems.push(`${l} leftover: ${txt.slice(0, 140)}`) }
    }
  }
  process.stdout.write('.')
}
const never = CODES.filter(c => !codeCount.has(c))
const lines = [`# Verdict sweep: ${n} verdicts (${SPOTS.length} spots x up to 7 days x ${PROFILES.length} profiles x today/tomorrow)`, '',
  `Status: go ${status.go}, check ${status.check}, no ${status.no}`, `Score distribution 0-10: ${scores.join(' / ')}`, '',
  `## Codes (count)`, ...CODES.map(c => `- ${c}: ${codeCount.get(c) ?? 0}`), '', `## Never triggered: ${never.join(', ') || 'none'}`, '',
  `## Example per code (English)`, ...[...examples.entries()].map(([c, e]) => `- **${c}**: ${e}`), '',
  `## Most frequent reason combinations`, ...[...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `- ${v} × ${k}`), '',
  `## Problems (${problems.length})`, ...[...new Set(problems)].slice(0, 60).map(p => `- ${p}`)]
writeFileSync('bench/verdict-sweep.md', lines.join('\n'))
console.log('\n' + lines.slice(0, 6).join('\n') + `\nnever: ${never.join(', ')}\nproblems: ${problems.length}`)
