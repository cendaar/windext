/** Public pages served by the Worker: landing, spots list, privacy policy. Plain HTML, no build step. */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const nf = (n: number) => new Intl.NumberFormat('en').format(n)

/* Layout: one 68ch reading column; the forecast table is the only element allowed to run wider.
   Palette: chart-paper ground with a cool slate bias, deep ink, a windsock-orange accent, a crimson reserved for offshore/forbidden/low agreement. */
const STYLE = `
:root{--bg:#f2f4f6;--bg-2:#e7ebef;--fg:#13202a;--muted:#5a6b78;--line:#cfd7de;--accent:#d9541f;--accent-ink:#ffffff;--warn:#b4294a;--good:#1f7a3a;--mono-bg:#0f1c25;--mono-fg:#dbe6ee;
--display:"Bricolage Grotesque","Avenir Next","Helvetica Neue",Arial,sans-serif;--body:"IBM Plex Sans","Segoe UI",Roboto,Helvetica,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1a22;--bg-2:#14232d;--fg:#e6edf2;--muted:#93a4b0;--line:#27404d;--accent:#ff8a4d;--accent-ink:#1a0d05;--warn:#ff7b9c;--good:#5fd38a;--mono-bg:#07121a;--mono-fg:#d4e2ea;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0e1a22;--bg-2:#14232d;--fg:#e6edf2;--muted:#93a4b0;--line:#27404d;--accent:#ff8a4d;--accent-ink:#1a0d05;--warn:#ff7b9c;--good:#5fd38a;--mono-bg:#07121a;--mono-fg:#d4e2ea;color-scheme:dark}
*{box-sizing:border-box}html{height:100%}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 var(--body);-webkit-font-smoothing:antialiased}
a{color:var(--accent)}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.wrap{max-width:68rem;margin:0 auto;padding-inline:clamp(16px,4vw,40px);padding-block:0}
header.top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-block:1.1rem;border-bottom:1px solid var(--line)}
.brand{font-family:var(--display);font-weight:700;font-size:1.25rem;letter-spacing:-.01em;text-decoration:none;color:var(--fg);display:flex;align-items:center;gap:.5rem}
.brand svg{width:26px;height:26px}
nav.links{display:flex;gap:1.1rem;flex-wrap:wrap;font-size:.95rem}nav.links a{color:var(--muted);text-decoration:none}nav.links a:hover{color:var(--fg)}
.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:2.5rem;align-items:center;padding-block:3.5rem 2.5rem}
@media (max-width:860px){.hero{grid-template-columns:1fr;padding-block:2.2rem 1.5rem}}
.eyebrow{font-size:.78rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:600;margin:0 0 .9rem}
h1{font-family:var(--display);font-weight:800;font-size:clamp(2.1rem,5.2vw,3.6rem);line-height:1.02;letter-spacing:-.025em;margin:0 0 1.1rem;text-wrap:balance}
h1 em{font-style:normal;color:var(--accent)}
.lead{font-size:1.15rem;max-width:34rem;margin:0 0 1.6rem;color:var(--fg)}
h2{font-family:var(--display);font-weight:700;font-size:clamp(1.5rem,3vw,2.1rem);letter-spacing:-.02em;line-height:1.1;margin:0 0 .9rem;text-wrap:balance}
h3{font-family:var(--display);font-size:1.1rem;margin:0 0 .4rem}
p{margin:0 0 1rem;max-width:62ch}
section{padding-block:2.6rem;border-top:1px solid var(--line)}
.ctas{display:flex;flex-wrap:wrap;gap:.7rem;margin-bottom:1.4rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.05rem;border-radius:.55rem;font-weight:600;text-decoration:none;border:1px solid var(--line);color:var(--fg);background:var(--bg-2);font-size:.95rem}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.stats{display:flex;flex-wrap:wrap;gap:1.6rem;color:var(--muted);font-size:.92rem;font-variant-numeric:tabular-nums}
.stats b{display:block;font-family:var(--display);font-size:1.6rem;color:var(--fg);line-height:1.1}
.wind{position:relative;aspect-ratio:1/1;max-width:100%;min-height:260px;border-radius:1rem;overflow:hidden;background:var(--mono-bg);border:1px solid var(--line)}
.wind canvas{width:100%;height:100%;display:block}
.wind .cap{position:absolute;left:1rem;bottom:.9rem;color:var(--mono-fg);font:500 .78rem/1.3 var(--mono);opacity:.8}
.table{overflow-x:auto;background:var(--mono-bg);color:var(--mono-fg);border-radius:.8rem;padding:1rem 1.1rem;border:1px solid var(--line)}
.table pre{margin:0;font:13px/1.5 var(--mono);white-space:pre}
.table .k{color:var(--accent)}.table .w{color:var(--warn)}.table .g{color:var(--good)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1.6rem 2.2rem}
.loop{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1.4rem;counter-reset:step}
.loop article{border-top:3px solid var(--accent);padding-top:.9rem}
.loop article::before{counter-increment:step;content:"Step " counter(step);display:block;font:600 .75rem/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem}
.chips{display:flex;flex-wrap:wrap;gap:.45rem;margin:.4rem 0 1rem}
.chip{font:500 .82rem/1 var(--mono);padding:.42rem .6rem;border:1px solid var(--line);border-radius:999px;color:var(--fg);background:var(--bg-2)}
.chip small{color:var(--muted);margin-left:.35rem}
.install{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1.2rem}
.install article{background:var(--bg-2);border:1px solid var(--line);border-radius:.8rem;padding:1.1rem 1.2rem}
code.url{display:block;font:14px/1.5 var(--mono);background:var(--mono-bg);color:var(--mono-fg);padding:.55rem .7rem;border-radius:.45rem;overflow-x:auto;white-space:nowrap;margin:.5rem 0}
.copy{display:inline-flex;align-items:center;gap:.4rem;background:none;border:1px solid var(--line);color:var(--fg);border-radius:.45rem;padding:.35rem .6rem;font:600 .8rem var(--body);cursor:pointer}
.note{color:var(--muted);font-size:.92rem}
blockquote{margin:0;padding:1rem 1.2rem;border-left:3px solid var(--accent);background:var(--bg-2);border-radius:0 .6rem .6rem 0;font-size:1.05rem;max-width:62ch}
footer{padding-block:2rem 3rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem;display:flex;flex-wrap:wrap;gap:1rem 2rem;justify-content:space-between}
table.spots{border-collapse:collapse;width:100%;font-size:.92rem}table.spots th,table.spots td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}table.spots th{font-family:var(--display);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.pill{font:600 .72rem/1 var(--mono);padding:.3rem .5rem;border-radius:999px;border:1px solid var(--line)}.pill.verified{color:var(--good);border-color:var(--good)}.pill.community{color:var(--accent);border-color:var(--accent)}.pill.seed{color:var(--muted)}
.filter{width:100%;max-width:28rem;padding:.6rem .8rem;border:1px solid var(--line);border-radius:.5rem;background:var(--bg-2);color:var(--fg);font:1rem var(--body);margin-bottom:1rem}
@media (prefers-reduced-motion:reduce){.wind canvas{display:none}.wind{background:linear-gradient(160deg,var(--mono-bg),#1d3340)}}
`

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">`

const LOGO = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 11h14a4 4 0 1 0-4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 17h20a4 4 0 1 1-4 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 23h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`

const shell = (title: string, body: string, desc: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-256.png">${FONTS}<style>${STYLE}</style></head><body><div class="wrap">
<header class="top"><a class="brand" href="/">${LOGO}windext</a><nav class="links"><a href="/#install">Install</a><a href="/#how">How it reads wind</a><a href="/spots">Spots</a><a href="/spots.json">Open data</a><a href="https://github.com/baptisterousseau/windext">GitHub</a></nav></header>
${body}
<footer><span>windext is free and open. Weather data © <a href="https://open-meteo.com">Open-Meteo</a> (CC BY 4.0). Spot data © OpenStreetMap contributors (ODbL) and the windext community (CC BY-SA 4.0).</span><span><a href="/privacy">Privacy</a> · <a href="https://wind.oooooooo.dev/mcp">MCP endpoint</a></span></footer>
</div></body></html>`

const SAMPLE = `Spot: Ouistreham Riva-Bella. Models: <span class="k">AROME HD, ICON, ECMWF 9km, GFS, UKMO, KNMI, DMI</span>. Sea 16.9°C. Beach faces NNE.

Time  | AROME  | ICON   | ECMWF  | GFS    | UKMO   | KNMI   | DMI    | <span class="k">MEAN</span>           | SPREAD | AGREE
09:00 | 12/18  | 18/31  | 12/22  | 16/20  | 13/26  |  8/33  | 19/33  | <span class="k">14/26 NNE onshore</span> | 10.6   | <span class="w">low</span>
10:00 | 11/23  | 14/33  | 13/24  | 19/20  | 12/23  |  9/17  | 19/35  | <span class="k">14/25 NE  onshore</span> | 10.6   | <span class="w">low</span>
14:00 |  6/16  |  7/17  |  9/21  |  9/18  |  8/15  |  7/16  | 10/19  | <span class="k"> 8/17 NE  onshore</span> |  3.8   | <span class="g">medium</span>
15:00 | 12/21  |  8/15  |  9/19  | 10/15  |  7/14  |  8/14  | 10/17  | <span class="k"> 9/17 NNE onshore</span> |  4.6   | <span class="g">medium</span>

Diagnosis
- Gust factor 1.9: gusts nearly double the mean, expect holes and overpowered spikes.
- Air 12.4°C over sea 16.9°C: unstable marine layer, convective gusts.
- Showery regime (CAPE 230 J/kg): each shower brings a downdraft gust then a lull.
- Models disagree on 88% of hours: re-check the morning run before driving.`

export function landingPage(stats: { spots: number; enriched: number; forecasts: number; countries: number }): string {
  const body = `
<section class="hero" style="border-top:0">
  <div>
    <p class="eyebrow">A wind forecast connector for Claude and ChatGPT</p>
    <h1>Every rider who asks makes the <em>next forecast</em> better.</h1>
    <p class="lead">windext reads seven weather models at once for your spot, tells you how much they agree, why the wind will be gusty, and whether the direction works where you launch. Ask about a spot nobody has asked about yet, and your answer becomes the next rider's starting point.</p>
    <div class="ctas"><a class="btn primary" href="#install">Add to Claude</a><a class="btn" href="#install">Add to ChatGPT</a><a class="btn" href="#how">See a real forecast</a></div>
    <div class="stats"><div><b>${nf(stats.spots)}</b>spots known</div><div><b>${nf(stats.enriched)}</b>cards enriched by riders</div><div><b>${nf(stats.forecasts)}</b>forecasts served</div><div><b>7</b>models per spot</div></div>
  </div>
  <div class="wind" aria-label="Animated wind field"><canvas id="wind" width="600" height="600"></canvas><div class="cap">wind field, 10 m, model consensus</div></div>
</section>

<section id="why">
  <h2>Why one model is never enough</h2>
  <div class="cols">
    <div><h3>Windguru shows you one model at a time</h3><p>Switching between AROME, ICON and GFS tabs and averaging in your head is the ritual of every rider. windext does the comparison in one call, in knots, and says plainly when the models disagree.</p></div>
    <div><h3>Gusts are the whole story</h3><p>A 15 knot mean with 30 knot gusts is not a 15 knot day. windext computes the gust factor and explains the cause: cold air over a warm sea, showers, wind shear, or simply a forecast nobody trusts yet.</p></div>
    <div><h3>Tides, included</h3><p>High and low water for any coastal spot, from the marine model, without a paid tide service. Approximate to twenty minutes, which is what you need to know whether the sandbank is still there at 15:00.</p></div>
    <div><h3>Direction only means something at a spot</h3><p>North-east is side-on at Ouistreham and offshore somewhere else. With the spot's orientation and its known sectors, the forecast says onshore, side, or forbidden, instead of a number of degrees.</p></div>
  </div>
</section>

<section id="how">
  <h2>What Claude sees when you ask</h2>
  <p>A real answer for Ouistreham, Normandy, on a showery north-easterly. Each cell is mean/gust in knots. The last three columns are what matter: the consensus, the spread between models, and how much to trust that hour.</p>
  <div class="table"><pre>${SAMPLE}</pre></div>
  <p class="note" style="margin-top:.8rem">About 600 tokens for a full day on seven models, so Claude keeps room to reason about your gear and the tide instead of drowning in numbers.</p>
</section>

<section id="loop">
  <h2>The more it is used, the better it gets</h2>
  <p>windext keeps an open database of spots. Nobody fills in forms. The knowledge arrives as a side effect of questions riders ask anyway.</p>
  <div class="loop">
    <article><h3>You ask about your spot</h3><p>If windext does not know it yet, Claude looks up the public guides, drafts the card (orientation, launch, working and forbidden directions, tide, hazards) and asks you to confirm. You are the local; guides are often wrong.</p></article>
    <article><h3>Your answer is saved for the next rider</h3><p>The confirmed card is stored under an open licence. The next person asking about that beach gets a forecast that already knows where the wind must come from.</p></article>
    <article><h3>Forecasts are kept, so models can be scored</h3><p>Every forecast is archived. Session reports ("I was there, it was 18 knots") will soon tell which model to trust at which spot. That is a dataset nobody has.</p></article>
  </div>
  <blockquote style="margin-top:1.6rem">You will never be asked to do extra work. Confirming one card, once, for the spot you know best, is the whole contribution. It takes a minute and it helps everyone who comes after you.</blockquote>
</section>

<section id="models">
  <h2>Models it reads</h2>
  <p>Served by <a href="https://open-meteo.com">Open-Meteo</a>, which collects the national models and picks the finest one available at each location. Within 48 hours windext leans on the regional model; beyond three days, on ECMWF.</p>
  <div class="chips">
    <span class="chip">AROME HD<small>1.5 km, France</small></span><span class="chip">ICON-D2<small>2 km, Central Europe</small></span><span class="chip">UKMO<small>2 km, UK</small></span><span class="chip">KNMI Harmonie<small>North Sea</small></span><span class="chip">DMI Harmonie<small>2 km, N-Europe</small></span><span class="chip">ECMWF IFS<small>9 km, global</small></span><span class="chip">GFS / HRRR<small>global, 3 km US</small></span><span class="chip">MET Norway<small>1 km, Nordics</small></span><span class="chip">MeteoSwiss<small>1 km, Alps</small></span><span class="chip">JMA, KMA, GEM, BOM<small>Asia, Canada, Australia</small></span>
  </div>
  <p class="note">Worldwide. Outside Europe the regional slots fall back to the global models, so every spot still gets at least five independent forecasts.</p>
</section>

<section id="install">
  <h2>Install in a minute, no account needed</h2>
  <div class="install">
    <article><h3>Claude (desktop, web, mobile)</h3><p>Settings → Connectors → <b>Add custom connector</b>, paste the URL, no authentication.</p><code class="url" id="u1">https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="https://wind.oooooooo.dev/mcp">Copy URL</button></article>
    <article><h3>ChatGPT</h3><p>Settings → Connectors → enable <b>Developer mode</b> → Create, paste the URL, no authentication.</p><code class="url" id="u2">https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="https://wind.oooooooo.dev/mcp">Copy URL</button></article>
    <article><h3>Claude Code</h3><p>One command in the terminal.</p><code class="url" id="u3">claude mcp add --transport http windext https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="claude mcp add --transport http windext https://wind.oooooooo.dev/mcp">Copy command</button></article>
  </div>
  <p class="note" style="margin-top:1rem">Then just talk: "Should I go to Tarifa on Saturday? I ride a 9 m, 80 kg." Try the built-in prompts too: session check, compare two spots, weekend planner, gear advice, why is it gusty.</p>
</section>

<section id="open">
  <h2>Free for everyone, including us</h2>
  <div class="cols">
    <div><h3>No account, no tracking</h3><p>No sign-up, no API key, no cookies. windext stores facts about beaches, never about people. The <a href="/privacy">privacy page</a> says exactly what is kept.</p></div>
    <div><h3>Open data, open code</h3><p>The spot database is published as <a href="/spots.json">spots.json</a> under CC BY-SA. The server is MIT-licensed on <a href="https://github.com/baptisterousseau/windext">GitHub</a>. Run your own if you prefer.</p></div>
    <div><h3>Built by a rider</h3><p>Made in Normandy by a kitesurfer who got tired of comparing model tabs on a phone in the car park. Corrections to a spot card are welcome, directly from a conversation.</p></div>
  </div>
</section>
<script>
(function(){
  document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){var t=b.getAttribute('data-copy');var done=function(){var o=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=o},1500)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){window.getSelection().selectAllChildren(b.previousElementSibling)})}else{window.getSelection().selectAllChildren(b.previousElementSibling)}})});
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var c=document.getElementById('wind');if(!c)return;var x=c.getContext('2d');var W=c.width,H=c.height,N=420,P=[];
  function field(px,py,t){var a=Math.sin(px*0.006+t*0.4)*0.6+Math.cos(py*0.008-t*0.3)*0.5+0.9;var s=1.1+0.5*Math.sin(px*0.01+py*0.01+t*0.7);return{a:a,s:s}}
  for(var i=0;i<N;i++)P.push({x:Math.random()*W,y:Math.random()*H,l:Math.random()*80});
  var t=0;x.fillStyle='rgba(15,28,37,1)';x.fillRect(0,0,W,H);
  function frame(){t+=0.016;x.fillStyle='rgba(15,28,37,0.08)';x.fillRect(0,0,W,H);x.strokeStyle='rgba(255,138,77,0.5)';x.lineWidth=1.2;
    for(var i=0;i<N;i++){var p=P[i],f=field(p.x,p.y,t),nx=p.x+Math.cos(f.a)*f.s*1.6,ny=p.y+Math.sin(f.a)*f.s*1.6;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(nx,ny);x.stroke();p.x=nx;p.y=ny;p.l--;if(p.l<0||p.x<0||p.x>W||p.y<0||p.y>H){p.x=Math.random()*W;p.y=Math.random()*H;p.l=40+Math.random()*80}}
    requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
})();
</script>`
  return shell('windext', body, 'Multi-model wind forecasts for kitesurf, windsurf, wingfoil and sailing, inside Claude and ChatGPT. Free, open, and better every time a rider asks.')
}

export function spotsPage(rows: { id: string; name: string; country: string; kind: string; status: string; sports: string; facing_deg: number | null; lat: number; lon: number }[]): string {
  const tr = rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.country || '')}</td><td>${esc((r.sports || '').split('|').join(', '))}</td><td>${r.facing_deg == null ? '<span class="note">unknown</span>' : Math.round(r.facing_deg) + '°'}</td><td><span class="pill ${esc(r.status)}">${esc(r.status)}</span></td><td class="note">${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}</td></tr>`).join('')
  const body = `<section style="border-top:0"><p class="eyebrow">Open spot database</p><h2>${nf(rows.length)} spots, and counting</h2>
<p>Seed cards come from OpenStreetMap and carry only a position. A card becomes <span class="pill community">community</span> when a rider confirms its orientation and wind sectors in a conversation, and <span class="pill verified">verified</span> after a moderator check. Ask Claude about your spot to add it; no form here on purpose.</p>
<input class="filter" id="q" type="search" placeholder="Filter by name or country" aria-label="Filter spots">
<div style="overflow-x:auto"><table class="spots" id="t"><thead><tr><th>Spot</th><th>Country</th><th>Sports</th><th>Faces</th><th>Status</th><th>Position</th></tr></thead><tbody>${tr}</tbody></table></div>
<p class="note" style="margin-top:1rem">Download: <a href="/spots.json">spots.json</a> (CC BY-SA 4.0).</p></section>
<script>(function(){var q=document.getElementById('q'),rows=[].slice.call(document.querySelectorAll('#t tbody tr'));q.addEventListener('input',function(){var v=q.value.toLowerCase();rows.forEach(function(r){r.hidden=v&&r.textContent.toLowerCase().indexOf(v)<0})})})();</script>`
  return shell('windext spots', body, 'The open database of wind-sport spots behind windext.')
}

export function privacyPage(): string {
  const body = `<section style="border-top:0"><p class="eyebrow">Privacy policy</p><h2>What windext keeps, and what it never sees</h2>
<p><b>Operator.</b> windext is run by Baptiste Rousseau, Normandy, France. Contact: wind@oooooooo.dev.</p>
<h3>Data collection</h3><p>windext has no accounts and sets no cookies. When Claude or ChatGPT calls the service on your behalf, the server receives the tool arguments only: coordinates or a spot id, a date, the sport, and, if you submit a spot card, the facts you confirmed about that beach. Your conversation, your name and your email never reach windext.</p>
<h3>What is stored</h3><ul><li><b>Spot cards</b>: facts about places (position, orientation, wind sectors, hazards, tide notes, source URLs). Published openly under CC BY-SA 4.0.</li><li><b>Forecast requests</b>: spot or rounded coordinates (0.01°), date asked, sport, and a timestamp. No identifier of any kind.</li><li><b>Forecast archive</b>: the model values returned, so models can be scored later.</li><li><b>Session reports</b> (when available): wind observed at a spot on a day, gear used, and a verdict. No identifier.</li></ul>
<h3>Rate limiting</h3><p>To prevent abuse of spot submissions, a counter is kept for one hour under a salted hash of the network address. The address itself is not stored and cannot be recovered from the hash.</p>
<h3>Third parties</h3><p>Weather data is fetched from Open-Meteo and coastline geometry from OpenStreetMap, with coordinates rounded to about 100 m and no information about you. The service is hosted on Cloudflare Workers; Cloudflare's own edge logs are governed by Cloudflare's policies.</p>
<h3>Retention</h3><p>Spot cards: indefinitely, as open data. Request logs and forecast archive: up to 24 months, then aggregated. Rate-limit counters: one hour.</p>
<h3>Your rights</h3><p>Since no personal data is held, there is nothing to export or delete about you. To correct or remove a spot card, ask in a conversation (submit_spot) or write to wind@oooooooo.dev.</p>
<p class="note">Last updated 17 October 2026.</p></section>`
  return shell('windext privacy', body, 'What windext stores and what it never sees.')
}
