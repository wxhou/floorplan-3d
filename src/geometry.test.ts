import { area, aabb, fmt, hex2rgb, norm, perim, snapMove, snapPoint, snapRects, shade } from './geometry'
import { WALLS, WINS } from './data/floorplan'

describe('area / perim / fmt / norm', () => {
  it('room area in m² for a rect polygon in mm', () => {
    const poly: [number, number][] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]]
    expect(area(poly)).toBeCloseTo(24, 6)
    expect(perim(poly)).toBeCloseTo(20, 6)
  })
  it('fmt and norm', () => {
    expect(fmt(3.14159)).toBe('3.14')
    expect(norm(370)).toBe(10)
    expect(norm(-90)).toBe(270)
    expect(norm(360 + 90)).toBe(90)
  })
})

describe('aabb', () => {
  it('axis-aligned furniture', () => {
    const a0 = aabb({ w: 2000, d: 600, rot: 0 }), a180 = aabb({ w: 2000, d: 600, rot: 180 })
    expect(a0.hw).toBeCloseTo(1000, 9); expect(a0.hh).toBeCloseTo(300, 9)
    expect(a180.hw).toBeCloseTo(1000, 9); expect(a180.hh).toBeCloseTo(300, 9)
  })
  it('90° rotation swaps half-extents', () => {
    const a90 = aabb({ w: 2000, d: 600, rot: 90 })
    expect(a90.hw).toBeCloseTo(300, 9); expect(a90.hh).toBeCloseTo(1000, 9)
  })
})

describe('hex2rgb / shade', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(hex2rgb('#ffffff')).toEqual([255, 255, 255])
    expect(hex2rgb('#abc')).toEqual([170, 187, 204])
  })
  it('shade darkens and lightens within bounds', () => {
    expect(shade('#ffffff', 0.5)).toBe('#808080')
    expect(shade('#000000', 2)).toBe('#ffffff') // k>1 是提亮方向
    expect(shade('#808080', 1.5)).toBe('#ffffff') // k>1: v + (255-v)*(k-1)*2
  })
})

describe('snapRects', () => {
  it('includes all walls + windows when nothing demolished', () => {
    expect(snapRects([]).length).toBe(WALLS.length + WINS.length)
  })
  it('excludes demolished walls', () => {
    const rects = snapRects(['w0'])
    expect(rects.length).toBe(WALLS.length - 1 + WINS.length)
  })
})

describe('snapMove', () => {
  const f = { w: 800, d: 500, rot: 0 }
  it('snaps to 10mm grid with wallSnap off', () => {
    const [x, y] = snapMove(f, 1234, 4321, { wallSnap: false, scale: 0.06, rects: snapRects([]) })
    expect([x, y]).toEqual([1230, 4320])
  })
  it('snaps furniture edge flush to a wall when close', () => {
    // 墙 [0,0,6000,100]：家具底边贴近 y=100 → 中心吸附到 y=100+hh=350
    const [, y] = snapMove(f, 3000, 340, { wallSnap: true, scale: 0.06, rects: [[0, 0, 6000, 100]] })
    expect(y).toBe(350)
  })
  it('ignores far walls', () => {
    const [x, y] = snapMove(f, 3000, 5000, { wallSnap: true, scale: 0.06, rects: [[0, 0, 6000, 100]] })
    expect([x, y]).toEqual([3000, 5000])
  })
})

describe('snapPoint', () => {
  const ctx = { scale: 0.06, rects: [[0, 0, 6000, 100] as [number, number, number, number]] }
  it('snaps to 10mm grid when far from edges', () => {
    expect(snapPoint({ x: 1234, y: 4321 }, false, null, ctx)).toEqual({ x: 1230, y: 4320 })
  })
  it('snaps to wall endpoint within tolerance', () => {
    expect(snapPoint({ x: 12, y: 98 }, false, null, ctx)).toEqual({ x: 0, y: 100 })
  })
  it('shift locks to anchor axis', () => {
    // 锚点 (0, 5000)，点 (2000, 3000)：dx > dy → 锁 x 到锚点
    expect(snapPoint({ x: 2000, y: 3000 }, true, { x: 0, y: 5000 }, { scale: 0.06, rects: [] })).toEqual({ x: 0, y: 3000 })
  })
})