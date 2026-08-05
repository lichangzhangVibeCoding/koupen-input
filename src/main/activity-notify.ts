/** 轻量活动变更通知，避免 cancel / 业务模块循环依赖 */
type Listener = () => void

let listener: Listener | null = null

export function onActivityChanged(fn: Listener | null): void {
  listener = fn
}

export function notifyActivityChanged(): void {
  try {
    listener?.()
  } catch (err) {
    console.warn('[activity] notify failed', err)
  }
}
