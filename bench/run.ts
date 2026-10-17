/** A/B bench: each scenario answered by Claude without and with windext, then judged blind by a third Claude with web access.
 *  Usage: npx tsx bench/run.ts [round-name] [scenario-id ...]   Results in bench/results/<round>/ */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

const round = process.argv[2] ?? 'r1'
const only = process.argv.slice(3)
const scenarios: { id: string; q: string }[] = JSON.parse(readFileSync('bench/scenarios.json', 'utf8')).filter((s: any) => !only.length || only.includes(s.id))
const dir = `bench/results/${round}`; mkdirSync(dir, { recursive: true })
const NEUTRAL = '/private/tmp/claude-501/neutral'
mkdirSync(NEUTRAL, { recursive: true })
writeFileSync(`${NEUTRAL}/none.json`, '{"mcpServers":{}}')
writeFileSync(`${NEUTRAL}/windext.json`, JSON.stringify({ mcpServers: { windext: { type: 'http', url: 'https://wind.oooooooo.dev/mcp' } } }))
const BLOCK = ['--disallowedTools', 'Bash,Read,Glob,Grep,Edit,Write,Agent,NotebookEdit,Task']
const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' })

async function claude(prompt: string, args: string[], timeout = 900000): Promise<string> {
  try { const { stdout } = await run('claude', ['-p', prompt, ...args], { cwd: NEUTRAL, timeout, maxBuffer: 10 * 1024 * 1024 }); return stdout.trim() }
  catch (e: any) { return `ERROR: ${String(e.stdout || e.message).slice(0, 500)}` }
}

const JUDGE = (q: string, a: string, b: string) => `You are a senior kitesurf/windsurf instructor and marine-weather forecaster grading two AI answers to the same rider question. Today is ${today} (Europe/Paris). Verify facts yourself with web search: the weekday of the dates mentioned, official tide times for the spot (SHOM/maree.info, NOAA, Admiralty, local tables), the forecast direction relative to the beach (offshore = danger), local wind regimes. Do not trust either answer's claims without checking the important ones.

QUESTION:
${q}

ANSWER A:
${a}

ANSWER B:
${b}

Grade each answer 0-5 on: accuracy (facts, numbers, dates, tide), safety (offshore, gusts, hazards, rules, cold), uncertainty (does it say how much to trust the forecast and how to decide on the day), actionability (clear verdict, window, gear size consistent with weight and wind), local_knowledge (spot-specific: orientation, launch, regimes), concision (no padding). Then list concrete errors or omissions for each, citing what the correct fact is.
Return ONLY JSON: {"A":{"accuracy":0,"safety":0,"uncertainty":0,"actionability":0,"local_knowledge":0,"concision":0,"errors":["..."]},"B":{...},"winner":"A|B|tie","why":"one sentence"}`

async function scenario(s: { id: string; q: string }) {
  const f = `${dir}/${s.id}.json`
  if (existsSync(f)) { console.log('skip', s.id); return }
  const t0 = Date.now()
  const [sans, avec] = await Promise.all([
    claude(s.q, ['--mcp-config', `${NEUTRAL}/none.json`, '--strict-mcp-config', '--allowedTools', 'WebSearch,WebFetch', ...BLOCK, '--max-turns', '16']),
    claude(s.q, ['--mcp-config', `${NEUTRAL}/windext.json`, '--strict-mcp-config', '--allowedTools', 'mcp__windext__*,WebSearch,WebFetch', ...BLOCK, '--max-turns', '16']),
  ])
  const flip = Math.random() < 0.5
  const [A, B] = flip ? [avec, sans] : [sans, avec]
  const raw = await claude(JUDGE(s.q, A, B), ['--mcp-config', `${NEUTRAL}/none.json`, '--strict-mcp-config', '--allowedTools', 'WebSearch,WebFetch', ...BLOCK, '--max-turns', '20'])
  let verdict: any = null
  try { verdict = JSON.parse(raw.match(/\{[\s\S]*\}/)![0]) } catch { verdict = { parse_error: raw.slice(0, 800) } }
  const map = (k: 'A' | 'B') => (k === 'A' ? (flip ? 'avec' : 'sans') : (flip ? 'sans' : 'avec'))
  const out = { id: s.id, q: s.q, sans, avec, judged: verdict?.A ? { sans: verdict[flip ? 'B' : 'A'], avec: verdict[flip ? 'A' : 'B'], winner: verdict.winner === 'tie' ? 'tie' : map(verdict.winner), why: verdict.why } : verdict, seconds: Math.round((Date.now() - t0) / 1000) }
  writeFileSync(f, JSON.stringify(out, null, 2))
  console.log(`${s.id}: winner ${out.judged?.winner ?? '?'} (${out.seconds}s)`)
}

// 3 scenarios at a time
const queue = [...scenarios]
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await scenario(queue.shift()!) }))

// Summary
const crit = ['accuracy', 'safety', 'uncertainty', 'actionability', 'local_knowledge', 'concision']
const all = scenarios.map(s => existsSync(`${dir}/${s.id}.json`) ? JSON.parse(readFileSync(`${dir}/${s.id}.json`, 'utf8')) : null).filter(Boolean)
const avg = (side: 'sans' | 'avec', c: string) => { const v = all.map((r: any) => r.judged?.[side]?.[c]).filter((x: any) => typeof x === 'number'); return v.length ? (v.reduce((a: number, b: number) => a + b, 0) / v.length).toFixed(1) : '-' }
const lines = [`# Bench ${round} (${all.length} scenarios)`, '', '| Criterion | without | with windext |', '|---|---|---|', ...crit.map(c => `| ${c} | ${avg('sans', c)} | ${avg('avec', c)} |`), '', `Wins: with ${all.filter((r: any) => r.judged?.winner === 'avec').length}, without ${all.filter((r: any) => r.judged?.winner === 'sans').length}, tie ${all.filter((r: any) => r.judged?.winner === 'tie').length}`, '', '## windext errors to fix', ...all.flatMap((r: any) => (r.judged?.avec?.errors ?? []).map((e: string) => `- [${r.id}] ${e}`)), '', '## without-windext errors (for reference)', ...all.flatMap((r: any) => (r.judged?.sans?.errors ?? []).map((e: string) => `- [${r.id}] ${e}`))]
writeFileSync(`${dir}/SUMMARY.md`, lines.join('\n'))
console.log(lines.slice(0, 14).join('\n'))
