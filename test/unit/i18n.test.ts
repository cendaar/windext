import { describe, it, expect } from 'vitest'
import { DICT, LANGS, pickLang, t } from '../../src/i18n.js'
import { landingPage, spotsPage } from '../../src/pages.js'

describe('dictionaries', () => {
  it('every language has every key of the English reference, and no extra ones', () => {
    const ref = Object.keys(DICT.en).sort()
    for (const l of LANGS) expect(Object.keys(DICT[l]).sort(), l).toEqual(ref)
  })
  it('keeps the same HTML markup across languages', () => {
    for (const k of Object.keys(DICT.en)) {
      const tags = (s: string) => (s.match(/<[a-z]+|href="[^"]*"/g) ?? []).sort()
      for (const l of LANGS) expect(tags(DICT[l][k]), `${l}:${k}`).toEqual(tags(DICT.en[k]))
    }
  })
  it('substitutes variables and falls back to English', () => {
    expect(t('fr', 'spots.h2', { n: '361' })).toBe('361 spots, et ça continue')
    expect(t('de', 'nope')).toBe('nope')
  })
})

describe('pickLang', () => {
  it('prefers the path, then the query, then Accept-Language, then English', () => {
    expect(pickLang('/de', null, 'fr')).toBe('de')
    expect(pickLang('/', 'pt', 'fr')).toBe('pt')
    expect(pickLang('/', null, 'fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr')
    expect(pickLang('/', null, 'ja,zh')).toBe('en')
    expect(pickLang('/spots', 'xx', null)).toBe('en')
    expect(pickLang('/xx', null, null)).toBe('en')
  })
})

describe('pages', () => {
  it('render in each language with the right lang attribute, hreflang links and switcher', () => {
    for (const l of LANGS) {
      const h = landingPage({ spots: 361, enriched: 2, forecasts: 10, countries: 5 }, l)
      expect(h).toContain(`<html lang="${l}">`); expect(h).toContain(t(l, 'hero.eyebrow')); expect(h).toContain(`<option value="${l}" selected>`)
      expect((h.match(/hreflang=/g) ?? []).length).toBe(LANGS.length)
      expect(h).toContain('https://wind.oooooooo.dev/mcp'); expect(h).toContain('<b>361</b>')
    }
    const s = spotsPage([{ id: 'a', name: 'A', country: 'FR', kind: 'spot', status: 'seed', sports: 'kitesurf', facing_deg: null, lat: 1, lon: 2 }], 'es')
    expect(s).toContain('1 spots, y subiendo'); expect(s).toContain('desconocida')
  })
})
