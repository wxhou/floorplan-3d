import { memo } from 'react'
import { DOORS, ROOMS, SLIDES, WALLS } from '../data/floorplan'
import type { Rect } from '../data/types'
import { useDocStore } from '../state/documentStore'
import { useUiStore } from '../state/uiStore'
import { useViewStore } from './viewStore'
import { aabb } from '../geometry'
import { furnSVG } from '../data/legend'
import { defsInner } from './defs'
import { dimsInner, labelsInner, openingsInner } from './staticLayers'
import { esc } from './esc'

const NOLABEL = ['plant', 'floorlamp', 'sidetable', 'barstool', 'beanbag']
/** 粗指针设备（iPad/手机）：手柄加大、热区加大，判定与旧版一致 */
export const COARSE = typeof matchMedia === 'function' ? matchMedia('(pointer:coarse)').matches : false

const SILL_ATTR = { fill: '#e2dacb', stroke: '#b9b0a0', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' } as const
const SILLS: Rect[] = [...DOORS.map(d => d.rect), ...SLIDES.map(d => d.rect)]
const OPENINGS_HTML = openingsInner()
const DIMS_HTML = dimsInner()

/** defs：材质图案 + 网格（纯静态） */
export const PlanDefs = memo(function PlanDefs() {
  return <defs dangerouslySetInnerHTML={{ __html: defsInner }} />
})

export const GridLayer = memo(function GridLayer() {
  const on = useUiStore(s => s.layers.grid)
  return (
    <g id="gGrid">
      <rect x={-20000} y={-20000} width={55000} height={55000} fill={on ? 'url(#grid)' : 'transparent'} data-bg="1" />
    </g>
  )
})

export const RoomsLayer = memo(function RoomsLayer() {
  const rooms = useDocStore(s => s.doc.rooms)
  return (
    <g id="gRooms">
      {ROOMS.map(r => (
        <polygon key={r.id} className="room" data-room={r.id}
          points={r.poly.map(p => p.join(',')).join(' ')}
          fill={`url(#m-${rooms[r.id]?.mat ?? r.mat})`} />
      ))}
      {SILLS.map((sill, i) => {
        const [a, b, c, d] = sill
        return <rect key={i} {...SILL_ATTR} x={a} y={b} width={c - a} height={d - b} pointerEvents="none" />
      })}
    </g>
  )
})

export const WallsLayer = memo(function WallsLayer() {
  const demolished = useDocStore(s => s.doc.demolished)
  const bearing = useUiStore(s => s.layers.bearing)
  return (
    <g id="gWalls">
      {WALLS.map((w, i) => {
        const [x0, y0, x1, y1, k] = w, id = 'w' + i, dem = demolished.includes(id)
        let fill = k === 'b' ? (bearing ? '#b8412c' : '#26241f') : k === 'low' ? '#e9e3d8' : k === 'e' ? '#8f897d' : '#a7a195'
        const ex: Record<string, number | string> = {}
        if (k === 'low') ex.stroke = '#8f897d'
        if (dem) { fill = 'rgba(198,91,58,.12)'; ex.stroke = '#c65b3a'; ex.strokeWidth = 1.2; ex.strokeDasharray = '5 3' }
        return <rect key={id} data-wall={id} className="wall" x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={fill} vectorEffect="non-scaling-stroke" {...ex} />
      })}
    </g>
  )
})

export const FurnLayer = memo(function FurnLayer() {
  const furn = useDocStore(s => s.doc.furniture)
  const show = useUiStore(s => s.layers.furn)
  return (
    <g id="gFurn" display={show ? 'inline' : 'none'}>
      {furn.map(f => {
        const fs = Math.max(80, Math.min(170, Math.min(f.w, f.d) * .2))
        const hasLabel = Math.min(f.w, f.d) >= 380 && !NOLABEL.includes(f.type)
        return (
          <g key={f.id} className="furn" data-fid={f.id} transform={`translate(${f.cx} ${f.cy}) rotate(${f.rot})`}>
            <g dangerouslySetInnerHTML={{ __html: furnSVG(f.type, f.w, f.d, f.color) }} />
            {hasLabel && (
              <text transform={`rotate(${-f.rot})`} fontSize={fs} textAnchor="middle" dominantBaseline="central"
                fill="#4a443c" opacity=".8" pointerEvents="none">{esc(f.name)}</text>
            )}
          </g>
        )
      })}
    </g>
  )
})

export const OpeningsLayer = memo(function OpeningsLayer() {
  return <g id="gOpen" dangerouslySetInnerHTML={{ __html: OPENINGS_HTML }} />
})

export const LabelsLayer = memo(function LabelsLayer() {
  const rooms = useDocStore(s => s.doc.rooms)
  const show = useUiStore(s => s.layers.labels)
  return <g id="gLabels" display={show ? 'inline' : 'none'} pointerEvents="none"
    dangerouslySetInnerHTML={{ __html: labelsInner(rooms) }} />
})

export const DimsLayer = memo(function DimsLayer() {
  const show = useUiStore(s => s.layers.dims)
  return <g id="gDims" display={show ? 'inline' : 'none'} pointerEvents="none"
    dangerouslySetInnerHTML={{ __html: DIMS_HTML }} />
})

/** 已确认的测量线 + 测量工具的待定预览 */
export const MeasureLayer = memo(function MeasureLayer() {
  const measures = useDocStore(s => s.doc.measures)
  const mA = useUiStore(s => s.mA)
  const mCur = useUiStore(s => s.mCur)
  const s = useViewStore(v => v.s)
  const k = 1 / s, fs = 12 * k
  const one = (a: { x: number; y: number }, b: { x: number; y: number }, tmp?: boolean) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    if (L < 1) return ''
    let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
    if (ang > 90 || ang < -90) ang += 180
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y) / L * 5 * k, ny = (b.x - a.x) / L * 5 * k
    const col = tmp ? '#2f5d62' : '#b5653a', S = `stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"`
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${S}/>
      <line x1="${a.x - nx}" y1="${a.y - ny}" x2="${a.x + nx}" y2="${a.y + ny}" ${S}/><line x1="${b.x - nx}" y1="${b.y - ny}" x2="${b.x + nx}" y2="${b.y + ny}" ${S}/>
      <text x="${mx}" y="${my - 5 * k}" font-size="${fs}" text-anchor="middle" fill="${col}" font-weight="600" transform="rotate(${ang} ${mx} ${my})"
        stroke="#fff" stroke-width="${3.5 * k}" paint-order="stroke">${Math.round(L)} mm</text>`
  }
  let inner = measures.map(m => one(m.a, m.b)).join('')
  if (mA && mCur) inner += one(mA, mCur, true)
  if (mA) inner += `<circle cx="${mA.x}" cy="${mA.y}" r="${3 * k}" fill="#2f5d62"/>`
  return <g id="gMeasure" pointerEvents="none" dangerouslySetInnerHTML={{ __html: inner }} />
})

/** 选中态高亮与旋转/尺寸手柄。拖拽期间由手势代码经 svg 定点改属性，提交后按 store 重渲染。 */
export const SelLayer = memo(function SelLayer() {
  const sel = useUiStore(s => s.sel)
  const furn = useDocStore(s => s.doc.furniture)
  const s = useViewStore(v => v.s)
  const k = 1 / s
  if (sel?.kind === 'furn') {
    const f = furn.find(x => x.id === sel.id)
    if (!f) return null
    const p = 5 * k, hs = COARSE ? 1.7 : 1, ro = (COARSE ? 40 : 26) * k, hit = (COARSE ? 24 : 11) * k
    const sx = f.w / 2 + p, sy = f.d / 2 + p
    const { hh } = aabb(f)
    return (
      <g id="gSel">
        <g transform={`translate(${f.cx} ${f.cy}) rotate(${f.rot})`}>
          <rect x={-f.w / 2 - p} y={-f.d / 2 - p} width={f.w + 2 * p} height={f.d + 2 * p} fill="none" stroke="#b5653a" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <line x1={0} y1={-f.d / 2 - p} x2={0} y2={-f.d / 2 - ro} stroke="#b5653a" strokeWidth={1} pointerEvents="none" />
          <circle data-handle="rot" cx={0} cy={-f.d / 2 - ro} r={hit} fill="transparent" />
          <circle data-handle="rot" cx={0} cy={-f.d / 2 - ro} r={6 * hs * k} fill="#fff" stroke="#b5653a" strokeWidth={1.5}><title>拖动旋转（Shift 自由角度)</title></circle>
          <circle data-handle="size" cx={sx} cy={sy} r={hit} fill="transparent" />
          <rect data-handle="size" x={sx - 5 * hs * k} y={sy - 5 * hs * k} width={10 * hs * k} height={10 * hs * k} fill="#b5653a"><title>拖动调整尺寸</title></rect>
        </g>
        <text x={f.cx} y={f.cy + hh + 24 * k} fontSize={12 * k} textAnchor="middle" fill="#b5653a" fontWeight={600} pointerEvents="none"
          stroke="#fff" strokeWidth={3 * k} paintOrder="stroke">{f.w} × {f.d}</text>
      </g>
    )
  }
  if (sel?.kind === 'room') {
    const r = ROOMS.find(x => x.id === sel.id)
    if (!r) return null
    return (
      <polygon points={r.poly.map(p => p.join(',')).join(' ')} fill="rgba(181,101,58,.08)" stroke="#b5653a"
        strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
    )
  }
  return null
})