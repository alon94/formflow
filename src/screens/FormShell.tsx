import { Download, Mail, Play } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { ThemeButton } from '../components/AdminTopbar'
import { FORM_NAME, FORM_SLUG } from '../lib/data'
import { useStore } from '../lib/store'

export type SaveStatus = 'saved' | 'saving'

export interface FormShellContext {
  saveStatus: SaveStatus
  setSaveStatus: (s: SaveStatus) => void
  setExportHandler: (fn: (() => void) | null) => void
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
      {children}
    </NavLink>
  )
}

export default function FormShell() {
  const { submissions } = useStore()
  const location = useLocation()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [published, setPublished] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const exportRef = useRef<(() => void) | null>(null)

  const setExportHandler = useCallback((fn: (() => void) | null) => {
    exportRef.current = fn
  }, [])

  const section = location.pathname.split('/').pop() ?? 'build'

  const publish = () => {
    setPublished(true)
    setJustPublished(true)
    window.setTimeout(() => setJustPublished(false), 2500)
  }

  const publishButton = (
    <button type="button" className="btn btn-lime" onClick={publish}>
      {justPublished ? 'פורסם ✓' : 'פרסום'}
    </button>
  )

  const actions: Record<string, React.ReactNode> = {
    build: (
      <>
        <span className="save-indicator" role="status">
          {saveStatus === 'saving' ? 'שומר…' : 'נשמר ✓'}
        </span>
        <Link
          to={`/f/${FORM_SLUG}`}
          target="_blank"
          className="btn btn-secondary"
        >
          תצוגה מקדימה
        </Link>
        {publishButton}
      </>
    ),
    logic: (
      <>
        <button type="button" className="btn btn-secondary">
          <Play size={14} aria-hidden="true" /> סימולטור כללים
        </button>
        {publishButton}
      </>
    ),
    design: (
      <button type="button" className="btn btn-lime">
        שמירה
      </button>
    ),
    settings: (
      <>
        <button type="button" className="btn btn-secondary">
          <Mail size={14} aria-hidden="true" /> שליחת בדיקה
        </button>
        <button type="button" className="btn btn-lime">
          שמירה
        </button>
      </>
    ),
    responses: (
      <>
        <span className="live-chip">
          <span className="dot" aria-hidden="true" /> עדכון חי
        </span>
        <button
          type="button"
          className="btn btn-navy"
          onClick={() => exportRef.current?.()}
        >
          <Download size={14} aria-hidden="true" /> ייצוא אקסל
        </button>
      </>
    ),
  }

  const ctx: FormShellContext = { saveStatus, setSaveStatus, setExportHandler }

  return (
    <div className="admin-shell">
      <header className="topbar">
        <Link to="/" aria-label="חזרה לטפסים שלי">
          <LogoMark />
        </Link>
        <div className="breadcrumb">
          <Link to="/">הטפסים שלי ‹</Link>
          <span className="crumb-name">{FORM_NAME}</span>
          <span className={`status-chip ${published ? 'published' : 'draft'}`}>
            {published ? 'פורסם' : 'טיוטה'}
          </span>
        </div>
        <nav className="form-tabs" aria-label="לשוניות הטופס">
          <TabLink to="build">בנייה</TabLink>
          <TabLink to="logic">לוגיקה</TabLink>
          <TabLink to="design">עיצוב</TabLink>
          <TabLink to="settings">הגדרות</TabLink>
          <TabLink to="responses">
            תשובות <span className="tab-badge">{submissions.length + 124}</span>
          </TabLink>
        </nav>
        <div className="topbar-actions">
          {actions[section]}
          <ThemeButton />
        </div>
      </header>
      <Outlet context={ctx} />
    </div>
  )
}
