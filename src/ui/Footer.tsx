/** 底栏：光标坐标 / 悬停房间 / 当前比例 / 提示文案（随 2D-3D 模式变化） */
import { useEffect, useState } from 'react'
import { ROOMS } from '../data/floorplan'
import { usePointerStore } from '../state/pointerStore'
import { useViewModeStore } from '../state/viewModeStore'
import { useUiStore, narrowNow } from '../state/uiStore'
import { PX_MM, useViewStore } from '../plan/viewStore'
import { area, fmt } from '../geometry'

const COARSE = typeof matchMedia === 'function' ? matchMedia('(pointer:coarse)').matches : false
const TIPS: Record<string, string> = {
  '2d': COARSE ? '点或拖动家具库添加 · 单指拖动平移 · 双指缩放 · 选中家具后底部工具条可旋转 / 复制 / 删除' : '拖动左侧家具到平面图 · 滚轮缩放 · 拖动空白处平移 · T 切换 3D',
  '3d': COARSE ? '单指旋转 · 双指缩放 / 平移 · 点家具或地面编辑 · 点门开关' : '3D 场景与平面方案实时同步 · 右侧面板修改会立即生效 · T 返回 2D',
}

export function Footer() {
  const x = usePointerStore(s => s.x)
  const y = usePointerStore(s => s.y)
  const room = usePointerStore(s => s.room)
  const s = useViewStore(v => v.s)
  const mode = useViewModeStore(m => m.mode)
  const tool = useUiStore(t => t.tool)
  const is3d = mode === '3d'
  const hoverRoom = room ? ROOMS.find(r => r.id === room) : null
  const hoverArea = hoverRoom ? fmt(area(hoverRoom.poly)) : null
  const ratio = '1:' + Math.round(1 / (s * PX_MM))
  void tool
  void narrowNow
  void useState; void useEffect
  return (
    <footer>
      {!is3d ? <span className="only2d">X <b>{isNaN(x) ? '—' : x} mm</b></span> : null}
      {!is3d ? <span className="only2d">Y <b>{isNaN(y) ? '—' : y} mm</b></span> : null}
      {!is3d ? <span className="only2d">当前比例 <b>{ratio}</b></span> : null}
      {!is3d ? <span id="hover" className="only2d">{hoverRoom ? <><b>{hoverRoom.name}</b> {hoverArea} m²</> : null}</span> : null}
      <span className="spacer" />
      <span id="tip">{TIPS[is3d ? '3d' : '2d']}</span>
    </footer>
  )
}