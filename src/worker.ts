import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from './core/server.js'

const LANDING = `<!doctype html><meta charset="utf-8"><title>windext</title>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>windext</h1><p>Multi-model wind forecasts for kitesurf, windsurf, wingfoil and sailing, served to Claude over MCP.</p>
<p><strong>Claude Desktop / claude.ai:</strong> Settings &rarr; Connectors &rarr; Add custom connector &rarr; URL <code>https://wind.oooooooo.dev/mcp</code></p>
<p><strong>Claude Code:</strong> <code>claude mcp add --transport http windext https://wind.oooooooo.dev/mcp</code></p>
<p>Data: <a href="https://open-meteo.com">Open-Meteo</a> (CC BY 4.0). Free, no account.</p></body>`

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/mcp') {
      // Stateless: a fresh server + transport per request, nothing to store on the edge.
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      const server = createServer()
      await server.connect(transport)
      return transport.handleRequest(request)
    }
    if (url.pathname === '/health') return new Response('ok')
    return new Response(LANDING, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  },
} satisfies ExportedHandler
