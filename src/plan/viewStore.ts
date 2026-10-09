import { create } from 'zustand'

export interface View { x0: number; y0: number; s: number }

/** 视图变换状态：不进 React 渲染频繁路径的例外——pan/zoom 每帧改这里，只有订阅 s 的
 *  sel/measure 图层和 <svg viewBox> 会重渲染（对应旧版 applyView 定点重绘）。 */
export const useViewStore = create<View & {
  setView: (v: Partial<View>) => void
}>((set) => ({
  x0: 0, y0: 0, s: 0.06,
  setView: v => set(s => ({ ...v, s: v.s !== undefined ? clampScale(v.s) : s.s })),
}))

/** 1 CSS px = 0.2646 mm */
export const PX_MM = 25.4 / 96
export const BOUNDS = { x: -1850, y: -1750, w: 15600, h: 14100 }

const clampScale = (s: number) => Math.max(0.012, Math.min(2, s))

/** 以 (mx,my)（svg 像素坐标）为中心缩放到 ns */
export function zoomAt(ns: number, mx: number, my: number): void {
  const v = useViewStore.getState()
  ns = clampScale(ns)
  const px = v.x0 + mx / v.s, py = v.y0 + my / v.s
  useViewStore.getState().setView({ s: ns, x0: px - mx / ns, y0: py - my / ns })
}

export function fitView(w: number, h: number): void {
  const s = Math.min(w / BOUNDS.w, h / BOUNDS.h)
  useViewStore.getState().setView({ s, x0: BOUNDS.x - (w / s - BOUNDS.w) / 2, y0: BOUNDS.y - (h / s - BOUNDS.h) / 2 })
}

/** 平移（拖拽空白处，dx/dy 为屏幕像素） */
export function panBy(dx: number, dy: number): void {
  const v = useViewStore.getState()
  useViewStore.getState().setView({ x0: v.x0 - dx / v.s, y0: v.y0 - dy / v.s })
}

export const zoomCenter = (k: number, w: number, h: number) => zoomAt(useViewStore.getState().s * k, w / 2, h / 2)
export const setRatio = (r: number, w: number, h: number) => zoomAt(1 / (r * PX_MM), w / 2, h / 2)

/** 屏幕事件坐标 → 户型坐标 mm（与旧版 toMM 相同：走 SVG CTM 逆变换） */
export function toMM(svg: SVGSVGElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: p.x, y: p.y }
}