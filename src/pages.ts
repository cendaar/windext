/** Public pages served by the Worker: landing, spots list, privacy policy. Plain HTML, no build step. */
import { type Lang, LANGS, LANG_NAMES, t } from './i18n.js'

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
nav.links{display:flex;gap:1.1rem;flex-wrap:wrap;font-size:.95rem;align-items:center}
select.lang{background:var(--bg-2);color:var(--fg);border:1px solid var(--line);border-radius:.4rem;padding:.3rem .4rem;font:.85rem var(--body)}nav.links a{color:var(--muted);text-decoration:none}nav.links a:hover{color:var(--fg)}
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
.loop article::before{counter-increment:step;content:var(--step) " " counter(step);display:block;font:600 .75rem/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem}
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

const shell = (title: string, body: string, desc: string, lang: Lang = 'en', path = '/') => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-256.png">${FONTS}<style>${STYLE}</style></head><body><div class="wrap">
${LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://wind.oooooooo.dev${path === '/' ? (l === 'en' ? '/' : '/' + l) : path + '?lang=' + l}">`).join('')}
<header class="top"><a class="brand" href="/${lang === 'en' ? '' : lang}">${LOGO}windext</a><nav class="links"><a href="/${lang === 'en' ? '' : lang}#install">${t(lang, 'nav.install')}</a><a href="/${lang === 'en' ? '' : lang}#how">${t(lang, 'nav.how')}</a><a href="/spots?lang=${lang}">${t(lang, 'nav.spots')}</a><a href="/spots.json">${t(lang, 'nav.data')}</a><a href="https://github.com/cendaar/windext">GitHub</a><select class="lang" id="lang" aria-label="Language">${LANGS.map(l => `<option value="${l}"${l === lang ? ' selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select></nav></header>
${body}
<footer><span>${t(lang, 'footer.credits')}</span><span><a href="/privacy">${t(lang, 'footer.privacy')}</a> · <a href="https://wind.oooooooo.dev/mcp">${t(lang, 'footer.endpoint')}</a></span></footer>
</div><script>document.getElementById('lang').addEventListener('change',function(e){var l=e.target.value;location.href=${JSON.stringify(path)}==='/'?(l==='en'?'/':'/'+l):${JSON.stringify(path)}+'?lang='+l})</script></body></html>`

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

export function landingPage(stats: { spots: number; enriched: number; forecasts: number; countries: number }, lang: Lang = 'en'): string {
  const T = (k: string) => t(lang, k)
  const body = `
<section class="hero" style="border-top:0">
  <div>
    <p class="eyebrow">${T('hero.eyebrow')}</p>
    <h1>${T('hero.h1')}</h1>
    <p class="lead">${T('hero.lead')}</p>
    <div class="ctas"><a class="btn primary" href="#install">${T('cta.claude')}</a><a class="btn" href="#install">${T('cta.chatgpt')}</a><a class="btn" href="#how">${T('cta.sample')}</a></div>
    <div class="stats"><div><b>${nf(stats.spots)}</b>${T('stats.spots')}</div><div><b>${nf(stats.enriched)}</b>${T('stats.enriched')}</div><div><b>${nf(stats.forecasts)}</b>${T('stats.forecasts')}</div><div><b>7</b>${T('stats.models')}</div></div>
  </div>
  <div class="wind" aria-label="Animated wind field"><canvas id="wind" width="600" height="600"></canvas><div class="cap">${T('hero.cap')}</div></div>
</section>

<section id="why">
  <h2>${T('why.h2')}</h2>
  <div class="cols">
    <div><h3>${T('why1.h3')}</h3><p>${T('why1.p')}</p></div>
    <div><h3>${T('why2.h3')}</h3><p>${T('why2.p')}</p></div>
    <div><h3>${T('why3.h3')}</h3><p>${T('why3.p')}</p></div>
    <div><h3>${T('why4.h3')}</h3><p>${T('why4.p')}</p></div>
  </div>
</section>

<section id="how">
  <h2>${T('how.h2')}</h2>
  <p>${T('how.p')}</p>
  <div class="table"><pre>${SAMPLE}</pre></div>
  <p class="note" style="margin-top:.8rem">${T('how.note')}</p>
</section>

<section id="loop">
  <h2>${T('loop.h2')}</h2>
  <p>${T('loop.p')}</p>
  <div class="loop" style="--step:'${T('loop.step')}'">
    <article><h3>${T('loop1.h3')}</h3><p>${T('loop1.p')}</p></article>
    <article><h3>${T('loop2.h3')}</h3><p>${T('loop2.p')}</p></article>
    <article><h3>${T('loop3.h3')}</h3><p>${T('loop3.p')}</p></article>
  </div>
  <blockquote style="margin-top:1.6rem">${T('loop.quote')}</blockquote>
</section>

<section id="models">
  <h2>${T('models.h2')}</h2>
  <p>${T('models.p')}</p>
  <div class="chips">
    <span class="chip">AROME HD<small>1.5 km, France</small></span><span class="chip">ICON-D2<small>2 km, Central Europe</small></span><span class="chip">UKMO<small>2 km, UK</small></span><span class="chip">KNMI Harmonie<small>North Sea</small></span><span class="chip">DMI Harmonie<small>2 km, N-Europe</small></span><span class="chip">ECMWF IFS<small>9 km, global</small></span><span class="chip">GFS / HRRR<small>global, 3 km US</small></span><span class="chip">MET Norway<small>1 km, Nordics</small></span><span class="chip">MeteoSwiss<small>1 km, Alps</small></span><span class="chip">JMA, KMA, GEM, BOM<small>Asia, Canada, Australia</small></span>
  </div>
  <p class="note">${T('models.note')}</p>
</section>

<section id="install">
  <h2>${T('install.h2')}</h2>
  <div class="install">
    <article><h3>${T('install1.h3')}</h3><p>${T('install1.p')}</p><code class="url" id="u1">https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="https://wind.oooooooo.dev/mcp" data-copied="${T('install.copied')}">${T('install.copy')}</button></article>
    <article><h3>${T('install2.h3')}</h3><p>${T('install2.p')}</p><code class="url" id="u2">https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="https://wind.oooooooo.dev/mcp" data-copied="${T('install.copied')}">${T('install.copy')}</button></article>
    <article><h3>${T('install3.h3')}</h3><p>${T('install3.p')}</p><code class="url" id="u3">claude mcp add --transport http windext https://wind.oooooooo.dev/mcp</code><button class="copy" type="button" data-copy="claude mcp add --transport http windext https://wind.oooooooo.dev/mcp" data-copied="${T('install.copied')}">${T('install.copycmd')}</button></article>
  </div>
  <p class="note" style="margin-top:1rem">${T('install.note')}</p>
</section>

<section id="open">
  <h2>${T('open.h2')}</h2>
  <div class="cols">
    <div><h3>${T('open1.h3')}</h3><p>${T('open1.p')}</p></div>
    <div><h3>${T('open2.h3')}</h3><p>${T('open2.p')}</p></div>
    <div><h3>${T('open3.h3')}</h3><p>${T('open3.p')}</p></div>
  </div>
</section>
<script>
(function(){
  document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){var t=b.getAttribute('data-copy');var done=function(){var o=b.textContent;b.textContent=b.getAttribute('data-copied')||'Copied';setTimeout(function(){b.textContent=o},1500)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){window.getSelection().selectAllChildren(b.previousElementSibling)})}else{window.getSelection().selectAllChildren(b.previousElementSibling)}})});
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
  return shell('windext', body, T('meta.desc'), lang, '/')
}

export function spotsPage(rows: { id: string; name: string; country: string; kind: string; status: string; sports: string; facing_deg: number | null; lat: number; lon: number }[], lang: Lang = 'en'): string {
  const T = (k: string) => t(lang, k)
  const tr = rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.country || '')}</td><td>${esc((r.sports || '').split('|').join(', '))}</td><td>${r.facing_deg == null ? `<span class="note">${T('spots.unknown')}</span>` : Math.round(r.facing_deg) + '°'}</td><td><span class="pill ${esc(r.status)}">${esc(r.status)}</span></td><td class="note">${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}</td></tr>`).join('')
  const body = `<section style="border-top:0"><p class="eyebrow">${T('spots.eyebrow')}</p><h2>${t(lang, 'spots.h2', { n: nf(rows.length) })}</h2>
<p>${T('spots.p')}</p>
<input class="filter" id="q" type="search" placeholder="${T('spots.filter')}" aria-label="${T('spots.filter')}">
<div style="overflow-x:auto"><table class="spots" id="t"><thead><tr><th>${T('spots.th.spot')}</th><th>${T('spots.th.country')}</th><th>${T('spots.th.sports')}</th><th>${T('spots.th.faces')}</th><th>${T('spots.th.status')}</th><th>${T('spots.th.pos')}</th></tr></thead><tbody>${tr}</tbody></table></div>
<p class="note" style="margin-top:1rem">${T('spots.download')} <a href="/spots.json">spots.json</a> (CC BY-SA 4.0).</p></section>
<script>(function(){var q=document.getElementById('q'),rows=[].slice.call(document.querySelectorAll('#t tbody tr'));q.addEventListener('input',function(){var v=q.value.toLowerCase();rows.forEach(function(r){r.hidden=v&&r.textContent.toLowerCase().indexOf(v)<0})})})();</script>`
  return shell('windext spots', body, T('spots.eyebrow'), lang, '/spots')
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
