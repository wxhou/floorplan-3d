import { WALLS, WINS } from './data/floorplan'
import type { Furniture, Pt, Rect, Vec } from './data/types'

/** 多边形面积 m²（按墙体内净尺寸） */
export const area = (poly: Pt[]): number => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 / 1e6
/** 周长 m */
export const perim = (poly: Pt[]): number => poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0) / 1000
export const bbox = (poly: Pt[]): Rect => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
/** 旋转后的轴对齐包围盒半宽/半深 */
export function aabb(f: Pick<Furniture, 'w' | 'd' | 'rot'>): { hw: number; hh: number } {
  const a = f.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a))
  return { hw: f.w / 2 * c + f.d / 2 * s, hh: f.w / 2 * s + f.d / 2 * c }
}
export const fmt = (n: number, d = 2): string => n.toFixed(d)
export const norm = (a: number): number => ((Math.round(a) % 360) + 360) % 360

export function hex2rgb(h: string): [number, number, number] {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map(c => c + c).join('')
  const n = parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function shade(h: string, k: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) * 2 : v * k)))
  return '#' + hex2rgb(h).map(v => f(v).toString(16).padStart(2, '0')).join('')
}

/** 吸附/推出用的矩形集合：未拆除的墙 + 窗 */
export function snapRects(demolished: readonly string[]): Rect[] {
  return WALLS.filter((_, i) => !demolished.includes('w' + i)).map(w => [w[0], w[1], w[2], w[3]] as Rect).concat(WINS)
}
const GRID = () => 10
export interface SnapCtx { wallSnap: boolean; scale: number; rects: Rect[] }
/** 家具拖动落点吸附：10mm 网格 + 贴墙吸附（家具边缘贴近墙/窗边缘时按最近边对齐） */
export function snapMove(f: Pick<Furniture, 'w' | 'd' | 'rot'>, cx: number, cy: number, ctx: SnapCtx): [number, number] {
  let nx = Math.round(cx / GRID()) * GRID(), ny = Math.round(cy / GRID()) * GRID()
  if (!ctx.wallSnap) return [nx, ny]
  const { hw, hh } = aabb(f), tol = 10 / ctx.scale
  let bx = tol, by = tol
  for (const r of ctx.rects) {
    if (!(r[3] < cy - hh - tol || r[1] > cy + hh + tol)) for (const ex of [r[0], r[2]]) for (const c of [ex + hw, ex - hw]) if (Math.abs(c - cx) < bx) { bx = Math.abs(c - cx); nx = c }
    if (!(r[2] < cx - hw - tol || r[0] > cx + hw + tol)) for (const ey of [r[1], r[3]]) for (const c of [ey + hh, ey - hh]) if (Math.abs(c - cy) < by) { by = Math.abs(c - cy); ny = c }
  }
  return [nx, ny]
}
/** 测量点吸附：10mm 网格 + 靠近墙/窗端点时吸附端点；shift 时向锚点锁定水平/垂直 */
export function snapPoint(p: Vec, shift: boolean, anchor: Vec | null, ctx: { scale: number; rects: Rect[] }): Vec {
  let x = Math.round(p.x / 10) * 10, y = Math.round(p.y / 10) * 10
  const tol = 8 / ctx.scale
  let bx = tol, by = tol
  for (const r of ctx.rects) {
    for (const ex of [r[0], r[2]]) if (Math.abs(ex - p.x) < bx) { bx = Math.abs(ex - p.x); x = ex }
    for (const ey of [r[1], r[3]]) if (Math.abs(ey - p.y) < by) { by = Math.abs(ey - p.y); y = ey }
  }
  if (shift && anchor) { if (Math.abs(x - anchor.x) > Math.abs(y - anchor.y)) y = anchor.y; else x = anchor.x }
  return { x, y }
}
/** 新放下的家具若压在墙/窗上，沿穿透较浅的方向推出来，刚好贴墙 */
export function pushOut(f: { cx: number; cy: number; w: number; d: number; rot: number }, rects: Rect[]): void {
  for (let n = 0; n < 4; n++) {
    let moved = false
    for (const r of rects) {
      const { hw, hh } = aabb(f), ox = Math.min(f.cx + hw, r[2]) - Math.max(f.cx - hw, r[0]), oy = Math.min(f.cy + hh, r[3]) - Math.max(f.cy - hh, r[1])
      if (ox <= 0 || oy <= 0) continue
      if (ox < oy) f.cx = f.cx < (r[0] + r[2]) / 2 ? r[0] - hw : r[2] + hw
      else f.cy = f.cy < (r[1] + r[3]) / 2 ? r[1] - hh : r[3] + hh
      moved = true
    }
    if (!moved) return
  }
}