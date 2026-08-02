/**
 * FormFlow API server â multi-tenant edition.
 * Workspaces (customers) are resolved from the authenticated user's email;
 * every admin route is scoped to the caller's workspace, public routes
 * (form rendering + submit + SSE) are open by design.
 * Storage via adapters (SQLite default, JSON fallback) per spec ch.6.
 */
import express from 'express'
import ExcelJS from 'exceljs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeFillState, runSubmitActions, skippedPages } from '../shared/rules.js'
import { validateSubmission } from '../shared/validate.js'
import { FORM_ID as CONFERENCE_ID } from '../shared/seed.js'
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

/* ---------- SSE (scoped per form) ---------- */
const sseClients = new Map() /* formId -> Set<res> */

function broadcast(formId, event, data) {
  const clients = sseClients.get(formId)
  if (!clients) return
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) res.write(frame)
}

/* ---------- helpers ---------- */
function deriveIdentity(fields, values) {
  const byType = (t) => fields.find((f) => f.type === t)
  const first = values['first_name'] ?? ''
  const last = values['last_name'] ?? ''
  let name = `${first} ${last}`.trim()
  if (!name) {
    const texts = fields.filter((f) => f.type === 'short_text').slice(0, 2)
    name = texts.map((f) => values[f.fieldKey] ?? '').join(' ').trim() || '××××/×ª ×× ×× ×××/×ª'
  }
  const email = byType('email') ? (values[byType('email').fieldKey] ?? '') : ''
  const trackField =
    fields.find((f) => f.fieldKey === 'track') ??
    fields.find((f) => f.type === 'radio' && (f.options?.length ?? 0) >= 3)
  const track = trackField ? (values[trackField.fieldKey] ?? 'â') : 'â'
  return { name, email, track }
}

function deliverWebhooks(form, event, submission) {
  for (const wh of form.webhooks ?? []) {
    if (!wh.active || !wh.events.includes(event)) continue
    store.insertWebhookLog({
      id: `whl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      formId: form.id,
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
    })
  }
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9Ö-×¿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'form'}-${Math.random().toString(36).slice(2, 6)}`
}

const filterParams = (req) => ({
  q: (req.query.q ?? '').toString().trim(),
  track: (req.query.track ?? 'all').toString(),
  status: (req.query.status ?? 'all').toString(),
})

const BASELINE_TRACKS = { '×××¦×¨ ×× ××××': 55, '×¤××ª×× ××× ××¡×': 37, '×¢××¦×× ×-UX': 28 }
const BASE_TIMELINE = [3, 5, 8, 7, 9, 12, 11, 8, 6, 9, 12, 15, 13, 11, 14, 18]

/* ---------- app ---------- */
const app = express()
app.use(express.json({ limit: '1mb' }))

const api = express.Router()
app.use('/api/v1', api)

/* auth: resolve workspace from the user email header (demo-grade session) */
function requireAuth(req, res, next) {
  const email = (req.headers['x-user-email'] ?? '').toString().trim().toLowerCase()
  if (!email) return res.status(401).json({ error: 'not authenticated' })
  const ws = store.workspaceForEmail(email)
  if (!ws) return res.status(401).json({ error: 'no workspace for user' })
  req.workspace = ws
  next()
}

/* admin form access: must belong to the caller's workspace */
function requireForm(req, res, next) {
  const form = store.getForm(req.params.id)
  if (!form || form.workspaceId !== req.workspace.id) {
    return res.status(404).json({ error: 'form not found' })
  }
  req.form = form
  next()
}

api.post('/auth/session', (req, res) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase()
  const name = (req.body?.name ?? '').toString().trim() || email.split('@')[0]
  if (!email.includes('@')) return res.status(400).json({ error: 'invalid email' })
  let ws = store.workspaceForEmail(email)
  if (!ws) {
    ws = store.createWorkspace({
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `×-Workspace ×©× ${name}`,
      ownerEmail: email,
      ownerName: name,
      members: [email],
      createdAt: new Date().toISOString(),
    })
  }
  res.json({ workspace: ws, formsCount: store.listForms(ws.id).length })
})

/* persist the customer's onboarding profile onto their workspace */
api.patch('/workspaces/current', requireAuth, (req, res) => {
  const updated = store.updateWorkspace(req.workspace.id, req.body ?? {})
  res.json(updated ?? req.workspace)
})

/* ---- workspaces (multi-business per user) ---- */
api.get('/workspaces', requireAuth, (req, res) => {
  const email = req.workspace.ownerEmail
  const list = store.listWorkspacesForEmail
    ? store.listWorkspacesForEmail(email)
    : [req.workspace]
  res.json(list)
})

api.post('/workspaces', requireAuth, (req, res) => {
  const { name, businessName, phone, domain, goal, website } = req.body ?? {}
  const label = (name ?? businessName ?? '').toString().trim()
  if (!label) return res.status(400).json({ error: 'name required' })
  const email = req.workspace.ownerEmail
  const ws = store.createWorkspace({
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: label,
    ownerEmail: email,
    ownerName: req.workspace.ownerName ?? email,
    members: [email],
    createdAt: new Date().toISOString(),
  })
  if (businessName || phone || domain || goal || website) {
    store.updateWorkspace(ws.id, { businessName, phone, domain, goal, website })
  }
  res.status(201).json(store.getWorkspace ? store.getWorkspace(ws.id) : ws)
})

function requireOwnedWorkspace(req, res, next) {
  const target = store.getWorkspace ? store.getWorkspace(req.params.id) : null
  const email = req.workspace.ownerEmail
  if (!target || (target.ownerEmail !== email && !target.members?.includes(email))) {
    return res.status(404).json({ error: 'workspace not found' })
  }
  req.targetWorkspace = target
  next()
}

api.patch('/workspaces/:id', requireAuth, requireOwnedWorkspace, (req, res) => {
  const updated = store.updateWorkspace(req.params.id, req.body ?? {})
  res.json(updated ?? req.targetWorkspace)
})

api.delete('/workspaces/:id', requireAuth, requireOwnedWorkspace, (req, res) => {
  if (!store.deleteWorkspace) return res.status(501).json({ error: 'not supported' })
  const ok = store.deleteWorkspace(req.params.id)
  if (!ok) return res.status(404).json({ error: 'workspace not found' })
  res.status(204).end()
})

/* ---- custom templates (per-business + global) ---- */
function templateScope(req) {
  return req.workspace.id
}

api.get('/templates', requireAuth, (req, res) => {
  res.json(store.listTemplates(templateScope(req)))
})

api.post('/templates', requireAuth, (req, res) => {
  const { name, description, icon, category, scope, fields } = req.body ?? {}
  if (!name || !Array.isArray(fields)) {
    return res.status(400).json({ error: 'name and fields required' })
  }
  const now = new Date().toISOString()
  const tpl = store.createTemplate({
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: scope === 'global' ? null : req.workspace.id,
    scope: scope === 'global' ? 'global' : 'workspace',
    name,
    description: description ?? '',
    icon: icon ?? 'file',
    category: category ?? '',
    fields,
    createdAt: now,
    updatedAt: now,
  })
  res.status(201).json(tpl)
})

function requireTemplate(req, res, next) {
  const tpl = store.getTemplate(req.params.id)
  const scoped = tpl && (tpl.scope === 'global' || tpl.workspaceId === req.workspace.id)
  if (!scoped) return res.status(404).json({ error: 'template not found' })
  req.template = tpl
  next()
}

api.patch('/templates/:id', requireAuth, requireTemplate, (req, res) => {
  const updated = store.updateTemplate(req.params.id, req.body ?? {})
  res.json(updated ?? req.template)
})

api.delete('/templates/:id', requireAuth, requireTemplate, (req, res) => {
  const ok = store.deleteTemplate(req.params.id)
  if (!ok) return res.status(404).json({ error: 'template not found' })
  res.status(204).end()
})

api.post('/templates/:id/duplicate', requireAuth, requireTemplate, (req, res) => {
  const src = req.template
  const now = new Date().toISOString()
  const copy = store.createTemplate({
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: req.workspace.id,
    scope: 'workspace',
    name: (req.body?.name ?? `${src.name} (עותק)`).toString(),
    description: src.description ?? '',
    icon: src.icon ?? 'file',
    category: src.category ?? '',
    fields: src.fields ?? [],
    createdAt: now,
    updatedAt: now,
  })
  res.status(201).json(copy)
})

/* ---- forms (workspace-scoped) ---- */
api.get('/forms', requireAuth, (req, res) => {
  const forms = store.listForms(req.workspace.id).map((form) => {
    const count = store.submissionCount(form.id)
    const isConf = form.id === CONFERENCE_ID
    return {
      id: form.id,
      slug: form.slug,
      name: form.name,
      folder: form.folder ?? '××××',
      icon: form.icon ?? 'file',
      status: form.status,
      version: form.version,
      responses: isConf ? store.getBaseline().total + count : count,
      completion: isConf ? store.getBaseline().completion : count > 0 ? 100 : null,
      lastResponseAt: store.latestSubmissionAt(form.id),
    }
  })
  res.json(forms)
})

api.post('/forms', requireAuth, (req, res) => {
  const { name, folder, icon, fields, notif, branding, settings } = req.body ?? {}
  if (!name || !Array.isArray(fields)) return res.status(400).json({ error: 'name and fields required' })
  const form = {
    id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: req.workspace.id,
    slug: slugify(name),
    name,
    folder: folder ?? '××××',
    icon: icon ?? 'file',
    status: 'draft',
    version: 1,
    fields,
    rules: [],
    notif,
    branding,
    webhooks: [],
    settings,
  }
  store.createForm(form)
  store.pushVersion(form.id, fields)
  res.status(201).json(form)
})

api.get('/forms/:id', requireAuth, requireForm, (req, res) => {
  res.json(req.form)
})

api.patch('/forms/:id', requireAuth, requireForm, (req, res) => {
  const form = req.form
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
  if (fieldsChanged) store.pushVersion(form.id, form.fields)
  res.json(form)
})

api.delete('/forms/:id', requireAuth, requireForm, (req, res) => {
  const withSubmissions = req.query.records === 'true'
  store.deleteForm(req.form.id, { withSubmissions })
  res.json({ ok: true, deletedRecords: withSubmissions })
})

/* assign an existing form to another business (workspace) owned by the caller */
api.patch('/forms/:id/workspace', requireAuth, requireForm, (req, res) => {
  const targetId = (req.body?.workspaceId ?? '').toString()
  const email = req.workspace.ownerEmail
  const target = store.getWorkspace ? store.getWorkspace(targetId) : null
  if (!target || (target.ownerEmail !== email && !target.members?.includes(email))) {
    return res.status(404).json({ error: 'workspace not found' })
  }
  const form = { ...req.form, workspaceId: targetId }
  store.saveForm(form)
  res.json({ id: form.id, workspaceId: targetId })
})

api.post('/forms/:id/publish', requireAuth, requireForm, (req, res) => {
  const form = req.form
  form.status = 'published'
  form.version += 1
  form.publishedAt = new Date().toISOString()
  store.saveForm(form)
  res.json(form)
})

api.get('/forms/:id/versions', requireAuth, requireForm, (req, res) => {
  res.json(store.listVersions(req.form.id))
})

api.get('/forms/:id/versions/:vid', requireAuth, requireForm, (req, res) => {
  const v = store.getVersion(req.params.vid)
  if (!v || v.formId !== req.form.id) return res.status(404).json({ error: 'version not found' })
  res.json(v)
})

/* ---- public form rendering (no auth): only what the renderer needs ---- */
api.get('/public/forms/:slug', (req, res) => {
  const form = store.getForm(req.params.slug)
  if (!form || form.status === 'closed') return res.status(404).json({ error: 'form not found' })
  const { id, slug, name, fields, rules, branding, settings, status } = form
  res.json({ id, slug, name, fields, rules, branding, settings, status })
})

/* ---- submissions ---- */
api.get('/forms/:id/submissions', requireAuth, requireForm, (req, res) => {
  const items = store.listSubmissions(req.form.id, filterParams(req))
  res.json({ items, total: items.length })
})

api.get('/submissions/:id', requireAuth, (req, res) => {
  const sub = store.getSubmission(Number(req.params.id))
  const form = sub && store.getForm(sub.formId)
  if (!sub || !form || form.workspaceId !== req.workspace.id) {
    return res.status(404).json({ error: 'not found' })
  }
  res.json({ ...sub, notifications: store.notificationsFor(sub.id) })
})

api.patch('/submissions/:id', requireAuth, (req, res) => {
  const sub = store.getSubmission(Number(req.params.id))
  const form = sub && store.getForm(sub.formId)
  if (!sub || !form || form.workspaceId !== req.workspace.id) {
    return res.status(404).json({ error: 'not found' })
  }
  const { status, notes, tags } = req.body ?? {}
  const patch = {}
  if (status !== undefined) patch.status = status
  if (notes !== undefined) patch.notes = notes
  if (tags !== undefined) patch.tags = tags
  const next = store.updateSubmission(sub.id, patch)
  broadcast(form.id, 'submission.updated', { submission: next })
  deliverWebhooks(form, 'submission.updated', next)
  res.json(next)
})

api.delete('/submissions/:id', requireAuth, (req, res) => {
  const sub = store.getSubmission(Number(req.params.id))
  const form = sub && store.getForm(sub.formId)
  if (!sub || !form || form.workspaceId !== req.workspace.id) {
    return res.status(404).json({ error: 'not found' })
  }
  store.deleteSubmission(sub.id)
  broadcast(form.id, 'submission.deleted', { id: sub.id })
  res.json({ ok: true })
})

/* public submit â server-side validation is the source of truth (spec Â§4.2, Â§8.2) */
api.post('/forms/:id/submissions', (req, res) => {
  const form = store.getForm(req.params.id)
  if (!form || form.status === 'closed') return res.status(404).json({ error: 'form not found' })
  const values = req.body?.values ?? {}
  const { fields, rules } = form

  const { hiddenFieldKeys } = computeFillState(fields, rules, values)
  const skipped = skippedPages(fields, rules, values)
  const errors = validateSubmission(fields, values, hiddenFieldKeys, skipped)

  for (const field of fields) {
    if (!field.unique || errors[field.fieldKey]) continue
    const v = String(values[field.fieldKey] ?? '').trim()
    if (v && store.hasValue(form.id, field.fieldKey, v)) {
      errors[field.fieldKey] = '××¢×¨× ×××¨ × ×©×× ××¢××¨ ××××¤×¡ ××'
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ errors })
  }

  const { routes, tags, assigns } = runSubmitActions(rules, values)
  const identity = deriveIdentity(fields, values)
  const submission = {
    id: store.nextSubmissionId(),
    formId: form.id,
    values,
    ...identity,
    tags,
    assignedTo: assigns[0] ?? null,
    status: 'new',
    notes: '',
    submittedAt: new Date().toISOString(),
  }
  store.insertSubmission(submission)

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
  const notif = form.notif ?? {}
  if (notif.confirmEnabled && identity.email) notify('email', identity.email, '×××× ×××©××¨ ×××××')
  if (notif.ownerEnabled) {
    const recipients = [...new Set([...(notif.recipients ?? []), ...routes])]
    for (const r of recipients) {
      notify('email', r, routes.includes(r) ? '× ××ª×× ××¤× ××× ×××××§×' : '×××× ××ª×¨×× ×××¢× ××××¤×¡')
    }
  }

  deliverWebhooks(form, 'submission.created', submission)
  broadcast(form.id, 'submission.created', { submission })
  res.status(201).json({ submission, notifications: created })
})

/* ---- analytics (per form; the seeded conference keeps its showcase baseline) ---- */
api.get('/forms/:id/analytics', requireAuth, requireForm, (req, res) => {
  const form = req.form
  const count = store.submissionCount(form.id)
  const isConf = form.id === CONFERENCE_ID
  const baseline = store.getBaseline()

  if (isConf) {
    const liveCount = count - 4
    const total = baseline.total + count
    const timeline = BASE_TIMELINE.map((v, i, arr) => ({
      label: `${String(i + 1).padStart(2, '0')}/07`,
      value: i === arr.length - 1 ? v + Math.max(0, liveCount) : v,
    }))
    const trackCounts = { ...BASELINE_TRACKS }
    for (const [track, c] of Object.entries(store.trackCounts(form.id))) {
      if (track in trackCounts) trackCounts[track] += c
    }
    const trackTotal = Object.values(trackCounts).reduce((a, b) => a + b, 0)
    const names = { '×××¦×¨ ×× ××××': '×××¦×¨ ×× ××××', '×¤××ª×× ××× ××¡×': '×¤××ª××', '×¢××¦×× ×-UX': '×¢××¦××' }
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
    return res.json({
      total,
      today: 14 + Math.max(0, liveCount),
      completion: baseline.completion,
      avgTime: baseline.avgTime,
      nps: baseline.nps,
      topSource: { name: '×××××¡××¤', share: 44 },
      timeline: {
        day: timeline,
        week: [
          { label: '×©×××¢ 1', value: 22 },
          { label: '×©×××¢ 2', value: 35 },
          { label: '×©×××¢ 3', value: 41 },
          { label: '×©×××¢ 4', value: 30 + Math.max(0, liveCount) },
        ],
        month: [
          { label: '××¤×¨××', value: 14 },
          { label: '×××', value: 48 },
          { label: '××× ×', value: 66 },
          { label: '××××', value: total },
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
  }

  /* generic form: real numbers only */
  const daily = store.dailyCounts(form.id, 16)
  const dayLabels = []
  for (let i = 15; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    dayLabels.push({
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      value: daily[key] ?? 0,
    })
  }
  const today = daily[new Date().toISOString().slice(0, 10)] ?? 0
  const tracks = Object.entries(store.trackCounts(form.id)).filter(([k]) => k !== 'â')
  const trackTotal = tracks.reduce((a, [, c]) => a + c, 0)
  const split =
    trackTotal > 0
      ? tracks
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, c]) => ({ name: k, value: Math.round((c / trackTotal) * 100) }))
      : []
  res.json({
    total: count,
    today,
    completion: null,
    avgTime: null,
    nps: null,
    topSource: { name: '×§××©××¨ ××©××¨', share: 100 },
    timeline: {
      day: dayLabels,
      week: [],
      month: [],
    },
    trackSplit: split,
    workshopInterest: [],
  })
})

/* ---- export ---- */
api.get('/forms/:id/export', requireAuth, requireForm, async (req, res) => {
  const form = req.form
  const items = store.listSubmissions(form.id, filterParams(req))
  const statusLabel = { new: '×××©', in_progress: '××××¤××', done: '×××¤×' }
  const fields = form.fields

  if (req.query.format === 'csv') {
    const header = ['#', '×©× ×××', '××××', ...fields.map((f) => f.label), '×ª××××ª', '×¡××××¡', '× ×©××']
    const rows = items.map((s) => [
      s.id,
      s.name,
      s.email,
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
    return res.send('ï»¿' + csv)
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('×ª×©××××ª', { views: [{ rightToLeft: true }] })
  ws.columns = [
    { header: '#', key: 'id', width: 8 },
    { header: '×©× ×××', key: 'name', width: 18 },
    { header: '××××', key: 'email', width: 26 },
    ...fields.map((f) => ({ header: f.label, key: f.fieldKey, width: 22 })),
    { header: '×ª××××ª', key: 'tags', width: 14 },
    { header: '×¡××××¡', key: 'status', width: 10 },
    { header: '× ×©××', key: 'submittedAt', width: 22 },
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
      ...Object.fromEntries(fields.map((f) => [f.fieldKey, s.values?.[f.fieldKey] ?? ''])),
      tags: s.tags.map((t) => t.text).join(' | '),
      status: statusLabel[s.status],
      submittedAt: new Date(s.submittedAt).toLocaleString('he-IL'),
    })
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="formflow-responses.xlsx"')
  await wb.xlsx.write(res)
  res.end()
})

/* ---- webhooks ---- */
api.get('/forms/:id/webhook-logs', requireAuth, requireForm, (req, res) => {
  res.json(store.listWebhookLogs(req.form.id))
})

api.post('/webhook-logs/:id/retry', requireAuth, (req, res) => {
  const original = store.getWebhookLog(req.params.id)
  const form = original && store.getForm(original.formId)
  if (!original || !form || form.workspaceId !== req.workspace.id) {
    return res.status(404).json({ error: 'not found' })
  }
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

api.post('/notifications/test', requireAuth, (req, res) => {
  const channel = req.body?.channel === 'sms' ? 'sms' : 'email'
  const entry = {
    id: `ntf-test-${Date.now()}`,
    submissionId: null,
    channel,
    recipient: channel === 'email' ? req.workspace.ownerEmail : '050-â¢â¢â¢0000',
    status: 'delivered',
    note: '×©××××ª ××××§×',
    at: new Date().toISOString(),
  }
  store.insertNotification(entry)
  res.status(201).json(entry)
})

/* dev helper â reset to seed state (used by the E2E suite) */
api.post('/__reset', (_req, res) => {
  store.reset()
  res.json({ ok: true, store: store.kind })
})

/* SSE â public per-form stream */
api.get('/forms/:id/events', (req, res) => {
  const form = store.getForm(req.params.id)
  if (!form) return res.status(404).end()
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  res.write('retry: 3000\n\n')
  if (!sseClients.has(form.id)) sseClients.set(form.id, new Set())
  sseClients.get(form.id).add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  req.on('close', () => {
    clearInterval(ping)
    sseClients.get(form.id)?.delete(res)
  })
})

app.listen(PORT, () => {
  console.log(`FormFlow API listening on http://localhost:${PORT} (store: ${store.kind})`)
})
