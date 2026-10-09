import { create } from 'zustand'
import { toast } from './toastStore'
import { useUiStore } from './uiStore'

export type ViewMode = '2d' | '3d'

/**
 * 2D/3D 视图模式。3D 引擎（three 模块）在 9.x 接线时通过 registerEngine 注册；
 * 引擎未就绪时切 3D 只提示不切换（同旧版「3D 引擎仍在加载或加载失败」）。
 */
interface ViewModeStore {
  mode: ViewMode
  switching: boolean
  registerEngine: (engine: View3DApi) => void
  switchTo: (m: ViewMode) => Promise<void>
}

// 与旧版 window.View3D 相同的接口（three 模块提供的最小面）
export interface View3DApi {
  enter: () => Promise<void>
  exit: () => Promise<void>
  sync: () => void
  shot: () => void
  groundAt: (x: number, y: number) => { x: number; y: number; s: number } | null
  flyToRoom: (id: string) => void
  walking: () => boolean
}

let engine: View3DApi | null = null

export const getView3D = () => engine

export const useViewModeStore = create<ViewModeStore>((set, get) => ({
  mode: '2d',
  switching: false,
  registerEngine: e => { engine = e },
  switchTo: async m => {
    const st = get()
    if (m === st.mode || st.switching) return
    if (m === '3d' && !engine) { toast('3D 引擎仍在加载或加载失败'); return }
    set({ switching: true, mode: m })
    try {
      if (m === '3d') {
        // 进入 3D：重置为选择工具并清除未完成的测量起点（同旧版 setView）
        const ui = useUiStore.getState()
        if (ui.tool !== 'select') ui.setTool('select')
        else ui.setMeasure(null, null)
        await engine!.enter()
      } else {
        await engine!.exit()
      }
    } finally {
      set({ switching: false })
    }
  },
}))