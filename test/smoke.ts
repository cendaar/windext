import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
const c = new Client({ name: 'smoke', version: '0' })
await c.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/stdio.ts'] }))
console.log('tools:', (await c.listTools()).tools.map(t => t.name).join(', '))
const text = async (name: string, args: any) => { const r: any = await c.callTool({ name, arguments: args }); const t = r.content[0].text; console.log(`\n### ${name} (${t.length} chars, ~${Math.round(t.length / 3.5)} tokens)\n${t}`); return t }
await text('find_spot', { query: 'Ouistreham' })
await text('submit_spot', { name: 'Ouistreham Riva-Bella', lat: 49.2865, lon: -0.2605, country: 'France', water: 'sea', facing_deg: 15, facing_source: 'user', sports: ['kitesurf', 'wingfoil'], wind: [{ sector: 'NE', quality: 'best' }, { sector: 'N', quality: 'ok' }, { sector: 'NW', quality: 'ok' }, { sector: 'W', quality: 'marginal', note: 'side-off, experts' }, { sector: 'SW', quality: 'forbidden', note: 'offshore' }, { sector: 'S', quality: 'forbidden', note: 'offshore' }], launch_notes: 'Right of the lifeguard post, outside swimming zone in summer', tide_notes: 'Best 2h either side of high tide; big sandbanks at low tide', hazards: 'Ferry channel to the east, groynes', sources: ['https://example.org/guide-ouistreham'] })
await text('find_spot', { query: 'ouistreham' })
await text('spot_forecast', { spot_id: 'ouistreham-riva-bella', days: 1, start_date: process.argv[2] ?? '2026-10-18', hours_from: 8, hours_to: 18, sport: 'kitesurf' })
await text('ride_windows', { spot_id: 'ouistreham-riva-bella', days: 3, min_kn: 12, max_kn: 30 })
await c.close()
