import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
const c = new Client({ name: 'smoke', version: '0' })
await c.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/stdio.ts'] }))
const tools = await c.listTools(); console.log('tools:', tools.tools.map(t => t.name).join(', '))
const text = async (name: string, args: any) => { const r: any = await c.callTool({ name, arguments: args }); const t = r.content[0].text; console.log(`\n### ${name} (${t.length} chars, ~${Math.round(t.length / 3.5)} tokens)\n${t}`); return t }
await text('find_spot', { query: 'Ouistreham' })
await text('spot_forecast', { lat: 49.2757, lon: -0.2591, days: 1, start_date: process.argv[2] ?? '2026-10-18', facing_deg: 10, hours_from: 8, hours_to: 18 })
await text('ride_windows', { lat: 49.2757, lon: -0.2591, days: 3, min_kn: 12, max_kn: 30, facing_deg: 10 })
await c.close()
