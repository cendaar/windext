/** Official tide predictions from NOAA CO-OPS (public domain, free, no key) for spots near one of its ~3,500 prediction stations
 *  (USA, Caribbean, Pacific islands). Times are local standard/daylight time at the station. */
import STATIONS from '../../data/noaa-stations.json' with { type: 'json' }
import { distanceKm } from './store.js'
import type { TideEvent } from './analysis.js'

const LIST = STATIONS as unknown as [string, string, number, number][]

export function nearestStation(lat: number, lon: number, maxKm = 25): { id: string; name: string; km: number } | null {
  if (lat < -20 || lat > 72 || (lon > -60 && lon < 120)) return null   // quick reject outside NOAA coverage
  let best: { id: string; name: string; km: number } | null = null
  for (const [id, name, la, lo] of LIST) {
    if (Math.abs(la - lat) > 0.5) continue
    const km = distanceKm({ lat, lon }, { lat: la, lon: lo })
    if (km <= maxKm && (!best || km < best.km)) best = { id, name, km: Math.round(km * 10) / 10 }
  }
  return best
}

export async function noaaTides(stationId: string, startDate: string, days: number, fetchImpl: typeof fetch = fetch): Promise<TideEvent[]> {
  const u = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MSL&interval=hilo&station=${stationId}&begin_date=${startDate.replace(/-/g, '')}&range=${days * 24}&time_zone=lst_ldt&units=metric&format=json&application=windext`
  const res = await fetchImpl(u)
  if (!res.ok) throw new Error(`NOAA HTTP ${res.status}`)
  const d: any = await res.json()
  if (!d.predictions) throw new Error(d.error?.message ?? 'NOAA: no predictions')
  return d.predictions.map((p: any) => ({ time: String(p.t), type: p.type === 'H' ? 'high' : 'low', height: Math.round(Number(p.v) * 10) / 10 }))
}
