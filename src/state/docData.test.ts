import { describe, expect, it } from 'vitest'
import { normalizeDocument } from './docData'
import { defaultState } from '../data/defaults'

const validDoc = () => ({
  // 旧版结构：无 schemaVersion
  furniture: [{ id: 'f1', type: 'bed', name: '双人床', cx: 8300, cy: 1000, w: 1800, d: 2000, rot: 0, color: '#c9d6df' }],
  rooms: { master: { name: '主卧室改名', mat: 'tile800' } },
  demolished: ['w21'],
  measures: [{ a: { x: 0, y: 0 }, b: { x: 1000, y: 0 } }],
})

describe('normalizeDocument（迁移 + fixState）', () => {
  it('old-structure document migrates losslessly and gains schemaVersion 1', () => {
    const doc = normalizeDocument(validDoc())!
    expect(doc.schemaVersion).toBe(1)
    expect(doc.furniture).toEqual(validDoc().furniture)
    expect(doc.demolished).toEqual(['w21'])
    expect(doc.measures).toEqual(validDoc().measures)
    // 用户改过的房间保留，其余房间由默认方案补齐
    expect(doc.rooms.master).toEqual({ name: '主卧室改名', mat: 'tile800' })
    expect(doc.rooms.mbath).toEqual(defaultState().rooms.mbath)
    expect(Object.keys(doc.rooms).length).toBe(Object.keys(defaultState().rooms).length)
  })

  it('missing demolished / measures fall back to empty arrays', () => {
    const base = validDoc()
    const old = { furniture: base.furniture, rooms: base.rooms }
    const doc = normalizeDocument(old)!
    expect(doc.demolished).toEqual([])
    expect(doc.measures).toEqual([])
    expect(doc.furniture.length).toBe(1)
  })

  it('returns null for corrupted / furniture-less data', () => {
    expect(normalizeDocument(null)).toBeNull()
    expect(normalizeDocument('nonsense')).toBeNull()
    expect(normalizeDocument({ rooms: {} })).toBeNull()
    expect(normalizeDocument({ furniture: 'nope' })).toBeNull()
  })

  it('drops malformed furniture entries, keeps valid ones', () => {
    const raw = { furniture: [validDoc().furniture[0], null, { cx: 1, cy: 2 }, { id: 'f9', cx: 5, cy: 6, w: 100, d: 100, rot: 0, type: 'bed', name: 'x', color: '#fff' }] }
    const doc = normalizeDocument(raw)!
    expect(doc.furniture.length).toBe(2)
    expect(doc.furniture[1].id).toBe('f9')
  })
})

describe('persistence', () => {
  it('loadDocument falls back to null on corrupted JSON; save silently ignores quota errors', async () => {
    localStorage.setItem('huxing-design-v1', '{broken json')
    const { loadDocument } = await import('./docData')
    expect(loadDocument()).toBeNull()

    localStorage.setItem('huxing-design-v1', JSON.stringify(validDoc()))
    expect(loadDocument()!.schemaVersion).toBe(1)

    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota') }
    const { saveDocument } = await import('./docData')
    expect(() => saveDocument(defaultState())).not.toThrow()
    Storage.prototype.setItem = setItem
  })
})