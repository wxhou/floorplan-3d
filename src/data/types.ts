/** 平面文档与户型定义的共享类型。坐标单位 mm，原点 = 左侧外墙内皮 / 顶部外墙内皮。 */

export type Vec = { x: number; y: number }
/** 平面几何点（墙/窗/房间多边形用 [x, y] 元组；measure 端点用 Vec 对象） */
export type Pt = [number, number]
export type Rect = [number, number, number, number] // [x0, y0, x1, y1]

/** 墙体：b=承重(黑) e=外墙 n=可拆非承重 low=矮墙 */
export type Wall = [number, number, number, number, 'b' | 'e' | 'n' | 'low']
export type WindowRect = Rect

/** 平开门：洞口、铰点、关闭方向、开启方向、门宽 */
export interface DoorDef {
  name: string
  rect: Rect
  h: [number, number]
  c: [number, number]
  o: [number, number]
  len: number
  entry?: boolean
}
export interface SlideDef {
  rect: Rect
  v: boolean
}

export interface RoomDef {
  id: string
  name: string
  poly: Pt[]
  /** 默认地面材料 key（MATS） */
  mat: string
  /** 房间名 3D 标签的放置点 */
  at?: [number, number]
  /** false = 飘窗等不计入套内使用面积 */
  counted?: boolean
}

export interface Furniture {
  id: string
  type: string
  name: string
  cx: number
  cy: number
  w: number
  d: number
  rot: number
  color: string
}

export type Measure = { a: Vec; b: Vec }

export interface RoomState {
  name: string
  mat: string
}

/** 可序列化的方案文档（唯一持久化单位），见 spec plan-persistence */
export interface PlanDocument {
  /** 1 = React 重写版结构（旧版数据无此字段，迁移时写入） */
  schemaVersion: 1
  furniture: Furniture[]
  /** roomId -> 状态；以 ROOMS 为完备集合 */
  rooms: Record<string, RoomState>
  demolished: string[]
  measures: Measure[]
}

/** 家具库条目：[类型, 名称, 宽, 深, 颜色] */
export type LibItem = [type: string, name: string, w: number, d: number, color: string]

export interface LibCategory {
  cat: string
  items: LibItem[]
}