import type { LibItem } from '../data/types'
import { F, uid } from '../data/defaults'
import { WALLS } from '../data/floorplan'
import { getDoc, useDocStore } from '../state/documentStore'
import { toast } from '../state/toastStore'
import { useUiStore } from '../state/uiStore'
import { pushOut, norm, snapRects } from '../geometry'

/** 添加家具（同旧版 addItem）：10mm 取整 + 推出墙体 + 地毯置底 + 自动选中 + 提示 */
export function addItem(it: LibItem, x: number, y: number): void {
  const [type, name, w, d, color] = it
  const f = F(type, name, Math.round(x / 10) * 10, Math.round(y / 10) * 10, w, d, 0, color)
  pushOut(f, snapRects(getDoc().demolished))
  useUiStore.getState().select({ kind: 'furn', id: f.id })
  useDocStore.getState().mutate(doc => {
    if (type === 'rug') doc.furniture.unshift(f)
    else doc.furniture.push(f)
  })
  toast(`已添加「${name}」${w}×${d}`)
}

/** 拆改墙体：承重墙/外墙不可拆（各自提示），其余切换拆除状态并提示 */
export function toggleWall(id: string): void {
  const w = WALLS[+id.slice(1)]
  if (w[4] === 'b') return toast('承重墙（黑色）不可拆除')
  if (w[4] === 'e') return toast('外墙属于建筑外围护结构，不建议拆除')
  const on = getDoc().demolished.includes(id)
  useDocStore.getState().mutate(doc => {
    doc.demolished = on ? doc.demolished.filter(x => x !== id) : [...doc.demolished, id]
  })
  toast(on ? '已恢复墙体' : `已标记拆除 ${Math.max(w[2] - w[0], w[3] - w[1])} mm 墙体`)
}

/** 旋转选中家具 90°（delta 可为负） */
export function rotateSel(delta: number): void {
  const sel = useUiStore.getState().sel
  if (sel?.kind !== 'furn') return
  useDocStore.getState().mutate(doc => {
    const f = doc.furniture.find(x => x.id === sel.id)
    if (f) f.rot = norm(f.rot + delta)
  })
}

export function deleteSel(): void {
  const ui = useUiStore.getState()
  if (ui.sel?.kind !== 'furn') return
  const id = ui.sel.id
  ui.select(null)
  useDocStore.getState().mutate(doc => {
    doc.furniture = doc.furniture.filter(f => f.id !== id)
  })
}

/** 复制：副本右下偏移 200mm 并自动选中（同旧版 duplicateSel） */
export function duplicateSel(): void {
  const ui = useUiStore.getState()
  const sel = ui.sel
  if (sel?.kind !== 'furn') return
  const f = getDoc().furniture.find(x => x.id === sel.id)
  if (!f) return
  const n = { ...f, id: uid(), cx: f.cx + 200, cy: f.cy + 200 }
  ui.select({ kind: 'furn', id: n.id })
  useDocStore.getState().mutate(doc => { doc.furniture.push(n) })
}

/** 清空布置：确认后整体可撤销（同旧版 clearLayout） */
export function clearLayout(): void {
  const n = getDoc().furniture.length
  if (!n) return toast('当前没有布置任何家具')
  if (!confirm(`确定清空全部 ${n} 件家具 / 家电吗？\n墙体、地面材料和测量线会保留，可点「撤销」恢复。`)) return
  useUiStore.getState().select(null)
  useDocStore.getState().mutate(doc => { doc.furniture = [] })
  toast('已清空布置，可点「撤销」恢复')
}

/** 家具叠放顺序调整（属性面板用） */
export function bringToEdge(id: string, edge: 'top' | 'bottom'): void {
  useDocStore.getState().mutate(doc => {
    const i = doc.furniture.findIndex(f => f.id === id)
    if (i < 0) return
    const [f] = doc.furniture.splice(i, 1)
    if (edge === 'top') doc.furniture.push(f)
    else doc.furniture.unshift(f)
  })
}