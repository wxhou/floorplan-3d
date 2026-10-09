import { useEffect, useRef } from 'react'
import { useToastStore } from '../state/toastStore'

/** 全局轻提示：seq 变化显示并重新计时，1.8s 后淡出（同旧版 toast，直接操作 DOM 避免级联渲染） */
export function Toast() {
  const seq = useToastStore(s => s.seq)
  const msg = useToastStore(s => s.msg)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const el = ref.current
    if (!el || !seq) return
    el.classList.add('show')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => el.classList.remove('show'), 1800)
    return () => clearTimeout(timer.current)
  }, [seq])
  return <div id="toast" ref={ref}>{msg}</div>
}