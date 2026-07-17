import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  Channel,
  Contact,
  Message,
  MessageQuery,
  MessageRole
} from '../shared/types'
import { ensureSettingsFile } from './user-config'

export { getSettings, saveSettings } from './user-config'

let db: Database.Database | null = null

function dbPath(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'vip-chat.sqlite')
}

function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) {
    getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

export function initDb(): void {
  db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      display_name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      persona_title TEXT NOT NULL DEFAULT '',
      persona_prompt TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(channel, display_name)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content_text TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      raw_hash TEXT NOT NULL,
      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_hash ON messages(contact_id, raw_hash);
  `)

  ensureColumn('contacts', 'persona_tags', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('contacts', 'profile_summary', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('contacts', 'profile_tags', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn('contacts', 'key_facts', `TEXT NOT NULL DEFAULT '[]'`)

  // 个性化配置迁到 config/settings.json；SQLite 只保留客户与聊天
  const legacy = getDb()
    .prepare(`SELECT value FROM settings WHERE key = 'app'`)
    .get() as { value: string } | undefined
  ensureSettingsFile(legacy?.value)
  if (legacy) {
    getDb().prepare(`DELETE FROM settings WHERE key = 'app'`).run()
  }
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function mapContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as number,
    channel: row.channel as Channel,
    displayName: row.display_name as string,
    tags: (row.tags as string) || '',
    personaTitle: (row.persona_title as string) || '',
    personaPrompt: (row.persona_prompt as string) || '',
    personaTags: (row.persona_tags as string) || '',
    profileSummary: (row.profile_summary as string) || '',
    profileTags: (row.profile_tags as string) || '',
    keyFacts: (row.key_facts as string) || '[]',
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function listContacts(): Contact[] {
  const rows = getDb()
    .prepare(`SELECT * FROM contacts ORDER BY updated_at DESC`)
    .all() as Record<string, unknown>[]
  return rows.map(mapContact)
}

export function getContact(id: number): Contact | null {
  const row = getDb()
    .prepare(`SELECT * FROM contacts WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  return row ? mapContact(row) : null
}

export function findOrCreateContact(channel: Channel, displayName: string): Contact {
  const existing = getDb()
    .prepare(`SELECT * FROM contacts WHERE channel = ? AND display_name = ?`)
    .get(channel, displayName) as Record<string, unknown> | undefined
  if (existing) {
    const now = new Date().toISOString()
    getDb()
      .prepare(`UPDATE contacts SET updated_at = ? WHERE id = ?`)
      .run(now, existing.id)
    return mapContact({ ...existing, updated_at: now })
  }

  const now = new Date().toISOString()
  const info = getDb()
    .prepare(
      `INSERT INTO contacts(
         channel, display_name, tags, persona_title, persona_prompt, persona_tags,
         profile_summary, profile_tags, key_facts, notes, created_at, updated_at
       ) VALUES(?, ?, '', '', '', '', '', '', '[]', '', ?, ?)`
    )
    .run(channel, displayName, now, now)
  return getContact(Number(info.lastInsertRowid))!
}

export type ContactPatch = Partial<
  Pick<
    Contact,
    | 'displayName'
    | 'tags'
    | 'personaTitle'
    | 'personaPrompt'
    | 'personaTags'
    | 'profileSummary'
    | 'profileTags'
    | 'keyFacts'
    | 'notes'
    | 'channel'
  >
>

export function updateContact(id: number, patch: ContactPatch): Contact | null {
  const current = getContact(id)
  if (!current) return null
  const next = {
    displayName: patch.displayName ?? current.displayName,
    tags: patch.tags ?? current.tags,
    personaTitle: patch.personaTitle ?? current.personaTitle,
    personaPrompt: patch.personaPrompt ?? current.personaPrompt,
    personaTags: patch.personaTags ?? current.personaTags,
    profileSummary: patch.profileSummary ?? current.profileSummary,
    profileTags: patch.profileTags ?? current.profileTags,
    keyFacts: patch.keyFacts ?? current.keyFacts,
    notes: patch.notes ?? current.notes,
    channel: patch.channel ?? current.channel
  }
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `UPDATE contacts
       SET channel = ?, display_name = ?, tags = ?, persona_title = ?, persona_prompt = ?,
           persona_tags = ?, profile_summary = ?, profile_tags = ?, key_facts = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.channel,
      next.displayName,
      next.tags,
      next.personaTitle,
      next.personaPrompt,
      next.personaTags,
      next.profileSummary,
      next.profileTags,
      next.keyFacts,
      next.notes,
      now,
      id
    )
  return getContact(id)
}

export function deleteContact(id: number): void {
  const tx = getDb().transaction(() => {
    getDb().prepare(`DELETE FROM messages WHERE contact_id = ?`).run(id)
    getDb().prepare(`DELETE FROM contacts WHERE id = ?`).run(id)
  })
  tx()
}

function hashMessage(role: MessageRole, content: string): string {
  return `${role}::${content.trim()}`
}

export function insertMessages(
  contactId: number,
  messages: { role: MessageRole; content: string }[],
  batchId: string
): number {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO messages(contact_id, role, content_text, captured_at, batch_id, raw_hash)
     VALUES(?, ?, ?, ?, ?, ?)`
  )
  const now = new Date().toISOString()
  let inserted = 0
  const tx = getDb().transaction(() => {
    for (const msg of messages) {
      const content = msg.content.trim()
      if (!content) continue
      const info = stmt.run(
        contactId,
        msg.role,
        content,
        now,
        batchId,
        hashMessage(msg.role, content)
      )
      if (info.changes > 0) inserted += 1
    }
    getDb()
      .prepare(`UPDATE contacts SET updated_at = ? WHERE id = ?`)
      .run(now, contactId)
  })
  tx()
  return inserted
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as number,
    contactId: row.contact_id as number,
    role: row.role as MessageRole,
    contentText: row.content_text as string,
    capturedAt: row.captured_at as string,
    batchId: row.batch_id as string
  }
}

export function listMessages(contactId: number, query: MessageQuery = {}): Message[] {
  const limit = query.limit ?? 2000
  const params: unknown[] = [contactId]
  let sql = `SELECT * FROM messages WHERE contact_id = ?`
  if (query.from) {
    sql += ` AND captured_at >= ?`
    params.push(query.from)
  }
  if (query.to) {
    sql += ` AND captured_at <= ?`
    params.push(query.to)
  }
  sql += ` ORDER BY captured_at ASC, id ASC LIMIT ?`
  params.push(limit)

  const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(mapMessage)
}

export function recentMessages(contactId: number, limit: number): Message[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM messages WHERE contact_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(contactId, limit) as Record<string, unknown>[]
  return rows.map(mapMessage).reverse()
}
