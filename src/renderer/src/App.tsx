import { NavLink, Route, Routes } from 'react-router-dom'
import { BRAND } from '../../shared/brand'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import ModelsPage from './pages/ModelsPage'
import ContactsPage from './pages/ContactsPage'
import ContactDetailPage from './pages/ContactDetailPage'

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">{BRAND.name}</h1>
        <p className="brand-sub">{BRAND.tagline}</p>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
            首页
          </NavLink>
          <NavLink
            to="/contacts"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            联系人
          </NavLink>
          <NavLink
            to="/models"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            模型
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            设置
          </NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
        </Routes>
      </main>
    </div>
  )
}
