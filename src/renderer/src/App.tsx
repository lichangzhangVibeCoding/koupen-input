import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import brandIcon from './assets/brand-icon.png'
import AccountCenter from './components/AccountCenter'
import PermissionGuide from './components/PermissionGuide'
import { useI18n } from './i18n'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import ModelsPage from './pages/ModelsPage'
import ContactsPage from './pages/ContactsPage'
import ContactDetailPage from './pages/ContactDetailPage'
import ScreenAskPage from './pages/ScreenAskPage'
import AccountPage from './pages/AccountPage'
import HelpPage from './pages/HelpPage'

const OPEN_PERMISSION_GUIDE = 'typenow:open-permission-guide'

function RailIcon({
  name
}: {
  name: 'home' | 'chats' | 'contacts' | 'models' | 'help' | 'settings'
}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M7 10.5V20h10v-9.5" />
        </svg>
      )
    case 'chats':
      return (
        <svg {...common}>
          <path d="M5 6h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H11l-4 3v-3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
        </svg>
      )
    case 'contacts':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19c1.4-3.2 3.8-4.8 6.5-4.8S17.6 15.8 19 19" />
        </svg>
      )
    case 'models':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M8 9h8M8 12h5M8 15h6" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.2a2.5 2.5 0 1 1 3.2 2.4c-.7.4-1.1.9-1.1 1.7" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6" />
        </svg>
      )
  }
}

export default function App() {
  const { t, brand, isDev } = useI18n()
  const [version, setVersion] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    void window.vipChat.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const [platform, settings] = await Promise.all([
          window.vipChat.getPlatform(),
          window.vipChat.getSettings()
        ])
        if (platform === 'darwin' && !settings.permissionGuideCompleted) {
          setGuideOpen(true)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    const onOpen = (): void => setGuideOpen(true)
    window.addEventListener(OPEN_PERMISSION_GUIDE, onOpen)
    return () => window.removeEventListener(OPEN_PERMISSION_GUIDE, onOpen)
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'rail-link active' : 'rail-link'

  return (
    <div className="app-shell">
      <aside className="rail" aria-label={isDev ? t('brand.devTitle', { name: brand.name }) : brand.name}>
        <div
          className="rail-brand"
          title={`${isDev ? t('brand.devTitle', { name: brand.name }) : brand.name}${version ? ` v${version}` : ''}`}
        >
          <img className="brand-mark" src={brandIcon} alt="" width={28} height={28} aria-hidden />
          {isDev ? <span className="rail-dev-badge">{t('brand.devBadge')}</span> : null}
        </div>
        <nav className="rail-nav">
          <NavLink to="/" end className={linkClass} title={t('nav.home')}>
            <RailIcon name="home" />
            <span>{t('nav.home')}</span>
          </NavLink>
          <NavLink to="/chats" className={linkClass} title={t('nav.chats')}>
            <RailIcon name="chats" />
            <span>{t('nav.chats')}</span>
          </NavLink>
          <NavLink to="/contacts" className={linkClass} title={t('nav.contacts')}>
            <RailIcon name="contacts" />
            <span>{t('nav.contacts')}</span>
          </NavLink>
          <NavLink to="/models" className={linkClass} title={t('nav.models')}>
            <RailIcon name="models" />
            <span>{t('nav.models')}</span>
          </NavLink>
          <NavLink to="/help" className={linkClass} title={t('nav.help')}>
            <RailIcon name="help" />
            <span>{t('nav.help')}</span>
          </NavLink>
          <NavLink to="/settings" className={linkClass} title={t('nav.settings')}>
            <RailIcon name="settings" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </nav>
        <div className="rail-footer">
          <AccountCenter />
          {version || isDev ? (
            <div className="rail-version">
              {isDev ? <span className="rail-dev-tag">{t('brand.devBadge')}</span> : null}
              {version ? <span>v{version}</span> : null}
            </div>
          ) : null}
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/membership" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/updates" element={<Navigate to={{ pathname: '/help', hash: 'changelog' }} replace />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/chats" element={<ScreenAskPage />} />
          <Route path="/chats/:id" element={<ScreenAskPage />} />
        </Routes>
      </main>
      <PermissionGuide open={guideOpen} onFinished={() => setGuideOpen(false)} />
    </div>
  )
}

export { OPEN_PERMISSION_GUIDE }
