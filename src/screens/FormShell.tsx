import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, Download, Mail, Play, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { ThemeButton } from '../components/AdminTopbar'
import { api } from '../lib/api'
import { FORM_NAME, FORM_SLUG } from '../lib/data'
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
  const publicUrl = `${window.location.origin}/f/${FORM_SLUG}`
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 148,
      color: { dark: '#12265a', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [publicUrl])

  const embed = `<iframe src="${publicUrl}" width="100%" height="720" style="border:0;border-radius:16px" title="${FORM_NAME}"></iframe>`

  const copy = (text: string, which: 'link' | 'embed') => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(which)
    window.setTimeout(() => setCopied(null), 1800)
  }

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
        <div className="share-row">
          <span className="share-link mono" dir="ltr">
            {publicUrl}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => copy(publicUrl, 'link')}>
            <Copy size={13} aria-hidden="true" /> {copied === 'link' ? 'הועתק ✓' : 'העתקה'}
          </button>
          <Link className="btn btn-secondary" to={`/f/${FORM_SLUG}`} target="_blank">
            פתיחה
          </Link>
        </div>
        {qr && (
          <div className="qr-box">
            <img src={qr} alt={`קוד QR לטופס ${FORM_NAME}`} width={148} height={148} />
            <span>סריקה למילוי מהנייד</span>
          </div>
        )}
        <div className="embed-box">
          <div className="embed-head">
            <span className="field-label">קוד הטמעה (iframe)</span>
            <button type="button" className="mini-copy" onClick={() => copy(embed, 'embed')}>
              {copied === 'embed' ? 'הועתק ✓' : 'העתקת הקוד'}
            </button>
          </div>
          <code className="embed-code" dir="ltr">
            {embed}
          </code>
        </div>
      </div>
    </div>
  )
}

export default function FormShell() {
  const { saveState, formStatus, publish } = useStore()
  const location = useLocation()
  const [showPublish, setShowPublish] = useState(false)
  const exportRef = useRef<(() => void) | null>(null)

  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.getAnalytics,
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
        <Link to={`/f/${FORM_SLUG}`} target="_blank" className="btn btn-secondary">
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
            תשובות <span className="tab-badge">{analytics?.total ?? 128}</span>
          </TabLink>
        </nav>
        <div className="topbar-actions">
          {actions[section]}
          <ThemeButton />
        </div>
      </header>
      <Outlet context={ctx} />
      {showPublish && <PublishModal onClose={() => setShowPublish(false)} />}
    </div>
  )
}
