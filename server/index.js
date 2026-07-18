/**
 * FormFlow API server — implements the core of spec chapter 7 for the demo:
 * forms, submissions (server-side validation as source of truth), analytics,
 * XLSX/CSV export, webhooks simulation with delivery log, version history
 * and an SSE stream for live dashboard updates.
 *
 * Storage goes through an adapter (spec ch.6 schema): better-sqlite3 when
 * available, JSON file otherwise. Production target is PostgreSQL + JSONB.
 */
import express from 'express'
import ExcelJS from 'exceljs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeFillState, runSubmitActions, skippedPages } from '../shared/rules.js'
import { validateSubmission } from '../shared/validate.js'
import { JsonStore } from './store-json.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? 4000

let store
if (process.env.FORMFLOW_DB === 'json') {
  store = new JsonStore(path.join(__dirname, 'db.json'))
} else {
  try {
    const { SqliteStore } = await import('./store-sqlite.js')
    store = new SqliteStore(path.join(__dirname, 'formflow.db'))
  } catch (err) {
    console.warn('sqlite unavailable, falling back to JSON store:', err.message)
    store = new JsonStore(path.join(__dirname, 'db.json'))
  }
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

/* simulated webhook delivery (spec §4.9.2) — records to the delivery log */
function deliverWebhooks(form, event, submission) {
  const created = []
  for (const wh of form.webhooks ?? []) {
    if (!wh.active || !wh.events.includes(event)) continue
    const entry = {
      id: `whl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      webhookId: wh.id,
      submissionId: submission?.id ?? null,
      event,
      status: 200,
      attempt: 1,
      payload: JSON.stringify({
        event,
        submission: submission
          ? { id: submission.id, track: submission.track, values: submission.values }
          : null,
      }),
      at: new Date().toISOString(),
    }
    store.insertWebhookLog(entry)
    created.push(entry)
  }
  return created
}

const BASELINE_TRACKS = { 'מוצר וניהול': 55, 'פיתוח והנדסה': 37, 'עיצוב ו-UX': 28 }

const BASE_TIMELINE = [3, 5, 8, 7, 9, 12, 11, 8, 6, 9, 12, 15, 13, 11, 14, 18].map((v, i) => ({
  label: `${String(i + 1).padStart(2, '0')}/07`,
  value: v,
}))

const filterParams = (req) => ({
  q: (req.query.q ?? '').toString().trim(),
  track: (req.query.track ?? 'all').toString(),
  status: (req.query.status ?? 'all').toString(),
})

/* ---------- app ---------- */
const app = express()
app.use(express.json({ limit: '1mb' }))

const api = express.Router()
app.use('/api/v1', api)

api.get('/forms', (_req, res) => {
  const form = store.getForm()
  res.json([
    {
      id: form.id,
      slug: form.slug,
      name: form.name,
      status: form.status,
      version: form.version,
      responses: store.getBaseline().total + store.submissionCount(),
      completion: store.getBaseline().completion,
      lastResponseAt: store.latestSubmissionAt(),
    },
  ])
})

api.get('/forms/:id', (req, res) => {
  const form = store.getForm()
  if (req.params.id !== form.id && req.params.id !== form.slug) {
    return res.status(404).json({ error: 'form not found' })
  }
  res.json(form)
})

api.patch('/forms/:id', (req, res) => {
  const form = store.getForm()
  const patch = req.body ?? {}
  let fieldsChanged = false
  for (const key of ['fields', 'rules', 'notif', 'branding', 'webhooks', 'settings', 'name']) {
    if (patch[key] !== undefined) {
      if (key === 'fields' && JSON.stringify(form.fields) !== JSON.stringify(patch.fields)) {
        fieldsChanged = true
      }
      form[key] = patch[key]
    }
  }
  store.saveForm(form)
  /* version history — snapshot on every fields change, capped at 50 (spec §4.1.1) */
  if (fieldsChanged) store.pushVersion(form.id, form.fields)
  res.json(form)
})

api.post('/forms/:id/publish', (_req, res) => {
  const form = store.getForm()
  form.status = 'published'
  form.version += 1
  form.publishedAt = new Date().toISOString()
  store.saveForm(form)
  res.json(form)
})

api.get('/forms/:id/versions', (_req, res) => {
  res.json(store.listVersions(store.getForm().id))
})

api.get('/forms/:id/versions/:vid', (req, res) => {
  const v = store.getVersion(req.params.vid)
  if (!v) return res.status(404).json({ error: 'version not found' })
  res.json(v)
})

api.get('/forms/:id/submissions', (req, res) => {
  const items = store.listSubmissions(filterParams(req))
  res.json({ items, total: items.length })
})

api.get('/submissions/:id', (req, res) => {
  const sub = store.getSubmission(Number(req.params.id))
  if (!sub) return res.status(404).json({ error: 'not found' })
  res.json({ ...sub, notifications: store.notificationsFor(sub.id) })
})

api.patch('/submissions/:id', (req, res) => {
  const { status, notes, tags } = req.body ?? {}
  const patch = {}
  if (status !== undefined) patch.status = status
  if (notes !== undefined) patch.notes = notes
  if (tags !== undefined) patch.tags = tags
  const sub = store.updateSubmission(Number(req.params.id), patch)
  if (!sub) return res.status(404).json({ error: 'not found' })
  broadcast('submission.updated', { submission: sub })
  deliverWebhooks(store.getForm(), 'submission.updated', sub)
  res.json(sub)
})

/* public submit — server-side validation is the source of truth (spec §4.2, §8.2) */
api.post('/forms/:id/submissions', (req, res) => {
  const values = req.body?.values ?? {}
  const form = store.getForm()
  const { fields, rules } = form

  const { hiddenFieldKeys } = computeFillState(fields, rules, values)
  const skipped = skippedPages(fields, rules, values)
  const errors = validateSubmission(fields, values, hiddenFieldKeys, skipped)

  /* uniqueness (spec §4.2.1) */
  for (const field of fields) {
    if (!field.unique || errors[field.fieldKey]) continue
    const v = String(values[field.fieldKey] ?? '').trim()
    if (v && store.hasValue(field.fieldKey, v)) {
      errors[field.fieldKey] = 'הערך כבר נשלח בעבר בטופס זה'
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ errors })
  }

  const { routes, tags, assigns } = runSubmitActions(rules, values)
  const identity = deriveIdentity(fields, values)
  const submission = {
    id: store.nextSubmissionId(),
    values,
    ...identity,
    tags,
    assignedTo: assigns[0] ?? null,
    status: 'new',
    notes: '',
    submittedAt: new Date().toISOString(),
  }
  store.insertSubmission(submission)

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
    store.insertNotification(entry)
    created.push(entry)
  }
  const notif = form.notif
  if (notif.confirmEnabled && identity.email) {
    notify('email', identity.email, 'מייל אישור לממלא')
  }
  if (notif.ownerEnabled) {
    const recipients = [...new Set([...notif.recipients, ...routes])]
    for (const r of recipients) {
      notify('email', r, routes.includes(r) ? 'ניתוב לפי כלל לוגיקה' : 'מייל התראה לבעל הטופס')
    }
  }

  deliverWebhooks(form, 'submission.created', submission)
  broadcast('submission.created', { submission })
  res.status(201).json({ submission, notifications: created })
})

api.get('/forms/:id/analytics', (_req, res) => {
  const baseline = store.getBaseline()
  const count = store.submissionCount()
  const liveCount = count - 4 /* beyond seeds */
  const total = baseline.total + count
  const today = 14 + Math.max(0, liveCount)

  const timeline = BASE_TIMELINE.map((p, i, arr) =>
    i === arr.length - 1 ? { ...p, value: p.value + Math.max(0, liveCount) } : p,
  )

  const trackCounts = { ...BASELINE_TRACKS }
  for (const [track, c] of Object.entries(store.trackCounts())) {
    if (track in trackCounts) trackCounts[track] += c
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
    completion: baseline.completion,
    avgTime: baseline.avgTime,
    nps: baseline.nps,
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
  const items = store.listSubmissions(filterParams(req))
  const statusLabel = { new: 'חדש', in_progress: 'בטיפול', done: 'טופל' }
  const fields = store.getForm().fields

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

api.get('/forms/:id/webhook-logs', (_req, res) => {
  res.json(store.listWebhookLogs())
})

api.post('/webhook-logs/:id/retry', (req, res) => {
  const original = store.getWebhookLog(req.params.id)
  if (!original) return res.status(404).json({ error: 'not found' })
  const entry = {
    ...original,
    id: `whl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    status: 200,
    attempt: original.attempt + 1,
    at: new Date().toISOString(),
  }
  store.insertWebhookLog(entry)
  res.status(201).json(entry)
})

api.post('/notifications/test', (req, res) => {
  const channel = req.body?.channel === 'sms' ? 'sms' : 'email'
  const entry = {
    id: `ntf-test-${Date.now()}`,
    submissionId: null,
    channel,
    recipient: channel === 'email' ? store.getForm().notif.fromAddress : '050-•••0000',
    status: 'delivered',
    note: 'שליחת בדיקה',
    at: new Date().toISOString(),
  }
  store.insertNotification(entry)
  res.status(201).json(entry)
})

/* dev helper — reset the store to seed state (used by the E2E suite) */
api.post('/__reset', (_req, res) => {
  store.reset()
  res.json({ ok: true, store: store.kind })
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
  console.log(`FormFlow API listening on http://localhost:${PORT} (store: ${store.kind})`)
})
