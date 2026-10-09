import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../state/uiStore'
import { getView3D, useViewModeStore } from '../state/viewModeStore'
import { fitView, zoomAt, useViewStore } from './viewStore'
import { bindPlanInteractions } from './interactions'
import { bindKeyboard } from './keyboard'
import { DimsLayer, FurnLayer, GridLayer, LabelsLayer, MeasureLayer, OpeningsLayer, PlanDefs, RoomsLayer, SelLayer, WallsLayer } from './layers'

/**
 * 平面图 SVG 壳。viewBox 随视图 store 声明式更新；尺寸标注层/选中态/测量层
 * 各自订阅所需切片，缩放时只有受影响的图层重渲染。
 */
export function PlanSvg() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<[number, number]>([0, 0])
  const x0 = useViewStore(v => v.x0), y0 = useViewStore(v => v.y0), s = useViewStore(v => v.s)
  const tool = useUiStore(t => t.tool)

  // 视图初始化与画布尺寸自适应：首次 fit，之后保持画面中心（同旧版 ResizeObserver）
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    let lastW = 0, lastH = 0
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w) return
      const v = useViewStore.getState()
      if (!lastW) fitView(w, h)
      else v.setView({ x0: v.x0 - (w - lastW) / 2 / v.s, y0: v.y0 - (h - lastH) / 2 / v.s })
      lastW = w; lastH = h
      setSize([w, h])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 滚轮以光标为中心缩放（ctrlKey 时为触控板捏合，灵敏度同旧版）
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(useViewStore.getState().s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 指针手势 + 键盘快捷键（5.x 交互层）
  useEffect(() => {
    const clean1 = bindPlanInteractions(() => svgRef.current)
    const clean2 = bindKeyboard(() => svgRef.current, () => useViewModeStore.getState().mode === '3d' ? getView3D() : null)
    return () => { clean1(); clean2() }
  }, [])

  return (
    <svg id="plan" ref={svgRef} className={`tool-${tool}`}
      viewBox={size[0] ? `${x0} ${y0} ${size[0] / s} ${size[1] / s}` : undefined}
      fontFamily="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">
      <PlanDefs />
      <GridLayer />
      <RoomsLayer />
      <FurnLayer />
      <WallsLayer />
      <OpeningsLayer />
      <LabelsLayer />
      <DimsLayer />
      <MeasureLayer />
      <SelLayer />
    </svg>
  )
}