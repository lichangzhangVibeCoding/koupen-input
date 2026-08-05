import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

let cached: string | null = null

function knowledgeFilePath(): string {
  const name = 'exam-knowledge-base.txt'
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', name)
  }
  return join(app.getAppPath(), 'resources', name)
}

/** 加载看屏幕答题用的考试知识库（纯文本）；失败返回空串 */
export function getExamKnowledgeBase(): string {
  if (cached != null) return cached
  try {
    const p = knowledgeFilePath()
    if (!existsSync(p)) {
      console.warn('[exam-knowledge] missing:', p)
      cached = ''
      return cached
    }
    cached = readFileSync(p, 'utf8').trim()
    return cached
  } catch (err) {
    console.warn('[exam-knowledge] load failed', err)
    cached = ''
    return cached
  }
}

export function examKnowledgeLoaded(): boolean {
  return getExamKnowledgeBase().length > 0
}
