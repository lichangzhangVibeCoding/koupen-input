import { app } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { ScreenAskMessage, ScreenAskSession } from '../shared/types'
import { getDb } from './db'

export function screenAskRootDir(): string {
  const dir = join(app.getPath('userData'), 'data', 'screen-ask')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function absScreenshotPath(relative: string): string {
  return join(screenAskRootDir(), relative)
}

function mapSession(
  row: Record<string, unknown>,
  preview = ''
): ScreenAskSession {
  return {
    id: row.id as number,
    title: (row.title as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    preview
  }
}

function mapMessage(row: Record<string, unknown>): ScreenAskMessage {
  return {
    id: row.id as number,
    sessionId: row.session_id as number,
    role: row.role as ScreenAskMessage['role'],
    contentText: row.content_text as string,
    screenshotPath: (row.screenshot_path as string) || null,
    screenshotMime: (row.screenshot_mime as string) || null,
    capturedAt: row.captured_at as string
  }
}

export function listScreenAskSessions(): ScreenAskSession[] {
  const rows = getDb()
    .prepare(`SELECT * FROM screen_ask_sessions ORDER BY updated_at DESC`)
    .all() as Record<string, unknown>[]

  const previewStmt = getDb().prepare(
    `SELECT content_text FROM screen_ask_messages
     WHERE session_id = ? ORDER BY id DESC LIMIT 1`
  )

  return rows.map((row) => {
    const last = previewStmt.get(row.id) as { content_text?: string } | undefined
    const preview = (last?.content_text || '').trim().slice(0, 80)
    return mapSession(row, preview)
  })
}

export function getScreenAskSession(id: number): ScreenAskSession | null {
  const row = getDb()
    .prepare(`SELECT * FROM screen_ask_sessions WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) return null
  const last = getDb()
    .prepare(
      `SELECT content_text FROM screen_ask_messages
       WHERE session_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(id) as { content_text?: string } | undefined
  return mapSession(row, (last?.content_text || '').trim().slice(0, 80))
}

export function createScreenAskSession(title: string): ScreenAskSession {
  const now = new Date().toISOString()
  const info = getDb()
    .prepare(
      `INSERT INTO screen_ask_sessions(title, created_at, updated_at) VALUES(?, ?, ?)`
    )
    .run(title.trim() || 'New chat', now, now)
  const id = Number(info.lastInsertRowid)
  mkdirSync(join(screenAskRootDir(), String(id)), { recursive: true })
  return getScreenAskSession(id)!
}

export function renameScreenAskSession(id: number, title: string): ScreenAskSession | null {
  const now = new Date().toISOString()
  getDb()
    .prepare(`UPDATE screen_ask_sessions SET title = ?, updated_at = ? WHERE id = ?`)
    .run(title.trim() || 'Untitled', now, id)
  return getScreenAskSession(id)
}

export function deleteScreenAskSession(id: number): boolean {
  const tx = getDb().transaction(() => {
    getDb().prepare(`DELETE FROM screen_ask_messages WHERE session_id = ?`).run(id)
    getDb().prepare(`DELETE FROM screen_ask_sessions WHERE id = ?`).run(id)
  })
  tx()
  try {
    rmSync(join(screenAskRootDir(), String(id)), { recursive: true, force: true })
  } catch {
    // ignore
  }
  return true
}

export function listScreenAskMessages(sessionId: number): ScreenAskMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM screen_ask_messages WHERE session_id = ? ORDER BY id ASC`
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(mapMessage)
}

export function recentScreenAskTextHistory(
  sessionId: number,
  limit = 12
): { role: 'user' | 'assistant'; content: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT role, content_text FROM screen_ask_messages
       WHERE session_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(sessionId, limit) as { role: string; content_text: string }[]
  return rows
    .reverse()
    .map((r) => ({
      role: r.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: r.content_text
    }))
}

function titleFromQuestion(question: string): string {
  const t = question.trim().replace(/\s+/g, ' ')
  if (!t) return 'Screen Ask'
  return t.length > 36 ? `${t.slice(0, 35)}…` : t
}

/**
 * 写入一轮：用户（问题+截图）+ 助手回答
 */
export function appendScreenAskTurn(input: {
  sessionId: number | null
  question: string
  answer: string
  image: { base64: string; mime: string }
}): { session: ScreenAskSession; userMessage: ScreenAskMessage; assistantMessage: ScreenAskMessage } {
  const now = new Date().toISOString()
  let sessionId = input.sessionId
  let session: ScreenAskSession

  if (!sessionId || !getScreenAskSession(sessionId)) {
    session = createScreenAskSession(titleFromQuestion(input.question))
    sessionId = session.id
  } else {
    session = getScreenAskSession(sessionId)!
    // 首条若还是占位标题，用问题更新
    if (!session.title || session.title === 'New chat' || session.title === '新对话') {
      renameScreenAskSession(sessionId, titleFromQuestion(input.question))
      session = getScreenAskSession(sessionId)!
    }
  }

  const insert = getDb().prepare(
    `INSERT INTO screen_ask_messages
      (session_id, role, content_text, screenshot_path, screenshot_mime, captured_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  const userInfo = insert.run(sessionId, 'user', input.question.trim(), null, null, now)
  const userId = Number(userInfo.lastInsertRowid)

  const ext = input.image.mime.includes('png') ? 'png' : 'jpg'
  const relative = `${sessionId}/${userId}.${ext}`
  const abs = absScreenshotPath(relative)
  mkdirSync(join(screenAskRootDir(), String(sessionId)), { recursive: true })
  writeFileSync(abs, Buffer.from(input.image.base64, 'base64'))

  getDb()
    .prepare(
      `UPDATE screen_ask_messages SET screenshot_path = ?, screenshot_mime = ? WHERE id = ?`
    )
    .run(relative, input.image.mime, userId)

  const asstInfo = insert.run(sessionId, 'assistant', input.answer.trim(), null, null, now)
  const asstId = Number(asstInfo.lastInsertRowid)

  getDb()
    .prepare(`UPDATE screen_ask_sessions SET updated_at = ? WHERE id = ?`)
    .run(now, sessionId)

  return {
    session: getScreenAskSession(sessionId)!,
    userMessage: mapMessage(
      getDb().prepare(`SELECT * FROM screen_ask_messages WHERE id = ?`).get(userId) as Record<
        string,
        unknown
      >
    ),
    assistantMessage: mapMessage(
      getDb().prepare(`SELECT * FROM screen_ask_messages WHERE id = ?`).get(asstId) as Record<
        string,
        unknown
      >
    )
  }
}

/** 读取截图为 data URL（给渲染进程展示） */
export function readScreenAskScreenshotDataUrl(relativePath: string): string | null {
  if (!relativePath || relativePath.includes('..')) return null
  const abs = absScreenshotPath(relativePath)
  if (!existsSync(abs)) return null
  try {
    const buf = readFileSync(abs)
    const mime = relativePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
