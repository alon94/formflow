/** Canonical seed data â single source for the API server and the frontend fallback. */

export const FORM_ID = 'conf-2026'
export const FORM_SLUG = 'product-conf-2026'
export const FORM_NAME = '××¨×©×× ××× ×¡ ××××¦×¨ 2026'

export const seedFields = [
  {
    id: 'fld-member',
    type: 'radio',
    label: '×××¨×ª ×××¢××× ×©×××?',
    required: true,
    fieldKey: 'member',
    options: ['××, ×××¨× ×××¢×××', '×¢×××× ××'],
    page: 1,
  },
  {
    id: 'fld-participants',
    type: 'number',
    label: '××¡×¤×¨ ××©×ª×ª×¤××',
    placeholder: '×××©×: 2',
    required: true,
    fieldKey: 'participants',
    page: 1,
  },
  {
    id: 'fld-first',
    type: 'short_text',
    label: '×©× ×¤×¨××',
    placeholder: '××©×¨××',
    required: true,
    fieldKey: 'first_name',
    half: true,
    page: 2,
  },
  {
    id: 'fld-last',
    type: 'short_text',
    label: '×©× ××©×¤××',
    placeholder: '××©×¨×××',
    required: true,
    fieldKey: 'last_name',
    half: true,
    page: 2,
  },
  {
    id: 'fld-email',
    type: 'email',
    label: '××ª×××ª ××××',
    placeholder: 'name@company.co.il',
    help: '×××©××¨ ×××¨×©×× ×××©×× ×××ª×××ª ××',
    required: true,
    unique: true,
    errorMessage: '× × ××××× ××ª×××ª ×××× ×ª×§×× ×',
    fieldKey: 'email',
    page: 2,
  },
  {
    id: 'fld-track',
    type: 'radio',
    label: '××××× ××¡××× ×ª×©×ª×ª×¤×?',
    required: true,
    fieldKey: 'track',
    options: ['×××¦×¨ ×× ××××', '×¤××ª×× ××× ××¡×', '×¢××¦×× ×-UX'],
    page: 2,
  },
  {
    id: 'fld-workshop',
    type: 'dropdown',
    label: '××××¨×ª ×¡×× ×ª ×¢××¦××',
    help: '×××¦× ×¨×§ ×××¡××× ×¢××¦×× ×-UX (××× ×××××§×)',
    required: false,
    fieldKey: 'design_workshop',
    options: ['Design Systems ××¢××¨××ª', '×××§×¨ ××©×ª××©×× ××××¨', '×¤×¨×××××××¤×× × ×-Figma'],
    page: 2,
  },
  {
    id: 'fld-notes',
    type: 'long_text',
    label: '××¢×¨××ª ×××¢××¤××ª (×××¤×¦××× ××)',
    placeholder: '× ×××©××ª, ×ª××× ×, ×× ×××¨ ×©× ×¦××¨× ×××¢×ªâ¦',
    required: false,
    fieldKey: 'notes',
    page: 3,
  },
  {
    id: 'fld-terms',
    type: 'radio',
    label: '×××©××¨ ×ª×§× ××',
    required: true,
    fieldKey: 'terms',
    options: ['×§×¨××ª× ××× × ×××©×¨/×ª ××ª ×ª× ×× ×××©×ª×ª×¤××ª'],
    page: 3,
  },
]

export const seedRules = [
  {
    id: 'rule-1',
    name: '××¦××ª ×©×××ª ×¡×× × ×××¡××× ×¢××¦××',
    scope: 'fill',
    enabled: true,
    combinator: 'and',
    conditions: [{ fieldKey: 'track', op: 'eq', value: '×¢××¦×× ×-UX' }],
    actions: [{ type: 'show_field', fieldKey: 'design_workshop' }],
  },
  {
    id: 'rule-2',
    name: '× ××ª×× ×¤× ×××ª VIP ××××× ×× ×××ª ××××¨××¢',
    scope: 'submit',
    enabled: true,
    combinator: 'and',
    conditions: [
      { fieldKey: 'participants', op: 'gt', value: '5' },
      { fieldKey: 'member', op: 'eq', value: '××, ×××¨× ×××¢×××' },
    ],
    actions: [
      { type: 'route_email', to: 'vip@shaveh360.co.il' },
      { type: 'add_tag', text: 'VIP', color: 'peach' },
    ],
  },
  {
    id: 'rule-3',
    name: '××××× ×¢× ×¢××× ×¤×¨××× ××××¨× ×××¢×××',
    scope: 'fill',
    enabled: false,
    combinator: 'and',
    conditions: [{ fieldKey: 'member', op: 'eq', value: '××, ×××¨× ×××¢×××' }],
    actions: [{ type: 'jump_page', page: 3, label: '3 Â· ×¡××××' }],
  },
]

const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()

export const seedSubmissions = [
  {
    id: 1128,
    values: {
      member: '××, ×××¨× ×××¢×××',
      participants: '7',
      first_name: '× ××¢×',
      last_name: '××¨×§',
      email: 'noa@acme.co.il',
      track: '×××¦×¨ ×× ××××',
      terms: '×§×¨××ª× ××× × ×××©×¨/×ª ××ª ×ª× ×× ×××©×ª×ª×¤××ª',
    },
    name: '× ××¢× ××¨×§',
    email: 'noa@acme.co.il',
    track: '×××¦×¨ ×× ××××',
    tags: [{ text: 'VIP', color: 'peach' }],
    status: 'new',
    notes: '',
    submittedAt: minutesAgo(4),
  },
  {
    id: 1127,
    values: {
      member: '×¢×××× ××',
      participants: '1',
      first_name: '××××¨',
      last_name: '×××',
      email: 'amir.c@gmail.com',
      track: '×¤××ª×× ××× ××¡×',
      terms: '×§×¨××ª× ××× × ×××©×¨/×ª ××ª ×ª× ×× ×××©×ª×ª×¤××ª',
    },
    name: '××××¨ ×××',
    email: 'amir.c@gmail.com',
    track: '×¤××ª×× ××× ××¡×',
    tags: [],
    status: 'in_progress',
    notes: '',
    submittedAt: minutesAgo(22),
  },
  {
    id: 1126,
    values: {
      member: '×¢×××× ××',
      participants: '1',
      first_name: '×× ×',
      last_name: '×××',
      email: 'dana@studio-d.co',
      track: '×¢××¦×× ×-UX',
      design_workshop: '×¤×¨×××××××¤×× × ×-Figma',
      notes: '××§××§× ××××©××¨ ×¡×××× ×××ª',
      terms: '×§×¨××ª× ××× × ×××©×¨/×ª ××ª ×ª× ×× ×××©×ª×ª×¤××ª',
    },
    name: '×× × ×××',
    email: 'dana@studio-d.co',
    track: '×¢××¦×× ×-UX',
    tags: [{ text: '×¡×××× ×××ª', color: 'purple' }],
    status: 'done',
    notes: '× ×©×× ×××©××¨ ×× ××',
    submittedAt: minutesAgo(64),
  },
  {
    id: 1125,
    values: {
      member: '××, ×××¨× ×××¢×××',
      participants: '2',
      first_name: '×××¡×',
      last_name: '×××¨××',
      email: 'yossi@tlv-events.com',
      track: '×××¦×¨ ×× ××××',
      terms: '×§×¨××ª× ××× × ×××©×¨/×ª ××ª ×ª× ×× ×××©×ª×ª×¤××ª',
    },
    name: '×××¡× ×××¨××',
    email: 'yossi@tlv-events.com',
    track: '×××¦×¨ ×× ××××',
    tags: [],
    status: 'done',
    notes: '',
    submittedAt: minutesAgo(183),
  },
]

export const seedNotif = {
  confirmEnabled: true,
  subject: '×§×××× × ××ª ××¨×©××ª× ××× ×¡, {{first_name}} ð',
  fromAddress: 'events@shaveh360.co.il',
  attachPdf: true,
  attachIcal: true,
  ownerEnabled: true,
  recipients: ['michal@shaveh360.co.il', 'events@shaveh360.co.il'],
  digest: false,
  smsEnabled: true,
  smsTemplate: '××× {{first_name}}, × ×¨×©××ª ×××¦××× ××× ×¡ ××××¦×¨ 2026! ×¤×¨××× ×××¨×××¡: {{short_url}}',
  smsReminder: true,
}

export const seedNotifications = [
  {
    id: 'ntf-1',
    submissionId: 1128,
    channel: 'email',
    recipient: 'noa@acme.co.il',
    status: 'delivered',
    note: '×××× ×××©××¨ ×××××',
    at: minutesAgo(4),
  },
  {
    id: 'ntf-2',
    submissionId: 1128,
    channel: 'email',
    recipient: 'vip@shaveh360.co.il',
    status: 'delivered',
    note: '× ××ª×× ××¤× ×××: × ××ª×× ×¤× ×××ª VIP',
    at: minutesAgo(4),
  },
  {
    id: 'ntf-3',
    submissionId: 1128,
    channel: 'sms',
    recipient: '052-â¢â¢â¢4821',
    status: 'delivered',
    note: 'SMS ×××©××¨ ×××××',
    at: minutesAgo(3),
  },
]

export const seedBranding = {
  themeId: 'shaveh',
  primary: '#0d4ef2',
  textColor: '#12265a',
  ctaColor: '#d9f051',
  bgColor: '#e9f2fd',
  headFont: 'Rubik',
  bodyFont: 'Assistant',
  darkMode: 'auto',
}

export const seedSettings = {
  closeAt: '2026-11-10',
  maxResponses: '400',
  onePerUser: true,
  passwordProtect: false,
}

export const seedWebhooks = [
  {
    id: 'wh-crm',
    url: 'https://crm.shaveh360.co.il/api/leads/formflow',
    events: ['submission.created'],
    active: true,
    secret: 'whsec_9f2c4e81a7d34b6c',
  },
  {
    id: 'wh-slack',
    url: 'https://hooks.slack.com/services/T360/B42/reg-updates',
    events: ['submission.created', 'submission.updated'],
    active: false,
    secret: 'whsec_2b8d1f6c3a904e57',
  },
]

const seedLogTime = (m) => new Date(Date.now() - m * 60_000).toISOString()

export const seedWebhookLogs = [
  {
    id: 'whl-3',
    webhookId: 'wh-crm',
    submissionId: 1128,
    event: 'submission.created',
    status: 200,
    attempt: 1,
    payload: '{"event":"submission.created","submission":{"id":1128,"track":"×××¦×¨ ×× ××××"}}',
    at: seedLogTime(4),
  },
  {
    id: 'whl-2',
    webhookId: 'wh-crm',
    submissionId: 1127,
    event: 'submission.created',
    status: 500,
    attempt: 1,
    payload: '{"event":"submission.created","submission":{"id":1127,"track":"×¤××ª×× ××× ××¡×"}}',
    at: seedLogTime(22),
  },
  {
    id: 'whl-1',
    webhookId: 'wh-crm',
    submissionId: 1127,
    event: 'submission.created',
    status: 200,
    attempt: 2,
    payload: '{"event":"submission.created","submission":{"id":1127,"track":"×¤××ª×× ××× ××¡×"}}',
    at: seedLogTime(21),
  },
]

export const DEMO_WORKSPACE_ID = 'ws-shaveh360'
/* emails whose login lands in the seeded demo workspace */
export const DEMO_EMAILS = ['israel@gmail.com', 'israel@outlook.com', 'demo@shaveh360.co.il']

export function defaultNotifFor(name) {
  return {
    ...seedNotif,
    subject: `×§×××× × ××ª ××¤× ××× ×©×× â ${name}`,
    smsTemplate: `××× {{first_name}}, ×§×××× × ××ª ××¤× ××× ×©×× ×-${name}. × ××××¨ ×××× ××§×¨××: {{short_url}}`,
  }
}

export const defaultSettingsFor = () => ({
  closeAt: '',
  maxResponses: '',
  onePerUser: true,
  passwordProtect: false,
})

function simpleForm(id, slug, name, folder, icon, status, fields) {
  return {
    id,
    slug,
    name,
    folder,
    icon,
    status,
    version: 1,
    fields,
    rules: [],
    notif: defaultNotifFor(name),
    branding: { ...seedBranding },
    webhooks: [],
    settings: defaultSettingsFor(),
  }
}

const f = (key, label, type, extra = {}) => ({
  id: `fld-${key}`,
  type,
  label,
  required: false,
  fieldKey: key,
  page: 1,
  ...extra,
})

export function buildSeedForms() {
  const conference = {
    id: FORM_ID,
    slug: FORM_SLUG,
    name: FORM_NAME,
    folder: '×××¨××¢××',
    icon: 'ticket',
    status: 'published',
    version: 2,
    fields: seedFields,
    rules: seedRules,
    notif: seedNotif,
    branding: seedBranding,
    webhooks: seedWebhooks,
    settings: seedSettings,
  }
  return [
    conference,
    simpleForm('hr-onboarding', 'hr-onboarding', '×§××××ª ×¢××× ×××© â ××©××× ×× ××©', 'HR', 'hand', 'published', [
      f('first_name', '×©× ×¤×¨××', 'short_text', { required: true, half: true }),
      f('last_name', '×©× ××©×¤××', 'short_text', { required: true, half: true }),
      f('id_number', '×ª×¢×××ª ××××ª', 'id_number', { required: true, placeholder: '9 ×¡×¤×¨××ª' }),
      f('email', '××ª×××ª ××××', 'email', { required: true, placeholder: 'name@company.co.il' }),
      f('start_date', '×ª××¨×× ×ª××××ª ×¢××××', 'date', { required: true }),
    ]),
    simpleForm('contact', 'contact-us', '×¦××¨ ×§×©×¨ â ××ª×¨ ××××¨×', '××××¨××ª', 'phone', 'published', [
      f('first_name', '×©× ×××', 'short_text', { required: true }),
      f('email', '××ª×××ª ××××', 'email', { required: true }),
      f('phone', '×××¤××', 'phone'),
      f('notes', '××× × ××× ××¢×××¨?', 'long_text', { required: true }),
    ]),
    simpleForm('nps-q3', 'nps-q3', '××©×× ××§××××ª Q3', '××©××', 'file', 'draft', [
      f('rating', '×¢× ××× ×ª××××¦× ×¢××× ×?', 'rating', { required: true }),
      f('notes', '×¡×¤×¨× ×× × ×××', 'long_text'),
    ]),
    simpleForm('webinar-june', 'webinar-june', '××¨×©×× ×××××× ×¨ â ××× ×', '×××¨××¢××', 'graduation', 'closed', [
      f('first_name', '×©× ×××', 'short_text', { required: true }),
      f('email', '××ª×××ª ××××', 'email', { required: true }),
    ]),
  ]
}

export function buildSeedDb() {
  return {
    workspaces: [
      {
        id: DEMO_WORKSPACE_ID,
        name: '×©××× ×¢×¡×§×× 360',
        ownerEmail: DEMO_EMAILS[0],
        ownerName: '××©×¨×× ×©×××',
        members: DEMO_EMAILS,
        createdAt: new Date().toISOString(),
      },
    ],
    forms: buildSeedForms().map((form) => ({ ...form, workspaceId: DEMO_WORKSPACE_ID })),
    submissions: seedSubmissions.map((s) => ({ ...s, formId: FORM_ID })),
    notifications: seedNotifications,
    webhookLogs: seedWebhookLogs,
    versions: [],
    customTemplates: [],
    nextSubmissionId: 1129,
    baseline: { total: 124, completion: 82, avgTime: '2:41', nps: 46 },
  }
}
