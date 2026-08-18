import { randomUUID } from 'crypto'
import { t } from '../shared/i18n'
import { LOCAL_DEFAULTS } from '../shared/types'
import { captureFrontWindow, guessChannel } from './capture'
import {
  findOrCreateContact,
  getSettings,
  insertMessages,
  recentMessages
} from './db'
import { notifyActivityChanged } from './activity-notify'
import { showHud } from './hud'
import { generateReply, isLocalMode, recognizeChatScreenshot } from './llm'
import { getOllamaStatus } from './ollama'
import { hasMacAccessibility, macAccessibilityApisAllowed } from './permissions'
import { pasteIntoFrontApp } from './paste'
import { isScreenAskBusy, showScreenAskProgressHud } from './screen-ask'
import { notifySkillGuideStep } from './skill-guide'
import {
  abortNetworkWork,
  beginNetworkWork,
  isTaskCancelled,
  TaskCancelledError
} from './task-cancel'

let running = false
let runId = 0
let pipelineFromUi = false

export function isReplyBusy(): boolean {
  return running
}

/** Esc：立刻停下帮我对话 */
export function cancelCapturePipeline(): boolean {
  if (!running) return false
  runId += 1
  abortNetworkWork()
  running = false
  notifyActivityChanged()
  return true
}

export async function runCapturePipeline(opts?: { fromUi?: boolean }): Promise<void> {
  if (isScreenAskBusy()) {
    showScreenAskProgressHud()
    return
  }

  if (running) {
    showHud({
      kind: 'generating',
      text: t('reply.hud.busy'),
      detail: t('screenAsk.busyDetail'),
      icon: 'think'
    })
    return
  }

  if (
    process.platform === 'darwin' &&
    macAccessibilityApisAllowed() &&
    !hasMacAccessibility()
  ) {
    showHud({
      kind: 'error',
      text: t('hud.a11yMissingFull', { name: t('brand.name') })
    })
    return
  }

  running = true
  pipelineFromUi = Boolean(opts?.fromUi)
  const myRun = ++runId
  notifyActivityChanged()

  try {
    const settings = getSettings()

    if (isLocalMode(settings)) {
      const textModel = settings.localModelName || LOCAL_DEFAULTS.textModel
      const visionModel = settings.localVisionModelName || LOCAL_DEFAULTS.visionModel
      const status = await getOllamaStatus(textModel, visionModel)
      if (myRun !== runId) throw new TaskCancelledError()
      if (!status.running) {
        showHud({ kind: 'error', text: t('reply.hud.localNotReady') })
        return
      }
      if (!status.textModelReady || !status.visionModelReady) {
        showHud({ kind: 'error', text: t('reply.hud.installModels') })
        return
      }
    } else if (!settings.apiKey.trim()) {
      showHud({ kind: 'error', text: t('reply.hud.needApiKey') })
      return
    }

    showHud({
      kind: 'recognizing',
      text: isLocalMode(settings) ? t('reply.hud.lookingLocal') : t('reply.hud.looking')
    })
    const shot = await captureFrontWindow()
    if (myRun !== runId) throw new TaskCancelledError()
    const guessed = guessChannel(shot.appName, shot.windowTitle)

    const signal = beginNetworkWork()
    const recognized = await recognizeChatScreenshot(
      settings,
      shot.visionImage,
      {
        appName: shot.appName,
        windowTitle: shot.windowTitle,
        contactNameHint: shot.contactNameHint
      },
      signal
    )
    if (myRun !== runId) throw new TaskCancelledError()

    if (recognized.channel === 'unknown' && guessed !== 'unknown') {
      recognized.channel = guessed
    }

    const contact = findOrCreateContact(recognized.channel, recognized.contactName)
    const batchId = randomUUID()
    insertMessages(contact.id, recognized.messages, batchId)

    const history = recentMessages(contact.id, settings.contextWindowSize)
    showHud({
      kind: 'generating',
      text: isLocalMode(settings) ? t('reply.hud.writingLocal') : t('reply.hud.writing')
    })
    const signal2 = beginNetworkWork()
    const { text: reply, scenarioShortName } = await generateReply(
      settings,
      contact,
      history,
      signal2
    )
    if (myRun !== runId) throw new TaskCancelledError()
    if (!reply.trim()) throw new Error('模型返回了空回复')

    if (scenarioShortName) {
      showHud({
        kind: 'generating',
        text: t('reply.hud.scenario', { name: scenarioShortName })
      })
    }

    const pasteResult = await pasteIntoFrontApp(reply.trim())
    if (myRun !== runId) throw new TaskCancelledError()
    if (pasteResult === 'pasted') {
      showHud({ kind: 'done', text: t('reply.hud.done') })
    } else {
      showHud({ kind: 'done', text: t('reply.hud.pasteFail') })
    }
    if (!pipelineFromUi) notifySkillGuideStep('reply', true)
  } catch (err) {
    if (isTaskCancelled(err) || myRun !== runId) return
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
    if (myRun === runId) {
      running = false
      notifyActivityChanged()
    }
  }
}
