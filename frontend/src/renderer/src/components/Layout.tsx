import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useAuthStore } from '../store/authStore'
import { SupportChat } from './SupportChat'
import {
  LayoutDashboard,
  CalendarDays,
  Tag,
  Tags,
  Building2,
  UserRound,
  Users,
  CreditCard,
  Ticket,
  Gift,
  FileCheck,
  TrendingUp,
  Settings2,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  ListFilter,
  LogOut,
  Globe,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
]

export function Layout() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const [langOpen, setLangOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarDays },
    { to: '/class-types', label: t('nav.classTypes'), icon: Tag },
    { to: '/establishments', label: t('nav.establishments'), icon: Building2 },
    { to: '/instructors', label: t('nav.instructors'), icon: UserRound },
    { to: '/clients', label: t('nav.clients'), icon: Users },
    { to: '/memberships', label: t('nav.memberships'), icon: CreditCard },
    { to: '/promo-codes', label: t('nav.promoCodes'), icon: Ticket },
    { to: '/gift-cards', label: t('nav.giftCards'), icon: Gift },
    { to: '/tags', label: t('nav.tags'), icon: Tags },
    { to: '/waivers', label: t('nav.waivers'), icon: FileCheck },
    { to: '/reports', label: t('nav.reports'), icon: TrendingUp },
    { to: '/settings', label: t('nav.settings'), icon: Settings2 },
  ]

  const marketingItems = [
    { to: '/marketing/templates', label: t('marketing.templates'), icon: Mail },
    { to: '/marketing/events', label: t('marketing.events'), icon: Megaphone },
    { to: '/marketing/sms-templates', label: t('nav.smsTemplates'), icon: MessageSquareText },
    { to: '/marketing/sms-events', label: t('nav.smsEvents'), icon: MessageSquare },
    { to: '/marketing/smartlists', label: t('marketing.smartLists'), icon: ListFilter },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <span className="font-bold text-lg text-indigo-600">Agon</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
              <item.icon size={16} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-3 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('marketing.sectionTitle')}
            </p>
          </div>
          {marketingItems.map((item) => (
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
              <item.icon size={16} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 space-y-1">
          {/* Language dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <Globe size={15} strokeWidth={1.75} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-left">{currentLang.label}</span>
              {langOpen ? (
                <ChevronUp size={14} className="text-gray-400 shrink-0" />
              ) : (
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
              )}
            </button>
            {langOpen && (
              <div
                role="listbox"
                className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50"
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    role="option"
                    aria-selected={lang.code === currentLang.code}
                    onClick={() => {
                      void i18n.changeLanguage(lang.code)
                      localStorage.setItem('agon-language', lang.code)
                      setLangOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                      lang.code === currentLang.code
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LogOut size={15} strokeWidth={1.75} className="text-gray-400 shrink-0" />
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
