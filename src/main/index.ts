import { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  ContactPatch,
  deleteContact,
  getContact,
  getSettings,
  initDb,
  listContacts,
  listMessages,
  recentMessages,
  saveSettings,
  updateContact
} from './db'
import { destroyHud, showHud } from './hud'
import { refreshProfileFromHistory, testConnection } from './llm'
import {
  membershipCreateOfflineIntent,
  membershipCreateStripeCheckout,
  membershipGetLedger,
  membershipGetMe,
  membershipUpdateProfile,
  membershipGetPlans,
  membershipLogin,
  membershipRedeem,
  membershipRequestCode
} from './membership'
import {
  applySiliconflow,
  getModelDashboard,
  installLocalSuite,
  testSlot
} from './model-service'
import { ensureStreamAsr, getStreamAsrStatus, warmupStreamAsr } from './local-asr-stream'
import {
  ensureLocalModels,
  getOllamaStatus,
  openOllamaDownload,
  startOllama
} from './ollama'
import type { SlotId } from '../shared/model-slots'
import { runCapturePipeline } from './pipeline'
import {
  askScreenWithText,
  getActiveScreenAskSessionId,
  setActiveScreenAskSessionId,
  setScreenAskUpdateHandler,
  startNewScreenAskSession,
  toggleScreenAsk
} from './screen-ask'
import {
  deleteScreenAskSession,
  getScreenAskSession,
  listScreenAskMessages,
  listScreenAskSessions,
  readScreenAskScreenshotDataUrl,
  renameScreenAskSession
} from './screen-ask-store'
import {
  getMacPermissionSnapshot,
  hasMacAccessibility,
  macAccessibilityApisAllowed,
  openMacPrivacyPane,
  requestMacMicrophoneAccess
} from './permissions'
import { migrateUserDataFromLegacy } from './migrate-userdata'
import {
  exportSettingsToFile,
  resetSettingsToDefault
} from './user-config'
import { disposeEscapeCancel, initEscapeCancel } from './escape-cancel'
import { destroyRecorder } from './voice-recorder'
import { toggleVoiceInput, beginVoiceHold, endVoiceHold, cancelHoldVoiceInput, toggleVoiceHold } from './voice-input'
import {
  hardwareReplyAccelerator,
  hardwareVoiceAccelerator,
  isModifierDoubleHotkey
} from '../shared/hotkey'
import { appDisplayTitle, applyLocalePreference, t } from '../shared/i18n'
import { getReleasesCatalog } from '../shared/releases'
import { AppSettings, LOCAL_DEFAULTS, MessageQuery, PullProgress } from '../shared/types'
import {
  isModifierTapHookRunning,
  setModifierTapVoiceTrigger,
  startModifierTapListener,
  stopModifierTapListener,
  usesRightCommandHotkeys
} from './modifier-tap'
import { applyDevDockBadge } from './dev-dock'
import { warmupCosyVoice } from './speak'
import { destroyTray, navigateMainWindow, refreshTray, setupTray } from './tray'

const isDevBuild = !app.isPackaged

function syncAppLocale(settings?: AppSettings): void {
  const s = settings ?? getSettings()
  applyLocalePreference(s.locale, app.getLocale())
  const title = appDisplayTitle(isDevBuild)
  mainWindow?.setTitle(title)
  if (isDevBuild) {
    app.setName(title)
    applyDevDockBadge()
  }
  refreshTray()
}

let mainWindow: BrowserWindow | null = null
let registeredHotkey = ''
let registeredScreenAskHotkey = ''
let registeredScreenQuizHotkey = ''
let hardwareHotkeys: string[] = []
let accessibilityWatchTimer: ReturnType<typeof setInterval> | null = null
let accessibilityHintShown = false
let appQuitting = false

const modifierTapHandlers = {
  onSingleTap: () => {
    void toggleVoiceInput()
  },
  onDoubleTap: () => {
    const s = getSettings()
    if (isModifierDoubleHotkey(s.hotkey)) {
      void runCapturePipeline()
    }
  },
  onVoiceHoldStart: () => beginVoiceHold(),
  onVoiceHoldEnd: () => {
    void endVoiceHold()
  },
  onVoiceHoldCancel: () => {
    cancelHoldVoiceInput()
  },
  onScreenAsk: () => {
    const s = getSettings()
    if (s.screenAskEnabled !== false) void toggleScreenAsk()
  },
  onHardwareVoice: () => {
    void toggleVoiceInput({ fromUi: true })
  },
  onHardwareReply: () => {
    void runCapturePipeline({ fromUi: true })
  }
}

function startAccessibilityWatch(): void {
  if (process.platform !== 'darwin' || accessibilityWatchTimer) return
  // 运行中途勾选辅助功能后，不要立刻 uIOhook.start（当前进程往往仍未真正生效），
  // 否则系统会每隔几秒再弹「辅助功能访问」。只提示完全退出重开。
  accessibilityWatchTimer = setInterval(() => {
    if (!hasMacAccessibility()) return
    if (accessibilityWatchTimer) {
      clearInterval(accessibilityWatchTimer)
      accessibilityWatchTimer = null
    }
    showHud({
      kind: 'done',
      text: t('hud.a11yRelaunch'),
      detail: t('hud.cancelledDetail')
    })
  }, 2500)
}

function maybeWarnAccessibilityOnce(): void {
  if (process.platform !== 'darwin' || accessibilityHintShown || hasMacAccessibility()) return
  accessibilityHintShown = true
  showHud({
    kind: 'error',
    text: t('hud.a11yMissingFull', { name: t('brand.name') })
  })
}

function resolveAppIconPath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'resources/icon.png'),
    join(app.getAppPath(), 'resources/icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function createWindow(): void {
  const iconPath = resolveAppIconPath()
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: appDisplayTitle(isDevBuild),
    minimizable: true,
    maximizable: true,
    closable: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (process.platform === 'darwin') {
      app.dock?.show()
      if (iconPath) {
        try {
          app.dock?.setIcon(nativeImage.createFromPath(iconPath))
        } catch {
          /* ignore */
        }
      }
      if (isDevBuild) applyDevDockBadge()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDevBuild && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Mac：点红灯 = 缩到程序坞（继续听快捷键），不是退出。
  // 真退出：⌘Q、菜单栏图标右键「退出」。勿用 hide()，否则程序坞里看不到窗口。
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !appQuitting) {
      e.preventDefault()
      if (mainWindow?.isFullScreen()) {
        mainWindow.setFullScreen(false)
        mainWindow.once('leave-full-screen', () => {
          mainWindow?.minimize()
        })
        return
      }
      mainWindow?.minimize()
      app.dock?.show()
    }
  })
}

/** Mac 上含 Command 的加速键：只认右 Command（uIOhook），绝不走 globalShortcut（左右不分） */
function isMacCommandAccelerator(accel: string): boolean {
  return process.platform === 'darwin' && /\bCommand\b/i.test(accel)
}

function registerHotkey(hotkey: string): boolean {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey)
    registeredHotkey = ''
  }
  // 修饰键双击（Mac 右 Command / Win Alt）：由 modifier-tap 处理，无需 globalShortcut
  if (isModifierDoubleHotkey(hotkey)) {
    return true
  }
  // Mac Command*：只走右 Command 监听，避免左 Command 也能触发
  if (isMacCommandAccelerator(hotkey)) {
    registeredHotkey = hotkey
    if (!usesRightCommandHotkeys()) {
      console.warn('Mac Command hotkey needs Accessibility (right Command only):', hotkey)
    }
    return true
  }
  if (hardwareHotkeys.includes(hotkey)) {
    console.warn('Hotkey reserved for hardware:', hotkey)
    return false
  }
  if (hotkey && registeredScreenAskHotkey && hotkey === registeredScreenAskHotkey) {
    console.warn('Hotkey conflicts with Screen Ask:', hotkey)
    return false
  }
  if (hotkey && registeredScreenQuizHotkey && hotkey === registeredScreenQuizHotkey) {
    console.warn('Hotkey conflicts with Screen Quiz:', hotkey)
    return false
  }
  const ok = globalShortcut.register(hotkey, () => {
    void runCapturePipeline()
  })
  if (ok) registeredHotkey = hotkey
  return ok
}

function registerScreenAskHotkey(hotkey: string, enabled: boolean): boolean {
  if (registeredScreenAskHotkey) {
    try {
      globalShortcut.unregister(registeredScreenAskHotkey)
    } catch {
      // ignore
    }
    registeredScreenAskHotkey = ''
  }
  if (!enabled || !hotkey.trim()) return true
  // Mac Command*：只认右 Command（modifier-tap），不注册 globalShortcut
  if (isMacCommandAccelerator(hotkey)) {
    registeredScreenAskHotkey = hotkey
    if (!usesRightCommandHotkeys()) {
      console.warn('Mac Screen Ask needs Accessibility (right Command only):', hotkey)
    }
    return true
  }
  if (isModifierDoubleHotkey(hotkey) || hardwareHotkeys.includes(hotkey)) {
    console.warn('Screen Ask hotkey reserved:', hotkey)
    return false
  }
  if (registeredHotkey && hotkey === registeredHotkey) {
    console.warn('Screen Ask hotkey conflicts with reply:', hotkey)
    return false
  }
  if (registeredScreenQuizHotkey && hotkey === registeredScreenQuizHotkey) {
    console.warn('Screen Ask hotkey conflicts with Screen Quiz:', hotkey)
    return false
  }
  const ok = globalShortcut.register(hotkey, () => {
    void toggleScreenAsk()
  })
  if (ok) registeredScreenAskHotkey = hotkey
  return ok
}

/** 答题已并入看屏幕：只注销遗留热键，不再注册 */
function registerScreenQuizHotkey(hotkey: string, enabled: boolean): boolean {
  if (registeredScreenQuizHotkey) {
    try {
      globalShortcut.unregister(registeredScreenQuizHotkey)
    } catch {
      // ignore
    }
    registeredScreenQuizHotkey = ''
  }
  void hotkey
  void enabled
  return true
}

/** 硬件备用：Mac 只走右 Command+8/0（modifier-tap）；Win 用 Win+8/0 globalShortcut */
function registerHardwareHotkeys(): void {
  for (const accel of hardwareHotkeys) {
    try {
      globalShortcut.unregister(accel)
    } catch {
      // ignore
    }
  }
  hardwareHotkeys = []

  // Mac：绝不注册 Command+8/0 的 globalShortcut（左右 Command 都会触发）
  if (process.platform === 'darwin') {
    if (!usesRightCommandHotkeys()) {
      console.warn('Mac hardware hotkeys need Accessibility (right Command+8 / +0)')
    }
    return
  }

  const voiceAccel = hardwareVoiceAccelerator()
  const replyAccel = hardwareReplyAccelerator()

  const voiceOk = globalShortcut.register(voiceAccel, () => {
    void toggleVoiceInput({ fromUi: true })
  })
  if (voiceOk) hardwareHotkeys.push(voiceAccel)
  else console.warn('Failed to register hardware voice hotkey', voiceAccel)

  const replyOk = globalShortcut.register(replyAccel, () => {
    void runCapturePipeline({ fromUi: true })
  })
  if (replyOk) hardwareHotkeys.push(replyAccel)
  else console.warn('Failed to register hardware reply hotkey', replyAccel)
}

/** 先挂修饰键监听，再按平台注册 globalShortcut */
function applyAllHotkeys(settings: ReturnType<typeof getSettings>): boolean {
  const hookOk = startModifierTapListener(modifierTapHandlers, {
    voiceTrigger: settings.voiceTrigger
  })
  setModifierTapVoiceTrigger(settings.voiceTrigger)
  registerHardwareHotkeys()
  const ok = registerHotkey(settings.hotkey)
  const screenAskOk = registerScreenAskHotkey(
    settings.screenAskHotkey,
    settings.screenAskEnabled !== false
  )
  // 答题已并入看屏幕：注销遗留 Shift+2 热键，不再注册
  registerScreenQuizHotkey(settings.screenQuizHotkey, false)
  if (!hookOk && process.platform === 'darwin' && macAccessibilityApisAllowed()) {
    maybeWarnAccessibilityOnce()
    startAccessibilityWatch()
  }
  return ok && screenAskOk
}

function setupIpc(): void {
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:isDev', () => isDevBuild)
  ipcMain.handle('app:userDataPath', () => app.getPath('userData'))
  ipcMain.handle('app:openUserData', async () => {
    const dir = app.getPath('userData')
    const err = await shell.openPath(dir)
    return err ? { ok: false as const, error: err } : { ok: true as const }
  })
  ipcMain.handle('updates:catalog', () => getReleasesCatalog())
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      await shell.openExternal(url)
    }
  })
  ipcMain.handle('permissions:mac', () => getMacPermissionSnapshot())
  ipcMain.handle('permissions:openMac', (_e, pane: 'screen' | 'accessibility' | 'microphone') =>
    openMacPrivacyPane(pane)
  )
  ipcMain.handle('permissions:requestMic', () => requestMacMicrophoneAccess())
  ipcMain.handle('permissions:retryAccessibility', () => {
    const trusted = hasMacAccessibility()
    if (!trusted) {
      startAccessibilityWatch()
      return { ok: false, accessibility: false, needsRelaunch: false }
    }
    const ok = applyAllHotkeys(getSettings())
    if (ok || isModifierTapHookRunning()) {
      if (accessibilityWatchTimer) {
        clearInterval(accessibilityWatchTimer)
        accessibilityWatchTimer = null
      }
      return { ok: true, accessibility: true, needsRelaunch: false }
    }
    startAccessibilityWatch()
    return { ok: false, accessibility: true, needsRelaunch: true }
  })
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    saveSettings(settings)
    syncAppLocale(settings)
    const ok = applyAllHotkeys(settings)
    return { ok, hotkey: settings.hotkey }
  })
  ipcMain.handle('membership:requestCode', (_e, phone: string) =>
    membershipRequestCode(getSettings(), String(phone || ''))
  )
  ipcMain.handle('membership:login', (_e, phone: string, code: string) =>
    membershipLogin(getSettings(), String(phone || ''), String(code || ''))
  )
  ipcMain.handle('membership:me', () => membershipGetMe(getSettings()))
  ipcMain.handle('membership:updateProfile', (_e, displayName: string) =>
    membershipUpdateProfile(getSettings(), String(displayName || ''))
  )
  ipcMain.handle(
    'membership:ledger',
    (_e, opts: { days?: number; from?: string; to?: string } | undefined) =>
      membershipGetLedger(getSettings(), opts || {})
  )
  ipcMain.handle('membership:plans', () => membershipGetPlans(getSettings()))
  ipcMain.handle('membership:redeem', (_e, code: string) =>
    membershipRedeem(getSettings(), String(code || ''))
  )
  ipcMain.handle('membership:offlineIntent', (_e, body: unknown) =>
    membershipCreateOfflineIntent(
      getSettings(),
      (body || {}) as { planId?: string; credits?: number; amountCents?: number }
    )
  )
  ipcMain.handle('membership:stripeCheckout', (_e, body: unknown) =>
    membershipCreateStripeCheckout(
      getSettings(),
      (body || {}) as {
        planId?: string
        interval?: 'month' | 'year'
        changeType?: string
        credits?: number
        amountCents?: number
      }
    )
  )
  ipcMain.handle('pipeline:screenAsk', () => toggleScreenAsk({ fromUi: true }))
  ipcMain.handle('screenAsk:askText', (_e, question: string) => askScreenWithText(String(question || '')))
  ipcMain.handle('screenAsk:listSessions', () => listScreenAskSessions())
  ipcMain.handle('screenAsk:getSession', (_e, id: number) => getScreenAskSession(id))
  ipcMain.handle('screenAsk:listMessages', (_e, id: number) => listScreenAskMessages(id))
  ipcMain.handle('screenAsk:delete', (_e, id: number) => {
    if (getActiveScreenAskSessionId() === id) setActiveScreenAskSessionId(null)
    return deleteScreenAskSession(id)
  })
  ipcMain.handle('screenAsk:rename', (_e, id: number, title: string) =>
    renameScreenAskSession(id, title)
  )
  ipcMain.handle('screenAsk:new', () => startNewScreenAskSession())
  ipcMain.handle('screenAsk:setActive', (_e, id: number | null) => {
    setActiveScreenAskSessionId(id)
    return getActiveScreenAskSessionId()
  })
  ipcMain.handle('screenAsk:getActive', () => getActiveScreenAskSessionId())
  ipcMain.handle('screenAsk:readImage', (_e, relativePath: string) =>
    readScreenAskScreenshotDataUrl(relativePath)
  )
  ipcMain.handle('settings:test', async (_e, settings: AppSettings) => {
    return testConnection(settings)
  })
  ipcMain.handle(
    'settings:export',
    async (_e, includeSecrets: boolean) => exportSettingsToFile(Boolean(includeSecrets))
  )
  ipcMain.handle('settings:resetDefaults', async () => {
    const settings = resetSettingsToDefault()
    syncAppLocale(settings)
    const ok = applyAllHotkeys(settings)
    return { ok, settings, hotkey: settings.hotkey }
  })

  ipcMain.handle('contacts:list', () => listContacts())
  ipcMain.handle('contacts:get', (_e, id: number) => getContact(id))
  ipcMain.handle('contacts:update', (_e, id: number, patch: ContactPatch) =>
    updateContact(id, patch)
  )
  ipcMain.handle('contacts:delete', (_e, id: number) => {
    deleteContact(id)
    return true
  })
  ipcMain.handle('contacts:refreshProfile', async (_e, id: number) => {
    const contact = getContact(id)
    if (!contact) throw new Error(t('error.contactMissing'))
    const history = recentMessages(id, 200)
    const settings = getSettings()
    const result = await refreshProfileFromHistory(settings, contact, history)
    const mergeTags = (oldVal: string, next?: string[]): string => {
      const set = new Set(
        oldVal
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
      for (const t of next || []) {
        const x = String(t).trim()
        if (x) set.add(x)
      }
      return [...set].join('，')
    }
    let keyFacts = contact.keyFacts || '[]'
    try {
      const arr = JSON.parse(keyFacts) as { id: string; text: string; createdAt: string }[]
      const existing = new Set(arr.map((a) => a.text))
      const now = new Date().toISOString()
      for (const fact of result.keyFacts || []) {
        const text = String(fact).trim()
        if (!text || existing.has(text)) continue
        arr.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, createdAt: now })
        existing.add(text)
      }
      keyFacts = JSON.stringify(arr.slice(-40))
    } catch {
      // keep
    }
    return updateContact(id, {
      personaTitle: result.personaTitle?.trim() || contact.personaTitle,
      personaPrompt: result.personaPrompt?.trim() || contact.personaPrompt,
      personaTags: mergeTags(contact.personaTags, result.personaTags),
      profileSummary: result.profileSummary?.trim() || contact.profileSummary,
      profileTags: mergeTags(contact.profileTags || contact.tags, result.profileTags),
      tags: mergeTags(contact.tags, result.profileTags),
      keyFacts
    })
  })
  ipcMain.handle('messages:list', (_e, contactId: number, query?: MessageQuery) =>
    listMessages(contactId, query || { limit: 2000 })
  )
  ipcMain.handle('pipeline:run', async () => {
    await runCapturePipeline({ fromUi: true })
    return true
  })
  ipcMain.handle('voice:toggle', async () => {
    await toggleVoiceInput({ fromUi: true })
    return true
  })
  ipcMain.handle('voice:toggleHold', async () => toggleVoiceHold())

  ipcMain.handle('models:dashboard', async () => getModelDashboard())
  ipcMain.handle('models:applySiliconflow', async (_e, apiKey: string) =>
    applySiliconflow(apiKey)
  )
  ipcMain.handle('models:installLocalSuite', async (event) => {
    return installLocalSuite((p) => {
      event.sender.send('models:install-progress', p)
    })
  })
  ipcMain.handle('models:testSlot', async (_e, slot: SlotId) => testSlot(slot))
  ipcMain.handle('models:ensureStreamAsr', async (event) => {
    await ensureStreamAsr((p) => {
      event.sender.send('models:install-progress', {
        phase: 'asr-stream',
        message: p.message,
        percent: p.percent
      })
    })
    return getStreamAsrStatus()
  })

  ipcMain.handle('ollama:status', async () => {
    const s = getSettings()
    return getOllamaStatus(
      s.localModelName || LOCAL_DEFAULTS.textModel,
      s.localVisionModelName || LOCAL_DEFAULTS.visionModel
    )
  })
  ipcMain.handle('ollama:openDownload', async () => {
    await openOllamaDownload()
    return true
  })
  ipcMain.handle('ollama:start', async () => startOllama())
  ipcMain.handle('ollama:installModels', async (event) => {
    const s = getSettings()
    const textModel = s.localModelName || LOCAL_DEFAULTS.textModel
    const visionModel = s.localVisionModelName || LOCAL_DEFAULTS.visionModel
    await ensureLocalModels(textModel, visionModel, (p: PullProgress) => {
      event.sender.send('ollama:pull-progress', p)
    })
    return getOllamaStatus(textModel, visionModel)
  })
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.typenow.app')
  }

  migrateUserDataFromLegacy()
  initDb()
  const settings = getSettings()
  syncAppLocale(settings)
  setupTray({
    getMainWindow: () => mainWindow,
    onVoice: () => void toggleVoiceInput({ fromUi: true }),
    onAiTalk: () => void toggleVoiceHold(),
    onReply: () => void runCapturePipeline({ fromUi: true }),
    onScreenAsk: () => void toggleScreenAsk({ fromUi: true }),
    onQuit: () => {
      appQuitting = true
      app.quit()
    }
  })
  setupIpc()
  createWindow()
  setScreenAskUpdateHandler((sessionId) => {
    mainWindow?.webContents.send('screenAsk:updated', sessionId)
  })

  if (!applyAllHotkeys(settings)) {
    console.warn('Some hotkeys failed to register')
  }

  initEscapeCancel()

  warmupCosyVoice()
  if (settings.voiceAsrMode !== 'cloud') warmupStreamAsr()

  app.on('activate', () => {
    if (!mainWindow) {
      createWindow()
      return
    }
    navigateMainWindow(mainWindow, '/', true)
  })
})

app.on('before-quit', () => {
  appQuitting = true
})

app.on('will-quit', () => {
  if (accessibilityWatchTimer) {
    clearInterval(accessibilityWatchTimer)
    accessibilityWatchTimer = null
  }
  destroyTray()
  disposeEscapeCancel()
  globalShortcut.unregisterAll()
  stopModifierTapListener()
  destroyRecorder()
  destroyHud()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
