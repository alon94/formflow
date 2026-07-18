export type FormStatus = 'published' | 'draft' | 'closed'

export interface FormMeta {
  id: string
  name: string
  folder: string
  icon: string
  status: FormStatus
  responses: number | null
  completion: number | null
  lastResponse: string
  slug?: string
}

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'dropdown'
  | 'date'
  | 'rating'
  | 'id_number'
  | 'payment'

export interface FieldTypeDef {
  type: FieldType
  label: string
  category: 'text' | 'choice' | 'advanced'
  icon: string
}

export interface FormField {
  id: string
  type: FieldType
  label: string
  help?: string
  placeholder?: string
  required: boolean
  unique?: boolean
  errorMessage?: string
  fieldKey: string
  options?: string[]
  half?: boolean
  page?: number
}

export type RuleScope = 'fill' | 'submit'
export type RuleOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'empty' | 'filled'
export type TagColor = 'peach' | 'purple'

export interface RuleCondition {
  fieldKey: string
  op: RuleOp
  value?: string
}

export type RuleAction =
  | { type: 'show_field'; fieldKey: string }
  | { type: 'hide_field'; fieldKey: string }
  | { type: 'jump_page'; page: number; label?: string }
  | { type: 'route_email'; to: string }
  | { type: 'add_tag'; text: string; color: TagColor }
  | { type: 'assign'; user: string }

export interface LogicRule {
  id: string
  name: string
  scope: RuleScope
  enabled: boolean
  combinator: 'and' | 'or'
  conditions: RuleCondition[]
  actions: RuleAction[]
}

export interface RulePart {
  kind: 'if' | 'then' | 'and' | 'or' | 'field' | 'op' | 'value' | 'action' | 'tag'
  text: string
  ltr?: boolean
}

export type HandleStatus = 'new' | 'in_progress' | 'done'

export interface SubmissionTag {
  text: string
  color: TagColor
}

export interface Submission {
  id: number
  values: Record<string, string>
  name: string
  email: string
  track: string
  tags: SubmissionTag[]
  assignedTo?: string | null
  status: HandleStatus
  notes: string
  submittedAt: string
  isNew?: boolean
}

export interface NotificationEntry {
  id: string
  submissionId: number | null
  channel: 'email' | 'sms' | 'webhook'
  recipient: string
  status: 'delivered' | 'queued' | 'optout' | 'failed'
  note: string
  at: string
}

export interface SubmissionDetail extends Submission {
  notifications: NotificationEntry[]
}

export interface AnalyticsPayload {
  total: number
  today: number
  completion: number
  avgTime: string
  nps: number
  topSource: { name: string; share: number }
  timeline: Record<'day' | 'week' | 'month', { label: string; value: number }[]>
  trackSplit: { name: string; value: number }[]
  workshopInterest: { label: string; value: number }[]
}

export interface BrandingState {
  themeId: 'shaveh' | 'business' | 'events'
  primary: string
  textColor: string
  ctaColor: string
  bgColor: string
  headFont: string
  bodyFont: string
  darkMode: 'auto' | 'light' | 'dark'
}

export interface NotifState {
  confirmEnabled: boolean
  subject: string
  fromAddress: string
  attachPdf: boolean
  attachIcal: boolean
  ownerEnabled: boolean
  recipients: string[]
  digest: boolean
  smsEnabled: boolean
  smsTemplate: string
  smsReminder: boolean
}

export interface WebhookConfig {
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string
}

export interface WebhookLog {
  id: string
  webhookId: string
  submissionId: number | null
  event: string
  status: number
  attempt: number
  payload: string
  at: string
}

export interface FormVersionMeta {
  id: string
  at: string
  fieldCount: number
}

export interface FormSettings {
  closeAt: string
  maxResponses: string
  onePerUser: boolean
  passwordProtect: boolean
}

export interface FormDoc {
  id: string
  slug: string
  name: string
  folder?: string
  icon?: string
  workspaceId?: string
  status: FormStatus
  version: number
  publishedAt?: string
  fields: FormField[]
  rules: LogicRule[]
  notif: NotifState
  branding: BrandingState
  webhooks: WebhookConfig[]
  settings: FormSettings
}
