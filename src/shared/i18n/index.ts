import enUS from './catalogs/en-US'
import zhCN from './catalogs/zh-CN'
import type { LocalePreference, MessageKey, ResolvedLocale } from './types'

export type { LocalePreference, MessageKey, ResolvedLocale } from './types'
export { LOCALE_OPTIONS } from './types'

const catalogs: Record<ResolvedLocale, Record<MessageKey, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

let current: ResolvedLocale = 'zh-CN'

export function resolveLocale(
  preference: LocalePreference | string | undefined | null,
  systemLocale?: string
): ResolvedLocale {
  if (preference === 'zh-CN' || preference === 'en-US') return preference
  const sys = (systemLocale || detectSystemLocale()).toLowerCase()
  if (sys.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

export function detectSystemLocale(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language
    }
  } catch {
    /* ignore */
  }
  return process.env.LANG || process.env.LC_ALL || 'en-US'
}

export function getLocale(): ResolvedLocale {
  return current
}

export function setLocale(locale: ResolvedLocale): void {
  current = locale
}

/** Apply preference (+ optional system locale from Electron app.getLocale()). */
export function applyLocalePreference(
  preference: LocalePreference | string | undefined | null,
  systemLocale?: string
): ResolvedLocale {
  const resolved = resolveLocale(preference, systemLocale)
  setLocale(resolved)
  return resolved
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const table = catalogs[current] || zhCN
  let text = table[key] ?? zhCN[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

export type BrandCopy = {
  name: string
  nameEn: string
  dual: string
  tagline: string
  site: string
  voice: { name: string; blurb: string }
  aiTalk: { name: string; blurb: string }
  reply: { name: string; blurb: string }
  screenAsk: { name: string; blurb: string }
  screenQuiz: { name: string; blurb: string }
  trayShort: string
}

export function getBrand(): BrandCopy {
  return {
    name: t('brand.name'),
    nameEn: t('brand.nameEn'),
    dual: t('brand.dual'),
    tagline: t('brand.tagline'),
    site: t('brand.site'),
    voice: { name: t('brand.voice.name'), blurb: t('brand.voice.blurb') },
    aiTalk: { name: t('brand.aiTalk.name'), blurb: t('brand.aiTalk.blurb') },
    reply: { name: t('brand.reply.name'), blurb: t('brand.reply.blurb') },
    screenAsk: {
      name: t('brand.screenAsk.name'),
      blurb: t('brand.screenAsk.blurb')
    },
    screenQuiz: {
      name: t('brand.screenQuiz.name'),
      blurb: t('brand.screenQuiz.blurb')
    },
    trayShort: t('brand.trayShort')
  }
}

/** 窗口标题 / Dock / 托盘：开发版带「（开发）」后缀 */
export function appDisplayTitle(isDev: boolean): string {
  const name = t('brand.name')
  return isDev ? t('brand.devTitle', { name }) : name
}
