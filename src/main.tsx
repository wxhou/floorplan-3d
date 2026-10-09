import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { PlanSvg } from './plan/PlanSvg'
import { Library, bindLibraryDrag } from './panels/Library'
import { Panel, Fab } from './panels/Panel'
import { Header } from './ui/Header'
import { Footer } from './ui/Footer'
import { Toast } from './ui/Toast'
import { ModeHint } from './ui/ModeHint'
import { Stage3DOverlay, Lib3D } from './three/wire'
import { useDocStore } from './state/documentStore'
import { useUiStore } from './state/uiStore'
import { useViewModeStore } from './state/viewModeStore'
import { useViewStore } from './plan/viewStore'
import './styles.css'

function App() {
  useEffect(() => bindLibraryDrag(), [])
  const drawer = useUiStore(s => s.drawer)
  const panes = useUiStore(s => s.panes)
  const mode = useViewModeStore(s => s.mode)
  // body 类：2D/3D 大段 CSS（.only2d/.only3d/seg 样式）依赖 body.m3d，与旧版一致
  useEffect(() => {
    document.body.classList.toggle('m3d', mode === '3d')
  }, [mode])
  return (
    <>
      <div className={'app' + (panes.hideLib ? ' hide-lib' : '') + (panes.hidePanel ? ' hide-panel' : '')}>
        <Header />
        <aside className={'lib' + (drawer === 'lib' ? ' open' : '')}><Lib3D /><Library /></aside>
        <main id="stage">
          <PlanSvg />
          <Stage3DOverlay />
          <div className="scalebar"><ScalebarContent /></div>
          <ModeHint />
          <Fab />
        </main>
        <aside className={'right' + (drawer === 'panel' ? ' open' : '')}><Panel /></aside>
        <Footer />
      </div>
      <Toast />
    </>
  )
}

/** 比例尺：选取 ≥60px 的最大规整长度（同旧版 applyView 逻辑） */
function ScalebarContent() {
  const s = useViewStore(v => v.s)
  const nice = [100, 200, 500, 1000, 2000, 5000].find(v => v * s >= 60) ?? 5000
  return (
    <>
      <span>{nice >= 1000 ? `${nice / 1000} m` : `${nice} mm`}</span>
      <div className="bar" style={{ width: nice * s }} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// dev 环境暴露 store 供自动化验证与调试（生产构建不含）
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__stores = { useDocStore, useUiStore, useViewStore }
}