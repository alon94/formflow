import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Download, Mail, Play, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import ShareBlock from '../components/ShareBlock'
import { AvatarMenu, ThemeButton } from '../components/AdminTopbar'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

export interface FormShellContext {
  setExportHandler: (fn: (() => void) | null) => void
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
      {children}
    </NavLink>
  )
}

function PublishModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card fade-up"
        role="dialog"
        aria-label="הטופס פורסם"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="סגירה">
          <X size={16} />
        </button>
        <span className="success-circle" style={{ width: 52, height: 52 }}>
          <Check size={26} strokeWidth={3} />
        </span>
        <h2>הטופס פורסם!</h2>
        <p className="modal-sub">שתפו את הקישור, סרקו את ה-QR או הטמיעו באתר</p>
        <ShareBlock />
      </div>
    </div>
  )
}

export default function FormShell() {
  const { saveState, formStatus, publish, formName, formSlug, formId, loadForm } = useStore()
  const location = useLocation()
  const params = useParams()
  const [showPublish, setShowPublish] = useState(false)
  const exportRef = useRef<(() => void) | null>(null)

  /* the shell owns loading the routed form into the store */
  useEffect(() => {
    if (params.formId) loadForm(params.formId)
  }, [params.formId, loadForm])

  const { data: analytics } = useQuery({
    queryKey: ['analytics', formId],
    queryFn: () => api.getAnalytics(formId),
  })

  const testSend = useMutation({ mutationFn: () => api.testNotification('email') })

  const setExportHandler = useCallback((fn: (() => void) | null) => {
    exportRef.current = fn
  }, [])

  const section = location.pathname.split('/').pop() ?? 'build'
  const published = formStatus === 'published'

  const doPublish = async () => {
    await publish()
    setShowPublish(true)
  }

  const saveLabel =
    saveState === 'saving' ? 'שומר…' : saveState === 'offline' ? 'מקומי בלבד' : 'נשמר ✓'

  const publishButton = (
    <button type="button" className="btn btn-lime" onClick={doPublish}>
      {published ? 'פרסום עדכון' : 'פרסום'}
    </button>
  )

  const actions: Record<string, React.ReactNode> = {
    build: (
      <>
        <span className="save-indicator" role="status">
          {saveLabel}
        </span>
        <Link to={`/f/${formSlug}`} target="_blank" className="btn btn-secondary">
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
      <span className="save-indicator" role="status">
        {saveLabel}
      </span>
    ),
    settings: (
      <>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => testSend.mutate()}
        >
          <Mail size={14} aria-hidden="true" />{' '}
          {testSend.isSuccess ? 'נשלח ✓' : 'שליחת בדיקה'}
        </button>
        <span className="save-indicator" role="status">
          {saveLabel}
        </span>
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

  const ctx: FormShellContext = { setExportHandler }

  return (
    <div className="admin-shell">
      <header className="topbar">
        <Link to="/" aria-label="חזרה לטפסים שלי">
          <LogoMark />
        </Link>
        <div className="breadcrumb">
          <Link to="/">הטפסים שלי ‹</Link>
          <span className="crumb-name">{formName}</span>
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
            תשובות <span className="tab-badge">{analytics?.total ?? 0}</span>
          </TabLink>
        </nav>
        <div className="topbar-actions">
          {actions[section]}
          <ThemeButton />
          <AvatarMenu />
        </div>
      </header>
      <Outlet context={ctx} />
      {showPublish && <PublishModal onClose={() => setShowPublish(false)} />}
    </div>
  )
}
