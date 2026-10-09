import { create } from 'zustand'

/** 全局轻提示（同旧版 toast，1.8s 自动消失；计时器归属展示组件） */
interface ToastStore {
  msg: string
  seq: number
  toast: (msg: string) => void
}

export const useToastStore = create<ToastStore>(set => ({
  msg: '',
  seq: 0,
  toast: msg => set(s => ({ msg, seq: s.seq + 1 })),
}))

export const toast = (msg: string) => useToastStore.getState().toast(msg)