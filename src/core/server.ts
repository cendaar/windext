import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchForecast, geocode, MODEL_LABELS, defaultModels } from './openmeteo.js'
import { summarizeHour, findWindows, gustDiagnostics, renderTable, compass } from './analysis.js'

export const INSTRUCTIONS = `windext gives wind-sport forecasts (kitesurf, windsurf, wingfoil, sailing) by reading several weather models at once for a spot.
How to use it:
- Always start with spot_forecast (geocode a place name with find_spot if you only have a name). Give the beach orientation (facing_deg = direction the beach faces, towards the sea) whenever you know it: it unlocks onshore/offshore safety.
- Read the table as a rider: the MEAN column is the model consensus, SPREAD is the disagreement in knots, AGREE tells how much to trust the hour. Gusts far above the mean (gust factor >= 1.8) mean an unpleasant, unsafe session even if the mean looks fine.
- Prefer the fine regional model (AROME in France/Western Europe, ICON in Germany/Alps, UKMO in the UK) within 48 h; prefer ECMWF beyond 3 days. GFS is the coarsest, treat it as a tie-breaker.
- Offshore wind is dangerous for kite and wing: say so explicitly. Onshore with waves can be hard to launch. Side and side-on are ideal.
- Never present a window as reliable when AGREE is low; say the models disagree and suggest re-checking the morning run.
- Units are knots; the user is usually a rider who thinks in knots and kite sizes.`

const Lat = z.number().min(-90).max(90), Lon = z.number().min(-180).max(180)

export function createServer(): McpServer {
  const server = new McpServer({ name: 'windext', version: '0.1.0' }, { instructions: INSTRUCTIONS })

  server.registerTool('find_spot', {
    title: 'Find a spot',
    description: 'Geocode a place or spot name into coordinates (Open-Meteo geocoding). Use before spot_forecast when you only have a name.',
    inputSchema: { query: z.string().min(2).describe('Place or spot name, e.g. "Ouistreham", "Tarifa", "Leucate"') },
  }, async ({ query }) => {
    const r = await geocode(query)
    if (!r.length) return { content: [{ type: 'text', text: `No place found for "${query}".` }] }
    return { content: [{ type: 'text', text: r.map(p => `${p.name}, ${p.admin}, ${p.country}: lat ${p.lat}, lon ${p.lon}`).join('\n') }] }
  })

  server.registerTool('spot_forecast', {
    title: 'Multi-model wind forecast for a spot',
    description: 'Hourly wind forecast from several weather models at once (AROME, ICON, ECMWF, GFS, UKMO, plus KNMI/DMI in Europe), compiled into one compact table with model consensus, spread, agreement, gust factor and shore relation. Includes a short diagnosis of why the wind is gusty or steady.',
    inputSchema: {
      lat: Lat, lon: Lon,
      days: z.number().int().min(1).max(7).default(2).describe('Forecast days (default 2). Keep small: each day costs tokens.'),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('First day, YYYY-MM-DD. Default today.'),
      facing_deg: z.number().min(0).max(360).optional().describe('Direction the beach faces, towards the sea, in degrees (e.g. a beach looking north = 0). Enables onshore/offshore analysis.'),
      models: z.array(z.string()).optional().describe(`Override the model list. Open-Meteo ids such as ${Object.keys(MODEL_LABELS).join(', ')}.`),
      hours_from: z.number().int().min(0).max(23).default(6), hours_to: z.number().int().min(0).max(23).default(21),
    },
  }, async (a) => {
    const fc = await fetchForecast({ lat: a.lat, lon: a.lon, days: a.days, models: a.models, startDate: a.start_date })
    const hours = fc.hours.map(h => summarizeHour(h, a.facing_deg)).filter((x): x is NonNullable<typeof x> => x != null)
    const table = renderTable(fc, hours, { from: a.hours_from, to: a.hours_to })
    const diag = gustDiagnostics(fc, hours)
    const head = `Models: ${fc.models.map(m => MODEL_LABELS[m] ?? m).join(', ')}. Sea temp: ${fc.seaTemp ?? 'n/a'}°C.${a.facing_deg != null ? ` Beach faces ${compass(a.facing_deg)}.` : ''}`
    return { content: [{ type: 'text', text: `${head}\n\n${table}\n\nDiagnosis:\n${diag.map(d => '- ' + d).join('\n')}` }] }
  })

  server.registerTool('ride_windows', {
    title: 'Rideable windows',
    description: 'Find contiguous daytime windows where the model-consensus wind sits inside the rider\'s range, excluding offshore wind unless allowed. Returns windows with average wind, gusts, direction and model agreement.',
    inputSchema: {
      lat: Lat, lon: Lon,
      days: z.number().int().min(1).max(7).default(3),
      min_kn: z.number().min(0).default(12).describe('Minimum usable wind in knots (kite ~12, wing ~12, windsurf ~14, big kite/foil ~8)'),
      max_kn: z.number().min(1).default(35).describe('Maximum wind the rider wants'),
      facing_deg: z.number().min(0).max(360).optional().describe('Direction the beach faces, towards the sea'),
      allow_offshore: z.boolean().default(false),
    },
  }, async (a) => {
    const fc = await fetchForecast({ lat: a.lat, lon: a.lon, days: a.days })
    const hours = fc.hours.map(h => summarizeHour(h, a.facing_deg)).filter((x): x is NonNullable<typeof x> => x != null)
    const w = findWindows(hours, a.min_kn, a.max_kn, { allowOffshore: a.allow_offshore })
    if (!w.length) return { content: [{ type: 'text', text: `No window between ${a.min_kn} and ${a.max_kn} kn in the next ${a.days} day(s) (models: ${fc.models.map(m => MODEL_LABELS[m] ?? m).join(', ')}).` }] }
    const lines = w.map(x => `${x.start.slice(0, 10)} ${x.start.slice(11, 16)}-${x.end.slice(11, 16)} (${x.hours}h): ${x.avgSpeed} kn mean, gusts ${x.avgGust}, ${x.dir}${x.shore ? ' ' + x.shore : ''}, agreement ${x.agreement}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  server.registerTool('list_models', {
    title: 'List weather models',
    description: 'Which weather models windext reads by default at a location, and their resolution/coverage notes.',
    inputSchema: { lat: Lat, lon: Lon },
  }, async ({ lat, lon }) => {
    const notes: Record<string, string> = {
      meteofrance_seamless: 'AROME 1.3 km over France/W-Europe (48 h), then ARPEGE; best for French spots',
      icon_seamless: 'ICON-D2 2 km over Central Europe, ICON-EU 7 km, ICON global 11 km',
      ecmwf_ifs: 'ECMWF IFS 9 km global; best medium range (3-10 days)',
      gfs_seamless: 'NOAA GFS 25 km global, HRRR 3 km over the US; coarsest in Europe',
      ukmo_seamless: 'UK Met Office 2 km over the UK, 10 km global',
      knmi_seamless: 'KNMI Harmonie 2 km over Benelux/North Sea',
      dmi_seamless: 'DMI Harmonie 2 km over Scandinavia/North Sea',
    }
    return { content: [{ type: 'text', text: defaultModels(lat, lon).map(m => `${MODEL_LABELS[m] ?? m} (${m}): ${notes[m] ?? ''}`).join('\n') }] }
  })

  server.registerPrompt('session_check', {
    title: 'Session check',
    description: 'Ask whether it is worth going riding at a spot, as an experienced rider would reason.',
    argsSchema: { spot: z.string().describe('Spot name'), sport: z.string().optional().describe('kitesurf, windsurf, wingfoil, sailing'), day: z.string().optional().describe('today, tomorrow, Saturday...') },
  }, ({ spot, sport, day }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `I ride ${sport ?? 'kitesurf'}. Should I go to ${spot} ${day ?? 'tomorrow'}? Use find_spot then spot_forecast (ask me the beach orientation if you do not know it), compare the models, tell me the best window, the gear size for a 75 kg rider, the safety points (offshore, gusts, tide if relevant) and how much to trust the forecast.` } }],
  }))

  return server
}
