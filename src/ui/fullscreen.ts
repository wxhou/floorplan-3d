/** 网页全屏（含 Safari webkit 前缀回退；独立 App 模式隐藏按钮，由组件读取 standalone 判定） */
import { toast } from '../state/toastStore'

const fsEl = () => document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement

export function toggleFullscreen(): void {
  const de = document.documentElement
  if (fsEl()) {
    const exit = document.exitFullscreen || (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
    exit?.call(document)
  } else {
    const req = de.requestFullscreen || (de as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
    if (!req) return toast('当前浏览器不支持网页全屏，可在 Safari 中「添加到主屏幕」后以全屏方式打开')
    Promise.resolve(req.call(de)).catch(() => toast('无法进入全屏'))
  }
}

export const isStandalone = () =>
  (navigator as unknown as { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches