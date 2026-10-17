/** Spot knowledge store. D1 on Cloudflare, in-memory fallback for the local stdio server. No personal data. */

export type SpotStatus = 'seed' | 'community' | 'verified'
export type WindQuality = 'best' | 'ok' | 'marginal' | 'forbidden'

export interface SpotCard {
  id: string; name: string; aliases: string[]
  lat: number; lon: number; country: string; water: string
  facing_deg: number | null; facing_source: string
  sports: string[]; tide_notes: string; hazards: string; rules: string; launch_notes: string; season: string
  kind: 'spot' | 'school'
  status: SpotStatus; sources: string[]; submissions: number; updated_at: string
  wind: { sector: string; quality: WindQuality; note: string }[]
}
export type SpotInput = Omit<SpotCard, 'id' | 'status' | 'submissions' | 'updated_at' | 'kind'> & { id?: string; kind?: 'spot' | 'school' }

export interface ArchiveRow { spot_key: string; day: string; model: string; hour: number; speed: number | null; gust: number | null; dir: number | null; fetched_at: string; lead_hours: number }

export interface Store {
  searchSpots(query: string, limit?: number): Promise<SpotCard[]>
  nearbySpots(lat: number, lon: number, km: number, limit?: number): Promise<(SpotCard & { distance_km: number })[]>
  getSpot(id: string): Promise<SpotCard | null>
  submitSpot(card: SpotInput): Promise<{ id: string; action: 'created' | 'updated' | 'proposed'; status: SpotStatus }>
  logRequest(r: { spot_id: string | null; lat: number; lon: number; day: string; sport: string }): Promise<void>
  archiveForecast(rows: ArchiveRow[]): Promise<void>
  hasArchive(spot_key: string, day: string, fetched_at_prefix: string): Promise<boolean>
  setFacing(id: string, facing_deg: number, source: string): Promise<void>
}

export const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// ---------- D1 ----------
type D1Row = Record<string, any>
const rowToCard = (r: D1Row, wind: SpotCard['wind'] = []): SpotCard => ({
  id: r.id, name: r.name, aliases: r.aliases ? String(r.aliases).split('|').filter(Boolean) : [],
  lat: r.lat, lon: r.lon, country: r.country, water: r.water, facing_deg: r.facing_deg, facing_source: r.facing_source,
  sports: r.sports ? String(r.sports).split('|').filter(Boolean) : [], tide_notes: r.tide_notes, hazards: r.hazards, rules: r.rules,
  launch_notes: r.launch_notes, season: r.season, kind: r.kind ?? 'spot', status: r.status, sources: r.sources ? String(r.sources).split('|').filter(Boolean) : [],
  submissions: r.submissions, updated_at: r.updated_at, wind,
})

export class D1Store implements Store {
  constructor(private db: D1Database) {}

  private async withWind(rows: D1Row[]): Promise<SpotCard[]> {
    if (!rows.length) return []
    const ids = rows.map(r => r.id)
    const w = await this.db.prepare(`SELECT spot_id, sector, quality, note FROM spot_wind WHERE spot_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<D1Row>()
    const byId = new Map<string, SpotCard['wind']>()
    for (const x of w.results) { if (!byId.has(x.spot_id)) byId.set(x.spot_id, []); byId.get(x.spot_id)!.push({ sector: x.sector, quality: x.quality, note: x.note }) }
    return rows.map(r => rowToCard(r, byId.get(r.id) ?? []))
  }

  async searchSpots(query: string, limit = 5) {
    const q = `%${query.toLowerCase()}%`
    const r = await this.db.prepare(`SELECT * FROM spots WHERE lower(name) LIKE ?1 OR aliases LIKE ?1 OR id LIKE ?1 ORDER BY CASE status WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END, submissions DESC LIMIT ?2`).bind(q, limit).all<D1Row>()
    return this.withWind(r.results)
  }

  async nearbySpots(lat: number, lon: number, km: number, limit = 10) {
    const dLat = km / 111, dLon = km / (111 * Math.cos(lat * Math.PI / 180))
    const r = await this.db.prepare(`SELECT * FROM spots WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 200`).bind(lat - dLat, lat + dLat, lon - dLon, lon + dLon).all<D1Row>()
    const cards = await this.withWind(r.results)
    return cards.map(c => ({ ...c, distance_km: Math.round(distanceKm({ lat, lon }, c) * 10) / 10 })).filter(c => c.distance_km <= km).sort((a, b) => a.distance_km - b.distance_km).slice(0, limit)
  }

  async getSpot(id: string) { const r = await this.db.prepare('SELECT * FROM spots WHERE id = ?').bind(id).first<D1Row>(); return r ? (await this.withWind([r]))[0] : null }

  async submitSpot(card: SpotInput) {
    const kind = card.kind ?? 'spot'
    const near = (await this.nearbySpots(card.lat, card.lon, 0.5, 10)).filter(k => k.kind === kind)   // a school never absorbs a launch spot, nor the reverse
    const existing = near[0] ?? (card.id ? await this.getSpot(card.id) : null)
    const now = new Date().toISOString().slice(0, 19) + 'Z'
    const j = (a: string[]) => a.map(s => s.trim()).filter(Boolean).join('|')
    if (existing?.status === 'verified') {
      await this.db.prepare('INSERT INTO spot_proposals (spot_id, payload) VALUES (?, ?)').bind(existing.id, JSON.stringify(card)).run()
      return { id: existing.id, action: 'proposed' as const, status: existing.status }
    }
    const id = existing?.id ?? (card.id ? slugify(card.id) : slugify(card.name))
    const aliases = Array.from(new Set([...(existing?.aliases ?? []), ...card.aliases.map(a => a.toLowerCase()), card.name.toLowerCase()]))
    const sources = Array.from(new Set([...(existing?.sources ?? []), ...card.sources]))
    const pick = (field: keyof SpotInput) => (card[field] as string) || (existing?.[field as keyof SpotCard] as string) || ''
    const stmts = [
      this.db.prepare(`INSERT INTO spots (id, name, aliases, lat, lon, country, water, facing_deg, facing_source, sports, tide_notes, hazards, rules, launch_notes, season, status, sources, submissions, updated_at, kind)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'community', ?16, 1, ?17, ?18)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, aliases = excluded.aliases, country = excluded.country, water = excluded.water, facing_deg = COALESCE(excluded.facing_deg, spots.facing_deg), facing_source = excluded.facing_source, sports = excluded.sports, tide_notes = excluded.tide_notes, hazards = excluded.hazards, rules = excluded.rules, launch_notes = excluded.launch_notes, season = excluded.season, status = 'community', sources = excluded.sources, submissions = spots.submissions + 1, updated_at = excluded.updated_at, kind = excluded.kind`)
        .bind(id, card.name, j(aliases), existing?.lat ?? card.lat, existing?.lon ?? card.lon, pick('country'), pick('water'), card.facing_deg ?? existing?.facing_deg ?? null, card.facing_deg != null ? card.facing_source : (existing?.facing_source ?? ''), j(card.sports.length ? card.sports : existing?.sports ?? []), pick('tide_notes'), pick('hazards'), pick('rules'), pick('launch_notes'), pick('season'), j(sources), now, card.kind ?? existing?.kind ?? 'spot'),
    ]
    if (card.wind.length) {
      stmts.push(this.db.prepare('DELETE FROM spot_wind WHERE spot_id = ?').bind(id))
      for (const w of card.wind) stmts.push(this.db.prepare('INSERT INTO spot_wind (spot_id, sector, quality, note) VALUES (?, ?, ?, ?)').bind(id, w.sector.toUpperCase(), w.quality, w.note ?? ''))
    }
    await this.db.batch(stmts)
    return { id, action: existing ? 'updated' as const : 'created' as const, status: 'community' as const }
  }

  async logRequest(r: { spot_id: string | null; lat: number; lon: number; day: string; sport: string }) {
    await this.db.prepare('INSERT INTO requests (spot_id, lat, lon, day, sport) VALUES (?, ?, ?, ?, ?)').bind(r.spot_id, Math.round(r.lat * 100) / 100, Math.round(r.lon * 100) / 100, r.day, r.sport).run()
  }

  async hasArchive(spot_key: string, day: string, prefix: string) {
    const r = await this.db.prepare('SELECT 1 AS x FROM forecast_archive WHERE spot_key = ? AND day = ? AND fetched_at LIKE ? LIMIT 1').bind(spot_key, day, prefix + '%').first()
    return !!r
  }

  async setFacing(id: string, facing_deg: number, source: string) {
    await this.db.prepare('UPDATE spots SET facing_deg = ?, facing_source = ? WHERE id = ? AND facing_deg IS NULL').bind(facing_deg, source, id).run()
  }

  async archiveForecast(rows: ArchiveRow[]) {
    const chunk = 50
    for (let i = 0; i < rows.length; i += chunk) {
      await this.db.batch(rows.slice(i, i + chunk).map(r => this.db.prepare('INSERT OR IGNORE INTO forecast_archive (spot_key, day, model, hour, speed, gust, dir, fetched_at, lead_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(r.spot_key, r.day, r.model, r.hour, r.speed, r.gust, r.dir, r.fetched_at, r.lead_hours)))
    }
  }
}

// ---------- in-memory (stdio / tests) ----------
export class MemoryStore implements Store {
  private spots = new Map<string, SpotCard>()
  async searchSpots(query: string, limit = 5) { const q = query.toLowerCase(); return [...this.spots.values()].filter(s => s.name.toLowerCase().includes(q) || s.aliases.some(a => a.includes(q))).slice(0, limit) }
  async nearbySpots(lat: number, lon: number, km: number, limit = 10) { return [...this.spots.values()].map(c => ({ ...c, distance_km: Math.round(distanceKm({ lat, lon }, c) * 10) / 10 })).filter(c => c.distance_km <= km).sort((a, b) => a.distance_km - b.distance_km).slice(0, limit) }
  async getSpot(id: string) { return this.spots.get(id) ?? null }
  async submitSpot(card: SpotInput) {
    const near = (await this.nearbySpots(card.lat, card.lon, 0.5, 10)).filter(k => k.kind === (card.kind ?? 'spot')); const id = near[0]?.id ?? slugify(card.id ?? card.name)
    const prev = this.spots.get(id)
    this.spots.set(id, { ...card, kind: card.kind ?? 'spot', id, status: 'community', submissions: (prev?.submissions ?? 0) + 1, updated_at: new Date().toISOString() })
    return { id, action: prev ? 'updated' as const : 'created' as const, status: 'community' as const }
  }
  async logRequest() {}
  async archiveForecast() {}
  async hasArchive() { return true }
  async setFacing(id: string, facing_deg: number, source: string) { const c = this.spots.get(id); if (c && c.facing_deg == null) { c.facing_deg = facing_deg; c.facing_source = source } }
}
