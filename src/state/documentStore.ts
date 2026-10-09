import { create } from 'zustand'
import type { PlanDocument } from '../data/types'
import { defaultState } from '../data/defaults'
import { loadDocument, saveDocument } from './docData'

/**
 * 文档 store：唯一事实源。undo/redo 用 JSON 快照（上限 150，与旧版一致），
 * 栈放 store 状态里让撤销/重做按钮可订阅可用性。
 * 两个写入口（对应旧版 mutate / 手势配对语义）：
 * - mutate(fn)：即改即提交一条历史（面板、快捷键等离散操作）
 * - commitGesture(before, apply)：手势起止配对——拖拽期间不动 store，
 *   结束时一次性应用并只记一条历史（「一次手势一条记录」）
 */
const HISTORY_MAX = 150

interface DocStore {
  doc: PlanDocument
  /** 每次文档变更自增，供组件用 useDocStore(s => s.version) 做廉价订阅 */
  version: number
  past: string[]
  future: string[]
  snapshot: () => string
  mutate: (fn: (d: PlanDocument) => void) => void
  commitGesture: (before: string, apply: (d: PlanDocument) => void) => void
  undo: () => boolean
  redo: () => boolean
  reset: () => void
  /** 导入整份文档（已规范化），计入撤销历史 */
  importDoc: (next: PlanDocument) => void
}

/** 文档变更监听（UI store 在此注册选中态校验等联动） */
export const docListeners = new Set<(d: PlanDocument) => void>()
function afterChange(d: PlanDocument) { docListeners.forEach(fn => fn(d)) }

export const useDocStore = create<DocStore>((set, get) => {
  const applyNext = (next: PlanDocument, before: string | null) => {
    const p = get().past, f = get().future
    const past = before !== null
      ? [...p, before].slice(Math.max(0, [...p, before].length - HISTORY_MAX))
      : p
    const future = before !== null ? [] : f
    saveDocument(next)
    set(s => ({ doc: next, version: s.version + 1, past, future }))
    afterChange(next)
  }
  const timeTravel = (from: string[], to: string[]): PlanDocument | null => {
    const next = from.pop()
    if (next === undefined) return null
    const doc = JSON.parse(next) as PlanDocument
    saveDocument(doc)
    set(s => ({ doc, version: s.version + 1, past: [...from], future: [...to] }))
    afterChange(doc)
    return doc
  }
  return {
    doc: loadDocument() ?? defaultState(),
    version: 0,
    past: [],
    future: [],
    snapshot: () => JSON.stringify(get().doc),
    mutate: fn => {
      const next = structuredClone(get().doc)
      fn(next)
      applyNext(next, get().snapshot())
    },
    commitGesture: (before, apply) => {
      const next = structuredClone(get().doc)
      apply(next)
      applyNext(next, before)
    },
    undo: () => {
      if (!get().past.length) return false
      const s = get()
      const future = [...s.future, s.snapshot()]
      timeTravel([...s.past], future)
      return true
    },
    redo: () => {
      if (!get().future.length) return false
      const s = get()
      const past = [...s.past, s.snapshot()]
      timeTravelReverse(past, s)
      return true
    },
    reset: () => applyNext(defaultState(), get().snapshot()),
    importDoc: next => applyNext(next, get().snapshot()),
  }
  function timeTravelReverse(past: string[], s: { future: string[]; }): PlanDocument | null {
    const next = s.future.pop()
    if (next === undefined) return null
    const doc = JSON.parse(next) as PlanDocument
    saveDocument(doc)
    set(v => ({ doc, version: v.version + 1, past, future: [...s.future] }))
    afterChange(doc)
    return doc
  }
})

export const getDoc = () => useDocStore.getState().doc