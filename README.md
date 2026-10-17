# windext

Multi-model wind forecasts for wind sports (kitesurf, windsurf, wingfoil, sailing), served to Claude over the Model Context Protocol.

One call reads AROME, ICON, ECMWF, GFS, UKMO (plus KNMI and DMI in Europe) for a spot and compiles them into a compact hourly table with model consensus, spread, agreement, gust factor and onshore/offshore relation, followed by a plain-language diagnosis of why the wind is gusty or steady.

Free for everyone: data from [Open-Meteo](https://open-meteo.com) (no key, CC BY 4.0), hosted on Cloudflare Workers free tier.

## Use it

**Claude Desktop / claude.ai / mobile**: Settings → Connectors → Add custom connector → `https://wind.oooooooo.dev/mcp`

**Claude Code**:
```
claude mcp add --transport http windext https://wind.oooooooo.dev/mcp
```

**Local (no server at all)**:
```
claude mcp add windext npx windext-mcp
```

Then just talk about wind: *"Should I go to Ouistreham tomorrow? The beach faces north."*

## Tools

| Tool | What it does |
|---|---|
| `find_spot` | Place name → coordinates |
| `spot_forecast` | Hourly multi-model table + gust diagnosis. Give `facing_deg` (direction the beach faces) for onshore/offshore safety |
| `ride_windows` | Contiguous daytime windows inside your knot range, offshore excluded by default |
| `list_models` | Which models are read at a location and why |

Prompt `session_check` asks the full "should I go?" question the way an experienced rider would.

## Develop

```
npm install
npm test            # stdio smoke test on Ouistreham
npm run dev:worker  # local Worker on :8787
npm run deploy      # Cloudflare Workers, route wind.oooooooo.dev
```

## Licences

- **Code**: MIT (see LICENSE).
- **Spot database** (`/spots.json`, community cards): CC BY-SA 4.0. Credit windext and share improvements under the same licence.
- **Seed spots**: © OpenStreetMap contributors, ODbL.
- **Weather data**: © Open-Meteo, CC BY 4.0.

## Privacy

No accounts, no cookies, no personal data. Full policy: https://wind.oooooooo.dev/privacy
