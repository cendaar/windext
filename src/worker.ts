import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from './core/server.js'
import { D1Store } from './core/store.js'
import { KVCache } from './core/cache.js'
import { setCache } from './core/openmeteo.js'

interface Env { DB: D1Database; CACHE: KVNamespace }

const LANDING = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>windext</title>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>windext</h1><p>Multi-model wind forecasts for kitesurf, windsurf, wingfoil and sailing, served to Claude over MCP, with an open community database of spots.</p>
<p><strong>Claude Desktop / claude.ai / mobile:</strong> Settings &rarr; Connectors &rarr; Add custom connector &rarr; URL <code>https://wind.oooooooo.dev/mcp</code></p>
<p><strong>Claude Code:</strong> <code>claude mcp add --transport http windext https://wind.oooooooo.dev/mcp</code></p>
<p>Data: <a href="https://open-meteo.com">Open-Meteo</a> (CC BY 4.0). Spot database: CC BY-SA. Free, no account, no personal data stored.</p></body>`

// Write rate limit for submit_spot: a KV counter per hashed client IP, 20 per hour. The IP itself is never stored.
async function overWriteLimit(env: Env, request: Request): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + new Date().toISOString().slice(0, 13)))
  const key = 'rl:' + [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
  const n = Number(await env.CACHE.get(key)) || 0
  if (n >= 20) return true
  await env.CACHE.put(key, String(n + 1), { expirationTtl: 3600 })
  return false
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/mcp') {
      if (request.method === 'POST') {
        const body = await request.clone().json().catch(() => null) as any
        if (body?.method === 'tools/call' && body?.params?.name === 'submit_spot' && await overWriteLimit(env, request)) {
          return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Too many spot submissions from this network this hour. Try again later.' } }, { status: 429 })
        }
      }
      setCache(new KVCache(env.CACHE))
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      const server = createServer(new D1Store(env.DB))
      await server.connect(transport)
      return transport.handleRequest(request)
    }
    if (url.pathname === '/health') return new Response('ok')
    if (url.pathname === '/spots.json') {
      const r = await env.DB.prepare("SELECT id, name, lat, lon, country, water, facing_deg, status, sports, updated_at FROM spots ORDER BY updated_at DESC LIMIT 5000").all()
      return Response.json({ licence: 'CC BY-SA 4.0', count: r.results.length, spots: r.results }, { headers: { 'cache-control': 'public, max-age=600' } })
    }
    return new Response(LANDING, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  },
} satisfies ExportedHandler<Env>
