/**
 * Supabase backend — a cloud implementation of the same interface as
 * localBackend. Multi-tenant persistence: workspaces (clients), forms and
 * submissions (responses) live in Postgres, with Row Level Security keeping
 * every tenant's data isolated. Public form fetch + submit work anonymously
 * for published forms only.
 */
import { computeFillState, runSubmitActions, skippedPages } from '../../shared/rules.js'
import { validateSubmission } from '../../shared/validate.js'
import { supabase } from './supabase'
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

/* ---------- helpers ---------- */

function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
    .replace(/[\u0590-\u05ff]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'form'}-${Math.random().toString(36).slice(2, 6)}`
}

/** db status <-> app status ('closed' is stored as 'archived') */
const fromDbStatus = (s: string): FormStatus => (s === 'archived' ? 'closed' : (s as FormStatus))

interface FormRow {
  id: string
  client_id: string
  slug: string
  title: string
  status: string
  schema: Record<string, unknown>
  created_at?: string
}

interface ResponseRow {
  id: string
  seq: number
  form_id: string
  client_id: string
  data: {
    values: Record<string, string>
    name: string
    email: string
    track: string
    tags: Submission['tags']
    assignedTo: string | null
    status: Submission['status']
    notes: string
  }
  submitted_at: string
}

function rowToDoc(row: FormRow): FormDoc {
  const s = (row.schema ?? {}) as Partial<FormDoc> & { versions?: unknown }
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    folder: s.folder ?? 'כללי',
    icon: s.icon ?? 'file',
    workspaceId: row.client_id,
    status: fromDbStatus(row.status),
    version: s.version ?? 1,
    publishedAt: s.publishedAt,
    fields: (s.fields ?? []) as FormField[],
    rules: (s.rules ?? []) as LogicRule[],
    notif: (s.notif ?? { confirmEnabled: false, subject: '', fromAddress: '', attachPdf: false, attachIcal: false, ownerEnabled: false, recipients: [], digest: false, smsEnabled: false, smsTemplate: '', smsReminder: false }) as NotifState,
    branding: (s.branding ?? { themeId: 'shaveh', primary: '#0D2C4A', textColor: '#122334', ctaColor: '#C9A961', bgColor: '#F5F7FA', headFont: 'Heebo', bodyFont: 'Heebo', darkMode: 'auto' }) as FormDoc['branding'],
    webhooks: (s.webhooks ?? []) as FormDoc['webhooks'],
    settings: (s.settings ?? { closeAt: '', maxResponses: '', onePerUser: false, passwordProtect: false }) as FormDoc['settings'],
  }
}

type StoredVersion = { id: string; at: string; fields: FormField[] }

function docToSchema(doc: FormDoc, versions: StoredVersion[]): Record<string, unknown> {
  return {
    fields: doc.fields,
    rules: doc.rules,
    notif: doc.notif,
    branding: doc.branding,
    webhooks: doc.webhooks,
    settings: doc.settings,
    folder: doc.folder,
    icon: doc.icon,
    version: doc.version,
    publishedAt: doc.publishedAt,
    versions: versions.slice(0, 20),
  }
}

function rowVersions(row: FormRow): StoredVersion[] {
  const v = (row.schema as { versions?: StoredVersion[] })?.versions
  return Array.isArray(v) ? v : []
}

function rowToSubmission(r: ResponseRow): Submission {
  const d = r.data ?? ({} as ResponseRow['data'])
  return {
    id: r.seq,
    values: d.values ?? {},
    name: d.name ?? 'ממלא/ת אנונימי/ת',
    email: d.email ?? '',
    track: d.track ?? '—',
    tags: d.tags ?? [],
    assignedTo: d.assignedTo ?? null,
    status: d.status ?? 'new',
    notes: d.notes ?? '',
    submittedAt: r.submitted_at,
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

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user?.id
  if (!uid) throw new Error('נדרשת התחברות')
  return uid
}

/** the signed-in user's workspace (clients row); created on first login.
 * Uses an atomic get-or-create RPC (advisory-locked per user) so concurrent
 * calls on first login never produce duplicate workspaces. */
async function resolveWorkspace(opts?: { name?: string; create?: boolean }): Promise<SessionInfo['workspace']> {
  await requireUserId()
  let client:
    | { id: string; name: string; contact_email: string | null; meta: Record<string, string> }
    | undefined

  if (opts?.create === false) {
    const { data: memberships, error } = await supabase
      .from('client_members')
      .select('client_id, clients(id, name, contact_email, meta)')
      .eq('user_id', (await supabase.auth.getSession()).data.session!.user.id)
      .limit(1)
    if (error) throw new Error(error.message)
    client = memberships?.[0]?.clients as unknown as typeof client
  } else {
    const { data, error } = await supabase.rpc('get_or_create_workspace', {
      p_name: opts?.name ? `ה-Workspace של ${opts.name}` : 'הארגון שלי',
    })
    if (error) throw new Error(error.message)
    client = data as typeof client
  }
  if (!client) throw new Error('workspace not found')
  const meta = client.meta ?? {}
  return {
    id: client.id,
    name: client.name,
    ownerEmail: client.contact_email ?? '',
    ownerName: meta.ownerName ?? '',
    businessName: meta.businessName,
    phone: meta.phone,
    domain: meta.domain,
    goal: meta.goal,
  }
}

async function getFormRow(idOrSlug: string, publishedOnly = false): Promise<FormRow> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)
  let q = supabase.from('forms').select('id, client_id, slug, title, status, schema')
  q = isUuid ? q.eq('id', idOrSlug) : q.eq('slug', idOrSlug)
  if (publishedOnly) q = q.eq('status', 'published')
  const { data, error } = await q.limit(1)
  if (error) throw new Error(error.message)
  if (!data || !data.length) throw new Error('form not found')
  return data[0] as FormRow
}

async function saveFormRow(id: string, patch: Partial<Pick<FormRow, 'slug' | 'title' | 'status' | 'schema'>>): Promise<void> {
  const { error } = await supabase.from('forms').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

/* per-session notification feed (not persisted server-side yet) */
const sessionNotifications: NotificationEntry[] = []

/* ---------- backend ---------- */

export const supabaseBackend = {
  async createSession(email: string, name: string): Promise<SessionInfo> {
    const ws = await resolveWorkspace({ name, create: true })
    /* keep owner details fresh */
    const meta: Record<string, string> = { ownerName: name }
    await supabase.from('clients').update({ contact_email: email, meta: { ...meta } }).eq('id', ws.id)
    const { count } = await supabase
      .from('forms')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', ws.id)
    return { workspace: { ...ws, ownerEmail: email, ownerName: name }, formsCount: count ?? 0 }
  },

  async updateWorkspace(patch: { name?: string; businessName?: string; phone?: string; domain?: string; goal?: string; website?: string }): Promise<SessionInfo['workspace']> {
    const ws = await resolveWorkspace({ create: true })
    const upd: Record<string, unknown> = {}
    if (patch.name) upd.name = patch.name
    const meta: Record<string, string | undefined> = {
      ownerName: ws.ownerName,
      businessName: patch.businessName ?? ws.businessName,
      phone: patch.phone ?? ws.phone,
      domain: patch.domain ?? ws.domain,
      goal: patch.goal ?? ws.goal,
      website: patch.website,
    }
    upd.meta = meta
    const { error } = await supabase.from('clients').update(upd).eq('id', ws.id)
    if (error) throw new Error(error.message)
    return { ...ws, ...patch, name: (patch.name as string) ?? ws.name }
  },

  async getForms(): Promise<FormListItem[]> {
    const ws = await resolveWorkspace({ create: true })
    const { data, error } = await supabase
      .from('forms')
      .select('id, client_id, slug, title, status, schema, created_at, responses(count)')
      .eq('client_id', ws.id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as (FormRow & { responses?: { count: number }[] })[]
    /* last response per form in one query */
    const { data: lastRows } = await supabase
      .from('responses')
      .select('form_id, submitted_at')
      .eq('client_id', ws.id)
      .order('submitted_at', { ascending: false })
      .limit(200)
    const lastMap = new Map<string, string>()
    for (const r of (lastRows ?? []) as { form_id: string; submitted_at: string }[]) {
      if (!lastMap.has(r.form_id)) lastMap.set(r.form_id, r.submitted_at)
    }
    return rows.map((row) => {
      const doc = rowToDoc(row)
      const count = row.responses?.[0]?.count ?? 0
      return {
        id: row.id,
        slug: row.slug,
        name: doc.name,
        folder: doc.folder ?? 'כללי',
        icon: doc.icon ?? 'file',
        status: doc.status,
        version: doc.version,
        responses: count,
        completion: count > 0 ? 100 : null,
        lastResponseAt: lastMap.get(row.id) ?? null,
      }
    })
  },

  async createForm(input: NewFormInput): Promise<FormDoc> {
    const ws = await resolveWorkspace({ create: true })
    const uid = await requireUserId()
    const doc: FormDoc = {
      id: '',
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
    const versions: StoredVersion[] = [{ id: rid('ver'), at: new Date().toISOString(), fields: input.fields }]
    const { data, error } = await supabase
      .from('forms')
      .insert({
        client_id: ws.id,
        slug: doc.slug,
        title: doc.name,
        status: 'draft',
        schema: docToSchema(doc, versions),
        created_by: uid,
      })
      .select('id, client_id, slug, title, status, schema')
      .single()
    if (error) throw new Error(error.message)
    return rowToDoc(data as FormRow)
  },

  async getForm(idOrSlug: string): Promise<FormDoc> {
    const row = await getFormRow(idOrSlug)
    return rowToDoc(row)
  },

  async getPublicForm(slug: string): Promise<PublicFormDoc> {
    const row = await getFormRow(slug, true)
    const doc = rowToDoc(row)
    return {
      id: doc.id,
      slug: doc.slug,
      name: doc.name,
      fields: doc.fields,
      rules: doc.rules,
      branding: doc.branding,
      settings: doc.settings,
      status: doc.status,
    }
  },

  async patchForm(formId: string, patch: Partial<FormDoc>): Promise<FormDoc> {
    const row = await getFormRow(formId)
    const doc = rowToDoc(row)
    let versions = rowVersions(row)
    let fieldsChanged = false
    for (const key of ['fields', 'rules', 'notif', 'branding', 'webhooks', 'settings', 'name'] as const) {
      if (patch[key] !== undefined) {
        if (key === 'fields' && JSON.stringify(doc.fields) !== JSON.stringify(patch.fields)) fieldsChanged = true
        // @ts-expect-error dynamic assign of known keys
        doc[key] = patch[key]
      }
    }
    if (fieldsChanged) versions = [{ id: rid('ver'), at: new Date().toISOString(), fields: doc.fields }, ...versions]
    await saveFormRow(row.id, { title: doc.name, schema: docToSchema(doc, versions) })
    return doc
  },

  async publishForm(formId: string): Promise<FormDoc> {
    const row = await getFormRow(formId)
    const doc = rowToDoc(row)
    doc.status = 'published'
    doc.version += 1
    doc.publishedAt = new Date().toISOString()
    await saveFormRow(row.id, { status: 'published', schema: docToSchema(doc, rowVersions(row)) })
    return doc
  },

  async deleteForm(formId: string, _withRecords: boolean): Promise<{ ok: boolean }> {
    const row = await getFormRow(formId)
    const { error } = await supabase.from('forms').delete().eq('id', row.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  },

  async getSubmissions(
    formId: string,
    f: { q: string; track: string; status: string },
  ): Promise<{ items: Submission[]; total: number }> {
    const row = await getFormRow(formId)
    const { data, error } = await supabase
      .from('responses')
      .select('id, seq, form_id, client_id, data, submitted_at')
      .eq('form_id', row.id)
      .order('submitted_at', { ascending: false })
      .limit(1000)
    if (error) throw new Error(error.message)
    const items = ((data ?? []) as ResponseRow[]).map(rowToSubmission).filter((s) => {
      if (f.q) {
        const hay = `${s.name} ${s.email} ${Object.values(s.values ?? {}).join(' ')}`
        if (!hay.includes(f.q)) return false
      }
      if (f.track !== 'all' && s.track !== f.track) return false
      if (f.status !== 'all' && s.status !== f.status) return false
      return true
    })
    return { items, total: items.length }
  },

  async getSubmission(id: number): Promise<SubmissionDetail> {
    const { data, error } = await supabase
      .from('responses')
      .select('id, seq, form_id, client_id, data, submitted_at')
      .eq('seq', id)
      .limit(1)
    if (error) throw new Error(error.message)
    if (!data || !data.length) throw new Error('not found')
    return {
      ...rowToSubmission(data[0] as ResponseRow),
      notifications: sessionNotifications.filter((n) => n.submissionId === id),
    }
  },

  async patchSubmission(id: number, patch: Partial<Submission>): Promise<Submission> {
    const { data, error } = await supabase
      .from('responses')
      .select('id, seq, form_id, client_id, data, submitted_at')
      .eq('seq', id)
      .limit(1)
    if (error) throw new Error(error.message)
    if (!data || !data.length) throw new Error('not found')
    const row = data[0] as ResponseRow
    const merged = { ...row.data }
    for (const key of ['tags', 'assignedTo', 'status', 'notes', 'name', 'email', 'track'] as const) {
      if (patch[key] !== undefined) {
        // @ts-expect-error dynamic assign of known keys
        merged[key] = patch[key]
      }
    }
    const { error: uErr } = await supabase.from('responses').update({ data: merged }).eq('id', row.id)
    if (uErr) throw new Error(uErr.message)
    return rowToSubmission({ ...row, data: merged })
  },

  async deleteSubmission(id: number): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('responses').delete().eq('seq', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  },

  async postSubmission(
    formIdOrSlug: string,
    values: Record<string, string>,
  ): Promise<{ submission: Submission; notifications: NotificationEntry[] }> {
    /* public flow: form must exist; validation mirrors the server exactly */
    const row = await getFormRow(formIdOrSlug)
    const doc = rowToDoc(row)
    const fields = doc.fields
    const rules = doc.rules as LogicRule[]
    const { hiddenFieldKeys } = computeFillState(fields, rules, values)
    const skipped = skippedPages(fields, rules, values)
    const errors = validateSubmission(fields, values, hiddenFieldKeys, skipped) as Record<string, string>
    /* unique fields — checked server-side via security-definer RPC */
    for (const field of fields) {
      if (!field.unique || errors[field.fieldKey]) continue
      const v = String(values[field.fieldKey] ?? '').trim()
      if (!v) continue
      const { data: taken } = await supabase.rpc('is_value_taken', {
        p_form: row.id,
        p_key: field.fieldKey,
        p_value: v,
      })
      if (taken === true) errors[field.fieldKey] = 'הערך כבר נשלח בעבר בטופס זה'
    }
    if (Object.keys(errors).length > 0) throw new SubmitValidationError(errors)

    const { routes, tags, assigns } = runSubmitActions(rules, values)
    const identity = deriveIdentity(fields, values)
    const payload = {
      values,
      ...identity,
      tags,
      assignedTo: assigns[0] ?? null,
      status: 'new' as const,
      notes: '',
    }
    const { error } = await supabase.from('responses').insert({
      form_id: row.id,
      client_id: row.client_id,
      data: payload,
      meta: { user_agent: navigator.userAgent, referrer: document.referrer || null, url: location.href },
    })
    if (error) throw new Error(error.message)

    const submission: Submission = {
      id: Date.now(),
      ...payload,
      submittedAt: new Date().toISOString(),
    }
    const created: NotificationEntry[] = []
    const notif = doc.notif as NotifState
    const emailRows: {
      client_id: string; form_id: string; to_email: string
      kind: 'confirmation' | 'owner_notify'; subject: string; body_text: string
    }[] = []
    const summary = fields
      .map((f) => `${f.label}: ${values[f.fieldKey] ?? ''}`)
      .join('\n')
    const notify = (channel: 'email' | 'sms', recipient: string, note: string) => {
      const entry: NotificationEntry = {
        id: rid('ntf'), submissionId: submission.id, channel, recipient,
        status: 'queued', note, at: new Date().toISOString(),
      }
      sessionNotifications.unshift(entry)
      created.push(entry)
    }
    if (notif?.confirmEnabled && identity.email) {
      notify('email', identity.email, 'מייל אישור לממלא')
      emailRows.push({
        client_id: row.client_id, form_id: row.id, to_email: identity.email,
        kind: 'confirmation',
        subject: notif.subject || `אישור קבלת הטופס: ${doc.name}`,
        body_text: `שלום ${identity.name},\n\nתודה שמילאת את הטופס "${doc.name}". פרטיך נקלטו בהצלחה.\n\n— ${doc.name}`,
      })
    }
    if (notif?.ownerEnabled) {
      for (const r of [...new Set([...(notif.recipients ?? []), ...routes])]) {
        notify('email', r, routes.includes(r) ? 'ניתוב לפי כלל לוגיקה' : 'מייל התראה לבעל הטופס')
        emailRows.push({
          client_id: row.client_id, form_id: row.id, to_email: r,
          kind: 'owner_notify',
          subject: `הרשמה חדשה: ${doc.name}`,
          body_text: `התקבלה הרשמה חדשה לטופס "${doc.name}":\n\n${summary}`,
        })
      }
    }
    /* enqueue for real delivery (Edge Function drains the queue via Resend).
     * Failure here must not block the submission the visitor already made. */
    if (emailRows.length) {
      try {
        await supabase.from('email_queue').insert(emailRows)
      } catch { /* queue insert best-effort */ }
    }
    try {
      new BroadcastChannel('formflow-events').postMessage({ type: 'submission.created', formId: row.id })
    } catch { /* unsupported */ }
    return { submission, notifications: created }
  },

  async getAnalytics(formId: string): Promise<AnalyticsPayload> {
    const { items: subs } = await this.getSubmissions(formId, { q: '', track: 'all', status: 'all' })
    const count = subs.length
    const daily: Record<string, number> = {}
    for (const s of subs) {
      const day = s.submittedAt.slice(0, 10)
      daily[day] = (daily[day] ?? 0) + 1
    }
    const dayLabels: { label: string; value: number }[] = []
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
    return {
      total: count,
      today,
      completion: null,
      avgTime: null,
      nps: null,
      topSource: { name: 'קישור ישיר', share: 100 },
      timeline: { day: dayLabels, week: [], month: [] },
      trackSplit: split,
      workshopInterest: [],
    }
  },

  async getVersions(formId: string) {
    const row = await getFormRow(formId)
    return rowVersions(row).map((v) => ({ id: v.id, at: v.at, fieldCount: v.fields.length }))
  },

  async getVersion(formId: string, id: string) {
    const row = await getFormRow(formId)
    const v = rowVersions(row).find((x) => x.id === id)
    if (!v) throw new Error('version not found')
    return { id: v.id, at: v.at, fields: v.fields }
  },

  async getWebhookLogs(_formId: string): Promise<WebhookLog[]> {
    return []
  },

  async retryWebhookLog(_id: string): Promise<WebhookLog> {
    throw new Error('not available')
  },

  async testNotification(channel: 'email' | 'sms'): Promise<NotificationEntry> {
    const ws = await resolveWorkspace({ create: true })
    return {
      id: rid('ntf-test'), submissionId: null, channel,
      recipient: channel === 'email' ? ws.ownerEmail : '050-•••0000',
      status: 'delivered', note: 'שליחת בדיקה', at: new Date().toISOString(),
    }
  },
}

export type SupabaseBackend = typeof supabaseBackend
