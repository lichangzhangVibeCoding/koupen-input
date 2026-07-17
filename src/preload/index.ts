import { contextBridge, ipcRenderer } from 'electron'
import {
  AppSettings,
  Contact,
  MessageQuery,
  OllamaStatus,
  PullProgress
} from '../shared/types'
import type { SlotId } from '../shared/model-slots'

const api = {
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (
    settings: AppSettings
  ): Promise<{ ok: boolean; hotkey: string }> => ipcRenderer.invoke('settings:save', settings),
  testSettings: (settings: AppSettings): Promise<string> =>
    ipcRenderer.invoke('settings:test', settings),
  exportSettings: (
    includeSecrets: boolean
  ): Promise<
    | { ok: true; path: string }
    | { ok: false; canceled: true }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('settings:export', includeSecrets),
  resetSettingsDefaults: (): Promise<{
    ok: boolean
    settings: AppSettings
    hotkey: string
  }> => ipcRenderer.invoke('settings:resetDefaults'),
  listContacts: (): Promise<Contact[]> => ipcRenderer.invoke('contacts:list'),
  getContact: (id: number): Promise<Contact | null> => ipcRenderer.invoke('contacts:get', id),
  updateContact: (
    id: number,
    patch: Partial<
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
  ): Promise<Contact | null> => ipcRenderer.invoke('contacts:update', id, patch),
  refreshContactProfile: (id: number): Promise<Contact | null> =>
    ipcRenderer.invoke('contacts:refreshProfile', id),
  deleteContact: (id: number): Promise<boolean> => ipcRenderer.invoke('contacts:delete', id),
  listMessages: (contactId: number, query?: MessageQuery) =>
    ipcRenderer.invoke('messages:list', contactId, query),
  runPipeline: (): Promise<boolean> => ipcRenderer.invoke('pipeline:run'),
  toggleVoiceInput: (): Promise<boolean> => ipcRenderer.invoke('voice:toggle'),
  getModelDashboard: () => ipcRenderer.invoke('models:dashboard'),
  applySiliconflow: (apiKey: string) => ipcRenderer.invoke('models:applySiliconflow', apiKey),
  installLocalSuite: () => ipcRenderer.invoke('models:installLocalSuite'),
  testModelSlot: (slot: SlotId) => ipcRenderer.invoke('models:testSlot', slot),
  onInstallProgress: (
    cb: (p: { phase: string; message: string; percent?: number }) => void
  ): (() => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      p: { phase: string; message: string; percent?: number }
    ): void => cb(p)
    ipcRenderer.on('models:install-progress', listener)
    return () => ipcRenderer.removeListener('models:install-progress', listener)
  },
  getOllamaStatus: (): Promise<OllamaStatus> => ipcRenderer.invoke('ollama:status'),
  openOllamaDownload: (): Promise<boolean> => ipcRenderer.invoke('ollama:openDownload'),
  startOllama: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('ollama:start'),
  installLocalModels: (): Promise<OllamaStatus> => ipcRenderer.invoke('ollama:installModels'),
  onPullProgress: (cb: (p: PullProgress) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, p: PullProgress): void => cb(p)
    ipcRenderer.on('ollama:pull-progress', listener)
    return () => ipcRenderer.removeListener('ollama:pull-progress', listener)
  }
}

contextBridge.exposeInMainWorld('vipChat', api)

export type VipChatApi = typeof api
