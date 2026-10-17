/** Estimates which way a beach faces from the OpenStreetMap coastline near a point (ODbL, © OSM contributors).
 *  OSM draws natural=coastline with land on the left and water on the right, so the beach faces bearing + 90°.
 *  Returns null when there is no coastline within `radiusM` or Overpass does not answer in time. */
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

export interface Facing { facing_deg: number; distance_m: number }

export function facingFromGeometry(lat: number, lon: number, ways: { geometry: { lat: number; lon: number }[] }[], smoothM = 500): Facing | null {
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540
  // Collect segment midpoints within the smoothing window of the nearest point, then average their orientation (as vectors, so the sea side is preserved).
  let best: { d: number; p: { lat: number; lon: number } } | null = null
  const segs: { mx: number; my: number; dx: number; dy: number; len: number }[] = []
  for (const w of ways) {
    const g = w.geometry ?? []
    for (let i = 1; i < g.length; i++) {
      const a = g[i - 1], b = g[i]
      const dx = (b.lon - a.lon) * kx, dy = (b.lat - a.lat) * ky, len = Math.hypot(dx, dy); if (!len) continue
      // Nearest point on the segment to (lat, lon)
      const px = (lon - a.lon) * kx, py = (lat - a.lat) * ky
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (len * len)))
      const qx = t * dx, qy = t * dy, d = Math.hypot(px - qx, py - qy)
      segs.push({ mx: a.lon + (qx / kx), my: a.lat + (qy / ky), dx, dy, len })
      if (!best || d < best.d) best = { d, p: { lon: a.lon + qx / kx, lat: a.lat + qy / ky } }
    }
  }
  if (!best) return null
  let sx = 0, sy = 0, total = 0
  for (const s of segs) {
    const dd = Math.hypot((s.mx - best.p.lon) * kx, (s.my - best.p.lat) * ky)
    if (dd <= smoothM) { sx += s.dx; sy += s.dy; total += s.len }   // length-weighted by construction
  }
  if (!sx && !sy) return null
  // A cove, a point or a lagoon mouth has segments pointing every way: the estimate would be a guess, so give none.
  if (Math.hypot(sx, sy) / total < 0.8) return null
  const bearing = (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360   // direction of travel along the way
  return { facing_deg: Math.round((bearing + 90) % 360), distance_m: Math.round(best.d) }
}

export async function estimateFacing(lat: number, lon: number, opts: { radiusM?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<Facing | null> {
  const { radiusM = 1500, timeoutMs = 8000, fetchImpl = fetch } = opts
  const query = `[out:json][timeout:${Math.ceil(timeoutMs / 1000)}];way["natural"="coastline"](around:${radiusM},${lat.toFixed(5)},${lon.toFixed(5)});out geom;`
  for (const url of MIRRORS) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetchImpl(`${url}?data=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'windext-mcp (https://wind.oooooooo.dev)' }, signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) continue
      const d: any = await res.json()
      return facingFromGeometry(lat, lon, d.elements ?? [])
    } catch { /* try next mirror */ }
  }
  return null
}
