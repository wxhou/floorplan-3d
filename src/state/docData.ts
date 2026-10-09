import type { PlanDocument } from '../data/types'
import { STORE_KEY, defaultState } from '../data/defaults'
import type { Furniture } from '../data/types'

/**
 * 「迁移 + fixState」合并的纯函数：把任意 localStorage / 导入 JSON 规范化为当前文档结构。
 * 返回 null 表示数据不可用（损坏 / 缺 furniture 数组），调用方回退默认方案。
 *
 * 与旧版 fixState 的语义差异（刻意为之）：
 * - 旧版直接 Object.assign 合并房间表；这里对缺字段的房间条目补默认值，因为新结构
 *   承诺 rooms 为完备集合（见 plan-persistence spec「缺字段修复」）。
 * - 字段齐全的旧数据（无 schemaVersion）迁移后内容无损。
 */
export function normalizeDocument(raw: unknown): PlanDocument | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<PlanDocument>
  if (!Array.isArray(r.furniture)) return null
  const defaults = defaultState()
  const rooms = { ...defaults.rooms }
  for (const [k, v] of Object.entries(r.rooms ?? {})) {
    if (!v || typeof v !== 'object') continue
    const rv = v as { name?: unknown; mat?: unknown }
    rooms[k] = {
      name: typeof rv.name === 'string' && rv.name ? rv.name : rooms[k]?.name ?? k,
      mat: typeof rv.mat === 'string' && rv.mat ? rv.mat : rooms[k]?.mat ?? 'wood',
    }
  }
  const furniture: Furniture[] = r.furniture.filter(f =>
    !!f && typeof f === 'object' && typeof (f as Partial<Furniture>).id === 'string'
    && typeof (f as Partial<Furniture>).cx === 'number' && typeof (f as Partial<Furniture>).cy === 'number',
  )
  return {
    schemaVersion: 1,
    furniture,
    rooms,
    demolished: Array.isArray(r.demolished) ? r.demolished.filter(x => typeof x === 'string') : [],
    measures: Array.isArray(r.measures) ? r.measures.filter(mv => !!mv && typeof mv === 'object' && mv.a != null && mv.b != null) : [],
  }
}

export function loadDocument(): PlanDocument | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    return s ? normalizeDocument(s) : null
  } catch {
    return null
  }
}

export function saveDocument(doc: PlanDocument): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(doc))
  } catch { /* 隐私模式 / 配额不足：静默忽略 */ }
}