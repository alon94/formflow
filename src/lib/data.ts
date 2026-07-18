import {
  FORM_ID as SEED_FORM_ID,
  FORM_NAME as SEED_FORM_NAME,
  FORM_SLUG as SEED_FORM_SLUG,
  seedBranding,
  seedFields as sharedSeedFields,
  seedNotif,
  seedRules as sharedSeedRules,
  seedSettings,
  seedSubmissions as sharedSeedSubmissions,
  seedWebhooks,
} from '../../shared/seed.js'
import type {
  BrandingState,
  FieldTypeDef,
  FormField,
  FormMeta,
  FormSettings,
  LogicRule,
  NotifState,
  Submission,
  WebhookConfig,
} from './types'

export const FORM_ID: string = SEED_FORM_ID
export const FORM_SLUG: string = SEED_FORM_SLUG
export const FORM_NAME: string = SEED_FORM_NAME

export const seedFields = sharedSeedFields as FormField[]
export const seedRules = sharedSeedRules as LogicRule[]
export const seedSubmissions = sharedSeedSubmissions as Submission[]
export const defaultNotif = seedNotif as NotifState
export const defaultBranding = seedBranding as BrandingState
export const defaultWebhooks = seedWebhooks as WebhookConfig[]
export const defaultSettings = seedSettings as FormSettings

export const seedForms: FormMeta[] = [
  {
    id: FORM_ID,
    name: FORM_NAME,
    folder: 'תיקייה: אירועים',
    icon: 'ticket',
    status: 'published',
    responses: 128,
    completion: 82,
    lastResponse: 'לפני 4 דקות',
    slug: FORM_SLUG,
  },
  {
    id: 'hr-onboarding',
    name: 'קליטת עובד חדש — משאבי אנוש',
    folder: 'תיקייה: HR',
    icon: 'hand',
    status: 'published',
    responses: 57,
    completion: 91,
    lastResponse: 'לפני שעתיים',
  },
  {
    id: 'contact',
    name: 'צור קשר — אתר החברה',
    folder: 'מחובר ל-CRM · Webhook',
    icon: 'phone',
    status: 'published',
    responses: 1204,
    completion: 76,
    lastResponse: 'לפני 12 דקות',
  },
  {
    id: 'nps-q3',
    name: 'משוב לקוחות Q3',
    folder: 'NPS · דוח שבועי במייל',
    icon: 'file',
    status: 'draft',
    responses: null,
    completion: null,
    lastResponse: 'נערך אתמול',
  },
  {
    id: 'webinar-june',
    name: 'הרשמה לוובינר — יוני',
    folder: 'תיקייה: אירועים',
    icon: 'graduation',
    status: 'closed',
    responses: 312,
    completion: 88,
    lastResponse: '30/06/2026',
  },
]

export const fieldLibrary: FieldTypeDef[] = [
  { type: 'short_text', label: 'טקסט קצר', category: 'text', icon: 'Aa' },
  { type: 'long_text', label: 'טקסט ארוך', category: 'text', icon: 'paragraph' },
  { type: 'email', label: 'מייל', category: 'text', icon: '@' },
  { type: 'phone', label: 'טלפון', category: 'text', icon: 'phone' },
  { type: 'number', label: 'מספר', category: 'text', icon: 'number' },
  { type: 'radio', label: 'בחירה יחידה', category: 'choice', icon: 'radio' },
  { type: 'dropdown', label: 'רשימה נפתחת', category: 'choice', icon: 'dropdown' },
  { type: 'date', label: 'תאריך', category: 'advanced', icon: 'date' },
  { type: 'rating', label: 'דירוג / NPS', category: 'advanced', icon: 'star' },
  { type: 'id_number', label: 'ת״ז ישראלית', category: 'advanced', icon: 'id' },
  { type: 'payment', label: 'תשלום', category: 'advanced', icon: 'card' },
]

export const fieldTypeMeta: Record<string, { label: string; icon: string }> =
  Object.fromEntries(fieldLibrary.map((f) => [f.type, { label: f.label, icon: f.icon }]))

export const fillActions = [
  'הצג / הסתר שדה',
  'קפיצה לעמוד',
  'חובה דינמית',
  'חישוב ערך',
  'מילוי אוטומטי',
  'סינון אפשרויות',
]

export const submitActions = [
  'ניתוב מייל',
  'מייל / SMS מותנה',
  'Redirect',
  'Webhook',
  'תגית',
  'הקצאת מטפל',
]

export const smsLog = [
  { phone: '052-•••4821', status: 'נמסר ✓', tone: 'success' as const },
  { phone: '054-•••1177', status: 'נמסר ✓', tone: 'success' as const },
  { phone: '050-•••9034', status: 'Opt-out', tone: 'peach' as const },
  { phone: '053-•••2568', status: 'בתור…', tone: 'warn' as const },
]

/** relative Hebrew time for table cells */
export function relTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'ממש עכשיו'
  if (diffMin === 1) return 'לפני דקה'
  if (diffMin < 60) return `לפני ${diffMin} דק׳`
  const hours = Math.round(diffMin / 60)
  if (hours === 1) return 'לפני שעה'
  if (hours === 2) return 'לפני שעתיים'
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.round(hours / 24)
  return days === 1 ? 'אתמול' : `לפני ${days} ימים`
}
