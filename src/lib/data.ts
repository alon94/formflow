import type {
  BrandingState,
  FieldTypeDef,
  FormField,
  FormMeta,
  LogicRule,
  NotifState,
  Submission,
} from './types'

export const FORM_ID = 'conf-2026'
export const FORM_SLUG = 'product-conf-2026'
export const FORM_NAME = 'הרשמה לכנס המוצר 2026'

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
  { type: 'email', label: 'מייל', category: 'text', icon: '@' },
  { type: 'phone', label: 'טלפון', category: 'text', icon: 'phone' },
  { type: 'radio', label: 'בחירה יחידה', category: 'choice', icon: 'radio' },
  { type: 'dropdown', label: 'רשימה נפתחת', category: 'choice', icon: 'dropdown' },
  { type: 'date', label: 'תאריך', category: 'advanced', icon: 'date' },
  { type: 'rating', label: 'דירוג / NPS', category: 'advanced', icon: 'star' },
  { type: 'id_number', label: 'ת״ז ישראלית', category: 'advanced', icon: 'id' },
  { type: 'payment', label: 'תשלום', category: 'advanced', icon: 'card' },
]

export const fieldTypeMeta: Record<string, { label: string; icon: string }> =
  Object.fromEntries(fieldLibrary.map((f) => [f.type, { label: f.label, icon: f.icon }]))

export const seedFields: FormField[] = [
  {
    id: 'fld-first',
    type: 'short_text',
    label: 'שם פרטי',
    placeholder: 'ישראל',
    required: true,
    fieldKey: 'first_name',
    half: true,
  },
  {
    id: 'fld-last',
    type: 'short_text',
    label: 'שם משפחה',
    placeholder: 'ישראלי',
    required: true,
    fieldKey: 'last_name',
    half: true,
  },
  {
    id: 'fld-email',
    type: 'email',
    label: 'כתובת מייל',
    placeholder: 'name@company.co.il',
    help: 'אישור ההרשמה יישלח לכתובת זו',
    required: true,
    unique: true,
    errorMessage: 'נא להזין כתובת מייל תקינה',
    fieldKey: 'email',
  },
  {
    id: 'fld-track',
    type: 'radio',
    label: 'באיזה מסלול תשתתפו?',
    required: true,
    fieldKey: 'track',
    options: ['מוצר וניהול', 'פיתוח והנדסה', 'עיצוב ו-UX'],
  },
]

export const seedRules: LogicRule[] = [
  {
    id: 'rule-1',
    name: 'הצגת שדות סדנה למסלול עיצוב',
    scope: 'fill',
    enabled: true,
    parts: [
      { kind: 'if', text: 'אם' },
      { kind: 'field', text: 'באיזה מסלול תשתתפו?' },
      { kind: 'op', text: 'שווה ל…' },
      { kind: 'value', text: 'עיצוב ו-UX' },
      { kind: 'then', text: 'אז' },
      { kind: 'action', text: 'הצג שדה' },
      { kind: 'value', text: 'בחירת סדנת עיצוב' },
    ],
  },
  {
    id: 'rule-2',
    name: 'ניתוב פניות VIP למייל מנהלת האירוע',
    scope: 'submit',
    enabled: true,
    parts: [
      { kind: 'if', text: 'אם' },
      { kind: 'field', text: 'מספר משתתפים' },
      { kind: 'op', text: 'גדול מ…' },
      { kind: 'value', text: '5' },
      { kind: 'and', text: 'וגם' },
      { kind: 'field', text: 'חברת מועדון שווה?' },
      { kind: 'value', text: 'כן' },
      { kind: 'then', text: 'אז' },
      { kind: 'action', text: 'שלח מייל אל' },
      { kind: 'value', text: 'vip@shaveh360.co.il', ltr: true },
      { kind: 'and', text: 'וגם' },
      { kind: 'action', text: 'הוסף תגית' },
      { kind: 'tag', text: 'VIP' },
    ],
  },
  {
    id: 'rule-3',
    name: 'דילוג על עמוד תשלום לחברי מועדון',
    scope: 'fill',
    enabled: false,
    parts: [
      { kind: 'if', text: 'אם' },
      { kind: 'field', text: 'חברת מועדון שווה?' },
      { kind: 'op', text: 'שווה ל…' },
      { kind: 'value', text: 'כן' },
      { kind: 'then', text: 'אז' },
      { kind: 'action', text: 'קפוץ לעמוד' },
      { kind: 'value', text: '4 · סיכום' },
    ],
  },
]

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

export const seedSubmissions: Submission[] = [
  {
    id: 1128,
    name: 'נועה ברק',
    email: 'noa@acme.co.il',
    track: 'מוצר וניהול',
    tag: { text: 'VIP', color: 'peach' },
    status: 'new',
    sentAt: 'לפני 4 דק׳',
  },
  {
    id: 1127,
    name: 'אמיר כהן',
    email: 'amir.c@gmail.com',
    track: 'פיתוח והנדסה',
    status: 'in_progress',
    sentAt: 'לפני 22 דק׳',
  },
  {
    id: 1126,
    name: 'דנה לוי',
    email: 'dana@studio-d.co',
    track: 'עיצוב ו-UX',
    tag: { text: 'סטודנטית', color: 'purple' },
    status: 'done',
    sentAt: 'לפני שעה',
  },
  {
    id: 1125,
    name: 'יוסי מזרחי',
    email: 'yossi@tlv-events.com',
    track: 'מוצר וניהול',
    status: 'done',
    sentAt: 'לפני 3 שעות',
  },
]

export const liveSubmissionsPool: Omit<Submission, 'id' | 'sentAt'>[] = [
  { name: 'רוני אשכנזי', email: 'roni@brightapps.io', track: 'פיתוח והנדסה', status: 'new' },
  {
    name: 'מאיה שפירא',
    email: 'maya@studio-ms.co.il',
    track: 'עיצוב ו-UX',
    tag: { text: 'סטודנטית', color: 'purple' },
    status: 'new',
  },
  {
    name: 'אבי פרץ',
    email: 'avi@peretz-group.co.il',
    track: 'מוצר וניהול',
    tag: { text: 'VIP', color: 'peach' },
    status: 'new',
  },
  { name: 'שירה גולן', email: 'shira.g@outlook.com', track: 'מוצר וניהול', status: 'new' },
  { name: 'תומר אדלר', email: 'tomer@adlertech.dev', track: 'פיתוח והנדסה', status: 'new' },
]

export const chartByDay = [
  { label: '01/07', value: 3 },
  { label: '02/07', value: 5 },
  { label: '03/07', value: 8 },
  { label: '04/07', value: 7 },
  { label: '05/07', value: 9 },
  { label: '06/07', value: 12 },
  { label: '07/07', value: 11 },
  { label: '08/07', value: 8 },
  { label: '09/07', value: 6 },
  { label: '10/07', value: 9 },
  { label: '11/07', value: 12 },
  { label: '12/07', value: 15 },
  { label: '13/07', value: 13 },
  { label: '14/07', value: 11 },
  { label: '15/07', value: 14 },
  { label: '16/07', value: 18 },
]

export const chartByWeek = [
  { label: 'שבוע 1', value: 22 },
  { label: 'שבוע 2', value: 35 },
  { label: 'שבוע 3', value: 41 },
  { label: 'שבוע 4', value: 30 },
]

export const chartByMonth = [
  { label: 'אפריל', value: 14 },
  { label: 'מאי', value: 48 },
  { label: 'יוני', value: 66 },
  { label: 'יולי', value: 128 },
]

export const trackSplit = [
  { name: 'מוצר וניהול', value: 46 },
  { name: 'פיתוח', value: 30 },
  { name: 'עיצוב', value: 24 },
]

export const workshopInterest = [
  { label: '1', value: 9 },
  { label: '2', value: 16 },
  { label: '3', value: 24 },
  { label: '4', value: 46 },
  { label: '5', value: 33 },
]

export const smsLog = [
  { phone: '052-•••4821', status: 'נמסר ✓', tone: 'success' as const },
  { phone: '054-•••1177', status: 'נמסר ✓', tone: 'success' as const },
  { phone: '050-•••9034', status: 'Opt-out', tone: 'peach' as const },
  { phone: '053-•••2568', status: 'בתור…', tone: 'warn' as const },
]

export const defaultBranding: BrandingState = {
  themeId: 'shaveh',
  primary: '#0d4ef2',
  textColor: '#12265a',
  ctaColor: '#d9f051',
  bgColor: '#e9f2fd',
  headFont: 'Rubik',
  bodyFont: 'Assistant',
  darkMode: 'auto',
}

export const defaultNotif: NotifState = {
  confirmEnabled: true,
  subject: 'קיבלנו את הרשמתך לכנס, {{first_name}} 🎟',
  fromAddress: 'events@shaveh360.co.il',
  attachPdf: true,
  attachIcal: true,
  ownerEnabled: true,
  recipients: ['michal@shaveh360.co.il', 'events@shaveh360.co.il'],
  digest: false,
  smsEnabled: true,
  smsTemplate:
    'היי {{first_name}}, נרשמת בהצלחה לכנס המוצר 2026! פרטים וכרטיס: {{short_url}}',
  smsReminder: true,
}
