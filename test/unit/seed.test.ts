import { describe, it, expect } from 'vitest'
import { classify, toRows, toSql } from '../../scripts/seed-osm.js'

const el = (id: number, tags: Record<string, string>, lat = 49.29, lon = -0.26, type = 'node') => ({ type, id, lat, lon, tags })

describe('classify', () => {
  it('tells launch spots from schools, clubs and shops', () => {
    expect(classify({ natural: 'beach', sport: 'kitesurfing' })).toBe('spot')
    expect(classify({ leisure: 'slipway' })).toBe('spot')
    expect(classify({ amenity: 'surf_school' })).toBe('school'); expect(classify({ shop: 'sports' })).toBe('school'); expect(classify({ club: 'sport' })).toBe('school')
    expect(classify({ name: 'Surfclub Otto' })).toBe('school'); expect(classify({ name: 'Bootsclub e.V.' })).toBe('school'); expect(classify({ name: 'Plage de la Franqui' })).toBe('spot')
  })
})

describe('toRows', () => {
  it('maps OSM sport values, names, aliases, notes and sources', () => {
    const rows = toRows([el(1, { name: 'Βασιλική', 'name:en': 'Vassiliki', sport: 'windsurfing;hiking;kitesurfing', natural: 'beach', description: 'Afternoon thermal' })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'vassiliki-osm-1', name: 'Vassiliki', aliases: ['vassiliki'], sports: ['windsurf', 'kitesurf'], kind: 'spot', launch_notes: 'Afternoon thermal', source: 'https://www.openstreetmap.org/node/1' })
  })
  it('skips objects without a relevant sport or without a position, and names unnamed ones', () => {
    expect(toRows([el(2, { sport: 'tennis' })])).toHaveLength(0)
    expect(toRows([{ type: 'relation', id: 3, tags: { sport: 'kitesurfing' } }])).toHaveLength(0)
    const u = toRows([el(4, { sport: 'kiteboarding' })])[0]; expect(u.name).toBe('Unnamed kitesurf spot (OSM node 4)'); expect(u.id).toBe('osm-node-4')
  })
  it('uses the centre of ways and merges duplicates within 300 m of the same kind', () => {
    const rows = toRows([{ type: 'way', id: 5, center: { lat: 49.29, lon: -0.26 }, tags: { name: 'Riva', sport: 'kitesurfing', natural: 'beach' } }, el(6, { name: 'Riva Bella', sport: 'windsurfing', natural: 'beach', description: 'richer' }, 49.2905, -0.2605), el(7, { name: 'Riva School', sport: 'kitesurfing', amenity: 'surf_school' }, 49.2905, -0.2605)])
    expect(rows).toHaveLength(2)
    const spot = rows.find(r => r.kind === 'spot')!
    expect(spot.name).toBe('Riva Bella'); expect(spot.sports.sort()).toEqual(['kitesurf', 'windsurf']); expect(spot.aliases).toContain('riva')
  })
})

describe('toSql', () => {
  it('escapes quotes and marks rows as seed', () => {
    const sql = toSql(toRows([el(8, { name: "L'Almanarre", sport: 'kitesurfing', natural: 'beach' })]))
    expect(sql).toContain("'L''Almanarre'"); expect(sql).toContain("'seed', 'seed'"); expect(sql).toContain('INSERT OR IGNORE')
  })
})
