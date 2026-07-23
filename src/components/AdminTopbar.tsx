import { LogIn, LogOut, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import LogoMark from './LogoMark'

export function ThemeButton() {
  const { theme, toggleTheme } = useStore()
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'מעבר למצב כהה' : 'מעבר למצב בהיר'}
      title={theme === 'light' ? 'מצב כהה' : 'מצב בהיר'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}

export function AvatarMenu() {
  const { user, logout } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0] ?? '')
        .slice(0, 2)
        .join('')
    : 'יש'

  return (
    <span className="avatar-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="avatar"
        aria-label={user ? `תפריט משתמש — ${user.name}` : 'תפריט משתמש'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ border: 0, cursor: 'pointer' }}
      >
        {initials}
      </button>
      {open && (
        <div className="avatar-menu fade-up" role="menu">
          <div className="who">
            <div className="nm">{user?.name ?? 'אורח/ת (דמו)'}</div>
            <div className="em" dir="ltr">
              {user?.email ?? 'לא מחובר/ת'}
            </div>
          </div>
          {user ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                logout()
                setOpen(false)
                navigate('/login')
              }}
            >
              <LogOut size={13} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              התנתקות
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/login')
              }}
            >
              <LogIn size={13} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              התחברות
            </button>
          )}
        </div>
      )}
    </span>
  )
}

interface HomeTopbarProps {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder?: string
}

export default function AdminTopbar({ search, onSearch, searchPlaceholder }: HomeTopbarProps) {
  return (
    <header className="topbar">
      <NavLink to="/" aria-label="FormFlow — דף הבית">
        <LogoMark />
      </NavLink>
      <nav className="topbar-nav" aria-label="ניווט ראשי">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          הטפסים שלי
        </NavLink>
        <NavLink to="/templates" className={({ isActive }) => (isActive ? 'active' : '')}>
          תבניות
        </NavLink>
        <NavLink to="/integrations" className={({ isActive }) => (isActive ? 'active' : '')}>
          אינטגרציות
        </NavLink>
        <a href="#" onClick={(e) => e.preventDefault()}>
          הגדרות Workspace
        </a>
      </nav>
      <div className="topbar-end">
        <label className="search-pill topbar-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder={searchPlaceholder ?? 'חיפוש…'}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="חיפוש"
          />
        </label>
        <ThemeButton />
        <AvatarMenu />
      </div>
    </header>
  )
}
