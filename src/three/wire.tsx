import { useEffect } from 'react'
import { useViewModeStore } from '../state/viewModeStore'
import { view3d } from './view3d'

/** 3D 引擎接线：挂载时注册进 viewModeStore（幂等） */
export function registerView3D(): void {
  useViewModeStore.getState().registerEngine(view3d)
}

/** main#stage 内的 3D 覆盖层（引擎经 imperative 绑定操作这些节点；CSS 控制显隐） */
export function Stage3DOverlay() {
  useEffect(() => registerView3D(), [])
  return (
    <div id="view3d">
      <div id="walkOverlay"><div>
        <h3>漫游模式</h3>
        <p>点击开始，从入户门进入</p>
        <p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 移动 · 鼠标转向 · <kbd>Shift</kbd> 快走</p>
        <p><kbd>E</kbd> 开关正前方的门 · <kbd>Esc</kbd> 暂停</p>
      </div></div>
      <div id="cross" />
      <div id="joy"><i /></div>
      <button className="btn primary" id="walkExit">退出漫游</button>
      <div id="hint3d">左键旋转 · 右键平移 · 滚轮缩放 · 点击家具/地面编辑 · 点击门开关</div>
    </div>
  )
}

/** 家具库侧栏的 3D 房间列表块（引擎填充并绑定） */
export function Lib3D() {
  return (
    <div id="lib3d" className="only3d">
      <h4>房间 · 点击飞到该房间</h4>
      <div id="roomList"></div>
    </div>
  )
}