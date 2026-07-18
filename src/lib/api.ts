import type {
  AnalyticsPayload,
  FormDoc,
  FormField,
  FormVersionMeta,
  NotificationEntry,
  Submission,
  SubmissionDetail,
  WebhookLog,
} from './types'

const BASE = '/api/v1'
const USER_KEY = 'formflow.user'

export class SubmitValidationError extends Error {
  errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super('validation failed')
    this.errors = errors
  }
}

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return {}
    const user = JSON.parse(raw) as { email: string; name: string }
    return {
      'X-User-Email': user.email,
      'X-User-Name': encodeURIComponent(user.name),
    }
  } catch {
    return {}
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
  })
  if (res.status === 422) {
    const body = (await res.json()) as { errors: Record<string, string> }
    throw new SubmitValidationError(body.errors)
  }
  if (!res.ok) throw new Error(`API ${res.status} — ${path}`)
  return (await res.json()) as T
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
  status: string
  version: number
  responses: number
  completion: number | null
  lastResponseAt: string | null
}

export interface SessionInfo {
  workspace: { id: string; name: string; ownerEmail: string; ownerName: string }
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

export const api = {
  createSession: (email: string, name: string) =>
    http<SessionInfo>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    }),
  getForms: () => http<FormListItem[]>('/forms'),
  createForm: (input: NewFormInput) =>
    http<FormDoc>('/forms', { method: 'POST', body: JSON.stringify(input) }),
  deleteForm: (formId: string, withRecords: boolean) =>
    http<{ ok: boolean }>(`/forms/${formId}?records=${withRecords}`, { method: 'DELETE' }),
  getForm: (formId: string) => http<FormDoc>(`/forms/${formId}`),
  getPublicForm: (slug: string) => http<PublicFormDoc>(`/public/forms/${slug}`),
  patchForm: (formId: string, patch: Partial<FormDoc>) =>
    http<FormDoc>(`/forms/${formId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  publishForm: (formId: string) =>
    http<FormDoc>(`/forms/${formId}/publish`, { method: 'POST' }),
  getSubmissions: (formId: string, f: SubmissionFilters) =>
    http<{ items: Submission[]; total: number }>(
      `/forms/${formId}/submissions?q=${encodeURIComponent(f.q)}&track=${encodeURIComponent(
        f.track,
      )}&status=${encodeURIComponent(f.status)}`,
    ),
  getSubmission: (id: number) => http<SubmissionDetail>(`/submissions/${id}`),
  patchSubmission: (id: number, patch: Partial<Submission>) =>
    http<Submission>(`/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteSubmission: (id: number) =>
    http<{ ok: boolean }>(`/submissions/${id}`, { method: 'DELETE' }),
  postSubmission: (formId: string, values: Record<string, string>) =>
    http<{ submission: Submission; notifications: NotificationEntry[] }>(
      `/forms/${formId}/submissions`,
      { method: 'POST', body: JSON.stringify({ values }) },
    ),
  getAnalytics: (formId: string) => http<AnalyticsPayload>(`/forms/${formId}/analytics`),
  getVersions: (formId: string) => http<FormVersionMeta[]>(`/forms/${formId}/versions`),
  getVersion: (formId: string, id: string) =>
    http<{ id: string; at: string; fields: FormField[] }>(`/forms/${formId}/versions/${id}`),
  getWebhookLogs: (formId: string) => http<WebhookLog[]>(`/forms/${formId}/webhook-logs`),
  retryWebhookLog: (id: string) =>
    http<WebhookLog>(`/webhook-logs/${id}/retry`, { method: 'POST' }),
  testNotification: (channel: 'email' | 'sms') =>
    http<NotificationEntry>(`/notifications/test`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
  exportUrl: (formId: string, f: SubmissionFilters, format: 'xlsx' | 'csv') =>
    `${BASE}/forms/${formId}/export?format=${format}&q=${encodeURIComponent(
      f.q,
    )}&track=${encodeURIComponent(f.track)}&status=${encodeURIComponent(f.status)}`,
  /* export needs the auth headers, so download via fetch + blob */
  downloadExport: async (formId: string, f: SubmissionFilters, format: 'xlsx' | 'csv') => {
    const res = await fetch(api.exportUrl(formId, f, format), { headers: authHeaders() })
    if (!res.ok) throw new Error(`export failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `formflow-responses.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
  eventsUrl: (formId: string) => `${BASE}/forms/${formId}/events`,
}
