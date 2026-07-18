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
import {
  chartByDay,
  chartByMonth,
  chartByWeek,
  liveSubmissionsPool,
  trackSplit,
  workshopInterest,
} from '../lib/data'
import { useStore } from '../lib/store'
import type { HandleStatus } from '../lib/types'
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

type Range = 'day' | 'week' | 'month'

const RANGE_DATA: Record<Range, { label: string; value: number }[]> = {
  day: chartByDay,
  week: chartByWeek,
  month: chartByMonth,
}

export default function ResponsesScreen() {
  const { submissions, addLiveSubmission, theme } = useStore()
  const { setExportHandler } = useOutletContext<FormShellContext>()
  const [range, setRange] = useState<Range>('day')
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const colors = CHART_COLORS[theme]

  /* simulated realtime feed (WebSocket/SSE in production) */
  const poolIndex = useRef(0)
  useEffect(() => {
    const t = window.setInterval(() => {
      addLiveSubmission(liveSubmissionsPool[poolIndex.current % liveSubmissionsPool.length])
      poolIndex.current += 1
    }, 9000)
    return () => window.clearInterval(t)
  }, [addLiveSubmission])

  const filtered = useMemo(
    () =>
      submissions.filter((s) => {
        const q = search.trim()
        if (q && !s.name.includes(q) && !s.email.includes(q)) return false
        if (trackFilter !== 'all' && s.track !== trackFilter) return false
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        return true
      }),
    [submissions, search, trackFilter, statusFilter],
  )

  /* export respects the active filters (per spec) */
  useEffect(() => {
    setExportHandler(() => {
      const header = ['#', 'שם מלא', 'מייל', 'מסלול', 'תגיות', 'סטטוס', 'נשלח']
      const rows = filtered.map((s) => [
        s.id,
        s.name,
        s.email,
        s.track,
        s.tag?.text ?? '',
        HANDLE_LABEL[s.status],
        s.sentAt,
      ])
      const csv = [header, ...rows]
        .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
        .join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'formflow-responses.csv'
      a.click()
      URL.revokeObjectURL(url)
    })
    return () => setExportHandler(null)
  }, [filtered, setExportHandler])

  const total = submissions.length + 124
  const today = 14 + (submissions.length - 4)

  return (
    <main className="page-body">
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">סה״כ תשובות</div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-sub positive">{today}+ היום</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">אחוז השלמה</div>
          <div className="kpi-value blue">82%</div>
          <div className="kpi-sub">יעד: 75%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">זמן מילוי ממוצע</div>
          <div className="kpi-value">2:41</div>
          <div className="kpi-sub">דקות</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ציון NPS</div>
          <div className="kpi-value green">+46</div>
          <div className="kpi-sub">62% Promoters</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">מקור תנועה מוביל</div>
          <div className="kpi-value small">וואטסאפ</div>
          <div className="kpi-sub">44% מהתשובות</div>
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
              <AreaChart data={RANGE_DATA[range]} margin={{ top: 6, left: 0, right: 0, bottom: 0 }}>
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

        <div className="chart-card">
          <div className="chart-title">התפלגות מסלולים</div>
          <div className="donut-wrap">
            <div className="donut-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trackSplit}
                    dataKey="value"
                    innerRadius={34}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {trackSplit.map((entry, i) => (
                      <Cell key={entry.name} fill={colors.donut[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">{total}</div>
            </div>
            <div className="donut-legend">
              {trackSplit.map((t, i) => (
                <div key={t.name}>
                  <span className="swatch" style={{ background: colors.donut[i] }} />
                  {t.name} · {t.value}%
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">דירוג עניין בסדנאות</div>
          <div style={{ height: 118, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* reversed so the 1→5 scale reads right-to-left like the rest of the UI */}
              <BarChart
                data={[...workshopInterest].reverse()}
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
                  {[...workshopInterest].reverse().map((entry) => (
                    <Cell key={entry.label} fill={colors.bars[Number(entry.label) - 1]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">ממוצע 3.8 · חציון 4</div>
        </div>
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
          <button type="button" className="filter-select" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`trow${s.isNew ? ' is-new row-flash' : ''}`}
            role="row"
          >
            <div className="sub-id">{s.id}</div>
            <div className="sub-name">{s.name}</div>
            <div className="sub-email" dir="ltr">
              {s.email}
            </div>
            <div>{s.track}</div>
            <div>
              {s.tag ? (
                <span className={`tag-chip ${s.tag.color}`}>{s.tag.text}</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
            <div>
              <span className={`handle-chip ${s.status}`}>{HANDLE_LABEL[s.status]}</span>
            </div>
            <div className="sub-sent">{s.sentAt}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="subs-empty">אין תשובות התואמות לסינון</div>
        )}
      </div>
    </main>
  )
}
