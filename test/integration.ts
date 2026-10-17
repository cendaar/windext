/** Runs against a Worker with a real D1 (default: local wrangler dev on :8787). `npx tsx test/integration.ts [url]` */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const base = process.argv[2] ?? 'http://localhost:8787'
let failures = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'OK ' : 'KO '} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++ }
const connect = async () => { const c = new Client({ name: 'it', version: '0' }); await c.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'))); return c }
const call = async (c: Client, name: string, args: any) => { const r: any = await c.callTool({ name, arguments: args }); return { text: r.content[0].text as string, isError: !!r.isError } }
const tag = Date.now().toString(36)
const spot = { name: `IT Spot ${tag}`, lat: 36.012, lon: -5.602, country: 'Spain', water: 'sea', facing_deg: 200, facing_source: 'guide', sports: ['kitesurf'], wind: [{ sector: 'E', quality: 'best' }, { sector: 'W', quality: 'ok' }], sources: ['https://example.org/it'] }

const c = await connect()
check('instructions', (c.getInstructions() ?? '').includes('windext'))
check('health', (await fetch(base + '/health')).status === 200)

let r = await call(c, 'submit_spot', spot); check('submit creates', /created with status community/.test(r.text), r.text)
const id = `it-spot-${tag}`
r = await call(c, 'submit_spot', { ...spot, name: `IT Spot ${tag} bis`, lat: 36.0125, lon: -5.6015 }); check('resubmit within 500 m updates', /updated/.test(r.text) && r.text.includes(id), r.text)
r = await call(c, 'spot_info', { spot_id: id }); check('spot_info shows merged card', r.text.includes('bis') && /E:best, W:ok/.test(r.text) && /faces 200/.test(r.text), r.text.split('\n')[0])
r = await call(c, 'find_spot', { query: `IT Spot ${tag}` }); check('find_spot by name', r.text.includes(`(id: ${id})`))
r = await call(c, 'find_spot', { query: `it spot ${tag} bis` }); check('find_spot by alias (case-insensitive)', r.text.includes(`(id: ${id})`))
r = await call(c, 'spot_forecast', { spot_id: id, days: 1, sport: 'kitesurf', hours_from: 12, hours_to: 13 }); check('spot_forecast with spot_id', /Spot: IT Spot/.test(r.text) && /Beach faces SSW/.test(r.text), r.text.split('\n')[0])
const t0 = Date.now(); r = await call(c, 'spot_forecast', { spot_id: id, days: 1, hours_from: 12, hours_to: 13 }); check('second forecast served from KV cache', Date.now() - t0 < 1500, `${Date.now() - t0} ms`)
r = await call(c, 'ride_windows', { spot_id: id, days: 2, min_kn: 1, max_kn: 60 }); check('ride_windows with spot_id', !r.isError, r.text.split('\n')[0])

const spots = await (await fetch(base + '/spots.json')).json() as any
check('/spots.json lists the spot with licence', spots.licence === 'CC BY-SA 4.0' && spots.spots.some((s: any) => s.id === id))

// A correction to a verified spot must be queued, not applied. Needs local D1 access (wrangler), so only on localhost.
if (base.includes('localhost')) {
  const { execSync } = await import('node:child_process')
  execSync(`npx wrangler d1 execute windext --local --command "UPDATE spots SET status='verified' WHERE id='${id}'"`, { stdio: 'ignore' })
  r = await call(c, 'submit_spot', { ...spot, name: 'IT fix', wind: [{ sector: 'N', quality: 'forbidden' }] }); check('correction to a verified spot is queued', /queued for moderator review/.test(r.text), r.text)
  r = await call(c, 'spot_info', { spot_id: id }); check('verified card untouched by the proposal', /\[verified\]/.test(r.text) && /E:best, W:ok/.test(r.text) && !/N:forbidden/.test(r.text))
  const n = JSON.parse(execSync('npx wrangler d1 execute windext --local --json --command "SELECT count(*) AS n FROM spot_proposals"').toString())[0].results[0].n
  check('proposal row stored', n >= 1, `${n} proposal(s)`)
  const a = JSON.parse(execSync('npx wrangler d1 execute windext --local --json --command "SELECT count(*) AS n, count(DISTINCT model) AS m FROM forecast_archive"').toString())[0].results[0]
  check('forecast archived once per spot/day/hour across all models', a.n >= 168 && a.m === 7, `${a.n} rows, ${a.m} models`)
}

// Rate limit: 20 writes per hour per network.
let got429 = false
for (let i = 0; i < 20; i++) { try { const x = await call(c, 'submit_spot', { ...spot, name: `IT RL ${tag} ${i}`, lat: 10 + i, lon: 10 }); if (/Too many/.test(x.text)) { got429 = true; break } } catch (e) { if (String(e).includes('429') || String(e).includes('Too many')) { got429 = true; break } } }
check('write rate limit kicks in', got429)
r = await call(c, 'find_spot', { query: 'Tarifa' }); check('reads still work after the write limit', !r.isError && !/Too many/.test(r.text))
await c.close()
console.log(failures ? `\n${failures} failure(s)` : '\nall integration checks passed')
process.exit(failures ? 1 : 0)
