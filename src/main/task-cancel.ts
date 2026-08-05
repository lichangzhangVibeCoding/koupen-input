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
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TaskCancelledError') return true
    if (/aborted|CANCELLED/i.test(err.message)) return true
  }
  return false
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
