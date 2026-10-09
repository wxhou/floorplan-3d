import { create } from 'zustand'
import type { PlanDocument } from '../data/types'
import { docListeners } from './documentStore'

export type Tool = 'select' | 'measure' | 'demolish'
export type Sel = { kind: 'furn'; id: string } | { kind: 'room'; id: string } | null
export type Vec2 = { x: number; y: number }

export interface Layers {
  dims: boolean
  labels: boolean
  furn: boolean
  grid: boolean
  bearing: boolean
  wallSnap: boolean
}

/**
 * UI 状态 store：不进撤销历史、不随方案持久化。
 * 字段与旧版 ui 对象对应；侧栏收起偏好按旧版单独存 'huxing-panes'。
 */
interface UiStore {
  tool: Tool
  sel: Sel
  /** 测量工具：待定的起点 / 当前点（null = 无待定测量） */
  mA: Vec2 | null
  mCur: Vec2 | null
  layers: Layers
  /** 窄屏抽屉：开着的那个（宽屏恒 null，用 panes 收起） */
  drawer: 'lib' | 'panel' | null
  /** 宽屏侧栏收起状态（持久化） */
  panes: { hideLib: boolean; hidePanel: boolean }
  setTool: (t: Tool) => void
  select: (s: Sel) => void
  setMeasure: (a: Vec2 | null, cur: Vec2 | null) => void
  toggleLayer: (k: keyof Layers) => void
  /** 开合侧栏：which=null 关闭窄屏抽屉；open 省略则切换（同旧版 drawer()） */
  toggleDrawer: (which: 'lib' | 'panel' | null, open?: boolean) => void
  closeDrawers: () => void
}

// 与旧版一致的默认图层开关
const initialLayers: Layers = { dims: true, labels: true, furn: true, grid: false, bearing: false, wallSnap: true }

export const PANES_KEY = 'huxing-panes'
const loadPanes = (): { hideLib: boolean; hidePanel: boolean } => {
  try {
    return JSON.parse(localStorage.getItem(PANES_KEY) ?? '{}') ?? { hideLib: false, hidePanel: false }
  } catch {
    return { hideLib: false, hidePanel: false }
  }
}
const savePanes = (p: { hideLib: boolean; hidePanel: boolean }): void => {
  try { localStorage.setItem(PANES_KEY, JSON.stringify(p)) } catch { /* 静默 */ }
}

export const useUiStore = create<UiStore>(set => ({
  tool: 'select',
  sel: null,
  mA: null,
  mCur: null,
  layers: initialLayers,
  drawer: null,
  panes: loadPanes(),
  setTool: tool => set({ tool, mA: null, mCur: null }),
  select: sel => set({ sel }),
  setMeasure: (a, cur) => set({ mA: a, mCur: cur }),
  toggleLayer: k => set(s => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  toggleDrawer: (which, open) => set(s => {
    if (narrowNow()) return { drawer: which && (open ?? s.drawer !== which) ? which : null }
    const panes = { ...s.panes }
    if (which) {
      const k = which === 'lib' ? 'hideLib' as const : 'hidePanel' as const
      panes[k] = open === undefined ? !panes[k] : !open
      savePanes(panes)
    }
    return { panes, ...(which ? {} : { drawer: null }) }
  }),
  closeDrawers: () => set(s => (narrowNow() ? (s.drawer ? { drawer: null } : s) : s)),
}))

/** 与旧版一致的窄屏判定 */
export const narrowNow = (): boolean => matchMedia('(max-width:1100px)').matches

// 选中家具被删除（mutate / 撤销重做还原）后自动清除选中态，同旧版 validateSel
docListeners.add((doc: PlanDocument) => {
  const { sel, select } = useUiStore.getState()
  if (sel?.kind === 'furn' && !doc.furniture.some(f => f.id === sel.id)) select(null)
})