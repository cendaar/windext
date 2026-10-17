import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchForecast, geocode, MODEL_LABELS, defaultModels } from './openmeteo.js'
import { summarizeHour, findWindows, gustDiagnostics, renderTable, compass, COMPASS, tideEvents, renderTides } from './analysis.js'
import type { Store, SpotCard, WindQuality } from './store.js'

export const INSTRUCTIONS = `windext: multi-model wind forecasts for wind sports (kitesurf, windsurf, wingfoil, sailing) plus an open, community-built database of spots. Every question a rider asks makes the next answer better: forecasts are archived, spot cards are shared, and session reports will score the models spot by spot.

WORKFLOW
1. find_spot with the place or spot name. It returns known cards (status seed, community or verified; kind spot or school) and geocoding results.
2. Pass the card's spot_id to spot_forecast and ride_windows. The forecast is then read against the beach orientation and the spot's known good and forbidden wind sectors.
3. A 'seed' card comes from OpenStreetMap: position and sports only, orientation possibly estimated from the coastline. A 'school' card is a club, school or shop, not the launch itself. In both cases, and whenever no card exists: search the web yourself for the spot guide (beach orientation, launch area, working and forbidden wind directions, hazards, tide, rules, season). Summarise the facts, ask the user to confirm or correct them (locals know better than guides), then call submit_spot with the confirmed card and the source URLs. Never skip the confirmation. Do this gently, once per spot, as a favour to the next rider, not as a chore.
4. Treat 'seed' and 'community' cards as useful but unverified; say so whenever safety depends on them. A coastline-estimated orientation is a guess: confirm it with the user before relying on it for offshore warnings.
5. If the user mentions having ridden a spot ("I was there yesterday, it was 20 knots"), thank them and note that session reports will soon be recorded to score the models.

READING THE TABLE AS A RIDER
- MEAN is the model consensus. SPREAD is the disagreement in knots: <= 4 reliable, 4-8 confirm on the morning run, > 8 do not plan on it. AGREE summarises both speed and direction agreement.
- By lead time: within 48 h trust the fine regional model (AROME HD in France and W-Europe, ICON-D2 in Germany and the Alps, UKMO in the UK, KNMI/DMI on the North Sea, HRRR in the US); 2 to 5 days ECMWF; beyond, only the trend. GFS is the coarsest, a tie-breaker.
- Gust factor (gust / mean): < 1.3 steady, 1.3-1.6 normal, 1.6-1.9 tiring, >= 1.9 unsafe for beginners even if the mean looks fine. The diagnosis lines explain the cause (sea warmer than air, showers, shear, model disagreement).
- Shore relation: offshore is dangerous for kite and wing without rescue cover, say it explicitly; side-off is for experts; side and side-on are ideal; onshore with waves is hard to launch. A card's 'forbidden' sector overrides everything: the spot does not work that day.
- Tide: spot_forecast includes model tide times; the tides tool gives more days. The model tide is often 30-60 min early near harbours. If the user has the local port table, compare once and submit tide_offset_min with submit_spot: the spot is then calibrated for everyone. When the card has tide notes, apply them; on the Atlantic and Channel coasts a falling tide plus offshore wind is the worst combination.
- Gear, as orders of magnitude for a 75 kg rider, scaled by weight: kite 12 kn 12-14 m, 16 kn 10-12 m, 20 kn 8-9 m, 25 kn 7 m; wing 12 kn 6 m, 18 kn 4.5-5 m, 25 kn 3.5-4 m; windsurf 15 kn 6.5-7 m2, 20 kn 5.5 m2, 25 kn 4.7 m2. Ask the weight if unknown.
- Units are knots. Answer in the user's language.`

const Lat = z.number().min(-90).max(90), Lon = z.number().min(-180).max(180)
const SpotId = z.string().min(1).optional().describe('Spot id from find_spot (preferred over raw coordinates: enables orientation and direction knowledge)')

const fmtCard = (s: SpotCard & { distance_km?: number }) => {
  const wind = s.wind.length ? s.wind.map(w => `${w.sector}:${w.quality}${w.note ? ` (${w.note})` : ''}`).join(', ') : 'unknown'
  const lines = [
    `[${s.status}${s.kind === 'school' ? ', school/club' : ''}] ${s.name} (id: ${s.id}) lat ${s.lat} lon ${s.lon}${s.country ? `, ${s.country}` : ''}${s.distance_km != null ? `, ${s.distance_km} km away` : ''}`,
    `  water: ${s.water || '?'} | faces ${s.facing_deg != null ? `${Math.round(s.facing_deg)}° ${compass(s.facing_deg)} (${s.facing_source}${s.facing_source === 'coastline' ? ', estimated: confirm with the user' : ''})` : 'unknown'} | sports: ${s.sports.join(', ') || '?'}`,
    `  wind sectors: ${wind}`,
  ]
  if (s.launch_notes) lines.push(`  launch: ${s.launch_notes}`)
  if (s.tide_notes || s.tide_offset_min != null) lines.push(`  tide: ${s.tide_notes}${s.tide_offset_min != null ? ` [calibration ${s.tide_offset_min >= 0 ? '+' : ''}${s.tide_offset_min} min]` : ''}`)
  if (s.hazards) lines.push(`  hazards: ${s.hazards}`)
  if (s.rules) lines.push(`  rules: ${s.rules}`)
  if (s.season) lines.push(`  season: ${s.season}`)
  if (s.sources.length) lines.push(`  sources: ${s.sources.join(' ')}`)
  return lines.join('\n')
}

const tideCaveat = (card: SpotCard | null) => card?.tide_offset_min != null ? `model tide calibrated for this spot (${card.tide_offset_min >= 0 ? '+' : ''}${card.tide_offset_min} min), about +/- 15 min` : 'model tide, uncalibrated: often 30-60 min early inside harbours and estuaries; compare once with the local port table and submit tide_offset_min'

const sectorQuality = (card: SpotCard | null, dir: number): WindQuality | undefined => card?.wind.find(w => w.sector === compass(dir))?.quality

export interface ServerOptions { estimateFacing?: (lat: number, lon: number) => Promise<{ facing_deg: number; distance_m: number } | null> }

export function createServer(store: Store, options: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'windext', version: '0.3.0' }, { instructions: INSTRUCTIONS })

  /** Fills a missing orientation from the coastline, once, and persists it. Best effort, never blocks a reply for long. */
  const withFacing = async (cards: SpotCard[]): Promise<SpotCard[]> => {
    if (!options.estimateFacing) return cards
    return Promise.all(cards.map(async c => {
      if (c.facing_deg != null || c.kind !== 'spot') return c
      try {
        const est = await options.estimateFacing!(c.lat, c.lon)
        if (!est || est.distance_m > 1200) return c
        await store.setFacing(c.id, est.facing_deg, 'coastline')
        return { ...c, facing_deg: est.facing_deg, facing_source: 'coastline' }
      } catch { return c }
    }))
  }

  const resolve = async (a: { spot_id?: string; lat?: number; lon?: number }) => {
    const card = a.spot_id ? await store.getSpot(a.spot_id) : null
    if (a.spot_id && !card) throw new Error(`Unknown spot_id "${a.spot_id}". Use find_spot.`)
    const lat = card?.lat ?? a.lat, lon = card?.lon ?? a.lon
    if (lat == null || lon == null) throw new Error('Give either spot_id or lat+lon.')
    return { card, lat, lon }
  }

  server.registerTool('find_spot', {
    title: 'Find a spot',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: 'Look a spot up by name in the windext spot database (community-built, with beach orientation and wind-direction knowledge), then fall back to geocoding. Always call this first.',
    inputSchema: { query: z.string().min(2).describe('Spot or place name, e.g. "Ouistreham", "Tarifa Los Lances", "Leucate"') },
  }, async ({ query }) => {
    const known = await store.searchSpots(query)
    const geo = await geocode(query).catch(() => [])
    const nearKnown = geo[0] ? await store.nearbySpots(geo[0].lat, geo[0].lon, 15, 5) : []
    const cards = await withFacing([...known, ...nearKnown.filter(n => !known.some(k => k.id === n.id))])
    const out: string[] = []
    if (cards.length) out.push(`Known spots:\n${cards.map(fmtCard).join('\n')}`)
    else out.push('No spot card in the database for this query.')
    if (geo.length) out.push(`Geocoding:\n${geo.map(p => `${p.name}, ${p.admin}, ${p.country}: lat ${p.lat}, lon ${p.lon}`).join('\n')}`)
    if (!cards.some(c => c.status !== 'seed' && c.kind === 'spot')) out.push('Next step: search the web for this spot\'s guide (beach orientation, launch, working wind directions, hazards, tide, rules), confirm the facts with the user, then call submit_spot. This is what makes the next rider\'s forecast better.')
    return { content: [{ type: 'text', text: out.join('\n\n') }] }
  })

  server.registerTool('spot_info', {
    title: 'Spot card',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: 'Full card of a known spot, or the spots known within a radius of a point.',
    inputSchema: { spot_id: SpotId, lat: Lat.optional(), lon: Lon.optional(), radius_km: z.number().min(1).max(200).default(30) },
  }, async (a) => {
    if (a.spot_id) { const c = await store.getSpot(a.spot_id); const [f] = c ? await withFacing([c]) : [null]; return { content: [{ type: 'text', text: f ? fmtCard(f) : `Unknown spot_id ${a.spot_id}` }] } }
    if (a.lat == null || a.lon == null) return { content: [{ type: 'text', text: 'Give spot_id or lat+lon.' }] }
    const near = await store.nearbySpots(a.lat, a.lon, a.radius_km, 15)
    const cards = await withFacing(near)
    return { content: [{ type: 'text', text: cards.length ? cards.map((c, i) => fmtCard({ ...c, distance_km: near[i].distance_km })).join('\n') : `No known spot within ${a.radius_km} km.` }] }
  })

  server.registerTool('submit_spot', {
    title: 'Submit or correct a spot card',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Add a spot to the open windext database, or correct an existing one. Only call after the user has confirmed the facts. Cards are stored with status "community" until a moderator verifies them; a correction to a verified spot is queued for review. Licence CC BY-SA, no personal data.',
    inputSchema: {
      name: z.string().min(2), lat: Lat, lon: Lon,
      aliases: z.array(z.string()).default([]).describe('Other names people use'),
      country: z.string().default(''), water: z.enum(['sea', 'lagoon', 'lake', 'river', 'estuary', '']).default(''),
      facing_deg: z.number().min(0).max(360).optional().describe('Direction the launch beach faces, towards the water'),
      facing_source: z.enum(['guide', 'user', 'coastline', 'seed']).default('guide'),
      sports: z.array(z.enum(['kitesurf', 'windsurf', 'wingfoil', 'sailing'])).default([]),
      kind: z.enum(['spot', 'school']).default('spot').describe('spot = a place to launch and ride; school = club, school or shop'),
      wind: z.array(z.object({ sector: z.enum(COMPASS as [string, ...string[]]), quality: z.enum(['best', 'ok', 'marginal', 'forbidden']), note: z.string().default('') })).default([]).describe('Which wind directions work. Use 16-point sectors.'),
      launch_notes: z.string().default(''), tide_notes: z.string().default(''),
      tide_offset_min: z.number().int().min(-180).max(180).optional().describe('Tide calibration: minutes to add to the model high/low water times so they match the local port table (e.g. +50 at Ouistreham). Set it after comparing the tides tool with an official table once.'),
      hazards: z.string().default(''), rules: z.string().default(''), season: z.string().default(''),
      sources: z.array(z.string().url()).default([]).describe('URLs of the guides used'),
    },
  }, async (a) => {
    const r = await store.submitSpot({ ...a, facing_deg: a.facing_deg ?? null, tide_offset_min: a.tide_offset_min ?? null, wind: a.wind.map(w => ({ ...w, note: w.note ?? '' })) })
    const msg = r.action === 'proposed' ? `Spot ${r.id} is verified; your change was queued for moderator review.` : `Spot ${r.id} ${r.action} with status ${r.status}. Thank the user: this card now helps every rider asking about this spot.`
    return { content: [{ type: 'text', text: msg }] }
  })

  server.registerTool('spot_forecast', {
    title: 'Multi-model wind forecast for a spot',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: 'Hourly wind forecast from several weather models at once (AROME, ICON, ECMWF, GFS, UKMO, plus KNMI/DMI in Europe), compiled into one compact table with model consensus, spread, agreement, gust factor and shore relation, followed by a diagnosis of why the wind is gusty or steady. Pass spot_id when known.',
    inputSchema: {
      spot_id: SpotId, lat: Lat.optional(), lon: Lon.optional(),
      days: z.number().int().min(1).max(7).default(2).describe('Forecast days (default 2). Keep small: each day costs tokens.'),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('First day, YYYY-MM-DD. Default today.'),
      facing_deg: z.number().min(0).max(360).optional().describe('Overrides the spot card orientation. Direction the beach faces, towards the water.'),
      sport: z.enum(['kitesurf', 'windsurf', 'wingfoil', 'sailing', '']).default('').describe('What the user rides, for statistics only'),
      models: z.array(z.string()).optional().describe(`Override the model list. Open-Meteo ids such as ${Object.keys(MODEL_LABELS).join(', ')}.`),
      hours_from: z.number().int().min(0).max(23).default(6), hours_to: z.number().int().min(0).max(23).default(21),
    },
  }, async (a) => {
    const { card, lat, lon } = await resolve(a)
    const [c2] = card ? await withFacing([card]) : [null]
    const facing = a.facing_deg ?? c2?.facing_deg ?? undefined
    const fc = await fetchForecast({ lat, lon, days: a.days, models: a.models, startDate: a.start_date })
    const hours = fc.hours.map(h => summarizeHour(h, facing)).filter((x): x is NonNullable<typeof x> => x != null)
    const table = renderTable(fc, hours, { from: a.hours_from, to: a.hours_to })
    const diag = gustDiagnostics(fc, hours)
    if (card?.wind.length) {
      const seen = new Map<string, number>()
      for (const h of hours) { const q = sectorQuality(card, h.dir); if (q) seen.set(q, (seen.get(q) ?? 0) + 1) }
      const forb = hours.filter(h => sectorQuality(card, h.dir) === 'forbidden').map(h => h.time.slice(11, 16))
      diag.push(`Spot card (${card.status}): forecast directions fall in sectors ${[...seen.entries()].map(([q, n]) => `${q} ${n}h`).join(', ')}.${forb.length ? ` FORBIDDEN sector at ${forb.slice(0, 6).join(', ')}${forb.length > 6 ? '...' : ''}: the spot does not work then.` : ''}`)
    }
    const day0 = fc.hours[0]?.time.slice(0, 10) ?? ''
    const key = card?.id ?? `${lat.toFixed(2)},${lon.toFixed(2)}`
    const fetched = new Date().toISOString().slice(0, 13) // hour precision: one archive per spot/day/hour-of-fetch
    try {
      await store.logRequest({ spot_id: card?.id ?? null, lat, lon, day: day0, sport: a.sport })
      if (!(await store.hasArchive(key, day0, fetched))) {
        const rows = fc.hours.flatMap(h => fc.models.map(m => ({ spot_key: key, day: h.time.slice(0, 10), model: m, hour: +h.time.slice(11, 13), speed: h.models[m].speed, gust: h.models[m].gust, dir: h.models[m].dir, fetched_at: fetched, lead_hours: Math.round((new Date(h.time).getTime() - Date.now()) / 3.6e6) })))
        await store.archiveForecast(rows)
      }
    } catch { /* statistics must never break a forecast */ }
    const head = `${card ? `Spot: ${card.name} [${card.status}]. ` : ''}${c2?.facing_source === 'coastline' && a.facing_deg == null ? 'Orientation estimated from the coastline, confirm it. ' : ''}Models: ${fc.models.map(m => MODEL_LABELS[m] ?? m).join(', ')}. Sea temp: ${fc.seaTemp ?? 'n/a'}°C.${facing != null ? ` Beach faces ${compass(facing)}.` : ' Beach orientation unknown: no onshore/offshore analysis.'}`
    const tides = renderTides(tideEvents(fc.hours.map(h => h.time), fc.seaLevel, c2?.tide_offset_min ?? 0))
    const tideBlock = tides ? `\n\nTides (${tideCaveat(c2)}${c2?.tide_notes ? `; spot note: ${c2.tide_notes}` : ''}):\n${tides}` : ''
    return { content: [{ type: 'text', text: `${head}\n\n${table}\n\nDiagnosis:\n${diag.map(d => '- ' + d).join('\n')}${tideBlock}` }] }
  })

  server.registerTool('ride_windows', {
    title: 'Rideable windows',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: 'Contiguous daytime windows where the model-consensus wind sits inside the rider\'s range, excluding offshore wind and the spot\'s forbidden sectors unless allowed.',
    inputSchema: {
      spot_id: SpotId, lat: Lat.optional(), lon: Lon.optional(),
      days: z.number().int().min(1).max(7).default(3),
      min_kn: z.number().min(0).default(12).describe('Minimum usable wind in knots (kite ~12, wing ~12, windsurf ~14, big kite/foil ~8)'),
      max_kn: z.number().min(1).default(35),
      facing_deg: z.number().min(0).max(360).optional(),
      allow_offshore: z.boolean().default(false),
    },
  }, async (a) => {
    const { card, lat, lon } = await resolve(a)
    const facing = a.facing_deg ?? card?.facing_deg ?? undefined
    const fc = await fetchForecast({ lat, lon, days: a.days })
    const hours = fc.hours.map(h => summarizeHour(h, facing)).filter((x): x is NonNullable<typeof x> => x != null)
      .filter(h => a.allow_offshore || sectorQuality(card, h.dir) !== 'forbidden')
    const w = findWindows(hours, a.min_kn, a.max_kn, { allowOffshore: a.allow_offshore })
    if (!w.length) return { content: [{ type: 'text', text: `No window between ${a.min_kn} and ${a.max_kn} kn in the next ${a.days} day(s)${card ? ` at ${card.name}` : ''} (models: ${fc.models.map(m => MODEL_LABELS[m] ?? m).join(', ')}).` }] }
    const lines = w.map(x => { const q = card ? sectorQuality(card, COMPASS.indexOf(x.dir) * 22.5) : undefined; return `${x.start.slice(0, 10)} ${x.start.slice(11, 16)}-${x.end.slice(11, 16)} (${x.hours}h): ${x.avgSpeed} kn mean, gusts ${x.avgGust}, ${x.dir}${x.shore ? ' ' + x.shore : ''}${q ? ` [spot: ${q}]` : ''}, agreement ${x.agreement}` })
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  server.registerTool('tides', {
    title: 'Tide times',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: 'High and low water times and heights (vs mean sea level) for a coastal spot, from the Open-Meteo marine model. Approximate (+/- 20 min), free, worldwide; not for navigation. Empty for lakes.',
    inputSchema: { spot_id: SpotId, lat: Lat.optional(), lon: Lon.optional(), days: z.number().int().min(1).max(7).default(3), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() },
  }, async (a) => {
    const { card, lat, lon } = await resolve(a)
    const fc = await fetchForecast({ lat, lon, days: a.days, startDate: a.start_date, models: ['gfs_seamless'] })
    const t = renderTides(tideEvents(fc.hours.map(h => h.time), fc.seaLevel, card?.tide_offset_min ?? 0))
    if (!t) return { content: [{ type: 'text', text: 'No tidal signal here (inland water or no marine model coverage).' }] }
    return { content: [{ type: 'text', text: `${card ? `${card.name}. ` : ''}Local time (${fc.timezone}). Heights vs mean sea level. ${tideCaveat(card)}.\n${t}${card?.tide_notes ? `\nSpot note: ${card.tide_notes}` : ''}` }] }
  })

  server.registerTool('list_models', {
    title: 'List weather models',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Which weather models windext reads by default at a location, and their resolution/coverage notes.',
    inputSchema: { lat: Lat, lon: Lon },
  }, async ({ lat, lon }) => {
    const notes: Record<string, string> = {
      meteofrance_seamless: 'AROME HD 1.5 km over France/W-Europe (48 h), then ARPEGE; best for French spots',
      icon_seamless: 'ICON-D2 2 km over Central Europe, ICON-EU 7 km, ICON global 11 km',
      ecmwf_ifs: 'ECMWF IFS 9 km global; best medium range (3-10 days)',
      gfs_seamless: 'NOAA GFS 25 km global, HRRR 3 km over the US; coarsest in Europe',
      ukmo_seamless: 'UK Met Office 2 km over the UK, 10 km global',
      knmi_seamless: 'KNMI Harmonie 5.5 km over W-Europe, 2 km Benelux',
      dmi_seamless: 'DMI Harmonie 2 km over N-Europe down to the Channel',
    }
    return { content: [{ type: 'text', text: defaultModels(lat, lon).map(m => `${MODEL_LABELS[m] ?? m} (${m}): ${notes[m] ?? ''}`).join('\n') }] }
  })

  server.registerPrompt('session_check', {
    title: 'Session check',
    description: 'Is it worth going riding at a spot? Reasoned like an experienced rider.',
    argsSchema: { spot: z.string().describe('Spot name'), sport: z.string().optional().describe('kitesurf, windsurf, wingfoil, sailing'), day: z.string().optional().describe('today, tomorrow, Saturday...') },
  }, ({ spot, sport, day }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `I ride ${sport ?? 'kitesurf'}. Should I go to ${spot} ${day ?? 'tomorrow'}? Use find_spot, then spot_forecast with the spot_id (if the spot is unknown, research it, confirm with me and submit it first). Compare the models, give me the best window, a gear size for my weight (ask if unknown), the safety points (offshore, gusts, tide, forbidden directions) and how much to trust the forecast.` } }],
  }))

  server.registerPrompt('spot_compare', {
    title: 'Compare two spots',
    description: 'Which of two spots to choose on a given day.',
    argsSchema: { spot_a: z.string(), spot_b: z.string(), day: z.string().optional(), sport: z.string().optional() },
  }, ({ spot_a, spot_b, day, sport }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `${sport ?? 'Kitesurf'}, ${day ?? 'tomorrow'}: ${spot_a} or ${spot_b}? Run find_spot and spot_forecast for both, compare wind, gusts, direction against each spot's orientation and sectors, and pick one with a clear reason. Mention the drive-worthiness given the model agreement.` } }] }))

  server.registerPrompt('weekend_planner', {
    title: 'Weekend planner',
    description: 'Best session of the coming weekend among the spots near a place.',
    argsSchema: { near: z.string().describe('Town or region'), sport: z.string().optional(), radius_km: z.string().optional() },
  }, ({ near, sport, radius_km }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Plan my ${sport ?? 'kitesurf'} weekend around ${near}. Use find_spot on ${near}, then spot_info with lat/lon and radius ${radius_km ?? '60'} km to list known spots, then ride_windows (days 3) on the best candidates. Give me the top two windows with spot, time, expected wind, direction vs the spot, and confidence.` } }] }))

  server.registerPrompt('gear_advice', {
    title: 'Which size to bring',
    description: 'Gear size for a rider at a spot on a day.',
    argsSchema: { spot: z.string(), sport: z.string().optional(), weight_kg: z.string().optional(), day: z.string().optional(), level: z.string().optional() },
  }, ({ spot, sport, weight_kg, day, level }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `I ride ${sport ?? 'kitesurf'}, ${weight_kg ?? '75'} kg, level ${level ?? 'intermediate'}. What should I bring to ${spot} ${day ?? 'tomorrow'}? Use find_spot and spot_forecast, then give one size for the main window and a second if the range of models or gusts calls for it.` } }] }))

  server.registerPrompt('explain_gusts', {
    title: 'Why is it gusty?',
    description: 'Plain-language explanation of the gustiness at a spot on a given day.',
    argsSchema: { spot: z.string(), day: z.string().optional() },
  }, ({ spot, day }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Explain, in simple rider terms, why the wind at ${spot} ${day ?? 'tomorrow'} is gusty or steady. Use find_spot and spot_forecast, then rely on the diagnosis lines (air-sea difference, showers, shear, model disagreement).` } }] }))

  return server
}
