/**
 * FormFlow API server — implements the core of spec chapter 7 for the demo:
 * forms, submissions (with server-side validation as source of truth),
 * analytics, XLSX/CSV export and an SSE stream for live dashboard updates.
 * Storage is a JSON file (server/db.json) seeded from shared/seed.js.
 */
import express from 'express'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeedDb } from '../shared/seed.js'
import { computeFillState, runSubmitActions, skippedPages } from '../shared/rules.js'
import { validateSubmission } from '../shared/validate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'db.json')
const PORT = process.env.PORT ?? 4000

/* ---------- storage ---------- */
let db
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
} catch {
  db = buildSeedDb()
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

let saveTimer
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  }, 250)
}

/* ---------- SSE ---------- */
const sseClients = new Set()

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) res.write(frame)
}

/* ---------- helpers ---------- */
function deriveIdentity(fields, values) {
  const byType = (t) => fields.find((f) => f.type === t)
  const first = values['first_name'] ?? ''
  const last = values['last_name'] ?? ''
  let name = `${first} ${last}`.trim()
  if (!name) {
    const texts = fields.filter((f) => f.type === 'short_text').slice(0, 2)
    name = texts.map((f) => values[f.fieldKey] ?? '').join(' ').trim() || 'ממלא/ת אנונימי/ת'
  }
  const email = byType('email') ? (values[byType('email').fieldKey] ?? '') : ''
  const trackField =
    fields.find((f) => f.fieldKey === 'track') ??
    fields.find((f) => f.type === 'radio' && (f.options?.length ?? 0) >= 3)
  const track = trackField ? (values[trackField.fieldKey] ?? '—') : '—'
  return { name, email, track }
}

function filterSubmissions({ q, track, status }) {
  return db.submissions
    .filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.email} ${Object.values(s.values ?? {}).join(' ')}`
        if (!hay.includes(q)) return false
      }
      if (track && track !== 'all' && s.track !== track) return false
      if (status && status !== 'all' && s.status !== status) return false
      return true
    })
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
}

const BASELINE_TRACKS = { 'מוצר וניהול': 57, 'פיתוח והנדסה': 38, 'עיצוב ו-UX': 29 }

const BASE_TIMELINE = [3, 5, 8, 7, 9, 12, 11, 8, 6, 9, 12, 15, 13, 11, 14, 18].map((v, i) => ({
  label: `${String(i + 1).padStart(2, '0')}/07`,
  value: v,
}))

/* ---------- app ---------- */
const app = express()
app.use(express.json({ limit: '1mb' }))

const api = express.Router()
app.use('/api/v1', api)

api.get('/forms', (_req, res) => {
  const last = db.submissions[0]
  res.json([
    {
      id: db.form.id,
      slug: db.form.slug,
      name: db.form.name,
      status: db.form.status,
      version: db.form.version,
      responses: db.baseline.total + db.submissions.length,
      completion: db.baseline.completion,
      lastResponseAt: last?.submittedAt ?? null,
    },
  ])
})

api.get('/forms/:id', (req, res) => {
  if (req.params.id !== db.form.id && req.params.id !== db.form.slug) {
    return res.status(404).json({ error: 'form not found' })
  }
  res.json(db.form)
})

api.patch('/forms/:id', (req, res) => {
  const patch = req.body ?? {}
  for (const key of ['fields', 'rules', 'notif', 'branding', 'name']) {
    if (patch[key] !== undefined) db.form[key] = patch[key]
  }
  persist()
  res.json(db.form)
})

api.post('/forms/:id/publish', (_req, res) => {
  db.form.status = 'published'
  db.form.version += 1
  db.form.publishedAt = new Date().toISOString()
  persist()
  res.json(db.form)
})

api.get('/forms/:id/submissions', (req, res) => {
  const items = filterSubmissions({
    q: (req.query.q ?? '').toString().trim(),
    track: (req.query.track ?? 'all').toString(),
    status: (req.query.status ?? 'all').toString(),
  })
  res.json({ items, total: items.length })
})

api.get('/submissions/:id', (req, res) => {
  const sub = db.submissions.find((s) => s.id === Number(req.params.id))
  if (!sub) return res.status(404).json({ error: 'not found' })
  const notifications = db.notifications.filter((n) => n.submissionId === sub.id)
  res.json({ ...sub, notifications })
})

api.patch('/submissions/:id', (req, res) => {
  const sub = db.submissions.find((s) => s.id === Number(req.params.id))
  if (!sub) return res.status(404).json({ error: 'not found' })
  const { status, notes, tags } = req.body ?? {}
  if (status !== undefined) sub.status = status
  if (notes !== undefined) sub.notes = notes
  if (tags !== undefined) sub.tags = tags
  persist()
  broadcast('submission.updated', { submission: sub })
  res.json(sub)
})

/* public submit — server-side validation is the source of truth (spec §4.2, §8.2) */
api.post('/forms/:id/submissions', (req, res) => {
  const values = req.body?.values ?? {}
  const { fields, rules } = db.form

  const { hiddenFieldKeys } = computeFillState(fields, rules, values)
  const skipped = skippedPages(fields, rules, values)
  const errors = validateSubmission(fields, values, hiddenFieldKeys, skipped)

  /* uniqueness (spec §4.2.1) */
  for (const field of fields) {
    if (!field.unique || errors[field.fieldKey]) continue
    const v = String(values[field.fieldKey] ?? '').trim()
    if (v && db.submissions.some((s) => String(s.values?.[field.fieldKey] ?? '') === v)) {
      errors[field.fieldKey] = 'הערך כבר נשלח בעבר בטופס זה'
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ errors })
  }

  const { routes, tags, assigns } = runSubmitActions(rules, values)
  const identity = deriveIdentity(fields, values)
  const submission = {
    id: db.nextSubmissionId++,
    values,
    ...identity,
    tags,
    assignedTo: assigns[0] ?? null,
    status: 'new',
    notes: '',
    submittedAt: new Date().toISOString(),
  }
  db.submissions.unshift(submission)

  /* notification pipeline (simulated transactional sends, spec §4.4) */
  const created = []
  const notify = (channel, recipient, note) => {
    const entry = {
      id: `ntf-${Date.now()}-${created.length}`,
      submissionId: submission.id,
      channel,
      recipient,
      status: 'delivered',
      note,
      at: new Date().toISOString(),
    }
    db.notifications.unshift(entry)
    created.push(entry)
  }
  const notif = db.form.notif
  if (notif.confirmEnabled && identity.email) {
    notify('email', identity.email, 'מייל אישור לממלא')
  }
  if (notif.ownerEnabled) {
    const recipients = [...new Set([...notif.recipients, ...routes])]
    for (const r of recipients) {
      notify(
        'email',
        r,
        routes.includes(r) ? 'ניתוב לפי כלל לוגיקה' : 'מייל התראה לבעל הטופס',
      )
    }
  }

  persist()
  broadcast('submission.created', { submission })
  res.status(201).json({ submission, notifications: created })
})

api.get('/forms/:id/analytics', (_req, res) => {
  const liveCount = db.submissions.length - 4 /* beyond seeds */
  const total = db.baseline.total + db.submissions.length
  const today = 14 + Math.max(0, liveCount)

  const timeline = BASE_TIMELINE.map((p, i, arr) =>
    i === arr.length - 1 ? { ...p, value: p.value + Math.max(0, liveCount) } : p,
  )

  const trackCounts = { ...BASELINE_TRACKS }
  for (const s of db.submissions) {
    if (s.track in trackCounts) trackCounts[s.track] += 1
  }
  const trackTotal = Object.values(trackCounts).reduce((a, b) => a + b, 0)
  const names = { 'מוצר וניהול': 'מוצר וניהול', 'פיתוח והנדסה': 'פיתוח', 'עיצוב ו-UX': 'עיצוב' }
  let acc = 0
  const split = Object.entries(trackCounts).map(([k, v], i, arr) => {
    let pct
    if (i === arr.length - 1) pct = 100 - acc
    else {
      pct = Math.round((v / trackTotal) * 100)
      acc += pct
    }
    return { name: names[k], value: pct }
  })

  res.json({
    total,
    today,
    completion: db.baseline.completion,
    avgTime: db.baseline.avgTime,
    nps: db.baseline.nps,
    topSource: { name: 'וואטסאפ', share: 44 },
    timeline: {
      day: timeline,
      week: [
        { label: 'שבוע 1', value: 22 },
        { label: 'שבוע 2', value: 35 },
        { label: 'שבוע 3', value: 41 },
        { label: 'שבוע 4', value: 30 + Math.max(0, liveCount) },
      ],
      month: [
        { label: 'אפריל', value: 14 },
        { label: 'מאי', value: 48 },
        { label: 'יוני', value: 66 },
        { label: 'יולי', value: total },
      ],
    },
    trackSplit: split,
    workshopInterest: [
      { label: '1', value: 9 },
      { label: '2', value: 16 },
      { label: '3', value: 24 },
      { label: '4', value: 46 },
      { label: '5', value: 33 },
    ],
  })
})

api.get('/forms/:id/export', async (req, res) => {
  const items = filterSubmissions({
    q: (req.query.q ?? '').toString().trim(),
    track: (req.query.track ?? 'all').toString(),
    status: (req.query.status ?? 'all').toString(),
  })
  const statusLabel = { new: 'חדש', in_progress: 'בטיפול', done: 'טופל' }
  const fields = db.form.fields

  if (req.query.format === 'csv') {
    const header = ['#', 'שם מלא', 'מייל', 'מסלול', ...fields.map((f) => f.label), 'תגיות', 'סטטוס', 'נשלח']
    const rows = items.map((s) => [
      s.id,
      s.name,
      s.email,
      s.track,
      ...fields.map((f) => s.values?.[f.fieldKey] ?? ''),
      s.tags.map((t) => t.text).join(' | '),
      statusLabel[s.status],
      s.submittedAt,
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="formflow-responses.csv"')
    return res.send('﻿' + csv)
  }

  /* XLSX with RTL sheet + styled header (spec §4.6.3) */
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('תשובות', { views: [{ rightToLeft: true }] })
  ws.columns = [
    { header: '#', key: 'id', width: 8 },
    { header: 'שם מלא', key: 'name', width: 18 },
    { header: 'מייל', key: 'email', width: 26 },
    { header: 'מסלול', key: 'track', width: 16 },
    ...fields.map((f) => ({ header: f.label, key: f.fieldKey, width: 22 })),
    { header: 'תגיות', key: 'tags', width: 14 },
    { header: 'סטטוס', key: 'status', width: 10 },
    { header: 'נשלח', key: 'submittedAt', width: 22 },
  ]
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12265A' } }
  head.height = 20
  for (const s of items) {
    ws.addRow({
      id: s.id,
      name: s.name,
      email: s.email,
      track: s.track,
      ...Object.fromEntries(fields.map((f) => [f.fieldKey, s.values?.[f.fieldKey] ?? ''])),
      tags: s.tags.map((t) => t.text).join(' | '),
      status: statusLabel[s.status],
      submittedAt: new Date(s.submittedAt).toLocaleString('he-IL'),
    })
  }
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', 'attachment; filename="formflow-responses.xlsx"')
  await wb.xlsx.write(res)
  res.end()
})

api.post('/notifications/test', (req, res) => {
  const channel = req.body?.channel === 'sms' ? 'sms' : 'email'
  const entry = {
    id: `ntf-test-${Date.now()}`,
    submissionId: null,
    channel,
    recipient: channel === 'email' ? db.form.notif.fromAddress : '050-•••0000',
    status: 'delivered',
    note: 'שליחת בדיקה',
    at: new Date().toISOString(),
  }
  db.notifications.unshift(entry)
  persist()
  res.status(201).json(entry)
})

/* dev helper — reset the store to seed state (used by the E2E suite) */
api.post('/__reset', (_req, res) => {
  db = buildSeedDb()
  persist()
  res.json({ ok: true })
})

api.get('/forms/:id/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  res.write('retry: 3000\n\n')
  sseClients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  req.on('close', () => {
    clearInterval(ping)
    sseClients.delete(res)
  })
})

app.listen(PORT, () => {
  console.log(`FormFlow API listening on http://localhost:${PORT}`)
})
