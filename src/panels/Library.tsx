/**
 * 家具库侧栏：分类网格 + 点击添加 + 拖拽幽灵预览。
 * 自旧版 buildLib / libDrag / dropPoint / endLibDrag 逐段搬迁。
 * 触屏用 pointer 事件（iPad 上 HTML5 拖放不可靠）；列表 touch-action:pan-y，
 * 竖向滑动交给浏览器滚动（触发 pointercancel），横向拖出列表才开始拖放。
 */
import { LIB } from '../data/catalog'
import type { LibItem } from '../data/types'
import { furnSVG } from '../data/legend'
import { addItem } from '../plan/actions'
import { toMM } from '../plan/viewStore'
import { useUiStore } from '../state/uiStore'
import { useViewModeStore, getView3D } from '../state/viewModeStore'
import { useViewStore } from '../plan/viewStore'
import { bbox } from '../geometry'
import { ROOMS } from '../data/floorplan'
import { toast } from '../state/toastStore'

const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches
const TAP = COARSE ? 9 : 4
const narrow = () => matchMedia('(max-width:1100px)').matches

/** 屏幕坐标 → 户型坐标（mm）。2D 取平面图坐标，3D 取射线与地面交点；s = 该处每 mm 的屏幕像素数 */
export function dropPoint(x: number, y: number): { x: number; y: number; s: number } | null {
  const stage = document.getElementById('stage')
  if (!stage) return null
  const r = stage.getBoundingClientRect()
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
  if (document.elementFromPoint(x, y)?.closest('aside.open,#fab,#walkOverlay,#joy,#walkExit')) return null
  if (useViewModeStore.getState().mode === '3d') return getView3D()?.groundAt(x, y) ?? null
  const svg = document.getElementById('plan') as unknown as SVGSVGElement | null
  if (!svg) return null
  const p = toMM(svg, { clientX: x, clientY: y })
  return { x: p.x, y: p.y, s: useViewStore.getState().s }
}

interface LibDrag { item: LibItem; id: number; sx: number; sy: number; ghost: HTMLDivElement | null; el: HTMLElement }
let libDrag: LibDrag | null = null

function endLibDrag(ok: boolean, e?: { clientX: number; clientY: number }): void {
  if (!libDrag) return
  const d = libDrag
  libDrag = null
  d.el.classList.remove('dragging')
  if (d.ghost) {
    d.ghost.remove()
    if (!ok || !e) return
    const p = dropPoint(e.clientX, e.clientY)
    if (p) addItem(d.item, p.x, p.y)
    else if (useViewModeStore.getState().mode === '3d') toast('请拖到地面上')
    return
  }
  if (!ok) return
  // 轻点：放到选中房间中心，否则放到画面中心（3D 取屏幕中心对应的地面位置）
  let p: { x: number; y: number } | null = null
  const sel = useUiStore.getState().sel
  if (sel?.kind === 'room') {
    const b = bbox(ROOMS.find(r => r.id === sel.id)!.poly)
    p = { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 }
  } else if (useViewModeStore.getState().mode === '3d') {
    const stage = document.getElementById('stage')!
    const r = stage.getBoundingClientRect()
    p = getView3D()?.groundAt(r.left + r.width / 2, r.top + r.height / 2) ?? null
  }
  if (!p) {
    const svg = document.getElementById('plan')
    const v = useViewStore.getState()
    if (!svg) return
    p = { x: v.x0 + svg.clientWidth / 2 / v.s, y: v.y0 + svg.clientHeight / 2 / v.s }
  }
  addItem(d.item, p.x, p.y)
}

/** 全局 move/up 监听（挂在 window，组件挂载时启用一次） */
export function bindLibraryDrag(): () => void {
  const onMove = (e: PointerEvent) => {
    if (!libDrag || e.pointerId !== libDrag.id) return
    const it = libDrag.item
    if (!libDrag.ghost) {
      if (Math.hypot(e.clientX - libDrag.sx, e.clientY - libDrag.sy) < TAP) return
      const g = libDrag.ghost = document.createElement('div')
      g.id = 'ghost'
      g.innerHTML = `<svg viewBox="${-it[2] / 2} ${-it[3] / 2} ${it[2]} ${it[3]}">${furnSVG(it[0], it[2], it[3], it[4])}</svg>`
      document.body.appendChild(g)
      libDrag.el.classList.add('dragging')
    }
    // 幽灵图按落点处的比例显示真实大小（3D 中近大远小）
    const g = libDrag.ghost
    const s = Math.max(dropPoint(e.clientX, e.clientY)?.s || (useViewModeStore.getState().mode === '3d' ? .05 : useViewStore.getState().s), .02)
    Object.assign(g.style, { width: Math.max(28, it[2] * s) + 'px', height: Math.max(20, it[3] * s) + 'px', left: e.clientX + 'px', top: e.clientY + 'px' })
    const lib = document.querySelector('aside.lib')
    if (narrow() && lib && lib.classList.contains('open') && e.clientX > lib.getBoundingClientRect().right) { /* 6.3 接抽屉收起 */ }
  }
  const onUp = (e: PointerEvent) => endLibDrag(true, e)
  const onCancel = () => endLibDrag(false)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }
}

/** 家具项按下（供组件调用）：真正开始拖动要等move 超过阈值 */
export function startLibDrag(e: { pointerId: number; clientX: number; clientY: number }, item: LibItem, el: HTMLElement): void {
  libDrag = { item, id: e.pointerId, sx: e.clientX, sy: e.clientY, ghost: null, el }
}

export function Library(): React.JSX.Element {
  return (
    <div id="lib">
      {LIB.map((c, ci) => (
        <div key={ci}>
          <h4>{c.cat}</h4>
          <div className="lib-grid">
            {c.items.map((it, ii) => {
              const [t, n, w, d2, col] = it
              const pad = Math.max(w, d2) * .08
              return (
                <div key={ii} className="item" data-key={`${ci}:${ii}`}
                  title="点击添加，或拖到平面图中的指定位置"
                  onPointerDown={e => { if (!(e as unknown as PointerEvent).button) startLibDrag(e, it, e.currentTarget) }}>
                  <svg viewBox={`${-w / 2 - pad} ${-d2 / 2 - pad} ${w + 2 * pad} ${d2 + 2 * pad}`}
                    dangerouslySetInnerHTML={{ __html: furnSVG(t, w, d2, col) }} />
                  <b>{n}</b><small>{w}×{d2}</small>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="hint">家具按真实尺寸（mm）绘制。{COARSE ? '点一下放到画面中央，或按住向右拖到平面图 / 3D 地面上的指定位置（上下滑动为滚动列表）。' : '点击添加到画面中央，或直接拖到平面图 / 3D 地面上。'}添加后可在右侧修改宽深与颜色。</div>
    </div>
  )
}