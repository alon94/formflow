import { FORM_ID } from './data'
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

export class SubmitValidationError extends Error {
  errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super('validation failed')
    this.errors = errors
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
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

export const api = {
  getForms: () =>
    http<
      {
        id: string
        slug: string
        name: string
        status: string
        responses: number
        completion: number
        lastResponseAt: string | null
      }[]
    >('/forms'),
  getForm: () => http<FormDoc>(`/forms/${FORM_ID}`),
  patchForm: (patch: Partial<FormDoc>) =>
    http<FormDoc>(`/forms/${FORM_ID}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  publishForm: () => http<FormDoc>(`/forms/${FORM_ID}/publish`, { method: 'POST' }),
  getSubmissions: (f: SubmissionFilters) =>
    http<{ items: Submission[]; total: number }>(
      `/forms/${FORM_ID}/submissions?q=${encodeURIComponent(f.q)}&track=${encodeURIComponent(
        f.track,
      )}&status=${encodeURIComponent(f.status)}`,
    ),
  getSubmission: (id: number) => http<SubmissionDetail>(`/submissions/${id}`),
  patchSubmission: (id: number, patch: Partial<Submission>) =>
    http<Submission>(`/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  postSubmission: (values: Record<string, string>) =>
    http<{ submission: Submission; notifications: NotificationEntry[] }>(
      `/forms/${FORM_ID}/submissions`,
      { method: 'POST', body: JSON.stringify({ values }) },
    ),
  getAnalytics: () => http<AnalyticsPayload>(`/forms/${FORM_ID}/analytics`),
  getVersions: () => http<FormVersionMeta[]>(`/forms/${FORM_ID}/versions`),
  getVersion: (id: string) =>
    http<{ id: string; at: string; fields: FormField[] }>(`/forms/${FORM_ID}/versions/${id}`),
  getWebhookLogs: () => http<WebhookLog[]>(`/forms/${FORM_ID}/webhook-logs`),
  retryWebhookLog: (id: string) =>
    http<WebhookLog>(`/webhook-logs/${id}/retry`, { method: 'POST' }),
  testNotification: (channel: 'email' | 'sms') =>
    http<NotificationEntry>(`/notifications/test`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
  exportUrl: (f: SubmissionFilters, format: 'xlsx' | 'csv') =>
    `${BASE}/forms/${FORM_ID}/export?format=${format}&q=${encodeURIComponent(
      f.q,
    )}&track=${encodeURIComponent(f.track)}&status=${encodeURIComponent(f.status)}`,
  eventsUrl: () => `${BASE}/forms/${FORM_ID}/events`,
}
