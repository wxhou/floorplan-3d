import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanDocument } from '../data/types'
import { defaultState } from '../data/defaults'

// past/future 是模块级状态：每个用例重载模块拿全新 store
let useDocStore: typeof import('./documentStore').useDocStore

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  ;({ useDocStore } = await import('./documentStore'))
  await import('./uiStore') // 注册选中态清理联动
})

describe('documentStore.mutate', () => {
  it('applies change, bumps version by 1 and persists', () => {
    const before = useDocStore.getState().doc.furniture[0].name
    const n0 = useDocStore.getState().version
    useDocStore.getState().mutate(d => { d.furniture[0].name = '改名' })
    const s = useDocStore.getState()
    expect(before).not.toBe('改名')
    expect(s.doc.furniture[0].name).toBe('改名')
    expect(s.version).toBe(n0 + 1)
    expect(JSON.parse(localStorage.getItem('huxing-design-v1')!).furniture[0].name).toBe('改名')
  })

  it('listener fires with the new document', async () => {
    const { docListeners } = await import('./documentStore')
    let seen = 0
    const fn = (d: PlanDocument) => { seen += d.furniture.length }
    docListeners.add(fn)
    useDocStore.getState().mutate(() => { })
    expect(seen).toBe(useDocStore.getState().doc.furniture.length)
    docListeners.delete(fn)
  })
})

describe('undo / redo', () => {
  it('one gesture = one history entry: three drags undone in three steps', () => {
    const s = useDocStore.getState()
    const original = s.doc.furniture[0].cx
    // 三次「拖动」：begin(snapshot) + commitGesture
    for (const dx of [10, 20, 30]) {
      const before = s.snapshot()
      s.commitGesture(before, d => { d.furniture[0].cx = original + dx })
    }
    expect(useDocStore.getState().doc.furniture[0].cx).toBe(original + 30)
    expect(useDocStore.getState().undo()).toBe(true)
    expect(useDocStore.getState().doc.furniture[0].cx).toBe(original + 20)
    expect(useDocStore.getState().undo()).toBe(true)
    expect(useDocStore.getState().undo()).toBe(true)
    expect(useDocStore.getState().doc.furniture[0].cx).toBe(original)
    expect(useDocStore.getState().undo()).toBe(false)
  })

  it('mutate and gesture entries share one stack; redo cleared by new commit', () => {
    const s = useDocStore.getState()
    s.mutate(d => { d.demolished.push('w7') })
    const before = s.snapshot()
    s.commitGesture(before, d => { d.furniture.pop() })
    s.mutate(d => { d.furniture[0].name = 'x' })
    // 撤销三条回到初始，且再无历史
    for (let i = 0; i < 3; i++) expect(s.undo()).toBe(true)
    expect(s.undo()).toBe(false)
    // 重做两条（最后一条 mutate 撤销后 redo 有两条？）——重做全部
    for (let i = 0; i < 3; i++) expect(s.redo()).toBe(true)
    expect(s.redo()).toBe(false)
    expect(useDocStore.getState().doc.furniture[0].name).toBe('x')
    // 新提交清空 redo
    s.mutate(d => { d.furniture[0].name = 'y' })
    expect(s.redo()).toBe(false)
  })

  it('history capped at 150', () => {
    const s = useDocStore.getState()
    for (let i = 0; i < 160; i++) s.mutate(d => { d.demolished.length = 0 })
    // 连续撤销最多 150 条（初始文档不含在历史里）
    let n = 0
    while (s.undo()) n++
    expect(n).toBe(150)
  })

  it('undo restores removed furniture and clears selection of deleted furniture', async () => {
    const { useUiStore } = await import('./uiStore')
    const s = useDocStore.getState()
    const id = s.doc.furniture[1].id
    useUiStore.getState().select({ kind: 'furn', id })
    expect(useUiStore.getState().sel?.kind).toBe('furn')
    s.mutate(d => { d.furniture = d.furniture.filter(f => f.id !== id) })
    // 删除触发联动：选中态清空
    expect(useUiStore.getState().sel).toBeNull()
    s.undo()
    expect(useDocStore.getState().doc.furniture.some(f => f.id === id)).toBe(true)
    // 选中态在删除时已经清空，不残留指向已删家具的引用（spec plan-persistence 撤销场景）
    expect(useUiStore.getState().sel).toBeNull()
  })
})

describe('reset', () => {
  it('restores default plan and is undoable', () => {
    const s = useDocStore.getState()
    const n0 = defaultState().furniture.length
    s.mutate(d => { d.furniture = [] })
    expect(useDocStore.getState().doc.furniture.length).toBe(0)
    s.reset()
    const doc = useDocStore.getState().doc
    expect(doc.furniture.length).toBe(n0)
    expect(doc.furniture[0].name).toBe('双人床')
    expect(s.undo()).toBe(true)
    expect(useDocStore.getState().doc.furniture.length).toBe(0)
  })
})