/** 头部工具栏：2D/3D 切换、工具、缩放、撤销/重做、图层、全屏、文件菜单（3D 专属控件在 9.x 接线时加入） */
import { useEffect, useRef } from 'react'
import { ROOMS } from '../data/floorplan'
import { useDocStore } from '../state/documentStore'
import { useUiStore } from '../state/uiStore'
import { useViewModeStore } from '../state/viewModeStore'
import { toast } from '../state/toastStore'
import { area, fmt } from '../geometry'
import { clearLayout } from '../plan/actions'
import { fitView, setRatio, zoomCenter } from '../plan/viewStore'
import { isStandalone, toggleFullscreen } from './fullscreen'
import { exportJSON, exportPNG, importJSON, resetPlan } from './fileIO'

export function Header() {
  const tool = useUiStore(s => s.tool)
  const layers = useUiStore(s => s.layers)
  const version = useDocStore(s => s.version)
  const pastLen = useDocStore(s => s.past.length)
  const futureLen = useDocStore(s => s.future.length)
  const mode = useViewModeStore(s => s.mode)
  const fileIn = useRef<HTMLInputElement>(null)
  void version
  // 菜单项点击后收起菜单；点菜单以外也收起（同旧版）
  useEffect(() => {
    const close = (e: Event) => {
      document.querySelectorAll<HTMLDetailsElement>('details.menu').forEach(m => { if (!m.contains(e.target as Node)) m.open = false })
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const closeMenu = (e: { currentTarget: Element }) => {
    const d = e.currentTarget.closest('details') as HTMLDetailsElement | null
    if (d) d.open = false
  }

  const svgSize = () => {
    const el = document.getElementById('plan')
    return { w: el?.clientWidth ?? 800, h: el?.clientHeight ?? 600 }
  }
  const tot = ROOMS.filter(r => r.counted !== false).reduce((a, r) => a + area(r.poly), 0)

  return (
    <header>
      <div className="grp">
        <button className="btn chip" onClick={() => useUiStore.getState().toggleDrawer('lib')}>◧ 家具库</button>
        <button className="btn chip" onClick={() => useUiStore.getState().toggleDrawer('panel')}>属性 ◨</button>
      </div>
      <div className="brand"><b>三室两厅两卫 · 装修设计</b><span>套内使用面积约 {fmt(tot)} m² · 尺寸单位 mm · 原图比例 1:60</span></div>
      <div className="grp seg" id="viewSeg" title="切换 2D / 3D (T)">
        <span className="pill" />
        <button className="btn" data-view="2d" onClick={() => void useViewModeStore.getState().switchTo('2d')}>2D 平面</button>
        <button className="btn" data-view="3d" onClick={() => void useViewModeStore.getState().switchTo('3d')}>3D 场景</button>
      </div>
      {mode === '2d' ? (
        <>
          <div className="grp" id="tools">
            <button className={`btn ${tool === 'select' ? 'on' : ''}`} title="选择 / 移动 (V)" onClick={() => useUiStore.getState().setTool('select')}>选择</button>
            <button className={`btn ${tool === 'measure' ? 'on' : ''}`} title="测量 (M)" onClick={() => useUiStore.getState().setTool('measure')}>测量</button>
            <button className={`btn ${tool === 'demolish' ? 'on' : ''}`} title="拆改非承重墙 (X)" onClick={() => useUiStore.getState().setTool('demolish')}>拆改墙体</button>
          </div>
          <div className="grp">
            <button className="btn" title="缩小" onClick={() => { const { w, h } = svgSize(); zoomCenter(.8, w, h) }}>−</button>
            <button className="btn" title="放大" onClick={() => { const { w, h } = svgSize(); zoomCenter(1.25, w, h) }}>＋</button>
            <button className="btn" title="适应窗口 (F)" onClick={() => { const { w, h } = svgSize(); fitView(w, h) }}>适应</button>
            <button className="btn" title="按 1:60 显示（与原图同比例）" onClick={() => { const { w, h } = svgSize(); setRatio(60, w, h); toast('已按 1:60 显示（与原始户型图同比例）') }}>1:60</button>
            <button className="btn" title="按 1:100 显示" onClick={() => { const { w, h } = svgSize(); setRatio(100, w, h) }}>1:100</button>
          </div>
        </>
      ) : null}
      <div className="grp" id="modes3d">
        <button className="btn on" data-mode="orbit">鸟瞰</button>
        <button className="btn" data-mode="walk">漫游</button>
      </div>
      <div className="grp">
        <button className="btn" id="vIso">斜视</button>
        <button className="btn" id="vTop">俯视</button>
      </div>
      <div className="grp">
        <button className="btn chip on" data-cut="2.8">全高墙</button>
        <button className="btn chip" data-cut="1.2">剖切墙</button>
      </div>
      <div className="grp" id="toggles3d">
        <button className="btn chip on" data-t="furn">家具</button>
        <button className="btn chip on" data-t="labels">房间名</button>
        <button className="btn chip" data-t="night">夜景</button>
      </div>
      <div className="grp"><label className="range">日照 <input type="range" id="sun" min={7} max={18} step={.25} defaultValue={10} style={{ width: 84 }} /><span id="sunT">10:00</span></label></div>
      <div className="grp">
        <button className="btn" style={{ opacity: pastLen ? 1 : .4 }} title="撤销 (Ctrl+Z)" onClick={() => { if (!useDocStore.getState().undo()) toast('没有可撤销的操作') }}>撤销</button>
        <button className="btn" style={{ opacity: futureLen ? 1 : .4 }} title="重做 (Ctrl+Shift+Z)" onClick={() => { if (!useDocStore.getState().redo()) toast('没有可重做的操作') }}>重做</button>
        <button className="btn danger" title="清空所有家具家电（可撤销）" onClick={() => clearLayout()}>清空布置</button>
      </div>
      {mode === '2d' ? (
        <div className="grp" id="layers">
          <button className={`btn chip ${layers.dims ? 'on' : ''}`} onClick={() => useUiStore.getState().toggleLayer('dims')}>尺寸</button>
          <button className={`btn chip ${layers.labels ? 'on' : ''}`} onClick={() => useUiStore.getState().toggleLayer('labels')}>房间</button>
          <button className={`btn chip ${layers.furn ? 'on' : ''}`} onClick={() => useUiStore.getState().toggleLayer('furn')}>家具</button>
          <button className={`btn chip ${layers.grid ? 'on' : ''}`} onClick={() => useUiStore.getState().toggleLayer('grid')}>网格</button>
          <button className={`btn chip ${layers.bearing ? 'on' : ''}`} onClick={() => useUiStore.getState().toggleLayer('bearing')}>承重墙</button>
          <button className={`btn chip ${layers.wallSnap ? 'on' : ''}`} title="拖动家具时贴墙吸附" onClick={() => useUiStore.getState().toggleLayer('wallSnap')}>贴墙吸附</button>
        </div>
      ) : null}
      <div className="spacer" />
      {!isStandalone() ? <button className="btn" style={{ border: '1px solid var(--line)', background: '#fff' }} title="全屏 (Shift+F)" onClick={toggleFullscreen}>⛶ 全屏</button> : null}
      <details className="menu">
        <summary className="btn">文件 ▾</summary>
        <div className="menu-pop">
          <button className="btn" onClick={e => { closeMenu(e); exportPNG() }}>导出图片</button>
          <button className="btn" onClick={e => { closeMenu(e); exportJSON() }}>导出方案 JSON</button>
          <button className="btn" onClick={e => { closeMenu(e); fileIn.current?.click() }}>导入方案</button>
          <button className="btn danger" onClick={e => { closeMenu(e); resetPlan() }}>重置为默认方案</button>
        </div>
      </details>
      <input ref={fileIn} type="file" accept=".json,application/json" hidden
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void importJSON(file)
          e.target.value = ''
        }} />
    </header>
  )
}