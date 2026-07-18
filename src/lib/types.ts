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
}

export type RuleScope = 'fill' | 'submit'

export interface RulePart {
  kind: 'if' | 'then' | 'and' | 'or' | 'field' | 'op' | 'value' | 'action' | 'tag'
  text: string
  ltr?: boolean
}

export interface LogicRule {
  id: string
  name: string
  scope: RuleScope
  enabled: boolean
  parts: RulePart[]
}

export type HandleStatus = 'new' | 'in_progress' | 'done'

export interface Submission {
  id: number
  name: string
  email: string
  track: string
  tag?: { text: string; color: 'peach' | 'purple' }
  status: HandleStatus
  sentAt: string
  isNew?: boolean
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
