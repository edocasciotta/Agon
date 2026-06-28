import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useAuthStore } from '../store/authStore'
import { SupportChat } from './SupportChat'

export function Layout() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: '📊' },
    { to: '/calendar', label: t('nav.calendar'), icon: '📅' },
    { to: '/class-types', label: t('nav.classTypes'), icon: '🏷️' },
    { to: '/clients', label: t('nav.clients'), icon: '👥' },
    { to: '/memberships', label: t('nav.memberships'), icon: '🎫' },
    { to: '/reports', label: t('nav.reports'), icon: '📈' },
    { to: '/settings', label: t('nav.settings'), icon: '⚙️' },
  ]

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language === 'en' ? 'it' : 'en')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <span className="font-bold text-lg text-indigo-600">Agon</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 space-y-1">
          {/* Language selector */}
          <div className="flex items-center justify-center gap-2 px-3 py-2">
            <button
              onClick={toggleLanguage}
              className="text-xs font-mono text-gray-500 hover:text-indigo-600 transition-colors"
              aria-label="Toggle language"
            >
              {i18n.language === 'en' ? t('lang.it') : t('lang.en')}
            </button>
            <span className="text-gray-300 text-xs">|</span>
            <span className="text-xs font-mono text-indigo-600 font-semibold">
              {i18n.language === 'en' ? t('lang.en') : t('lang.it')}
            </span>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
          >
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
      <SupportChat />
    </div>
  )
}
