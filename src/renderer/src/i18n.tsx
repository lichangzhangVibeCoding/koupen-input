import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  appDisplayTitle,
  applyLocalePreference,
  getBrand,
  getLocale,
  t as translate,
  type LocalePreference,
  type MessageKey,
  type ResolvedLocale
} from '../../shared/i18n'

type I18nContextValue = {
  locale: ResolvedLocale
  preference: LocalePreference
  isDev: boolean
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  brand: ReturnType<typeof getBrand>
  setPreference: (pref: LocalePreference) => Promise<void>
  refreshFromSettings: () => Promise<void>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<ResolvedLocale>(() => getLocale())
  const [preference, setPreferenceState] = useState<LocalePreference>('system')
  const [isDev, setIsDev] = useState(false)
  const [tick, setTick] = useState(0)

  const apply = useCallback((pref: LocalePreference, dev = isDev) => {
    const resolved = applyLocalePreference(pref, navigator.language)
    setPreferenceState(pref)
    setLocaleState(resolved)
    setTick((n) => n + 1)
    document.documentElement.lang = resolved
    document.title = appDisplayTitle(dev)
  }, [isDev])

  const refreshFromSettings = useCallback(async () => {
    try {
      const s = await window.vipChat.getSettings()
      apply(s.locale || 'system')
    } catch {
      apply('system')
    }
  }, [apply])

  useEffect(() => {
    void window.vipChat.isDev().then((dev) => {
      setIsDev(dev)
      document.title = appDisplayTitle(dev)
    })
  }, [])

  useEffect(() => {
    void refreshFromSettings()
  }, [refreshFromSettings])

  const setPreference = useCallback(
    async (pref: LocalePreference) => {
      const s = await window.vipChat.getSettings()
      await window.vipChat.saveSettings({ ...s, locale: pref })
      apply(pref)
    },
    [apply]
  )

  const value = useMemo<I18nContextValue>(() => {
    void tick
    return {
      locale,
      preference,
      isDev,
      t: translate,
      brand: getBrand(),
      setPreference,
      refreshFromSettings
    }
  }, [locale, preference, isDev, setPreference, refreshFromSettings, tick])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
