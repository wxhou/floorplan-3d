import { describe, expect, it, vi } from 'vitest'
import { useViewModeStore, type View3DApi } from './viewModeStore'
import { useToastStore } from './toastStore'

// Task 9.x：切换守卫逻辑 —— 引擎未就绪只提示、切换期间防抖、enter/exit 调用路径

const fakeEngine = (): View3DApi => ({
  enter: vi.fn().mockResolvedValue(undefined),
  exit: vi.fn().mockResolvedValue(undefined),
  sync: vi.fn(),
  shot: vi.fn(),
  groundAt: vi.fn(),
  flyToRoom: vi.fn(),
  walking: () => false,
})

async function resetStore(): Promise<void> {
  useViewModeStore.setState({ mode: '2d', switching: false })
}

describe('useViewModeStore.switchTo', () => {
  it('引擎未就绪时切 3D：提示但不切换', async () => {
    await resetStore()
    useToastStore.setState({ msg: '', seq: 0 })
    await useViewModeStore.getState().switchTo('3d')
    expect(useViewModeStore.getState().mode).toBe('2d')
    expect(useToastStore.getState().msg).toBe('3D 引擎仍在加载或加载失败')
  })

  it('引擎就绪后切 3D：先重置工具/测量再调用 enter', async () => {
    await resetStore()
    const e = fakeEngine()
    useViewModeStore.getState().registerEngine(e)
    await useViewModeStore.getState().switchTo('3d')
    expect(useViewModeStore.getState().mode).toBe('3d')
    expect(e.enter).toHaveBeenCalledTimes(1)
    expect(e.exit).not.toHaveBeenCalled()
  })

  it('已在目标模式或切换中：忽略重复触发', async () => {
    const e = fakeEngine()
    useViewModeStore.setState({ mode: '3d', switching: true })
    useViewModeStore.getState().registerEngine(e)
    await useViewModeStore.getState().switchTo('3d')
    expect(e.enter).not.toHaveBeenCalled()
    useViewModeStore.setState({ mode: '3d', switching: false })
    await useViewModeStore.getState().switchTo('2d')
    expect(e.exit).toHaveBeenCalledTimes(1)
    await resetStore()
  })
})