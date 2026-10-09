import { ROOMS, MATS, WALLS } from '../data/floorplan'
import type { Furniture, PlanDocument, RoomDef } from '../data/types'
import { getDoc, useDocStore } from '../state/documentStore'
import { useUiStore } from '../state/uiStore'
import { getView3D } from '../state/viewModeStore'
import { area, bbox, fmt, norm, perim } from '../geometry'
import { bringToEdge, clearLayout, deleteSel, duplicateSel, rotateSel } from '../plan/actions'
import { esc } from '../plan/esc'

const COARSE = typeof matchMedia === 'function' ? matchMedia('(pointer:coarse)').matches : false

function useDoc<T>(pick: (d: PlanDocument) => T): T {
  return useDocStore(s => pick(s.doc))
}

/* ============ 总览 ============ */
function Overview() {
  const rooms = useDoc(d => d.rooms)
  const furniture = useDoc(d => d.furniture)
  const demolished = useDoc(d => d.demolished)
  const measures = useDoc(d => d.measures)

  const selectRoom = (id: string) => {
    useUiStore.getState().select({ kind: 'room', id })
    if (useUiStore.getState() && getView3D()) getView3D()!.flyToRoom(id) // 引擎在 3D 中才有效
  }

  const rows = ROOMS.map(r => {
    const st = rooms[r.id]
    return (
      <tr key={r.id} className="click" data-room={r.id} onClick={() => selectRoom(r.id)}>
        <td><span className="sw" style={{ background: MATS[(st?.mat ?? r.mat) as keyof typeof MATS]?.sw }} />{esc(st?.name ?? r.name)}{r.counted === false ? <span className="muted"> *</span> : null}</td>
        <td className="r">{fmt(area(r.poly))} m²</td>
      </tr>
    )
  })
  const tot = ROOMS.filter(r => r.counted !== false).reduce((a, r) => a + area(r.poly), 0)
  const byMat: Record<string, number> = {}
  ROOMS.forEach(r => { const m = rooms[r.id]?.mat ?? r.mat; byMat[m] = (byMat[m] || 0) + area(r.poly) })
  let cost = 0
  const matRows = Object.entries(byMat).map(([m, a]) => {
    const md = MATS[m as keyof typeof MATS], c = a * md.price * 1.05
    cost += c
    return (
      <tr key={m}>
        <td><span className="sw" style={{ background: md.sw }} />{md.name}</td>
        <td className="r">{fmt(a, 1)} m²</td>
        <td className="r">¥{Math.round(c).toLocaleString()}</td>
      </tr>
    )
  })
  const demLen = demolished.reduce((a, id) => {
    const w = WALLS[+id.slice(1)]
    return a + (w ? Math.max(w[2] - w[0], w[3] - w[1]) : 0)
  }, 0) / 1000

  return (
    <>
      <section>
        <h3>房间面积 <small>点击查看 / 更换地面</small></h3>
        <table>
          <tbody>{rows}</tbody>
        </table>
        <div className="total"><span>套内使用面积</span><b>{fmt(tot)} m²</b></div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>* 飘窗不计入使用面积；面积按墙体内净尺寸计算</div>
      </section>
      <section>
        <h3>地面材料估算 <small>含 5% 损耗</small></h3>
        <table>
          <tbody>{matRows}</tbody>
        </table>
        <div className="total"><span>地面材料合计</span><b>¥{Math.round(cost).toLocaleString()}</b></div>
      </section>
      <section>
        <h3>方案统计</h3>
        <div className="stats">
          <div><small>家具数量</small><span className="big">{furniture.length}</span></div>
          <div><small>拆除墙体</small><span className="big">{fmt(demLen, 1)}</span> m</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => { if (measures.length) useDocStore.getState().mutate(d => { d.measures = [] }) }}>清除测量 ({measures.length})</button>
          <button className="btn danger" onClick={() => clearLayout()}>清空布置</button>
        </div>
      </section>
      {COARSE ? (
        <section>
          <h3>触屏操作</h3>
          <div className="kbd">
            <kbd>单指拖动</kbd><span>空白处平移画面</span><kbd>双指</kbd><span>捏合缩放、拖动平移</span>
            <kbd>家具库</kbd><span>点一下放到画面中央，或按住向右拖到指定位置</span>
            <kbd>点家具</kbd><span>选中后拖动移动；拖顶部圆点旋转、右下方块改尺寸</span>
            <kbd>工具条</kbd><span>选中后底部可旋转 / 复制 / 删除</span>
            <kbd>测量</kbd><span>按住拖出一条线，或依次点两点</span>
            <kbd>3D 漫游</kbd><span>左下摇杆移动，拖动屏幕转向，点门开关</span>
          </div>
        </section>
      ) : null}
      <section>
        <h3>键盘快捷键</h3>
        <div className="kbd">
          <kbd>拖拽</kbd><span>左侧家具拖入平面图</span><kbd>V</kbd><span>选择 / 移动</span><kbd>M</kbd><span>测量（Shift 水平/垂直）</span>
          <kbd>X</kbd><span>拆改非承重墙（黑色为承重墙）</span><kbd>R</kbd><span>旋转 90°（Shift 反向）</span><kbd>方向键</kbd><span>微调 10mm（Shift 100mm）</span>
          <kbd>⌘/Ctrl D</kbd><span>复制</span><kbd>Delete</kbd><span>删除</span><kbd>⌘/Ctrl Z</kbd><span>撤销</span><kbd>T</kbd><span>切换 2D / 3D</span><kbd>F</kbd><span>适应窗口</span><kbd>Esc</kbd><span>取消选择</span>
        </div>
      </section>
    </>
  )
}

/* ============ 房间面板 ============ */
function RoomPanel({ r }: { r: RoomDef }) {
  const st = useDoc(d => d.rooms[r.id]) ?? { name: r.name, mat: r.mat }
  const furniture = useDoc(d => d.furniture)
  const a = area(r.poly), [x0, y0, x1, y1] = bbox(r.poly)
  const inside = furniture.filter(f => f.cx > x0 && f.cx < x1 && f.cy > y0 && f.cy < y1)
  const mats = Object.entries(MATS).map(([k, m]) => (
    <button key={k} className={`mat ${k === st.mat ? 'on' : ''}`} onClick={() => useDocStore.getState().mutate(d => { d.rooms[r.id] = { ...d.rooms[r.id], mat: k } })}>
      <i style={{ background: m.sw }} /><span>{m.name}<small>¥{m.price}/m²</small></span>
    </button>
  ))
  return (
    <>
      <section>
        <h3>房间</h3>
        <div className="form">
          <label className="full">名称<input
            key={r.id}
            defaultValue={st.name}
            onChange={e => {
              const v = e.target.value.trim()
              if (v) useDocStore.getState().mutate(d => { d.rooms[r.id] = { ...d.rooms[r.id], name: v } })
            }} /></label>
        </div>
        <div className="stats" style={{ marginTop: 10 }}>
          <div><small>使用面积</small><span className="big">{fmt(a)}</span> m²</div>
          <div><small>周长</small><span className="big">{fmt(perim(r.poly), 1)}</span> m</div>
          <div><small>开间</small><span className="big">{x1 - x0}</span> mm</div>
          <div><small>进深</small><span className="big">{y1 - y0}</span> mm</div>
        </div>
        <div className="muted">墙面面积（层高 2.8m，未扣门窗）约 {fmt(perim(r.poly) * 2.8, 1)} m²</div>
      </section>
      <section>
        <h3>地面材料</h3>
        <div className="mats">{mats}</div>
        <div className="total"><span>材料估价</span><b>¥{Math.round(a * MATS[(st.mat ?? r.mat) as keyof typeof MATS].price * 1.05).toLocaleString()}</b></div>
      </section>
      <section>
        <h3>房间内家具 <small>{inside.length} 件</small></h3>
        <table>
          <tbody>
            {inside.length === 0 ? <tr><td className="muted">暂无</td></tr> : inside.map((f: Furniture) => (
              <tr key={f.id} className="click" data-fid={f.id} onClick={() => useUiStore.getState().select({ kind: 'furn', id: f.id })}>
                <td>{esc(f.name)}</td><td className="r muted">{f.w}×{f.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions"><button className="btn" onClick={() => useUiStore.getState().select(null)}>← 返回总览</button></div>
      </section>
    </>
  )
}

/* ============ 家具属性面板 ============ */
function FurnPanel({ f }: { f: Furniture }) {
  const upd = (fn: (g: Furniture, v: string) => void) => (e: { target: { value: string } }) => {
    const v = e.target.value
    useDocStore.getState().mutate(d => {
      const g = d.furniture.find(x => x.id === f.id)
      if (g) fn(g, v)
    })
  }
  const num = (fn: (g: Furniture, v: number) => void) => upd((g, v) => { const n = parseFloat(v); if (!isNaN(n)) fn(g, n) })
  return (
    <>
      <section>
        <h3>家具属性</h3>
        <div className="form">
          <label className="full">名称<input key={f.id} defaultValue={f.name} onChange={upd((g, v) => { if (v.trim()) g.name = v.trim() })} /></label>
          <label>宽 (mm)<input key={f.id + 'w'} type="number" defaultValue={f.w} min={50} step={10} onChange={num((g, v) => { g.w = Math.max(50, Math.round(v)) })} /></label>
          <label>深 (mm)<input key={f.id + 'd'} type="number" defaultValue={f.d} min={50} step={10} onChange={num((g, v) => { g.d = Math.max(50, Math.round(v)) })} /></label>
          <label>中心 X (mm)<input key={f.id + 'x'} type="number" defaultValue={Math.round(f.cx)} step={10} onChange={num((g, v) => { g.cx = v })} /></label>
          <label>中心 Y (mm)<input key={f.id + 'y'} type="number" defaultValue={Math.round(f.cy)} step={10} onChange={num((g, v) => { g.cy = v })} /></label>
          <label>旋转 (°)<input key={f.id + 'r'} type="number" defaultValue={f.rot} step={15} onChange={num((g, v) => { g.rot = norm(v) })} /></label>
          <label>颜色<input key={f.id + 'c'} type="color" defaultValue={f.color} onChange={upd((g, v) => { if (/^#[0-9a-f]{3,8}$/i.test(v)) g.color = v })} /></label>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>占地面积 {fmt(f.w * f.d / 1e6)} m²</div>
        <div className="actions">
          <button className="btn" onClick={() => rotateSel(90)}>旋转 90°</button>
          <button className="btn" onClick={() => duplicateSel()}>复制</button>
          <button className="btn" onClick={() => bringToEdge(f.id, 'top')}>置于顶层</button>
          <button className="btn" onClick={() => bringToEdge(f.id, 'bottom')}>置于底层</button>
          <button className="btn danger" onClick={() => deleteSel()}>删除</button>
          <button className="btn" onClick={() => useUiStore.getState().select(null)}>← 返回</button>
        </div>
      </section>
      <section className="muted" style={{ fontSize: 12 }}>拖动家具移动；拖动上方圆点旋转；拖动右下角方块调整尺寸。开启「贴墙吸附」后靠近墙面会自动贴齐。</section>
    </>
  )
}

/* ============ 属性侧栏主组件 ============ */
export function Panel() {
  const sel = useUiStore(s => s.sel)
  const furniture = useDoc(d => d.furniture)
  let body: React.ReactNode
  if (sel?.kind === 'furn') {
    const f = furniture.find(x => x.id === sel.id)
    body = f ? <FurnPanel key={f.id} f={f} /> : <Overview />
  } else if (sel?.kind === 'room') {
    const r = ROOMS.find(x => x.id === sel.id)
    body = r ? <RoomPanel key={r.id} r={r} /> : <Overview />
  } else {
    body = <Overview />
  }
  return <div id="panel">{body}</div>
}

/* ============ 底部浮动工具条（触屏等没有键盘的场景） ============ */
export function Fab() {
  const sel = useUiStore(s => s.sel)
  const version = useDocStore(s => s.version)
  void version
  const f = sel?.kind === 'furn' ? getDoc().furniture.find(x => x.id === sel.id) : null
  const r = sel?.kind === 'room' ? ROOMS.find(x => x.id === sel.id) : null
  if (!f && !r) return <div id="fab" />
  if (f) {
    return (
      <div id="fab" className="show">
        <span className="name">{esc(f.name)}</span>
        <button className="btn" onClick={() => rotateSel(-90)}>↺</button>
        <button className="btn" onClick={() => rotateSel(90)}>↻ 旋转</button>
        <button className="btn" onClick={() => duplicateSel()}>复制</button>
        <button className="btn danger" onClick={() => deleteSel()}>删除</button>
        <span className="sep" />
        <button className="btn narrow-only" onClick={() => useUiStore.getState().toggleDrawer('panel', true)}>属性</button>
        <button className="btn" onClick={() => useUiStore.getState().select(null)}>完成</button>
      </div>
    )
  }
  return (
    <div id="fab" className="show">
      <span className="name">{esc(getDoc().rooms[r!.id]?.name ?? r!.name)}</span>
      <button className="btn narrow-only" onClick={() => useUiStore.getState().toggleDrawer('panel', true)}>地面 / 属性</button>
      <button className="btn" onClick={() => useUiStore.getState().select(null)}>完成</button>
    </div>
  )
}