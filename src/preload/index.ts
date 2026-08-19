import { contextBridge, ipcRenderer } from 'electron'
import {
  AppSettings,
  Contact,
  MessageQuery,
  OllamaStatus,
  PullProgress,
  ScreenAskMessage,
  ScreenAskSession
} from '../shared/types'
import type { SlotId } from '../shared/model-slots'
import type { ReleasesCatalog } from '../shared/releases'

const api = {
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  isDev: (): Promise<boolean> => ipcRenderer.invoke('app:isDev'),
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('app:userDataPath'),
  openUserData: (): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('app:openUserData'),
  getReleasesCatalog: (): Promise<ReleasesCatalog> => ipcRenderer.invoke('updates:catalog'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getMacPermissions: (): Promise<{
    screen: string
    microphone: string
    accessibility: boolean
  }> => ipcRenderer.invoke('permissions:mac'),
  openMacPrivacy: (pane: 'screen' | 'accessibility' | 'microphone'): Promise<void> =>
    ipcRenderer.invoke('permissions:openMac', pane),
  requestMacMicrophone: (): Promise<boolean> => ipcRenderer.invoke('permissions:requestMic'),
  retryAccessibility: (): Promise<{
    ok: boolean
    accessibility: boolean
    needsRelaunch?: boolean
  }> => ipcRenderer.invoke('permissions:retryAccessibility'),
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
  runScreenAsk: (): Promise<void> => ipcRenderer.invoke('pipeline:screenAsk'),
  askScreenText: (question: string): Promise<boolean> =>
    ipcRenderer.invoke('screenAsk:askText', question),
  listScreenAskSessions: (): Promise<ScreenAskSession[]> =>
    ipcRenderer.invoke('screenAsk:listSessions'),
  getScreenAskSession: (id: number): Promise<ScreenAskSession | null> =>
    ipcRenderer.invoke('screenAsk:getSession', id),
  listScreenAskMessages: (id: number): Promise<ScreenAskMessage[]> =>
    ipcRenderer.invoke('screenAsk:listMessages', id),
  deleteScreenAskSession: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('screenAsk:delete', id),
  renameScreenAskSession: (id: number, title: string): Promise<ScreenAskSession | null> =>
    ipcRenderer.invoke('screenAsk:rename', id, title),
  newScreenAskSession: (): Promise<number> => ipcRenderer.invoke('screenAsk:new'),
  setActiveScreenAskSession: (id: number | null): Promise<number | null> =>
    ipcRenderer.invoke('screenAsk:setActive', id),
  getActiveScreenAskSession: (): Promise<number | null> =>
    ipcRenderer.invoke('screenAsk:getActive'),
  readScreenAskImage: (relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke('screenAsk:readImage', relativePath),
  onScreenAskUpdated: (cb: (sessionId: number) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, sessionId: number): void => cb(sessionId)
    ipcRenderer.on('screenAsk:updated', listener)
    return () => ipcRenderer.removeListener('screenAsk:updated', listener)
  },
  onSkillGuideStep: (cb: (step: { id: string; ok: boolean }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, step: { id: string; ok: boolean }): void =>
      cb(step)
    ipcRenderer.on('skill-guide:step', listener)
    return () => ipcRenderer.removeListener('skill-guide:step', listener)
  },
  toggleVoiceInput: (): Promise<boolean> => ipcRenderer.invoke('voice:toggle'),
  toggleVoiceHold: (): Promise<'started' | 'finished'> => ipcRenderer.invoke('voice:toggleHold'),
  getModelDashboard: () => ipcRenderer.invoke('models:dashboard'),
  applySiliconflow: (apiKey: string) => ipcRenderer.invoke('models:applySiliconflow', apiKey),
  installLocalSuite: () => ipcRenderer.invoke('models:installLocalSuite'),
  ensureStreamAsr: () => ipcRenderer.invoke('models:ensureStreamAsr'),
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
  },
  membershipRequestCode: (phone: string): Promise<void> =>
    ipcRenderer.invoke('membership:requestCode', phone),
  membershipLogin: (
    phone: string,
    code: string
  ): Promise<{ accessToken: string; me: import('../shared/membership').MembershipMe }> =>
    ipcRenderer.invoke('membership:login', phone, code),
  membershipGetMe: (): Promise<import('../shared/membership').MembershipMe> =>
    ipcRenderer.invoke('membership:me'),
  membershipUpdateProfile: (
    displayName: string
  ): Promise<import('../shared/membership').MembershipMe> =>
    ipcRenderer.invoke('membership:updateProfile', displayName),
  membershipGetLedger: (opts?: {
    days?: number
    from?: string
    to?: string
  }): Promise<import('../shared/membership').MembershipLedgerPayload> =>
    ipcRenderer.invoke('membership:ledger', opts || {}),
  membershipGetPlans: (): Promise<unknown> => ipcRenderer.invoke('membership:plans'),
  membershipRedeem: (code: string): Promise<import('../shared/membership').MembershipMe> =>
    ipcRenderer.invoke('membership:redeem', code),
  membershipCreateOfflineIntent: (body: {
    planId?: string
    credits?: number
    amountCents?: number
  }): Promise<{ paymentHint: string; supportContact: string; id: string }> =>
    ipcRenderer.invoke('membership:offlineIntent', body),
  membershipCreateStripeCheckout: (body: {
    planId?: string
    interval?: 'month' | 'year'
    changeType?: string
    credits?: number
    amountCents?: number
  }): Promise<{ id: string; checkoutUrl: string; sessionId: string }> =>
    ipcRenderer.invoke('membership:stripeCheckout', body)
}

contextBridge.exposeInMainWorld('vipChat', api)

export type VipChatApi = typeof api
