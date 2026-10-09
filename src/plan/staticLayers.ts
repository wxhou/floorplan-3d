/* 静态图形图层（门窗开启弧线 / 尺寸标注链）：自旧版 renderOpenings / renderDims 逐字搬迁。
 * 无交互（pointer-events: none），文档不变时内容恒定，注入方式同 furnSVG 图例。 */
import { DOORS, SLIDES, WINS } from '../data/floorplan'
import { fmt, area } from '../geometry'
import { ROOMS } from '../data/floorplan'
import { esc } from './esc'

export function openingsInner(): string {
  const WS = 'stroke="#4f7394" stroke-width="1" vector-effect="non-scaling-stroke"'
  let s = ''
  WINS.forEach(([x0, y0, x1, y1]) => {
    const w = x1 - x0, h = y1 - y0
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f7fbfd" ${WS}/>`
    if (w >= h) [1 / 3, 2 / 3].forEach(t => s += `<line x1="${x0}" y1="${y0 + h * t}" x2="${x1}" y2="${y0 + h * t}" ${WS}/>`)
    else [1 / 3, 2 / 3].forEach(t => s += `<line x1="${x0 + w * t}" y1="${y0}" x2="${x0 + w * t}" y2="${y1}" ${WS}/>`)
  })
  const DS = 'stroke="#3d3a34" stroke-width="1" vector-effect="non-scaling-stroke"'
  DOORS.forEach(d => {
    const [hx, hy] = d.h, L = d.len, T = 40
    const ox = hx + d.o[0] * L, oy = hy + d.o[1] * L, cx = hx + d.c[0] * L, cy = hy + d.c[1] * L
    const sweep = d.o[0] * d.c[1] - d.o[1] * d.c[0] > 0 ? 1 : 0
    const col = d.entry ? '#b5653a' : '#3d3a34'
    s += `<polygon points="${hx},${hy} ${ox},${oy} ${ox + d.c[0] * T},${oy + d.c[1] * T} ${hx + d.c[0] * T},${hy + d.c[1] * T}" fill="#fff" stroke="${col}" stroke-width="${d.entry ? 1.8 : 1}" vector-effect="non-scaling-stroke"/>`
    s += `<path d="M${ox} ${oy}A${L} ${L} 0 0 ${sweep} ${cx} ${cy}" fill="none" ${DS} stroke-dasharray="5 3" opacity=".7"/>`
  })
  SLIDES.forEach(({ rect: [x0, y0, x1, y1], v }) => {
    if (v) { const L = y1 - y0, m = (x0 + x1) / 2; s += `<rect x="${m - 45}" y="${y0}" width="40" height="${L * .55}" fill="#fff" ${DS}/><rect x="${m + 5}" y="${y1 - L * .55}" width="40" height="${L * .55}" fill="#fff" ${DS}/>` }
    else { const L = x1 - x0, m = (y0 + y1) / 2; s += `<rect x="${x0}" y="${m - 45}" width="${L * .55}" height="40" fill="#fff" ${DS}/><rect x="${x1 - L * .55}" y="${m + 5}" width="${L * .55}" height="40" fill="#fff" ${DS}/>` }
  })
  // 入户标识
  s += `<path d="M3350 8755H4350M4150 8600L4400 8755L4150 8910" fill="none" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <text x="3380" y="8600" font-size="200" fill="#b5653a">入户</text>`
  return s
}

export function dimsInner(): string {
  const DC = '#7d7160', LS = `stroke="${DC}" stroke-width="1" vector-effect="non-scaling-stroke"`, TK = `stroke="${DC}" stroke-width="2" vector-effect="non-scaling-stroke"`
  const txt = (x: number, y: number, v: number, rot?: boolean) => `<text x="${x}" y="${y}" font-size="${v < 400 ? 140 : 200}" text-anchor="middle" fill="${DC}" ${rot ? `transform="rotate(-90 ${x} ${y})"` : ''}>${v}</text>`
  const chain = (horiz: boolean, at: number, start: number, segs: number[]) => {
    const pts = [start]; segs.forEach(v => pts.push(pts[pts.length - 1] + v))
    let s = horiz ? `<line x1="${pts[0]}" y1="${at}" x2="${pts[pts.length - 1]}" y2="${at}" ${LS}/>` : `<line x1="${at}" y1="${pts[0]}" x2="${at}" y2="${pts[pts.length - 1]}" ${LS}/>`
    pts.forEach(p => s += horiz
      ? `<line x1="${p}" y1="${at - 170}" x2="${p}" y2="${at + 170}" ${LS}/><line x1="${p - 80}" y1="${at + 80}" x2="${p + 80}" y2="${at - 80}" ${TK}/>`
      : `<line x1="${at - 170}" y1="${p}" x2="${at + 170}" y2="${p}" ${LS}/><line x1="${at - 80}" y1="${p + 80}" x2="${at + 80}" y2="${p - 80}" ${TK}/>`)
    segs.forEach((v, i) => { const mid = (pts[i] + pts[i + 1]) / 2; s += horiz ? txt(mid, at - 70, v) : txt(at - 70, mid, v, true) })
    return s
  }
  return chain(true, -750, 0, [1580, 240, 2760, 240, 1540, 240, 3670]) + chain(true, -1250, 0, [10270]) +
    chain(true, 11350, 0, [2180, 240, 2160, 240, 5450, 240, 1340]) + chain(true, 11850, 0, [11850]) +
    chain(false, -800, 0, [3370, 1580, 240, 2770, 240, 2360]) + chain(false, -1300, 0, [10560]) +
    chain(false, 12750, 0, [3370, 240, 2760, 240, 3950]) + chain(false, 13250, 0, [10560])
}

/** 房间名 + 面积标签（依赖方案重命名的部分，其余静态） */
export function labelsInner(rooms: Record<string, { name: string }>): string {
  const halo = 'stroke="#fbf9f4" stroke-width="45" paint-order="stroke" stroke-linejoin="round"'
  return ROOMS.filter(r => r.at).map(r => {
    const [x, y] = r.at!
    return `<text x="${x}" y="${y}" font-size="250" font-weight="600" text-anchor="middle" fill="#2b2824" ${halo}>${esc(rooms[r.id]?.name ?? r.name)}</text>
      <text x="${x}" y="${y + 260}" font-size="175" text-anchor="middle" fill="#7d7366" ${halo}>${fmt(area(r.poly))} m²</text>`
  }).join('')
}