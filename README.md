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

## iOS app

`ios/` holds the SwiftUI app and its widget (XcodeGen project). One question at onboarding (sport, weight, gear, level, stored on the phone only), then for each followed spot: a windext score out of 10 and a plain-language verdict for **today and tomorrow**. The small widget shows the score; the medium one the verdict and the window. An evening notification after a "go" day asks how it was, in one tap, which feeds the model scoring.

```
cd ios && xcodegen generate
xcodebuild -scheme Windext -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

The app talks to `GET /v1/verdict`, `GET /v1/spots` and `POST /v1/report`. Verdict sentences are pre-written in 7 languages (`src/core/verdict-i18n.ts`) and computed by rules (`src/core/verdict.ts`); no language model runs on the server.

## Develop

```
npm install
npm test                        # unit tests (vitest)
npx tsx scripts/sweep.ts        # worldwide health sweep, 40 spots
npx tsx scripts/verdict-sweep.ts # ~2,900 real verdicts in 7 languages
npx tsx bench/run.ts r2         # blind A/B bench, Claude with vs without windext
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
