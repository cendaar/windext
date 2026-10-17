/** Official weather warnings from the US National Weather Service (public domain, free). Other countries: none yet. */
export interface Alert { event: string; headline: string; ends: string | null }

export const inUS = (lat: number, lon: number) => lat >= 17 && lat <= 72 && ((lon >= -180 && lon <= -64) || lon >= 170)

export async function nwsAlerts(lat: number, lon: number, fetchImpl: typeof fetch = fetch): Promise<Alert[]> {
  if (!inUS(lat, lon)) return []
  try {
    const res = await fetchImpl(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { 'User-Agent': 'windext (wind@oooooooo.dev)', Accept: 'application/geo+json' } })
    if (!res.ok) return []
    const d: any = await res.json()
    return (d.features ?? []).map((f: any) => ({ event: String(f.properties?.event ?? ''), headline: String(f.properties?.headline ?? '').slice(0, 200), ends: f.properties?.ends ?? f.properties?.expires ?? null })).filter((a: Alert) => a.event)
  } catch { return [] }
}

/** Warnings that make riding a no-go whatever the forecast table says. */
export const isBlocking = (event: string) => /gale|storm|hurricane|tropical|tornado|thunderstorm|high wind|hazardous seas|extreme wind|tsunami/i.test(event)
