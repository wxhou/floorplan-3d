/**
 * 3D 引擎增量重建签名：决定建筑 / 家具 / 标签三组是否需要重建。
 * 与 PlanDocument 结构同源 —— 文档里每个会影响 3D 的字段（rooms、demolished、furniture）
 * 都进入对应签名，切断墙高 cut 同时参与建筑与标签两组。
 */
import type { PlanDocument } from '../data/types'

export interface SyncSigs {
  arch: string
  furn: string
  labels: string
}

export function syncSigs(doc: PlanDocument, cut: number): SyncSigs {
  return {
    arch: JSON.stringify([doc.rooms, doc.demolished, cut]),
    furn: JSON.stringify(doc.furniture),
    labels: JSON.stringify([doc.rooms, cut]),
  }
}