/** 方案导入导出 / PNG 导出 / 重置（自旧版 download/exportPNG/import 分支搬迁） */
import { getDoc, useDocStore } from '../state/documentStore'
import { normalizeDocument } from '../state/docData'
import { useUiStore } from '../state/uiStore'
import { useViewModeStore, getView3D } from '../state/viewModeStore'
import { toast } from '../state/toastStore'
import { BOUNDS, PX_MM, useViewStore } from '../plan/viewStore'
import { download } from './download'

export function exportJSON(): void {
  download('户型装修方案.json', new Blob([JSON.stringify(getDoc(), null, 2)], { type: 'application/json' }))
}

export function exportPNG(): void {
  if (useViewModeStore.getState().mode === '3d') return getView3D()?.shot()
  const svg = document.getElementById('plan') as unknown as SVGSVGElement | null
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  const W = 3200, H = Math.round(W * BOUNDS.h / BOUNDS.w)
  clone.setAttribute('viewBox', `${BOUNDS.x} ${BOUNDS.y} ${BOUNDS.w} ${BOUNDS.h}`)
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))
  const gSel = clone.querySelector('#gSel')
  if (gSel) gSel.innerHTML = ''
  const gGrid = clone.querySelector('#gGrid')
  if (gGrid) gGrid.innerHTML = `<rect x="-20000" y="-20000" width="55000" height="55000" fill="${useUiStore.getState().layers.grid ? 'url(#grid)' : '#f7f4ee'}"/>`
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  const bgAttrs: Record<string, string> = { x: '-20000', y: '-20000', width: '55000', height: '55000', fill: '#f7f4ee' }
  Object.entries(bgAttrs).forEach(([k, v]) => bg.setAttribute(k, v))
  clone.insertBefore(bg, gGrid)
  const img = new Image()
  img.onload = () => {
    const cv = document.createElement('canvas')
    cv.width = W; cv.height = H
    cv.getContext('2d')!.drawImage(img, 0, 0, W, H)
    cv.toBlob(b => { if (b) download('户型装修方案.png', b) })
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))
}

/** 导入方案 JSON：校验失败提示且方案不变；成功可撤销（同旧版） */
export async function importJSON(file: File): Promise<void> {
  try {
    const next = normalizeDocument(JSON.parse(await file.text()))
    if (!next) throw 0
    useDocStore.getState().importDoc(next)
    useUiStore.getState().select(null)
    toast('方案已导入')
  } catch {
    toast('文件格式不正确')
  }
}

export function resetPlan(): void {
  if (!confirm('恢复为默认设计方案？（可撤销）')) return
  useDocStore.getState().reset()
  useUiStore.getState().select(null)
}

export function ratioText(): string {
  const s = useViewStore.getState().s
  return '1:' + Math.round(1 / (s * PX_MM))
}