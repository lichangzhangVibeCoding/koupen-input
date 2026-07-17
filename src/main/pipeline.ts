import { randomUUID } from 'crypto'
import { captureFrontWindow, guessChannel } from './capture'
import {
  findOrCreateContact,
  getSettings,
  insertMessages,
  recentMessages
} from './db'
import { showHud } from './hud'
import { generateReply, isLocalMode, recognizeChatScreenshot } from './llm'
import { getOllamaStatus } from './ollama'
import { pasteIntoFrontApp } from './paste'
import { LOCAL_DEFAULTS } from '../shared/types'

let running = false

export async function runCapturePipeline(): Promise<void> {
  if (running) {
    showHud({ kind: 'error', text: '上一次还在处理中…' })
    return
  }
  running = true

  try {
    const settings = getSettings()

    if (isLocalMode(settings)) {
      const textModel = settings.localModelName || LOCAL_DEFAULTS.textModel
      const visionModel = settings.localVisionModelName || LOCAL_DEFAULTS.visionModel
      const status = await getOllamaStatus(textModel, visionModel)
      if (!status.running) {
        showHud({ kind: 'error', text: '本地模型未就绪，请到设置安装/启动' })
        return
      }
      if (!status.textModelReady || !status.visionModelReady) {
        showHud({ kind: 'error', text: '请先在设置页一键安装本地模型' })
        return
      }
    } else if (!settings.apiKey.trim()) {
      showHud({ kind: 'error', text: '请先配置 API Key，或改用免费本地模型' })
      return
    }

    showHud({
      kind: 'recognizing',
      text: isLocalMode(settings) ? '帮你口喷：正在看聊天…（本地）' : '帮你口喷：正在看聊天…'
    })
    const shot = await captureFrontWindow()
    const guessed = guessChannel(shot.appName, shot.windowTitle)

    const recognized = await recognizeChatScreenshot(settings, shot.imageBase64, {
      appName: shot.appName,
      windowTitle: shot.windowTitle
    })

    if (recognized.channel === 'unknown' && guessed !== 'unknown') {
      recognized.channel = guessed
    }

    const contact = findOrCreateContact(recognized.channel, recognized.contactName)
    const batchId = randomUUID()
    insertMessages(contact.id, recognized.messages, batchId)

    showHud({
      kind: 'generating',
      text: isLocalMode(settings) ? '帮你口喷：正在写回复…（本地）' : '帮你口喷：正在写回复…'
    })
    const history = recentMessages(contact.id, settings.contextWindowSize)
    const reply = await generateReply(settings, contact, history)
    if (!reply.trim()) throw new Error('模型返回了空回复')

    const pasteResult = await pasteIntoFrontApp(reply.trim())
    if (pasteResult === 'pasted') {
      showHud({
        kind: 'done',
        text: isLocalMode(settings)
          ? '帮你口喷：已填入（本地档，不准可升级云端）'
          : '帮你口喷：已填入输入框，请你确认后发送'
      })
    } else {
      showHud({ kind: 'done', text: '粘贴失败，回复已复制到剪贴板' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
    running = false
  }
}
