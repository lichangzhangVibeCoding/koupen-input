import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron'
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
import { destroyHud } from './hud'
import { startModifierTapListener, stopModifierTapListener } from './modifier-tap'
import { refreshProfileFromHistory, testConnection } from './llm'
import {
  applySiliconflow,
  getModelDashboard,
  installLocalSuite,
  testSlot
} from './model-service'
import {
  ensureLocalModels,
  getOllamaStatus,
  openOllamaDownload,
  startOllama
} from './ollama'
import type { SlotId } from '../shared/model-slots'
import { runCapturePipeline } from './pipeline'
import {
  exportSettingsToFile,
  resetSettingsToDefault
} from './user-config'
import { destroyRecorder } from './voice-recorder'
import { toggleVoiceInput } from './voice-input'
import { isModifierDoubleHotkey } from '../shared/hotkey'
import { AppSettings, LOCAL_DEFAULTS, MessageQuery, PullProgress } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let registeredHotkey = ''

const isDev = !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: '口喷输入',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerHotkey(hotkey: string): boolean {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey)
    registeredHotkey = ''
  }
  // 修饰键双击（Mac Command / Win Alt）：由 modifier-tap 处理，无需 globalShortcut
  if (isModifierDoubleHotkey(hotkey)) {
    return true
  }
  const ok = globalShortcut.register(hotkey, () => {
    void runCapturePipeline()
  })
  if (ok) registeredHotkey = hotkey
  return ok
}

function setupIpc(): void {
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    saveSettings(settings)
    const ok = registerHotkey(settings.hotkey)
    return { ok, hotkey: settings.hotkey }
  })
  ipcMain.handle('settings:test', async (_e, settings: AppSettings) => {
    return testConnection(settings)
  })
  ipcMain.handle(
    'settings:export',
    async (_e, includeSecrets: boolean) => exportSettingsToFile(Boolean(includeSecrets))
  )
  ipcMain.handle('settings:resetDefaults', async () => {
    const settings = resetSettingsToDefault()
    const ok = registerHotkey(settings.hotkey)
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
    if (!contact) throw new Error('联系人不存在')
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
    await runCapturePipeline()
    return true
  })
  ipcMain.handle('voice:toggle', async () => {
    await toggleVoiceInput()
    return true
  })

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
    app.setAppUserModelId('com.streamer.vipchat')
  }

  initDb()
  setupIpc()
  createWindow()

  const settings = getSettings()
  const ok = registerHotkey(settings.hotkey)
  if (!ok) {
    console.warn('Failed to register hotkey', settings.hotkey)
  }

  // Mac：左 Command 单击/双击；Windows：Alt 单击/双击
  startModifierTapListener({
    onSingleTap: () => {
      void toggleVoiceInput()
    },
    onDoubleTap: () => {
      const s = getSettings()
      if (isModifierDoubleHotkey(s.hotkey)) {
        void runCapturePipeline()
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopModifierTapListener()
  destroyRecorder()
  destroyHud()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
