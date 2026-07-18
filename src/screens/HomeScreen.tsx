import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Copy,
  FileText,
  FolderPlus,
  GraduationCap,
  Hand,
  Link2,
  MoreHorizontal,
  Phone,
  Plus,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminTopbar from '../components/AdminTopbar'
import { api, type FormListItem } from '../lib/api'
import { relTime } from '../lib/data'
import { useStore } from '../lib/store'
import type { FormStatus } from '../lib/types'

const STATUS_LABEL: Record<FormStatus, string> = {
  published: 'פורסם',
  draft: 'טיוטה',
  closed: 'סגור',
}

const ICONS: Record<string, React.ReactNode> = {
  ticket: <Ticket size={18} />,
  hand: <Hand size={18} />,
  phone: <Phone size={18} />,
  file: <FileText size={18} />,
  graduation: <GraduationCap size={18} />,
}

type Filter = 'all' | FormStatus

/* point 2: deleting a form asks what to do with its records */
function DeleteFormModal({
  form,
  onClose,
}: {
  form: FormListItem
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const del = useMutation({
    mutationFn: (withRecords: boolean) => api.deleteForm(form.id, withRecords),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      onClose()
    },
  })
  const hasRecords = form.responses > 0

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card fade-up"
        role="dialog"
        aria-label={`מחיקת הטופס ${form.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="סגירה">
          <X size={16} />
        </button>
        <span
          className="icon-tile"
          style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--error-bg)', color: 'var(--error)' }}
        >
          <AlertTriangle size={24} />
        </span>
        <h2>מחיקת «{form.name}»</h2>
        <p className="modal-sub">
          {hasRecords
            ? `לטופס יש ${form.responses.toLocaleString('en-US')} רשומות. למחוק גם אותן?`
            : 'לטופס אין רשומות. הפעולה אינה הפיכה.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {hasRecords && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={del.isPending}
              onClick={() => del.mutate(false)}
            >
              מחיקת הטופס בלבד — הרשומות יישמרו בארכיון
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{ background: 'var(--error)', color: '#fff', padding: '10px 22px', fontWeight: 700 }}
            disabled={del.isPending}
            onClick={() => del.mutate(true)}
          >
            {del.isPending
              ? 'מוחק…'
              : hasRecords
                ? 'מחיקת הטופס וכל הרשומות'
                : 'מחיקה סופית'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { onboardingDone, completeOnboarding, user } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<FormListItem | null>(null)

  useEffect(() => {
    const close = () => setMenuFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const { data: forms, isError } = useQuery({
    queryKey: ['forms'],
    queryFn: api.getForms,
  })

  const filtered = useMemo(
    () =>
      (forms ?? []).filter(
        (f) =>
          (filter === 'all' || f.status === filter) &&
          (search.trim() === '' || f.name.includes(search.trim())),
      ),
    [forms, filter, search],
  )

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'הכל' },
    { id: 'published', label: 'פורסם' },
    { id: 'draft', label: 'טיוטה' },
    { id: 'closed', label: 'סגור' },
  ]

  return (
    <div className="admin-shell">
      <AdminTopbar search={search} onSearch={setSearch} />
      <main className="page-body">
        {!onboardingDone && (
          <div className="onb-banner fade-up">
            <span className="icon-tile">
              <Sparkles size={17} />
            </span>
            <div className="txt">
              <div className="t1">
                {user ? `היי ${user.name.split(' ')[0]}, ` : ''}בואו נשלים את ההגדרה הראשונית
              </div>
              <div className="t2">שלושה צעדים קצרים — שם Workspace, תחום ומטרה ראשונה</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/onboarding')}>
              להתחלה
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="דחיית ההגדרה"
              onClick={completeOnboarding}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {isError && (
          <div className="offline-note">
            שרת ה-API אינו זמין — רשימת הטפסים במצב דמו לקריאה. הריצו{' '}
            <code dir="ltr">npm run server</code>
          </div>
        )}

        <div className="home-title-row">
          <h1>הטפסים שלי</h1>
          <span className="count-chip">{filtered.length} טפסים</span>
          <div className="home-title-actions">
            <button type="button" className="btn btn-secondary">
              <FolderPlus size={15} aria-hidden="true" /> תיקייה חדשה
            </button>
            <button type="button" className="btn btn-lime" onClick={() => navigate('/new')}>
              <Plus size={15} aria-hidden="true" /> טופס חדש
            </button>
          </div>
        </div>

        <div className="home-filters">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip-filter${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <span className="vdivider" aria-hidden="true" />
          <button type="button" className="chip-filter">
            תגית: אירועים <ChevronDown size={12} style={{ verticalAlign: -2 }} />
          </button>
          <span className="home-sort">
            מיון: תשובה אחרונה <ChevronDown size={13} />
          </span>
        </div>

        <div className="forms-table">
          <div className="thead" role="row">
            <div>שם הטופס</div>
            <div>סטטוס</div>
            <div>תשובות</div>
            <div>אחוז השלמה</div>
            <div>תשובה אחרונה</div>
            <div>פעולות</div>
          </div>
          {filtered.map((form) => (
            <div
              key={form.id}
              className="trow clickable"
              role="row"
              onClick={() => navigate(`/form/${form.id}/build`)}
            >
              <div className="form-name-cell">
                <span className="icon-tile">{ICONS[form.icon] ?? ICONS.file}</span>
                <div>
                  <div className="name">{form.name}</div>
                  <div className="meta">תיקייה: {form.folder}</div>
                </div>
              </div>
              <div>
                <span className={`status-chip ${form.status}`}>
                  {STATUS_LABEL[form.status as FormStatus] ?? form.status}
                </span>
              </div>
              <div className={form.responses === 0 ? 'cell-empty' : 'cell-strong'}>
                {form.responses === 0 ? '—' : form.responses.toLocaleString('en-US')}
              </div>
              <div className={form.completion == null ? 'cell-empty' : 'cell-completion'}>
                {form.completion == null ? '—' : `${form.completion}%`}
              </div>
              <div className="cell-muted">
                {form.lastResponseAt ? relTime(form.lastResponseAt) : '—'}
              </div>
              <div
                className="row-actions"
                style={{ position: 'relative' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`תשובות — ${form.name}`}
                  onClick={() => navigate(`/form/${form.id}/responses`)}
                >
                  <BarChart3 size={16} />
                </button>
                <button type="button" className="icon-btn" aria-label={`שכפול — ${form.name}`}>
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`קישור ציבורי — ${form.name}`}
                  onClick={() => window.open(`/f/${form.slug}`, '_blank')}
                >
                  <Link2 size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`עוד פעולות — ${form.name}`}
                  aria-expanded={menuFor === form.id}
                  onClick={() => setMenuFor(menuFor === form.id ? null : form.id)}
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuFor === form.id && (
                  <div className="rule-menu" style={{ top: 26 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuFor(null)
                        navigate(`/form/${form.id}/settings`)
                      }}
                    >
                      הגדרות הטופס
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMenuFor(null)
                        setDeleting(form)
                      }}
                    >
                      <Trash2 size={13} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                      מחיקת הטופס
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="home-empty">
              {forms && forms.length === 0 ? (
                <>
                  אין עדיין טפסים ב-Workspace —{' '}
                  <button
                    type="button"
                    style={{ color: 'var(--link)', fontWeight: 700 }}
                    onClick={() => navigate('/new')}
                  >
                    צרו את הטופס הראשון
                  </button>
                </>
              ) : (
                'לא נמצאו טפסים תואמים לסינון הנוכחי'
              )}
            </div>
          )}
        </div>
      </main>

      {deleting && <DeleteFormModal form={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
