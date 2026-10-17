/** Worldwide health sweep: runs the real Open-Meteo pipeline on spots of every kind and continent, checks invariants, prints issues.
 *  Usage: npx tsx scripts/sweep.ts  (network required; ~2 min) */
import { fetchForecast, MODEL_LABELS } from '../src/core/openmeteo.js'
import { summarizeHour, gustDiagnostics, tideEvents, renderSea, daylightMap, significantTides } from '../src/core/analysis.js'
import { estimateFacing } from '../src/core/coastline.js'
import { createServer } from '../src/core/server.js'
import { MemoryStore } from '../src/core/store.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

type Kind = 'sea' | 'lagoon' | 'lake' | 'river' | 'microtidal'
export const SPOTS: { name: string; lat: number; lon: number; kind: Kind; facing?: number; noaa?: string }[] = [
  // Europe
  { name: 'Ouistreham FR', lat: 49.2865, lon: -0.2605, kind: 'sea', facing: 15 },
  { name: 'Wissant FR', lat: 50.886, lon: 1.66, kind: 'sea', facing: 315 },
  { name: 'Leucate FR (Med)', lat: 42.91, lon: 3.055, kind: 'microtidal', facing: 90 },
  { name: 'Tarifa Los Lances ES', lat: 36.03, lon: -5.62, kind: 'sea', facing: 200 },
  { name: 'Guincho PT', lat: 38.73, lon: -9.475, kind: 'sea', facing: 270 },
  { name: 'El Medano ES (Canaries)', lat: 28.045, lon: -16.535, kind: 'sea', facing: 135 },
  { name: 'Lake Garda Torbole IT', lat: 45.872, lon: 10.875, kind: 'lake' },
  { name: 'Lo Stagnone IT', lat: 37.87, lon: 12.45, kind: 'lagoon' },
  { name: 'Vassiliki GR', lat: 38.625, lon: 20.605, kind: 'microtidal', facing: 180 },
  { name: 'Brouwersdam NL', lat: 51.765, lon: 3.85, kind: 'sea', facing: 315 },
  { name: 'Fehmarn DE (Baltic)', lat: 54.43, lon: 11.10, kind: 'microtidal' },
  { name: 'Sylt DE', lat: 54.91, lon: 8.30, kind: 'sea', facing: 270 },
  { name: 'Rhosneigr UK', lat: 53.23, lon: -4.52, kind: 'sea', facing: 225 },
  { name: 'Lista NO', lat: 58.09, lon: 6.62, kind: 'sea', facing: 225 },
  // Africa
  { name: 'Dakhla lagoon MA', lat: 23.85, lon: -15.83, kind: 'lagoon' },
  { name: 'Essaouira MA', lat: 31.50, lon: -9.77, kind: 'sea', facing: 270 },
  { name: 'El Gouna EG (Red Sea)', lat: 27.40, lon: 33.68, kind: 'microtidal', facing: 90 },
  { name: 'Bloubergstrand ZA', lat: -33.81, lon: 18.465, kind: 'sea', facing: 270 },
  { name: 'Langebaan ZA', lat: -33.09, lon: 18.03, kind: 'lagoon' },
  { name: 'Le Morne MU', lat: -20.455, lon: 57.31, kind: 'sea', facing: 225 },
  { name: 'Paje Zanzibar TZ', lat: -6.27, lon: 39.54, kind: 'sea', facing: 90 },
  // Americas
  { name: 'Cumbuco BR', lat: -3.625, lon: -38.73, kind: 'sea', facing: 0 },
  { name: 'Jericoacoara BR', lat: -2.795, lon: -40.51, kind: 'sea', facing: 0 },
  { name: 'Cabarete DO', lat: 19.76, lon: -70.41, kind: 'sea', facing: 0 },
  { name: 'La Ventana MX', lat: 24.05, lon: -109.99, kind: 'microtidal', facing: 80 },
  { name: 'Hood River US', lat: 45.71, lon: -121.51, kind: 'river' },
  { name: 'Kanaha Maui US', lat: 20.90, lon: -156.43, kind: 'sea', facing: 0, noaa: '1615680' },
  { name: 'Cape Hatteras US', lat: 35.22, lon: -75.63, kind: 'sea', facing: 135, noaa: '8654467' },
  { name: 'Corpus Christi US', lat: 27.58, lon: -97.22, kind: 'lagoon', noaa: '8775870' },
  { name: 'Squamish CA', lat: 49.69, lon: -123.16, kind: 'sea', facing: 180 },
  { name: 'Paracas PE', lat: -13.85, lon: -76.25, kind: 'sea', facing: 0 },
  // Asia & Oceania
  { name: 'Mui Ne VN', lat: 10.95, lon: 108.29, kind: 'sea', facing: 135 },
  { name: 'Boracay Bulabog PH', lat: 11.955, lon: 121.94, kind: 'sea', facing: 90 },
  { name: 'Hua Hin TH', lat: 12.57, lon: 99.96, kind: 'sea', facing: 90 },
  { name: 'Kalpitiya LK', lat: 8.23, lon: 79.76, kind: 'lagoon' },
  { name: 'Shonan JP', lat: 35.31, lon: 139.48, kind: 'sea', facing: 180 },
  { name: 'Perth Safety Bay AU', lat: -32.30, lon: 115.71, kind: 'sea', facing: 270 },
  { name: 'St Kilda AU', lat: -37.865, lon: 144.97, kind: 'sea', facing: 225 },
  { name: 'Takapuna NZ', lat: -36.79, lon: 174.775, kind: 'sea', facing: 90 },
  { name: 'Nadi Fiji (date line)', lat: -17.77, lon: 177.38, kind: 'sea', facing: 270 },
]

if (process.argv[1]?.endsWith('sweep.ts')) {
const [ca, cb] = InMemoryTransport.createLinkedPair()
await createServer(new MemoryStore()).connect(cb)
const client = new Client({ name: 'sweep', version: '0' }); await client.connect(ca)
const tool = async (name: string, args: any) => ((await client.callTool({ name, arguments: args })) as any).content[0].text as string

const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

async function noaa(station: string, from: string): Promise<{ time: string; type: string }[]> {
  const u = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&interval=hilo&station=${station}&begin_date=${from.replace(/-/g, '')}&range=48&time_zone=lst_ldt&units=metric&format=json`
  const d: any = await (await fetch(u)).json()
  return (d.predictions ?? []).map((p: any) => ({ time: p.t, type: p.type === 'H' ? 'high' : 'low' }))
}

const issues: string[] = []
const flag = (spot: string, msg: string) => { issues.push(`${spot}: ${msg}`); console.log(`  ! ${msg}`) }

for (const s of SPOTS) {
  console.log(`\n${s.name}`)
  try {
    const fc = await fetchForecast({ lat: s.lat, lon: s.lon, days: 2 })
    const empty = fc.models.filter(m => fc.hours.every(h => h.models[m].speed == null))
    if (empty.length) flag(s.name, `models without data: ${empty.map(m => MODEL_LABELS[m] ?? m).join(', ')}`)
    const series = (m: string) => fc.hours.map(h => h.models[m].speed).join(',')
    for (let i = 0; i < fc.models.length; i++) for (let j = i + 1; j < fc.models.length; j++) {
      if (!empty.includes(fc.models[i]) && series(fc.models[i]) === series(fc.models[j])) flag(s.name, `identical series ${MODEL_LABELS[fc.models[i]]} = ${MODEL_LABELS[fc.models[j]]} (one is a fallback copy, double-counted in the consensus)`)
    }
    const noGust = fc.models.filter(m => !empty.includes(m) && fc.hours.every(h => h.models[m].gust == null))
    if (noGust.length) flag(s.name, `models without gusts: ${noGust.map(m => MODEL_LABELS[m]).join(', ')}`)
    if (!fc.sun.length || !fc.sun[0].sunrise) flag(s.name, 'no sunrise/sunset')
    const dl = daylightMap(fc)[fc.hours[0].time.slice(0, 10)]
    console.log(`  tz ${fc.timezone}, issued ${fc.issued}, daylight ${dl?.join('-')}, models ${fc.models.length - empty.length}/${fc.models.length}, sea ${fc.seaTemp}°C`)
    const hours = fc.hours.map(h => summarizeHour(h, s.facing)).filter(Boolean) as any[]
    const diag = gustDiagnostics(fc, hours)
    const waterless = s.kind === 'lake' || s.kind === 'river'
    if (waterless && fc.seaTemp != null) flag(s.name, `inland water but sea temperature ${fc.seaTemp}°C used (wrong air-sea diagnosis risk): ${diag.find(d => d.includes('sea')) ?? ''}`.slice(0, 220))
    if (!waterless && fc.seaTemp == null) console.log('  (no marine model coverage here: no sea temperature, waves or model tide)')
    const sea = renderSea(fc)
    if (waterless && sea) flag(s.name, `inland water but waves shown: ${sea.split('\n')[0]}`)
    const ev = tideEvents(fc.hours.map(h => h.time), fc.seaLevel)
    const lv = fc.seaLevel.filter((v): v is number => v != null)
    const range = lv.length ? Math.max(...lv) - Math.min(...lv) : 0
    const perDay = ev.length / 2
    console.log(`  tide: ${ev.length} events / 2 days, range ${range.toFixed(2)} m${ev[0] ? `, first ${ev[0].type} ${ev[0].time}` : ''}`)
    // What Claude actually receives
    const tt = await tool('tides', { lat: s.lat, lon: s.lon, days: 2 })
    const printed = (tt.match(/\b(HW|LW) \d/g) ?? []).length
    console.log(`  tides tool: ${tt.split('\n').slice(1, 2).join(' ').slice(0, 110)}${printed ? ` (${printed} events)` : ''}`)
    if (waterless && printed) flag(s.name, `inland water but the tides tool prints ${printed} events`)
    if (!waterless && range < 0.3 && printed) flag(s.name, `microtidal (range ${range.toFixed(2)} m) but the tides tool prints ${printed} events`)
    if (printed / 2 > 4.5) flag(s.name, `tides tool prints ${printed / 2} events per day`)
    if (s.noaa && !/Official NOAA/.test(tt)) flag(s.name, 'NOAA station nearby but the tides tool used the model')
    if (!waterless && !s.noaa && range >= 0.3 && !printed) flag(s.name, `tidal coast (range ${range.toFixed(2)} m) but no tide printed`)
    if (s.noaa) {
      const ref = await noaa(s.noaa, fc.hours[0].time.slice(0, 10))
      const raw = significantTides(ev)
      const signed = raw.map(e => { const r = ref.filter(x => x.type === e.type); if (!r.length) return NaN; const t = (x: string) => new Date(x.replace(' ', 'T')).getTime(); const best = r.reduce((a, b) => (Math.abs(t(b.time) - t(e.time)) < Math.abs(t(a.time) - t(e.time)) ? b : a)); return (t(best.time) - t(e.time)) / 60000 }).filter(x => !isNaN(x)).sort((a, b) => a - b)
      console.log(`  raw model vs NOAA median offset ${Math.round(signed[Math.floor(signed.length / 2)])} min (now replaced by NOAA in the tool)`)
    }
    if (s.facing != null) {
      const est = await estimateFacing(s.lat, s.lon, { timeoutMs: 15000 })
      if (!est) console.log('  coastline: none found')
      else { const d = angDiff(est.facing_deg, s.facing); console.log(`  coastline facing ${est.facing_deg}° (guide ${s.facing}°, diff ${d}°, ${est.distance_m} m away)`); if (d > 45) flag(s.name, `coastline orientation ${est.facing_deg}° vs guide ${s.facing}° (diff ${d}°)`) }
    }
  } catch (e) { flag(s.name, `ERROR ${String(e).slice(0, 160)}`) }
}
console.log(`\n==== ${issues.length} issue(s) on ${SPOTS.length} spots ====\n${issues.join('\n')}`)
await client.close(); process.exit(0)

}
