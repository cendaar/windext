import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from './core/server.js'
import { D1Store } from './core/store.js'
import { KVCache } from './core/cache.js'
import { setCache } from './core/openmeteo.js'
import { estimateFacing } from './core/coastline.js'
import { landingPage, privacyPage, spotsPage } from './pages.js'
import ICON_SVG from '../assets/icon.svg'
import ICON_PNG from '../assets/icon-256.png'

interface Env { DB: D1Database; CACHE: KVNamespace }

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
      const server = createServer(new D1Store(env.DB), { estimateFacing: (lat, lon) => estimateFacing(lat, lon, { timeoutMs: 6000 }) })
      await server.connect(transport)
      return transport.handleRequest(request)
    }
    if (url.pathname === '/health') return new Response('ok')
    if (url.pathname === '/icon.svg') return new Response(ICON_SVG, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } })
    if (url.pathname === '/icon-256.png') return new Response(ICON_PNG, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } })
    if (url.pathname === '/spots.json') {
      const r = await env.DB.prepare("SELECT id, name, lat, lon, country, water, facing_deg, status, sports, updated_at FROM spots ORDER BY updated_at DESC LIMIT 5000").all()
      return Response.json({ licence: 'CC BY-SA 4.0', count: r.results.length, spots: r.results }, { headers: { 'cache-control': 'public, max-age=600' } })
    }
    const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } })
    if (url.pathname === '/privacy') return html(privacyPage())
    if (url.pathname === '/spots') {
      const r = await env.DB.prepare("SELECT id, name, country, kind, status, sports, facing_deg, lat, lon FROM spots WHERE kind = 'spot' ORDER BY CASE status WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END, name LIMIT 2000").all<any>()
      return html(spotsPage(r.results))
    }
    if (url.pathname === '/') {
      const stats = await env.DB.prepare("SELECT (SELECT count(*) FROM spots WHERE kind='spot') AS spots, (SELECT count(*) FROM spots WHERE status <> 'seed') AS enriched, (SELECT count(*) FROM requests) AS forecasts, (SELECT count(DISTINCT country) FROM spots WHERE country <> '') AS countries").first<any>().catch(() => null)
      return html(landingPage(stats ?? { spots: 0, enriched: 0, forecasts: 0, countries: 0 }))
    }
    return Response.redirect(url.origin + '/', 302)
  },
} satisfies ExportedHandler<Env>
