import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { shell } from 'electron'
import { LOCAL_DEFAULTS, OllamaStatus, PullProgress } from '../shared/types'

const execFileAsync = promisify(execFile)

const OLLAMA_HOST = LOCAL_DEFAULTS.host

async function whichOllama(): Promise<string | null> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const { stdout } = await execFileAsync(cmd, ['ollama'])
    const path = stdout.trim().split('\n')[0]
    return path || null
  } catch {
    // common macOS app install path
    const candidates = [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      `${process.env.HOME}/.ollama/bin/ollama`
    ]
    const { existsSync } = await import('fs')
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return null
  }
}

export async function getOllamaStatus(
  textModel = LOCAL_DEFAULTS.textModel,
  visionModel = LOCAL_DEFAULTS.visionModel
): Promise<OllamaStatus> {
  const bin = await whichOllama()
  const installed = Boolean(bin)

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2500)
    })
    if (!res.ok) {
      return {
        installed,
        running: false,
        models: [],
        textModelReady: false,
        visionModelReady: false,
        error: `Ollama 响应异常 (${res.status})`
      }
    }
    const data = (await res.json()) as { models?: { name: string }[] }
    const models = (data.models || []).map((m) => m.name)
    const has = (want: string) =>
      models.some((m) => m === want || m.startsWith(`${want}:`) || m.startsWith(`${want}`))

    let version: string | undefined
    try {
      const v = await fetch(`${OLLAMA_HOST}/api/version`, {
        signal: AbortSignal.timeout(1500)
      })
      if (v.ok) {
        const j = (await v.json()) as { version?: string }
        version = j.version
      }
    } catch {
      // ignore
    }

    return {
      installed: true,
      running: true,
      version,
      models,
      textModelReady: has(textModel),
      visionModelReady: has(visionModel)
    }
  } catch {
    return {
      installed,
      running: false,
      models: [],
      textModelReady: false,
      visionModelReady: false,
      error: installed
        ? '已安装但未运行，请先启动 Ollama'
        : '未检测到 Ollama，请先安装'
    }
  }
}

export async function openOllamaDownload(): Promise<void> {
  await shell.openExternal('https://ollama.com/download')
}

/** Try to start Ollama app / serve if binary exists */
export async function startOllama(): Promise<{ ok: boolean; message: string }> {
  const bin = await whichOllama()
  if (!bin) {
    await openOllamaDownload()
    return { ok: false, message: '未找到 Ollama，已打开下载页' }
  }

  // If already running
  const status = await getOllamaStatus()
  if (status.running) {
    return { ok: true, message: 'Ollama 已在运行' }
  }

  try {
    if (process.platform === 'darwin') {
      // Prefer launching the GUI app which keeps the daemon up
      try {
        await execFileAsync('open', ['-a', 'Ollama'])
      } catch {
        spawn(bin, ['serve'], {
          detached: true,
          stdio: 'ignore'
        }).unref()
      }
    } else {
      spawn(bin, ['serve'], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    }

    // wait briefly for readiness
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 800))
      const s = await getOllamaStatus()
      if (s.running) return { ok: true, message: 'Ollama 已启动' }
    }
    return { ok: false, message: '已尝试启动，但仍未就绪，请手动打开 Ollama' }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function pullOllamaModel(
  model: string,
  onProgress?: (p: PullProgress) => void
): Promise<void> {
  const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true })
  })

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    throw new Error(`拉取模型失败 (${res.status}): ${t.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let row: {
        status?: string
        completed?: number
        total?: number
        error?: string
      }
      try {
        row = JSON.parse(trimmed)
      } catch {
        continue
      }
      if (row.error) throw new Error(row.error)
      const percent =
        row.total && row.completed
          ? Math.min(100, Math.round((row.completed / row.total) * 100))
          : undefined
      onProgress?.({
        model,
        status: row.status || 'downloading',
        completed: row.completed,
        total: row.total,
        percent,
        done: row.status === 'success'
      })
    }
  }

  onProgress?.({ model, status: 'success', done: true, percent: 100 })
}

/** Pull both default local models sequentially */
export async function ensureLocalModels(
  textModel: string,
  visionModel: string,
  onProgress?: (p: PullProgress) => void
): Promise<void> {
  const status = await getOllamaStatus(textModel, visionModel)
  if (!status.running) {
    const started = await startOllama()
    if (!started.ok) throw new Error(started.message)
  }

  const again = await getOllamaStatus(textModel, visionModel)
  if (!again.textModelReady) {
    await pullOllamaModel(textModel, onProgress)
  } else {
    onProgress?.({
      model: textModel,
      status: 'already present',
      done: true,
      percent: 100
    })
  }

  if (!again.visionModelReady && visionModel !== textModel) {
    // re-check after text pull
    const mid = await getOllamaStatus(textModel, visionModel)
    if (!mid.visionModelReady) {
      await pullOllamaModel(visionModel, onProgress)
    }
  } else if (again.visionModelReady) {
    onProgress?.({
      model: visionModel,
      status: 'already present',
      done: true,
      percent: 100
    })
  }
}
