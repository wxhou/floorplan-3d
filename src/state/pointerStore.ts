import { create } from 'zustand'

/** 指针悬停信息（底栏读取）：光标 mm 坐标 + 悬停房间，供底栏坐标读数与房间提示 */
export const usePointerStore = create<{
  x: number
  y: number
  room: string | null
  setPointer: (x: number, y: number, room: string | null) => void
}>(set => ({ x: 0, y: 0, room: null, setPointer: (x, y, room) => set({ x, y, room }) }))