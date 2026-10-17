import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const c = new Client({ name: 'http-smoke', version: '0' })
await c.connect(new StreamableHTTPClientTransport(new URL(process.argv[2] ?? 'http://localhost:8787/mcp')))
console.log('instructions reçues:', (c.getInstructions() ?? '').slice(0, 80) + '...')
console.log('tools:', (await c.listTools()).tools.map(t => t.name).join(', '))
const r: any = await c.callTool({ name: 'ride_windows', arguments: { lat: 49.2757, lon: -0.2591, days: 2, min_kn: 12, max_kn: 30, facing_deg: 10 } })
console.log(r.content[0].text)
await c.close()
