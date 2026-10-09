/**
 * 全局键盘快捷键：自旧版 keydown 逐键搬迁。
 * 输入框聚焦时豁免；3D 视图下工具/视图类按键不响应，撤销/复制/切换视图仍可用。
 */
import { useDocStore } from '../state/documentStore'
import { useUiStore } from '../state/uiStore'
import { useViewModeStore, type View3DApi } from '../state/viewModeStore'
import { toast } from '../state/toastStore'
import { deleteSel, duplicateSel, rotateSel } from './actions'
import { fitView, zoomCenter } from './viewStore'
import { toggleFullscreen } from '../ui/fullscreen'

export function bindKeyboard(getSvg: () => SVGSVGElement | null, view3d: () => View3DApi | null): () => void {
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as Element).matches?.('input,select,textarea')) return
    const vm = useViewModeStore.getState()
    if (vm.mode === '3d' && view3d()?.walking()) return
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase()
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) useDocStore.getState().redo(); else undo(); return }
    if (mod && k === 'y') { e.preventDefault(); useDocStore.getState().redo(); return }
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return }
    if (mod) return
    if (k === '[') { useUiStore.getState().toggleDrawer('lib'); return }
    if (k === ']') { useUiStore.getState().toggleDrawer('panel'); return }
    if (k === 'f' && e.shiftKey) { toggleFullscreen(); return }
    if (k === 't') { void vm.switchTo(vm.mode === '3d' ? '2d' : '3d'); return }
    else if (vm.mode === '3d' && ['v', 'm', 'x', 'f', '+', '=', '-'].includes(k)) return
    else if (k === 'v') useUiStore.getState().setTool('select')
    else if (k === 'm') useUiStore.getState().setTool('measure')
    else if (k === 'x') useUiStore.getState().setTool('demolish')
    else if (k === 'f') { const svg = getSvg(); if (svg) fitView(svg.clientWidth, svg.clientHeight) }
    else if (k === 'r') rotateSel(e.shiftKey ? -90 : 90)
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel() }
    else if (k === 'escape') {
      const ui = useUiStore.getState()
      if (ui.mA) ui.setMeasure(null, null)
      else { if (ui.tool !== 'select') ui.setTool('select'); ui.select(null) }
    }
    else if (k.startsWith('arrow') && useUiStore.getState().sel?.kind === 'furn') {
      e.preventDefault()
      const st = e.shiftKey ? 100 : 10
      const sel = useUiStore.getState().sel!
      useDocStore.getState().mutate(d => {
        const f = d.furniture.find(x => x.id === sel.id)
        if (!f) return
        if (k === 'arrowleft') f.cx -= st
        if (k === 'arrowright') f.cx += st
        if (k === 'arrowup') f.cy -= st
        if (k === 'arrowdown') f.cy += st
      })
    }
    else if (k === '+' || k === '=') { const svg = getSvg(); if (svg) zoomCenter(1.25, svg.clientWidth, svg.clientHeight) }
    else if (k === '-') { const svg = getSvg(); if (svg) zoomCenter(.8, svg.clientWidth, svg.clientHeight) }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}

function undo(): void {
  const s = useDocStore.getState()
  if (!s.undo()) toast('没有可撤销的操作')
}