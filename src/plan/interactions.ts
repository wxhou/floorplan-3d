/**
 * 平面图指针手势：选择/拖动/旋转/缩放尺寸/平移/双指/测量/拆改。
 * 自旧版 pointerdown/pointermove/onPointerEnd/endDrag 逐段搬迁；手势期间经
 * 直接改 DOM 属性渲染（不经 React 协调），结束时一次性 commitGesture 提交历史。
 * 键盘快捷键在同目录 keyboard.ts。
 */
import { getDoc, useDocStore } from '../state/documentStore'
import { useUiStore } from '../state/uiStore'
import { getView3D, useViewModeStore } from '../state/viewModeStore'
import { usePointerStore } from '../state/pointerStore'
import { toMM, useViewStore, zoomAt } from './viewStore'
import { norm, snapMove, snapPoint, snapRects } from '../geometry'
import { rotateSel, toggleWall } from './actions'

const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches
const TAP = COARSE ? 9 : 4

interface Drag {
  kind: 'move' | 'rot' | 'size' | 'pan' | 'measure'
  id?: string
  sx: number
  sy: number
  moved: boolean
  before: string
  ox?: number
  oy?: number
  x0?: number
  y0?: number
  room?: string | null
}

let drag: Drag | null = null
let pinch: { d: number; c: [number, number]; s: number; px: number; py: number } | null = null
const touches = new Map<number, { x: number; y: number }>()

/** 拖拽中的家具草稿：手势期间的临时形状/位置，不影响 store 文档 */
interface Draft { cx: number; cy: number; rot: number; w: number; d: number }
let draft: Draft | null = null

const ui = () => useUiStore.getState()
const vst = () => useViewStore.getState()
const snapCtx = () => ({ wallSnap: ui().layers.wallSnap, scale: vst().s, rects: snapRects(getDoc().demolished) })

/** 手势期间的定点 DOM 更新：对应旧版 renderFurn()+renderSel() 的最小集 */
function gestureDomUpdate(id: string, f: Draft): void {
  const svg = document.getElementById('plan')
  const g = svg?.querySelector(`[data-fid="${id}"]`)
  if (g) g.setAttribute('transform', `translate(${f.cx} ${f.cy}) rotate(${f.rot})`)
  const sel = svg?.querySelector('#gSel > g')
  if (sel) {
    sel.setAttribute('transform', `translate(${f.cx} ${f.cy}) rotate(${f.rot})`)
    const overlay = sel.querySelector('rect')
    if (overlay) {
      const p = 5 / vst().s
      overlay.setAttribute('x', String(-f.w / 2 - p))
      overlay.setAttribute('y', String(-f.d / 2 - p))
      overlay.setAttribute('width', String(f.w + 2 * p))
      overlay.setAttribute('height', String(f.d + 2 * p))
    }
  }
  const dims = svg?.querySelector('#gSel > text')
  if (dims) dims.textContent = `${f.w} × ${f.d}`
}

/** 漫游中（键盘手势让位给漫游模块） */
export const walkingNow = (): boolean => {
  const vm = useViewModeStore.getState()
  return vm.mode === '3d' && getView3D()?.walking() === true
}

export function bindPlanInteractions(getSvg: () => SVGSVGElement | null): () => void {
  const cleanups: Array<() => void> = []
  const bind = (el: Element | null, type: string, fn: EventListener, opts?: { passive?: boolean }) => {
    if (!el) return
    el.addEventListener(type, fn, opts)
    cleanups.push(() => el.removeEventListener(type, fn))
  }

  const svgXY = (x: number, y: number): [number, number] => {
    const r = getSvg()!.getBoundingClientRect()
    return [x - r.left, y - r.top]
  }
  const pinchInfo = () => {
    const [a, b] = [...touches.values()]
    return { d: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), c: svgXY((a.x + b.x) / 2, (a.y + b.y) / 2) }
  }
  const getF = (id: string) => getDoc().furniture.find(f => f.id === id)
  const snap = () => useDocStore.getState().snapshot()

  function endDrag(cancel: boolean, svg: SVGSVGElement): void {
    const d = drag
    drag = null
    svg.classList.remove('panning')
    if (!d) return
    if (d.kind === 'measure') {
      if (cancel) { ui().setMeasure(null, null); return }
      const a = ui().mA, b = ui().mCur
      if (d.moved && a && b && Math.hypot(b.x - a.x, b.y - a.y) > 20) {
        ui().setMeasure(null, null)
        useDocStore.getState().mutate(doc => { doc.measures.push({ a, b }) })
      }
      return // 没拖动：保留起点，等第二次点击
    }
    if (d.kind === 'pan') {
      if (!cancel && !d.moved && ui().tool === 'select') ui().select(d.room ? { kind: 'room', id: d.room } : null)
      return
    }
    if (d.moved && draft && d.id) {
      const captured = { ...draft }
      useDocStore.getState().commitGesture(d.before, doc => {
        const g = doc.furniture.find(x => x.id === d.id)
        if (g) Object.assign(g, captured)
      })
    }
    draft = null
  }

  function onPointerEnd(e: PointerEvent): void {
    touches.delete(e.pointerId)
    if (pinch) { if (touches.size < 2) pinch = null; return } // 双指结束后，剩下的手指不再触发操作
    endDrag(e.type === 'pointercancel', getSvg()!)
  }

  bind(getSvg(), 'pointerdown', (ev: Event) => onDown(ev as PointerEvent))
  bind(getSvg(), 'pointermove', ev => onMove(ev as PointerEvent))
  bind(getSvg(), 'pointerup', ev => onPointerEnd(ev as PointerEvent))
  bind(getSvg(), 'pointercancel', ev => onPointerEnd(ev as PointerEvent))

  function onDown(ev: PointerEvent): void {
    const svg = getSvg()!
    // 点画布收起窄屏抽屉（同旧版 closeDrawers）
    useUiStore.getState().closeDrawers()
    if (ev.button === 1 || ev.button === 2) return
    // 漫游模式下不处理平面手势（3D 有自己的处理）
    if (useViewModeStore.getState().mode === '3d') return
    if (ev.pointerType !== 'mouse') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      try { svg.setPointerCapture(ev.pointerId) } catch { /* 指针已释放时可能抛 NotFoundError */ }
      if (touches.size >= 2) { // 第二根手指落下：取消单指操作，进入双指缩放/平移
        endDrag(drag?.kind === 'measure' || drag?.kind === 'pan', svg)
        const { d, c } = pinchInfo()
        pinch = { d, c, s: vst().s, px: vst().x0 + c[0] / vst().s, py: vst().y0 + c[1] / vst().s }
        return
      }
    }
    if (pinch) return
    const p = toMM(svg, ev)
    const t = ev.target as Element
    if (ui().tool === 'measure') {
      const q = snapPoint(p, ev.shiftKey, ui().mA, { scale: vst().s, rects: snapRects(getDoc().demolished) })
      if (!ui().mA) {
        ui().setMeasure(q, q)
        drag = { kind: 'measure', sx: ev.clientX, sy: ev.clientY, moved: false, before: '' }
        try { svg.setPointerCapture(ev.pointerId) } catch { /* 指针已释放时可能抛 NotFoundError */ }
      } else {
        const a = ui().mA
        ui().setMeasure(null, null)
        if (a && Math.hypot(q.x - a.x, q.y - a.y) > 20) useDocStore.getState().mutate(doc => { doc.measures.push({ a, b: q }) })
      }
      return
    }
    if (!t) return
    const sel0 = ui().sel
    const h = t.closest<HTMLElement>('[data-handle]')
    if (h && sel0?.kind === 'furn') {
      const f = getF(sel0.id)
      if (!f) return
      draft = { ...f }
      drag = { kind: h.getAttribute('data-handle') as 'rot' | 'size', id: sel0.id, sx: ev.clientX, sy: ev.clientY, moved: false, before: snap() }
    } else if (ui().tool === 'demolish' && t.closest<HTMLElement>('[data-wall]')) {
      toggleWall(t.closest<HTMLElement>('[data-wall]')!.getAttribute('data-wall')!)
      return
    } else if (ui().tool === 'select' && t.closest<HTMLElement>('[data-fid]')) {
      const fid = t.closest<HTMLElement>('[data-fid]')!.getAttribute('data-fid')!
      const f = getF(fid)
      if (!f) return
      if (ui().sel?.id !== f.id) ui().select({ kind: 'furn', id: f.id })
      draft = { ...f }
      drag = { kind: 'move', id: f.id, sx: ev.clientX, sy: ev.clientY, ox: p.x - f.cx, oy: p.y - f.cy, moved: false, before: snap() }
    } else {
      const room = t.closest('[data-room]')
      drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, x0: vst().x0, y0: vst().y0, room: room && room.getAttribute('data-room'), moved: false, before: '' }
      draft = null
    }
    try { svg.setPointerCapture(ev.pointerId) } catch { /* 指针已释放时可能抛 NotFoundError */ }
  }

  function onMove(ev: PointerEvent): void {
    const svg = getSvg()!
    if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pinch) {
      if (touches.size < 2) return
      const { d, c } = pinchInfo()
      const ns = Math.max(.012, Math.min(2, pinch.s * d / pinch.d))
      vst().setView({ s: ns, x0: pinch.px - c[0] / ns, y0: pinch.py - c[1] / ns })
      return
    }
    const p = toMM(svg, ev)
    const t = ev.target instanceof Element ? ev.target : null
    const room = t?.closest?.('[data-room]')
    usePointerStore.getState().setPointer(Math.round(p.x), Math.round(p.y), room ? room.getAttribute('data-room') : null)
    if (!drag) {
      if (ui().tool === 'measure' && ui().mA) {
        ui().setMeasure(ui().mA, snapPoint(p, ev.shiftKey, ui().mA, { scale: vst().s, rects: snapRects(getDoc().demolished) }))
      }
      return
    }
    const far = Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) >= TAP
    if (drag.kind === 'measure') {
      if (far) drag.moved = true
      ui().setMeasure(ui().mA, snapPoint(p, ev.shiftKey, ui().mA, { scale: vst().s, rects: snapRects(getDoc().demolished) }))
      return
    }
    if (drag.kind === 'pan') {
      if (!drag.moved && !far) return
      drag.moved = true
      svg.classList.add('panning')
      vst().setView({ x0: drag.x0! - (ev.clientX - drag.sx) / vst().s, y0: drag.y0! - (ev.clientY - drag.sy) / vst().s })
      return
    }
    const f = drag.id ? getF(drag.id) : null
    if (!f || !draft) return
    if (!drag.moved && !far) return // 轻点家具不应让它抖动一下
    drag.moved = true
    if (drag.kind === 'move') {
      const [nx, ny] = snapMove(f, p.x - (drag.ox ?? 0), p.y - (drag.oy ?? 0), snapCtx())
      draft.cx = nx
      draft.cy = ny
    } else if (drag.kind === 'rot') {
      const a = Math.atan2(p.y - f.cy, p.x - f.cx) * 180 / Math.PI + 90
      draft.rot = norm(ev.shiftKey ? a : Math.round(a / 15) * 15)
    } else if (drag.kind === 'size') {
      const a = f.rot * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a)
      const dx = p.x - f.cx, dy = p.y - f.cy, lx = dx * c + dy * s2, ly = -dx * s2 + dy * c
      const ax = -f.w / 2, ay = -f.d / 2
      const nw = Math.max(100, Math.round((lx - ax) / 10) * 10), nd = Math.max(100, Math.round((ly - ay) / 10) * 10)
      const mx = ax + nw / 2, my = ay + nd / 2
      draft.cx = f.cx + mx * c - my * s2
      draft.cy = f.cy + mx * s2 + my * c
      draft.w = nw
      draft.d = nd
    }
    gestureDomUpdate(drag.id!, draft)
  }

  bind(getSvg(), 'wheel', ((e: WheelEvent) => {
    e.preventDefault()
    const svg = getSvg()!
    const r = svg.getBoundingClientRect()
    zoomAt(vst().s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top)
  }) as EventListener, { passive: false })

  bind(getSvg(), 'dblclick', e => { if (ui().tool === 'select' && (e.target as Element).closest('[data-fid]')) rotateSel(90) })
  bind(getSvg(), 'contextmenu', e => {
    if (ui().tool === 'measure') { e.preventDefault(); ui().setMeasure(null, null) }
  })

  return () => cleanups.forEach(fn => fn())
}