/** HTML/SVG 文本转义（同旧版 esc） */
export const esc = (s: string): string => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))