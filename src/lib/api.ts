import type {
  CustomTemplate,
  TemplateScope,
  AnalyticsPayload,
  FormDoc,
  FormField,
  FormVersionMeta,
  NotificationEntry,
  Submission,
  SubmissionDetail,
  WebhookLog,
} from './types'

import { supabaseConfigured } from './supabase'

const BASE = '/api/v1'
const USER_KEY = 'formflow.user'

export class SubmitValidationError extends Error {
  errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super('validation failed')
    this.errors = errors
  }
}

/* set true the first time any call falls back to the client-side backend
 * (static hosting with no server). Components read it to show the demo hint.
 * When Supabase is configured the fallback is the cloud backend, so the app
 * is NOT in local/demo mode even without an /api server. */
let localMode = false
export function isLocalMode(): boolean {
  return localMode && !supabaseConfigured()
}

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return {}
    const user = JSON.parse(raw) as { email: string; name: string }
    return { 'X-User-Email': user.email, 'X-User-Name': encodeURIComponent(user.name) }
  } catch {
    return {}
  }
}

/* try the server; on any "no backend" signal (network error or non-JSON
 * response, e.g. the SPA index.html on a static host) run the local fallback.
 * A genuine JSON error response from the server (401/404/500) is NOT masked. */
async function req<T>(path: string, init: RequestInit | undefined, local: () => Promise<T> | T): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
    })
    if (res.status === 422) {
      const body = (await res.json()) as { errors: Record<string, string> }
      throw new SubmitValidationError(body.errors)
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('json')) {
      localMode = true
      return await local()
    }
    if (!res.ok) throw new Error(`API ${res.status} — ${path}`)
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof SubmitValidationError) throw e
    localMode = true
    return await local()
  }
}

/* lazy import keeps the fallback backend out of the initial chunk until needed.
 * With Supabase configured the fallback is the real cloud backend (multi-tenant
 * Postgres + RLS); otherwise the localStorage demo backend. */
async function lb() {
  if (supabaseConfigured()) return (await import('./supabaseBackend')).supabaseBackend
  return (await import('./localBackend')).localBackend
}

export interface SubmissionFilters {
  q: string
  track: string
  status: string
}

export interface FormListItem {
  id: string
  slug: string
  name: string
  folder: string
  icon: string
  status: FormDoc['status']
  version: number
  responses: number
  completion: number | null
  lastResponseAt: string | null
}

export interface SessionInfo {
  workspace: {
    id: string
    name: string
    ownerEmail: string
    ownerName: string
    businessName?: string
    phone?: string
    domain?: string
    goal?: string
  }
  formsCount: number
}

export type PublicFormDoc = Pick<
  FormDoc,
  'id' | 'slug' | 'name' | 'fields' | 'rules' | 'branding' | 'settings' | 'status'
>

export interface NewFormInput {
  name: string
  folder: string
  icon: string
  fields: FormField[]
  notif: FormDoc['notif']
  branding: FormDoc['branding']
  settings: FormDoc['settings']
}

export interface WorkspaceProfile {
  businessName?: string
  phone?: string
  domain?: string
  goal?: string
  website?: string
  name?: string
}

export const api = {
  isLocalMode,
  createSession: (email: string, name: string) =>
    req<SessionInfo>(
      '/auth/session',
      { method: 'POST', body: JSON.stringify({ email, name }) },
      async () => (await lb()).createSession(email, name),
    ),
  updateWorkspace: (patch: WorkspaceProfile) =>
    req<SessionInfo['workspace']>(
      '/workspaces/current',
      { method: 'PATCH', body: JSON.stringify(patch) },
      async () => (await lb()).updateWorkspace(patch),
    ),
  getForms: () => req<FormListItem[]>('/forms', undefined, async () => (await lb()).getForms()),
  createForm: (input: NewFormInput) =>
    req<FormDoc>('/forms', { method: 'POST', body: JSON.stringify(input) }, async () =>
      (await lb()).createForm(input),
    ),
  deleteForm: (formId: string, withRecords: boolean) =>
    req<{ ok: boolean }>(
      `/forms/${formId}?records=${withRecords}`,
      { method: 'DELETE' },
      async () => (await lb()).deleteForm(formId, withRecords),
    ),
  getForm: (formId: string) =>
    req<FormDoc>(`/forms/${formId}`, undefined, async () => (await lb()).getForm(formId)),
  getPublicForm: (slug: string) =>
    req<PublicFormDoc>(`/public/forms/${slug}`, undefined, async () => (await lb()).getPublicForm(slug)),
  patchForm: (formId: string, patch: Partial<FormDoc>) =>
    req<FormDoc>(`/forms/${formId}`, { method: 'PATCH', body: JSON.stringify(patch) }, async () =>
      (await lb()).patchForm(formId, patch),
    ),
  publishForm: (formId: string) =>
    req<FormDoc>(`/forms/${formId}/publish`, { method: 'POST' }, async () =>
      (await lb()).publishForm(formId),
    ),
  getSubmissions: (formId: string, f: SubmissionFilters) =>
    req<{ items: Submission[]; total: number }>(
      `/forms/${formId}/submissions?q=${encodeURIComponent(f.q)}&track=${encodeURIComponent(
        f.track,
      )}&status=${encodeURIComponent(f.status)}`,
      undefined,
      async () => (await lb()).getSubmissions(formId, f),
    ),
  getSubmission: (id: number) =>
    req<SubmissionDetail>(`/submissions/${id}`, undefined, async () => (await lb()).getSubmission(id)),
  patchSubmission: (id: number, patch: Partial<Submission>) =>
    req<Submission>(`/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, async () =>
      (await lb()).patchSubmission(id, patch),
    ),
  deleteSubmission: (id: number) =>
    req<{ ok: boolean }>(`/submissions/${id}`, { method: 'DELETE' }, async () =>
      (await lb()).deleteSubmission(id),
    ),
  postSubmission: (formId: string, values: Record<string, string>) =>
    req<{ submission: Submission; notifications: NotificationEntry[] }>(
      `/forms/${formId}/submissions`,
      { method: 'POST', body: JSON.stringify({ values }) },
      async () => (await lb()).postSubmission(formId, values),
    ),
  getAnalytics: (formId: string) =>
    req<AnalyticsPayload>(`/forms/${formId}/analytics`, undefined, async () =>
      (await lb()).getAnalytics(formId),
    ),
  getVersions: (formId: string) =>
    req<FormVersionMeta[]>(`/forms/${formId}/versions`, undefined, async () =>
      (await lb()).getVersions(formId),
    ),
  getVersion: (formId: string, id: string) =>
    req<{ id: string; at: string; fields: FormField[] }>(
      `/forms/${formId}/versions/${id}`,
      undefined,
      async () => (await lb()).getVersion(formId, id),
    ),
  getWebhookLogs: (formId: string) =>
    req<WebhookLog[]>(`/forms/${formId}/webhook-logs`, undefined, async () =>
      (await lb()).getWebhookLogs(formId),
    ),
  retryWebhookLog: (id: string) =>
    req<WebhookLog>(`/webhook-logs/${id}/retry`, { method: 'POST' }, async () =>
      (await lb()).retryWebhookLog(id),
    ),
  testNotification: (channel: 'email' | 'sms') =>
    req<NotificationEntry>(
      `/notifications/test`,
      { method: 'POST', body: JSON.stringify({ channel }) },
      async () => (await lb()).testNotification(channel),
    ),
  exportUrl: (formId: string, f: SubmissionFilters, format: 'xlsx' | 'csv') =>
    `${BASE}/forms/${formId}/export?format=${format}&q=${encodeURIComponent(
      f.q,
    )}&track=${encodeURIComponent(f.track)}&status=${encodeURIComponent(f.status)}`,
  /* export via authorized fetch; offline builds a CSV from local data */
  downloadExport: async (formId: string, f: SubmissionFilters, format: 'xlsx' | 'csv') => {
    const trigger = (blob: Blob, ext: string) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `formflow-responses.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
    try {
      const res = await fetch(api.exportUrl(formId, f, format), { headers: authHeaders() })
      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok || ct.includes('text/html')) throw new Error('no server')
      trigger(await res.blob(), format)
    } catch {
      localMode = true
      const backend = await lb()
      const [{ items }, form] = await Promise.all([
        backend.getSubmissions(formId, f),
        backend.getForm(formId),
      ])
      const statusLabel: Record<string, string> = { new: 'חדש', in_progress: 'בטיפול', done: 'טופל' }
      const header = ['#', 'שם מלא', 'מייל', ...form.fields.map((fl) => fl.label), 'תגיות', 'סטטוס', 'נשלח']
      const rows = items.map((s) => [
        s.id,
        s.name,
        s.email,
        ...form.fields.map((fl) => s.values?.[fl.fieldKey] ?? ''),
        s.tags.map((t) => t.text).join(' | '),
        statusLabel[s.status] ?? s.status,
        s.submittedAt,
      ])
      const csv = [header, ...rows]
        .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
        .join('\r\n')
      trigger(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv')
    }
  },
  /* ---- custom templates (per-business + global) ---- */
  getTemplates: () =>
    req<CustomTemplate[]>('/templates', undefined, async () => (await lb()).getTemplates()),
  createTemplate: (input: {
    name: string
    description?: string
    icon?: string
    category?: string
    fields: FormField[]
    scope?: TemplateScope
  }) =>
    req<CustomTemplate>(
      '/templates',
      { method: 'POST', body: JSON.stringify(input) },
      async () => (await lb()).createTemplate(input),
    ),
  updateTemplate: (id: string, patch: Partial<CustomTemplate>) =>
    req<CustomTemplate>(
      `/templates/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      async () => (await lb()).updateTemplate(id, patch),
    ),
  deleteTemplate: (id: string) =>
    req<{ ok: boolean }>(
      `/templates/${id}`,
      { method: 'DELETE' },
      async () => (await lb()).deleteTemplate(id),
    ),
  duplicateTemplate: (id: string) =>
    req<CustomTemplate>(
      `/templates/${id}/duplicate`,
      { method: 'POST' },
      async () => (await lb()).duplicateTemplate(id),
    ),

  /* ---- businesses / workspaces ---- */
  getWorkspaces: () =>
    req<SessionInfo['workspace'][]>('/workspaces', undefined, async () =>
      (await lb()).getWorkspaces(),
    ),
  createWorkspace: (input: { name: string; businessName?: string }) =>
    req<SessionInfo['workspace']>(
      '/workspaces',
      { method: 'POST', body: JSON.stringify(input) },
      async () => (await lb()).createWorkspace(input),
    ),
  updateWorkspaceById: (id: string, patch: WorkspaceProfile) =>
    req<SessionInfo['workspace']>(
      `/workspaces/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      async () => (await lb()).updateWorkspaceById(id, patch),
    ),
  deleteWorkspace: (id: string) =>
    req<{ ok: boolean }>(
      `/workspaces/${id}`,
      { method: 'DELETE' },
      async () => (await lb()).deleteWorkspace(id),
    ),
  assignFormToWorkspace: (formId: string, workspaceId: string) =>
    req<{ ok: boolean }>(
      `/forms/${formId}/workspace`,
      { method: 'PATCH', body: JSON.stringify({ workspaceId }) },
      async () => (await lb()).assignFormToWorkspace(formId, workspaceId),
    ),

  eventsUrl: (formId: string) => `${BASE}/forms/${formId}/events`,
}
