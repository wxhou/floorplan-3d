/** 工具提示条（测量/拆改工具的操作提示，同旧版 modehint） */
import { useUiStore } from '../state/uiStore'

const COARSE = typeof matchMedia === 'function' ? matchMedia('(pointer:coarse)').matches : false
const HINTS: Record<string, string> = {
  select: '',
  measure: COARSE
    ? '按住拖出测量线，或依次点两点 · 靠近墙面自动吸附 · 点「选择」退出'
    : '点击两点（或按住拖动）测量距离 · 靠近墙面自动吸附 · Shift 锁定水平/垂直 · Esc 取消',
  demolish: '点击灰色非承重墙标记拆除，再次点击恢复 · 黑色承重墙不可拆',
}

export function toolHint(t: string): string {
  return HINTS[t] ?? ''
}

export function ModeHint() {
  const tool = useUiStore(s => s.tool)
  const h = toolHint(tool)
  return <div id="modehint" className={h ? 'show' : ''}>{h}</div>
}