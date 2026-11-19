/** 用户取消（Esc）时抛出；各流程 catch 后静默收尾，勿当业务错误展示 */
export class TaskCancelledError extends Error {
  constructor(message = 'CANCELLED') {
    super(message)
    this.name = 'TaskCancelledError'
  }
}

export function isTaskCancelled(err: unknown): boolean {
  if (!err) return false
  if (err instanceof TaskCancelledError) return true
  if (isTimeoutAbort(err)) return false
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TaskCancelledError') return true
    if (/aborted|CANCELLED/i.test(err.message) && !/timeout/i.test(err.message)) return true
  }
  return false
}

export function isTimeoutAbort(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string; cause?: { name?: string } }
  if (e.name === 'TimeoutError') return true
  if (e.cause?.name === 'TimeoutError') return true
  if (e.name === 'AbortError' && /timeout/i.test(String(e.message || ''))) return true
  return false
}

/** 墙钟超时：不依赖 fetch 是否真的 abort（Electron 上 AbortSignal 有时无效）。 */
export function raceDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), Math.max(1, ms))
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** Combine a user cancel signal with a wall-clock timeout. */
export function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timed = AbortSignal.timeout(Math.max(1, ms))
  if (!signal) return timed
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timed])
  const ctrl = new AbortController()
  const forward = () => {
    if (ctrl.signal.aborted) return
    ctrl.abort(signal.aborted ? signal.reason : timed.reason)
  }
  if (signal.aborted || timed.aborted) {
    forward()
    return ctrl.signal
  }
  signal.addEventListener('abort', forward, { once: true })
  timed.addEventListener('abort', forward, { once: true })
  return ctrl.signal
}

let llmController: AbortController | null = null

/** 开始一段可中断的网络工作；会使上一次未完成的请求 abort */
export function beginNetworkWork(): AbortSignal {
  llmController?.abort()
  llmController = new AbortController()
  return llmController.signal
}

export function getNetworkSignal(): AbortSignal | undefined {
  return llmController?.signal
}

export function abortNetworkWork(): void {
  if (llmController && !llmController.signal.aborted) {
    llmController.abort()
  }
  llmController = null
}

export function throwIfCancelled(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw new TaskCancelledError()
}
