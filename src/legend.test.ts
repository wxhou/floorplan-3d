import { furnSVG, sanitizeColor } from './data/legend'

describe('sanitizeColor', () => {
  it('accepts hex colors', () => {
    expect(sanitizeColor('#c9d6df')).toBe('#c9d6df')
    expect(sanitizeColor('#FFF')).toBe('#FFF')
    expect(sanitizeColor('#ff00aa88')).toBe('#ff00aa88')
  })
  it('replaces malformed / injected color with fallback', () => {
    const evil = '"><svg onload=alert(1)>'
    expect(sanitizeColor(evil)).toBe('#eee')
    expect(sanitizeColor('red')).toBe('#eee')
    expect(sanitizeColor('')).toBe('#eee')
    expect(sanitizeColor(evil, '#c9d6df')).toBe('#c9d6df')
  })
})

describe('furnSVG', () => {
  it('emits valid rect for unknown furniture type', () => {
    const svg = furnSVG('unknown-type', 1000, 500, '#c9d6df')
    expect(svg).toContain('fill="#c9d6df"')
    expect(svg).toContain('<rect')
  })
  it('does not interpolate malicious color into attributes', () => {
    const svg = furnSVG('cabinet', 1000, 350, '"><svg onload=alert(1)>')
    expect(svg).not.toContain('<svg onload')
    expect(svg).toContain('fill="#eee"')
  })
  it('renders known types including shade-derived colors', () => {
    const bed = furnSVG('bed', 1800, 2000, '#c9d6df')
    expect(bed).toContain('<rect')
    expect(bed).toContain('<path')
    expect(furnSVG('rug', 2400, 1700, '#d9cbb8')).toContain('fill-opacity=".6"')
    expect(furnSVG('plant', 500, 500, '#a9c39b')).toContain('rotate(315)')
  })
})