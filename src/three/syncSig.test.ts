import { describe, expect, it } from 'vitest'
import { syncSigs } from './syncSig'
import { defaultState } from '../data/defaults'

// Task 9.2：文档里每个影响 3D 的字段变更都必须改变对应签名
// （arch = rooms + demolished + cut；furn = furniture；labels = rooms + cut；measures 不参与）

describe('syncSigs', () => {
  const doc = () => defaultState()
  const cut = 2.8

  it('同一文档签名稳定且三组互不相同', () => {
    const d = doc()
    const s1 = syncSigs(d, cut)
    const s2 = syncSigs(d, cut)
    expect(s2).toEqual(s1)
    expect(s1.arch).not.toBe(s1.furn)
    expect(s1.furn).not.toBe(s1.labels)
  })

  it('furniture 变更只改 furn 签名（位置/旋转/颜色/增删）', () => {
    const d = doc()
    const base = syncSigs(d, cut)
    d.furniture[0].cx += 100
    expect(syncSigs(d, cut).furn).not.toBe(base.furn)
    expect(base.arch).toBe(syncSigs(d, cut).arch)
    expect(base.labels).toBe(syncSigs(d, cut).labels)
    const d2 = doc()
    d2.furniture.pop()
    expect(syncSigs(d2, cut).furn).not.toBe(base.furn)
  })

  it('房间（名称/材料）变更同时改 arch 与 labels 签名', () => {
    const d = doc()
    const base = syncSigs(d, cut)
    d.rooms.master.name = '改名卧室'
    const next = syncSigs(d, cut)
    expect(next.arch).not.toBe(base.arch)
    expect(next.labels).not.toBe(base.labels)
    const d2 = doc()
    d2.rooms.master.mat = 'marble'
    expect(syncSigs(d2, cut).arch).not.toBe(base.arch)
    expect(syncSigs(d2, cut).labels).not.toBe(base.labels)
  })

  it('demolished 变更只改 arch 签名（标签不含拆除墙）', () => {
    const d = doc()
    const base = syncSigs(d, cut)
    d.demolished.push('w21')
    const next = syncSigs(d, cut)
    expect(next.arch).not.toBe(base.arch)
    expect(next.labels).toBe(base.labels)
  })

  it('cut 切换同时改 arch 与 labels 签名', () => {
    const base = syncSigs(doc(), 2.8)
    expect(syncSigs(doc(), 1.2).arch).not.toBe(base.arch)
    expect(syncSigs(doc(), 1.2).labels).not.toBe(base.labels)
  })

  it('measures（2D 测量线）不进入任何签名', () => {
    const d = doc()
    const base = syncSigs(d, cut)
    d.measures.push({ a: { x: 0, y: 0 }, b: { x: 1000, y: 0 } })
    expect(syncSigs(d, cut)).toEqual(base)
  })
})