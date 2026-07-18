import {
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
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminTopbar from '../components/AdminTopbar'
import { api } from '../lib/api'
import { FORM_ID, relTime, seedForms } from '../lib/data'
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

export default function HomeScreen() {
  const navigate = useNavigate()
  const { onboardingDone, completeOnboarding, user } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  /* live counters for the demo form come from the API; the rest are static examples */
  const { data: serverForms } = useQuery({ queryKey: ['forms'], queryFn: api.getForms })

  const forms = useMemo(() => {
    const live = serverForms?.find((f) => f.id === FORM_ID)
    if (!live) return seedForms
    return seedForms.map((f) =>
      f.id === FORM_ID
        ? {
            ...f,
            status: live.status as FormStatus,
            responses: live.responses,
            completion: live.completion,
            lastResponse: live.lastResponseAt ? relTime(live.lastResponseAt) : f.lastResponse,
          }
        : f,
    )
  }, [serverForms])

  const filtered = useMemo(
    () =>
      forms.filter(
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
          {filtered.map((form) => {
            const isDemo = form.id === FORM_ID
            return (
              <div
                key={form.id}
                className={`trow${isDemo ? ' clickable' : ''}`}
                role="row"
                onClick={isDemo ? () => navigate(`/form/${FORM_ID}/build`) : undefined}
              >
                <div className="form-name-cell">
                  <span className="icon-tile">{ICONS[form.icon]}</span>
                  <div>
                    <div className="name">{form.name}</div>
                    <div className="meta">{form.folder}</div>
                  </div>
                </div>
                <div>
                  <span className={`status-chip ${form.status}`}>
                    {STATUS_LABEL[form.status]}
                  </span>
                </div>
                <div className={form.responses == null ? 'cell-empty' : 'cell-strong'}>
                  {form.responses == null ? '—' : form.responses.toLocaleString('en-US')}
                </div>
                <div className={form.completion == null ? 'cell-empty' : 'cell-completion'}>
                  {form.completion == null ? '—' : `${form.completion}%`}
                </div>
                <div className="cell-muted">{form.lastResponse}</div>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`תשובות — ${form.name}`}
                    onClick={
                      isDemo ? () => navigate(`/form/${FORM_ID}/responses`) : undefined
                    }
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
                    onClick={
                      form.slug ? () => window.open(`/f/${form.slug}`, '_blank') : undefined
                    }
                  >
                    <Link2 size={16} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`עוד פעולות — ${form.name}`}>
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="home-empty">לא נמצאו טפסים תואמים לסינון הנוכחי</div>
          )}
        </div>
      </main>
    </div>
  )
}
