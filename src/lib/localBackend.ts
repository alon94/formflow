/**
 * Client-side backend — a localStorage-backed mirror of the API used when no
 * server is reachable (static hosting like Vercel). It keeps the demo fully
 * functional per browser: multiple workspaces, multi-form CRUD, submissions,
 * analytics, versions and webhook logs. Reuses the exact seed + rules +
 * validation modules the server uses, so behavior matches.
 */
import { buildSeedDb } from '../../shared/seed.js'
import { computeFillState, runSubmitActions, skippedPages } from '../../shared/rules.js'
import { validateSubmission } from '../../shared/validate.js'
import type {
  AnalyticsPayload,
  FormDoc,
  FormField,
  FormStatus,
  LogicRule,
  NotifState,
  NotificationEntry,
  Submission,
  SubmissionDetail,
  WebhookLog,
} from './types'
import type { FormListItem, NewFormInput, PublicFormDoc, SessionInfo } from './api'
import { SubmitValidationError } from './api'

const DB_KEY = 'formflow.local-db'
const USER_KEY = 'formflow.user'
const CONFERENCE_ID = 'conf-2026'

interface Workspace {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
  members: string[]
  createdAt: string
  businessName?: string
  phone?: string
  domain?: string
  goal?: string
  website?: string
}

interface LocalForm extends FormDoc {
  workspaceId: string
  folder: string
  icon: string
}

interface LocalSubmission extends Submission {
  formId: string
}

interface LocalDb {
  workspaces: Workspace[]
  forms: LocalForm[]
  submissions: LocalSubmission[]
  notifications: NotificationEntry[]
  webhookLogs: WebhookLog[]
  versions: { id: string; formId: string; at: string; fields: FormField[] }[]
  nextSubmissionId: number
  baseline: { total: number; completion: number; avgTime: string; nps: number }
}

function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'form'}-${Math.random().toString(36).slice(2, 6)}`
}

function loadDb(): LocalDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw) as LocalDb
      if (db.workspaces && db.forms) return db
    }
  } catch {
    /* fall through to seed */
  }
  const seeded = buildSeedDb() as unknown as LocalDb
  localStorage.setItem(DB_KEY, JSON.stringify(seeded))
  return seeded
}

function saveDb(db: LocalDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function currentUser(): { email: string; name: string } {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) return JSON.parse(raw) as { email: string; name: string }
  } catch {
    /* ignore */
  }
  return { email: 'guest@formflow.local', name: 'אורח/ת' }
}

function resolveWorkspace(db: LocalDb, opts?: { name?: string; create?: boolean }): Workspace {
  const { email, name } = currentUser()
  let ws = db.workspaces.find((w) => w.members.includes(email) || w.ownerEmail === email)
  if (!ws && opts?.create !== false) {
    ws = {
      id: rid('ws'),
      name: `ה-Workspace של ${opts?.name ?? name}`,
      ownerEmail: email,
      ownerName: opts?.name ?? name,
      members: [email],
      createdAt: new Date().toISOString(),
    }
    db.workspaces.push(ws)
    saveDb(db)
  }
  return ws!
}

function toListItem(db: LocalDb, form: LocalForm): FormListItem {
  const count = db.submissions.filter((s) => s.formId === form.id).length
  const isConf = form.id === CONFERENCE_ID
  const last = db.submissions
    .filter((s) => s.formId === form.id)
    .reduce<string | null>((m, s) => (!m || s.submittedAt > m ? s.submittedAt : m), null)
  return {
    id: form.id,
    slug: form.slug,
    name: form.name,
    folder: form.folder ?? 'כללי',
    icon: form.icon ?? 'file',
    status: form.status,
    version: form.version,
    responses: isConf ? db.baseline.total + count : count,
    completion: isConf ? db.baseline.completion : count > 0 ? 100 : null,
    lastResponseAt: last,
  }
}

function deriveIdentity(fields: FormField[], values: Record<string, string>) {
  const byType = (t: string) => fields.find((f) => f.type === t)
  const first = values['first_name'] ?? ''
  const last = values['last_name'] ?? ''
  let name = `${first} ${last}`.trim()
  if (!name) {
    const texts = fields.filter((f) => f.type === 'short_text').slice(0, 2)
    name = texts.map((f) => values[f.fieldKey] ?? '').join(' ').trim() || 'ממלא/ת אנונימי/ת'
  }
  const emailField = byType('email')
  const email = emailField ? (values[emailField.fieldKey] ?? '') : ''
  const trackField =
    fields.find((f) => f.fieldKey === 'track') ??
    fields.find((f) => f.type === 'radio' && (f.options?.length ?? 0) >= 3)
  const track = trackField ? (values[trackField.fieldKey] ?? '—') : '—'
  return { name, email, track }
}

function pushVersion(db: LocalDb, formId: string, fields: FormField[]) {
  db.versions.unshift({ id: rid('ver'), formId, at: new Date().toISOString(), fields })
  const forThis = db.versions.filter((v) => v.formId === formId).slice(0, 50)
  db.versions = forThis.concat(db.versions.filter((v) => v.formId !== formId))
}

const BASELINE_TRACKS: Record<string, number> = {
  'מוצר וניהול': 55,
  'פיתוח והנדסה': 37,
  'עיצוב ו-UX': 28,
}
const BASE_TIMELINE = [3, 5, 8, 7, 9, 12, 11, 8, 6, 9, 12, 15, 13, 11, 14, 18]

async function delay<T>(value: T): Promise<T> {
  return value
}

export const localBackend = {
  createSession(_email: string, name: string): Promise<SessionInfo> {
    const db = loadDb()
    /* the caller already wrote USER_KEY, so resolveWorkspace targets this user */
    const ws = resolveWorkspace(db, { name, create: true })
    return delay({ workspace: ws, formsCount: db.forms.filter((f) => f.workspaceId === ws.id).length })
  },

  updateWorkspace(patch: Partial<Workspace>): Promise<Workspace> {
    const db = loadDb()
    const ws = resolveWorkspace(db, { create: true })
    Object.assign(ws, patch)
    saveDb(db)
    return delay(ws)
  },

  getForms(): Promise<FormListItem[]> {
    const db = loadDb()
    const ws = resolveWorkspace(db, { create: true })
    return delay(db.forms.filter((f) => f.workspaceId === ws.id).map((f) => toListItem(db, f)))
  },

  createForm(input: NewFormInput): Promise<FormDoc> {
    const db = loadDb()
    const ws = resolveWorkspace(db, { create: true })
    const form: LocalForm = {
      id: rid('form'),
      workspaceId: ws.id,
      slug: slugify(input.name),
      name: input.name,
      folder: input.folder ?? 'כללי',
      icon: input.icon ?? 'file',
      status: 'draft',
      version: 1,
      fields: input.fields,
      rules: [],
      notif: input.notif,
      branding: input.branding,
      webhooks: [],
      settings: input.settings,
    }
    db.forms.push(form)
    pushVersion(db, form.id, input.fields)
    saveDb(db)
    return delay(form)
  },

  getForm(idOrSlug: string): Promise<FormDoc> {
    const db = loadDb()
    const ws = resolveWorkspace(db, { create: true })
    const form = db.forms.find(
      (f) => (f.id === idOrSlug || f.slug === idOrSlug) && f.workspaceId === ws.id,
    )
    if (!form) throw new Error('form not found')
    return delay(form)
  },

  getPublicForm(slug: string): Promise<PublicFormDoc> {
    const db = loadDb()
    const form = db.forms.find((f) => f.slug === slug || f.id === slug)
    if (!form || form.status === 'closed') throw new Error('form not found')
    const { id, name, fields, rules, branding, settings, status } = form
    return delay({ id, slug: form.slug, name, fields, rules, branding, settings, status })
  },

  patchForm(formId: string, patch: Partial<FormDoc>): Promise<FormDoc> {
    const db = loadDb()
    const form = db.forms.find((f) => f.id === formId || f.slug === formId)
    if (!form) throw new Error('form not found')
    let fieldsChanged = false
    for (const key of ['fields', 'rules', 'notif', 'branding', 'webhooks', 'settings', 'name'] as const) {
      if (patch[key] !== undefined) {
        if (key === 'fields' && JSON.stringify(form.fields) !== JSON.stringify(patch.fields)) {
          fieldsChanged = true
        }
        // @ts-expect-error dynamic assign of known keys
        form[key] = patch[key]
      }
    }
    if (fieldsChanged) pushVersion(db, form.id, form.fields)
    saveDb(db)
    return delay(form)
  },

  publishForm(formId: string): Promise<FormDoc> {
    const db = loadDb()
    const form = db.forms.find((f) => f.id === formId)
    if (!form) throw new Error('form not found')
    form.status = 'published' as FormStatus
    form.version += 1
    saveDb(db)
    return delay(form)
  },

  deleteForm(formId: string, withRecords: boolean): Promise<{ ok: boolean }> {
    const db = loadDb()
    if (withRecords) {
      const subIds = new Set(db.submissions.filter((s) => s.formId === formId).map((s) => s.id))
      db.notifications = db.notifications.filter((n) => !subIds.has(n.submissionId ?? -1))
      db.submissions = db.submissions.filter((s) => s.formId !== formId)
    }
    db.webhookLogs = db.webhookLogs.filter((l) => l.formId !== formId)
    db.versions = db.versions.filter((v) => v.formId !== formId)
    db.forms = db.forms.filter((f) => f.id !== formId)
    saveDb(db)
    return delay({ ok: true })
  },

  getSubmissions(
    formId: string,
    f: { q: string; track: string; status: string },
  ): Promise<{ items: Submission[]; total: number }> {
    const db = loadDb()
    const items = db.submissions
      .filter((s) => {
        if (s.formId !== formId) return false
        if (f.q) {
          const hay = `${s.name} ${s.email} ${Object.values(s.values ?? {}).join(' ')}`
          if (!hay.includes(f.q)) return false
        }
        if (f.track !== 'all' && s.track !== f.track) return false
        if (f.status !== 'all' && s.status !== f.status) return false
        return true
      })
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
    return delay({ items, total: items.length })
  },

  getSubmission(id: number): Promise<SubmissionDetail> {
    const db = loadDb()
    const sub = db.submissions.find((s) => s.id === id)
    if (!sub) throw new Error('not found')
    return delay({ ...sub, notifications: db.notifications.filter((n) => n.submissionId === id) })
  },

  patchSubmission(id: number, patch: Partial<Submission>): Promise<Submission> {
    const db = loadDb()
    const sub = db.submissions.find((s) => s.id === id)
    if (!sub) throw new Error('not found')
    Object.assign(sub, patch)
    saveDb(db)
    return delay(sub)
  },

  deleteSubmission(id: number): Promise<{ ok: boolean }> {
    const db = loadDb()
    db.notifications = db.notifications.filter((n) => n.submissionId !== id)
    db.submissions = db.submissions.filter((s) => s.id !== id)
    saveDb(db)
    return delay({ ok: true })
  },

  postSubmission(
    formIdOrSlug: string,
    values: Record<string, string>,
  ): Promise<{ submission: Submission; notifications: NotificationEntry[] }> {
    const db = loadDb()
    const form = db.forms.find((f) => f.id === formIdOrSlug || f.slug === formIdOrSlug)
    if (!form) throw new Error('form not found')
    const fields = form.fields
    const rules = form.rules as LogicRule[]
    const { hiddenFieldKeys } = computeFillState(fields, rules, values)
    const skipped = skippedPages(fields, rules, values)
    const errors = validateSubmission(fields, values, hiddenFieldKeys, skipped)
    for (const field of fields) {
      if (!field.unique || errors[field.fieldKey]) continue
      const v = String(values[field.fieldKey] ?? '').trim()
      if (
        v &&
        db.submissions.some(
          (s) => s.formId === form.id && String(s.values?.[field.fieldKey] ?? '') === v,
        )
      ) {
        errors[field.fieldKey] = 'הערך כבר נשלח בעבר בטופס זה'
      }
    }
    if (Object.keys(errors).length > 0) throw new SubmitValidationError(errors)

    const { routes, tags, assigns } = runSubmitActions(rules, values)
    const identity = deriveIdentity(fields, values)
    const submission: LocalSubmission = {
      id: db.nextSubmissionId++,
      formId: form.id,
      values,
      ...identity,
      tags,
      assignedTo: assigns[0] ?? null,
      status: 'new',
      notes: '',
      submittedAt: new Date().toISOString(),
    }
    db.submissions.unshift(submission)

    const created: NotificationEntry[] = []
    const notify = (channel: 'email' | 'sms', recipient: string, note: string) => {
      const entry: NotificationEntry = {
        id: rid('ntf'),
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
    const notif = form.notif as NotifState
    if (notif.confirmEnabled && identity.email) notify('email', identity.email, 'מייל אישור לממלא')
    if (notif.ownerEnabled) {
      const recipients = [...new Set([...(notif.recipients ?? []), ...routes])]
      for (const r of recipients) {
        notify('email', r, routes.includes(r) ? 'ניתוב לפי כלל לוגיקה' : 'מייל התראה לבעל הטופס')
      }
    }
    /* webhook log */
    for (const wh of form.webhooks ?? []) {
      if (!wh.active || !wh.events.includes('submission.created')) continue
      db.webhookLogs.unshift({
        id: rid('whl'),
        formId: form.id,
        webhookId: wh.id,
        submissionId: submission.id,
        event: 'submission.created',
        status: 200,
        attempt: 1,
        payload: JSON.stringify({ event: 'submission.created', submission: { id: submission.id, values } }),
        at: new Date().toISOString(),
      })
    }
    saveDb(db)
    /* cross-tab live update for the dashboard */
    try {
      new BroadcastChannel('formflow-events').postMessage({ type: 'submission.created', formId: form.id })
    } catch {
      /* BroadcastChannel unsupported — dashboard updates on next load */
    }
    return delay({ submission, notifications: created })
  },

  getAnalytics(formId: string): Promise<AnalyticsPayload> {
    const db = loadDb()
    const subs = db.submissions.filter((s) => s.formId === formId)
    const count = subs.length
    const isConf = formId === CONFERENCE_ID
    if (isConf) {
      const liveCount = count - 4
      const total = db.baseline.total + count
      const timeline = BASE_TIMELINE.map((v, i, arr) => ({
        label: `${String(i + 1).padStart(2, '0')}/07`,
        value: i === arr.length - 1 ? v + Math.max(0, liveCount) : v,
      }))
      const trackCounts: Record<string, number> = { ...BASELINE_TRACKS }
      for (const s of subs) if (s.track in trackCounts) trackCounts[s.track] += 1
      const trackTotal = Object.values(trackCounts).reduce((a, b) => a + b, 0)
      const names: Record<string, string> = {
        'מוצר וניהול': 'מוצר וניהול',
        'פיתוח והנדסה': 'פיתוח',
        'עיצוב ו-UX': 'עיצוב',
      }
      let acc = 0
      const split = Object.entries(trackCounts).map(([k, v], i, arr) => {
        let pct: number
        if (i === arr.length - 1) pct = 100 - acc
        else {
          pct = Math.round((v / trackTotal) * 100)
          acc += pct
        }
        return { name: names[k], value: pct }
      })
      return delay({
        total,
        today: 14 + Math.max(0, liveCount),
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
    }

    /* generic form — real numbers */
    const daily: Record<string, number> = {}
    for (const s of subs) {
      const day = s.submittedAt.slice(0, 10)
      daily[day] = (daily[day] ?? 0) + 1
    }
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
    const trackCounts: Record<string, number> = {}
    for (const s of subs) if (s.track && s.track !== '—') trackCounts[s.track] = (trackCounts[s.track] ?? 0) + 1
    const trackTotal = Object.values(trackCounts).reduce((a, b) => a + b, 0)
    const split =
      trackTotal > 0
        ? Object.entries(trackCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, c]) => ({ name: k, value: Math.round((c / trackTotal) * 100) }))
        : []
    return delay({
      total: count,
      today,
      completion: null,
      avgTime: null,
      nps: null,
      topSource: { name: 'קישור ישיר', share: 100 },
      timeline: { day: dayLabels, week: [], month: [] },
      trackSplit: split,
      workshopInterest: [],
    })
  },

  getVersions(formId: string) {
    const db = loadDb()
    return delay(
      db.versions
        .filter((v) => v.formId === formId)
        .map((v) => ({ id: v.id, at: v.at, fieldCount: v.fields.length })),
    )
  },

  getVersion(_formId: string, id: string) {
    const db = loadDb()
    const v = db.versions.find((x) => x.id === id)
    if (!v) throw new Error('version not found')
    return delay({ id: v.id, at: v.at, fields: v.fields })
  },

  getWebhookLogs(formId: string): Promise<WebhookLog[]> {
    const db = loadDb()
    return delay(db.webhookLogs.filter((l) => l.formId === formId).slice(0, 50))
  },

  retryWebhookLog(id: string): Promise<WebhookLog> {
    const db = loadDb()
    const original = db.webhookLogs.find((l) => l.id === id)
    if (!original) throw new Error('not found')
    const entry: WebhookLog = {
      ...original,
      id: rid('whl'),
      status: 200,
      attempt: original.attempt + 1,
      at: new Date().toISOString(),
    }
    db.webhookLogs.unshift(entry)
    saveDb(db)
    return delay(entry)
  },

  testNotification(channel: 'email' | 'sms'): Promise<NotificationEntry> {
    const db = loadDb()
    const ws = resolveWorkspace(db, { create: true })
    const entry: NotificationEntry = {
      id: rid('ntf-test'),
      submissionId: null,
      channel,
      recipient: channel === 'email' ? ws.ownerEmail : '050-•••0000',
      status: 'delivered',
      note: 'שליחת בדיקה',
      at: new Date().toISOString(),
    }
    return delay(entry)
  },

  reset() {
    localStorage.removeItem(DB_KEY)
  },
}

export type LocalBackend = typeof localBackend
