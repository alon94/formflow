import type {
  BrandingState,
  FormField,
  LogicRule,
  NotifState,
  NotificationEntry,
  Submission,
  WebhookConfig,
  WebhookLog,
} from '../src/lib/types'

export declare const FORM_ID: string
export declare const FORM_SLUG: string
export declare const FORM_NAME: string
export declare const seedFields: FormField[]
export declare const seedRules: LogicRule[]
export declare const seedSubmissions: Submission[]
export declare const seedNotif: NotifState
export declare const seedNotifications: NotificationEntry[]
export declare const seedBranding: BrandingState
export declare const seedWebhooks: WebhookConfig[]
export declare const seedWebhookLogs: WebhookLog[]
export declare const seedSettings: import('../src/lib/types').FormSettings

export declare function buildSeedDb(): {
  form: {
    id: string
    slug: string
    name: string
    status: string
    version: number
    fields: FormField[]
    rules: LogicRule[]
    notif: NotifState
    branding: BrandingState
  }
  submissions: Submission[]
  notifications: NotificationEntry[]
  nextSubmissionId: number
  baseline: { total: number; completion: number; avgTime: string; nps: number }
}
