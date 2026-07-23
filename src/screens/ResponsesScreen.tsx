import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import SubmissionDrawer from '../components/SubmissionDrawer'
import { api, type SubmissionFilters } from '../lib/api'
import { relTime } from '../lib/data'
import { useStore } from '../lib/store'
import type { AnalyticsPayload, HandleStatus } from '../lib/types'
import type { FormShellContext } from './FormShell'

const HANDLE_LABEL: Record<HandleStatus, string> = {
  new: 'חדש',
  in_progress: 'בטיפול',
  done: 'טופל',
}

const CHART_COLORS = {
  light: {
    line: '#0d4ef2',
    fill: '#dce9fb',
    bars: ['#dce9fb', '#a9cbf1', '#6e97e8', '#0d4ef2', '#12265a'],
    donut: ['#0d4ef2', '#a9cbf1', '#ee2bc3'],
    tick: '#7a8aa8',
  },
  dark: {
    line: '#3d6ef7',
    fill: 'rgba(61,110,247,.18)',
    bars: ['#1b2c55', '#2c4f8f', '#3d6ef7', '#7fa4f9', '#a9cbf1'],
    donut: ['#3d6ef7', '#a9cbf1', '#ee2bc3'],
    tick: '#5f739e',
  },
}

const FALLBACK_ANALYTICS: AnalyticsPayload = {
  total: 128,
  today: 14,
  completion: 82,
  avgTime: '2:41',
  nps: 46,
  topSource: { name: 'וואטסאפ', share: 44 },
  timeline: {
    day: [3, 5, 8, 7, 9, 12, 11, 8, 6, 9, 12, 15, 13, 11, 14, 18].map((v, i) => ({
      label: `${String(i + 1).padStart(2, '0')}/07`,
      value: v,
    })),
    week: [
      { label: 'שבוע 1', value: 22 },
      { label: 'שבוע 2', value: 35 },
      { label: 'שבוע 3', value: 41 },
      { label: 'שבוע 4', value: 30 },
    ],
    month: [
      { label: 'אפריל', value: 14 },
      { label: 'מאי', value: 48 },
      { label: 'יוני', value: 66 },
      { label: 'יולי', value: 128 },
    ],
  },
  trackSplit: [
    { name: 'מוצר וניהול', value: 46 },
    { name: 'פיתוח', value: 30 },
    { name: 'עיצוב', value: 24 },
  ],
  workshopInterest: [
    { label: '1', value: 9 },
    { label: '2', value: 16 },
    { label: '3', value: 24 },
    { label: '4', value: 46 },
    { label: '5', value: 33 },
  ],
}

type Range = 'day' | 'week' | 'month'

export default function ResponsesScreen() {
  const { theme, formId } = useStore()
  const { setExportHandler } = useOutletContext<FormShellContext>()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Range>('day')
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const colors = CHART_COLORS[theme]

  const filters: SubmissionFilters = useMemo(
    () => ({ q: search.trim(), track: trackFilter, status: statusFilter }),
    [search, trackFilter, statusFilter],
  )

  const { data: subsData } = useQuery({
    queryKey: ['submissions', formId, filters],
    queryFn: () => api.getSubmissions(formId, filters),
    placeholderData: keepPreviousData,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics', formId],
    queryFn: () => api.getAnalytics(formId),
  })

  const analytics = analyticsData ?? FALLBACK_ANALYTICS
  const submissions = subsData?.items ?? []
  const localMode = (!!subsData || !!analyticsData) && api.isLocalMode()

  /* realtime: server SSE when online, BroadcastChannel across tabs when local */
  const flashTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    }
    const flash = (id: number) => {
      setFlashId(id)
      window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => setFlashId(null), 2500)
    }

    /* cross-tab live updates for the static/local demo */
    let channel: BroadcastChannel | undefined
    try {
      channel = new BroadcastChannel('formflow-events')
      channel.onmessage = (ev: MessageEvent) => {
        if (ev.data?.formId === formId) invalidate()
      }
    } catch {
      /* BroadcastChannel unsupported */
    }

    /* server SSE — skip when we already know there's no backend */
    let source: EventSource | undefined
    if (!api.isLocalMode()) {
      source = new EventSource(api.eventsUrl(formId))
      source.addEventListener('submission.created', (e: MessageEvent) => {
        try {
          const { submission } = JSON.parse(e.data) as { submission: { id: number } }
          flash(submission.id)
        } catch {
          /* ignore malformed frame */
        }
        invalidate()
      })
      source.addEventListener('submission.updated', invalidate)
      source.onerror = () => {
        if (api.isLocalMode()) source?.close()
      }
    }

    return () => {
      window.clearTimeout(flashTimer.current)
      channel?.close()
      source?.close()
    }
  }, [queryClient, formId])

  /* export respects the active filters (spec §4.6.3) */
  useEffect(() => {
    setExportHandler(() => {
      api.downloadExport(formId, filters, 'xlsx').catch(() => {})
    })
    return () => setExportHandler(null)
  }, [formId, filters, setExportHandler])

  return (
    <main className="page-body">
      {localMode && (
        <div className="offline-note">
          מצב דמו מקומי — הנתונים נשמרים בדפדפן זה. שליחות מטאב אחר מתעדכנות כאן חי.
        </div>
      )}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">סה״כ תשובות</div>
          <div className="kpi-value">{analytics.total}</div>
          <div className="kpi-sub positive">{analytics.today}+ היום</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">אחוז השלמה</div>
          <div className="kpi-value blue">{analytics.completion == null ? '—' : `${analytics.completion}%`}</div>
          <div className="kpi-sub">יעד: 75%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">זמן מילוי ממוצע</div>
          <div className="kpi-value">{analytics.avgTime ?? '—'}</div>
          <div className="kpi-sub">דקות</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ציון NPS</div>
          <div className="kpi-value green">{analytics.nps == null ? '—' : `+${analytics.nps}`}</div>
          <div className="kpi-sub">62% Promoters</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">מקור תנועה מוביל</div>
          <div className="kpi-value small">{analytics.topSource.name}</div>
          <div className="kpi-sub">{analytics.topSource.share}% מהתשובות</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-head">
            <div className="chart-title">תשובות לאורך זמן</div>
            <div className="seg" role="tablist" aria-label="טווח זמן">
              {(
                [
                  ['day', 'יום'],
                  ['week', 'שבוע'],
                  ['month', 'חודש'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={range === id}
                  className={range === id ? 'active' : ''}
                  onClick={() => setRange(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 150, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.timeline[range]}
                margin={{ top: 6, left: 0, right: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11.5, fill: colors.tick, fontFamily: 'Assistant' }}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis hide domain={[0, 'dataMax + 3']} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.line}
                  strokeWidth={3}
                  fill={colors.fill}
                  fillOpacity={1}
                  isAnimationActive={true}
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {analytics.trackSplit.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">התפלגות מסלולים</div>
          <div className="donut-wrap">
            <div className="donut-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.trackSplit}
                    dataKey="value"
                    innerRadius={34}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {analytics.trackSplit.map((entry, i) => (
                      <Cell key={entry.name} fill={colors.donut[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">{analytics.total}</div>
            </div>
            <div className="donut-legend">
              {analytics.trackSplit.map((t, i) => (
                <div key={t.name}>
                  <span className="swatch" style={{ background: colors.donut[i] }} />
                  {t.name} · {t.value}%
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {analytics.workshopInterest.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">דירוג עניין בסדנאות</div>
          <div style={{ height: 118, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* reversed so the 1→5 scale reads right-to-left like the rest of the UI */}
              <BarChart
                data={[...analytics.workshopInterest].reverse()}
                margin={{ top: 4, left: 8, right: 8, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11.5, fill: colors.tick, fontFamily: 'Assistant' }}
                />
                <YAxis hide />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                  {[...analytics.workshopInterest].reverse().map((entry) => (
                    <Cell key={entry.label} fill={colors.bars[Number(entry.label) - 1]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">ממוצע 3.8 · חציון 4</div>
        </div>
        )}
      </div>

      <div className="subs-table">
        <div className="subs-filters">
          <label className="search-pill">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="חיפוש חופשי בתשובות…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="חיפוש חופשי בתשובות"
            />
          </label>
          <select
            className="filter-select"
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            aria-label="סינון לפי מסלול"
          >
            <option value="all">מסלול ▾</option>
            <option value="מוצר וניהול">מוצר וניהול</option>
            <option value="פיתוח והנדסה">פיתוח והנדסה</option>
            <option value="עיצוב ו-UX">עיצוב ו-UX</option>
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="סינון לפי סטטוס טיפול"
          >
            <option value="all">סטטוס טיפול ▾</option>
            <option value="new">חדש</option>
            <option value="in_progress">בטיפול</option>
            <option value="done">טופל</option>
          </select>
          <button
            type="button"
            className="filter-select"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Calendar size={13} aria-hidden="true" /> 01–17 ביולי <ChevronDown size={12} />
          </button>
          <span className="subs-cols">
            עמודות <ChevronDown size={13} />
          </span>
        </div>
        <div className="thead" role="row">
          <div>#</div>
          <div>שם מלא</div>
          <div>מייל</div>
          <div>מסלול</div>
          <div>תגיות</div>
          <div>סטטוס</div>
          <div>נשלח</div>
        </div>
        {submissions.map((s) => (
          <div
            key={s.id}
            className={`trow clickable${s.id === flashId ? ' is-new row-flash' : ''}`}
            role="row"
            tabIndex={0}
            onClick={() => setOpenId(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setOpenId(s.id)
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="sub-id">{s.id}</div>
            <div className="sub-name">{s.name}</div>
            <div className="sub-email" dir="ltr">
              {s.email}
            </div>
            <div>{s.track}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {s.tags.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              ) : (
                s.tags.map((t) => (
                  <span key={t.text} className={`tag-chip ${t.color}`}>
                    {t.text}
                  </span>
                ))
              )}
            </div>
            <div>
              <span className={`handle-chip ${s.status}`}>{HANDLE_LABEL[s.status]}</span>
            </div>
            <div className="sub-sent">{relTime(s.submittedAt)}</div>
          </div>
        ))}
        {submissions.length === 0 && (
          <div className="subs-empty">אין תשובות התואמות לסינון</div>
        )}
      </div>

      {openId !== null && <SubmissionDrawer id={openId} onClose={() => setOpenId(null)} />}
    </main>
  )
}
