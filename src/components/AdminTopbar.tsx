import { Moon, Search, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'
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
        <a href="#" onClick={(e) => e.preventDefault()}>
          תבניות
        </a>
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
        <span className="avatar" aria-label="ישראל שווה">
          יש
        </span>
      </div>
    </header>
  )
}
