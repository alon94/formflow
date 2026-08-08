import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CreditCard,
  FilePlus2,
  FileText,
  GraduationCap,
  LayoutTemplate,
  LifeBuoy,
  Mail,
  MessageSquare,
  ShoppingCart,
  Ticket,
  UserPlus,
  Video,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import Toggle from '../components/Toggle'
import { api } from '../lib/api'
import { defaultBranding, defaultNotif, defaultSettings } from '../lib/data'
import { useStore } from '../lib/store'
import type { FormField } from '../lib/types'

interface QuickField {
  key: string
  label: string
  type: FormField['type']
  typeLabel: string
  required?: boolean
  unique?: boolean
  half?: boolean
  options?: string[]
  placeholder?: string
  help?: string
}

const CATALOG: QuickField[] = [
  { key: 'first_name', label: 'שם פרטי', type: 'short_text', typeLabel: 'טקסט קצר', required: true, half: true, placeholder: 'ישראל' },
  { key: 'last_name', label: 'שם משפחה', type: 'short_text', typeLabel: 'טקסט קצר', required: true, half: true, placeholder: 'ישראלי' },
  { key: 'full_name', label: 'שם מלא', type: 'short_text', typeLabel: 'טקסט קצר', required: true, placeholder: 'ישראל ישראלי' },
  { key: 'email', label: 'כתובת מייל', type: 'email', typeLabel: 'מייל', required: true, unique: true, placeholder: 'name@company.co.il', help: 'האישור יישלח לכתובת זו' },
  { key: 'phone', label: 'טלפון נייד', type: 'phone', typeLabel: 'טלפון', placeholder: '050-0000000' },
  { key: 'company', label: 'שם החברה', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'החברה שלי בע״מ' },
  { key: 'role', label: 'תפקיד', type: 'short_text', typeLabel: 'טקסט קצר', half: true, placeholder: 'מנהל/ת שיווק' },
  { key: 'address', label: 'כתובת', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'רחוב ומספר' },
  { key: 'city', label: 'עיר', type: 'short_text', typeLabel: 'טקסט קצר', half: true, placeholder: 'תל אביב' },
  { key: 'subject', label: 'נושא הפנייה', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'במה נוכל לעזור?' },
  { key: 'message', label: 'תוכן ההודעה', type: 'long_text', typeLabel: 'טקסט ארוך', required: true, placeholder: 'כתבו לנו כאן…' },
  { key: 'choice', label: 'בחירה מרשימה', type: 'radio', typeLabel: 'בחירה יחידה', options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3'] },
  { key: 'department', label: 'מחלקה', type: 'dropdown', typeLabel: 'רשימה נפתחת', options: ['תמיכה', 'מכירות', 'חיוב', 'כללי'] },
  { key: 'priority', label: 'דחיפות', type: 'radio', typeLabel: 'בחירה יחידה', options: ['נמוכה', 'רגילה', 'גבוהה', 'דחוף'] },
  { key: 'quantity', label: 'כמות', type: 'number', typeLabel: 'מספר', half: true, placeholder: '1' },
  { key: 'product', label: 'מוצר / שירות', type: 'dropdown', typeLabel: 'רשימה נפתחת', options: ['מוצר א׳', 'מוצר ב׳', 'מוצר ג׳'] },
  { key: 'budget', label: 'תקציב משוער', type: 'dropdown', typeLabel: 'רשימה נפתחת', options: ['עד 1,000 ₪', '1,000–5,000 ₪', '5,000–20,000 ₪', 'מעל 20,000 ₪'] },
  { key: 'event_date', label: 'תאריך מועדף', type: 'date', typeLabel: 'תאריך' },
  { key: 'appointment_date', label: 'תאריך לתיאום', type: 'date', typeLabel: 'תאריך', half: true },
  { key: 'time_slot', label: 'שעה מועדפת', type: 'dropdown', typeLabel: 'רשימה נפתחת', half: true, options: ['בוקר (09:00–12:00)', 'צהריים (12:00–15:00)', 'אחה״צ (15:00–18:00)', 'ערב (18:00–21:00)'] },
  { key: 'guests', label: 'מספר משתתפים', type: 'number', typeLabel: 'מספר', half: true, placeholder: '2' },
  { key: 'rating', label: 'דירוג כללי', type: 'rating', typeLabel: 'דירוג' },
  { key: 'recommend', label: 'עד כמה תמליצו לחבר?', type: 'rating', typeLabel: 'דירוג' },
  { key: 'position', label: 'משרה מבוקשת', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'מפתח/ת Full-Stack' },
  { key: 'experience', label: 'שנות ניסיון', type: 'number', typeLabel: 'מספר', half: true, placeholder: '3' },
  { key: 'linkedin', label: 'קישור לפרופיל / תיק עבודות', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'https://…' },
  { key: 'id_number', label: 'תעודת זהות', type: 'id_number', typeLabel: 'ת״ז' },
  { key: 'birth_date', label: 'תאריך לידה', type: 'date', typeLabel: 'תאריך', half: true },
  { key: 'amount', label: 'סכום לתשלום', type: 'payment', typeLabel: 'תשלום' },
  { key: 'notes', label: 'הערות חופשיות', type: 'long_text', typeLabel: 'טקסט ארוך', placeholder: 'ספרו לנו עוד…' },
  { key: 'newsletter', label: 'הרשמה לעדכונים', type: 'checkbox', typeLabel: 'תיבת סימון', options: ['אשמח לקבל עדכונים ומבצעים'] },
  { key: 'terms', label: 'אישור תקנון', type: 'radio', typeLabel: 'אישור', required: true, options: ['קראתי ואני מאשר/ת את התנאים'] },
]

const TEMPLATES = [
  {
    id: 'scratch',
    iconKey: 'file',
    icon: <FilePlus2 size={18} />,
    title: 'טופס ריק',
    desc: 'מתחילים מאפס ובוחרים שדות בעצמכם',
    name: 'טופס חדש',
    folder: 'כללי',
    keys: ['first_name', 'last_name', 'email'],
  },
  {
    id: 'event',
    iconKey: 'ticket',
    icon: <Ticket size={18} />,
    title: 'הרשמה לאירוע',
    desc: 'פרטי קשר, בחירת מסלול ואישור תקנון',
    name: 'הרשמה לאירוע חדש',
    folder: 'אירועים',
    keys: ['first_name', 'last_name', 'email', 'phone', 'choice', 'terms'],
  },
  {
    id: 'rsvp',
    iconKey: 'calendar',
    icon: <CalendarCheck size={18} />,
    title: 'אישור הגעה (RSVP)',
    desc: 'אישור הגעה, מספר אורחים והערות',
    name: 'אישור הגעה',
    folder: 'אירועים',
    keys: ['full_name', 'phone', 'guests', 'choice', 'notes'],
  },
  {
    id: 'webinar',
    iconKey: 'ticket',
    icon: <Video size={18} />,
    title: 'הרשמה לוובינר',
    desc: 'רישום להדרכה אונליין + תזכורת במייל',
    name: 'הרשמה לוובינר',
    folder: 'אירועים',
    keys: ['first_name', 'last_name', 'email', 'company', 'role', 'newsletter'],
  },
  {
    id: 'contact',
    iconKey: 'phone',
    icon: <Briefcase size={18} />,
    title: 'צור קשר / ליד',
    desc: 'ליד נקי ל-CRM: פרטי קשר וחברה + הודעה',
    name: 'צור קשר',
    folder: 'מכירות',
    keys: ['first_name', 'last_name', 'email', 'phone', 'company', 'message'],
  },
  {
    id: 'quote',
    iconKey: 'file',
    icon: <FileText size={18} />,
    title: 'בקשת הצעת מחיר',
    desc: 'פרטי לקוח, מוצר, תקציב ולוח זמנים',
    name: 'בקשת הצעת מחיר',
    folder: 'מכירות',
    keys: ['full_name', 'email', 'phone', 'company', 'product', 'budget', 'message'],
  },
  {
    id: 'order',
    iconKey: 'cart',
    icon: <ShoppingCart size={18} />,
    title: 'טופס הזמנה',
    desc: 'בחירת מוצר, כמות ופרטי משלוח',
    name: 'טופס הזמנה',
    folder: 'מכירות',
    keys: ['full_name', 'email', 'phone', 'product', 'quantity', 'address', 'city', 'notes'],
  },
  {
    id: 'appointment',
    iconKey: 'calendar',
    icon: <CalendarClock size={18} />,
    title: 'תיאום פגישה',
    desc: 'בחירת תאריך ושעה + פרטי קשר',
    name: 'תיאום פגישה',
    folder: 'מכירות',
    keys: ['full_name', 'email', 'phone', 'appointment_date', 'time_slot', 'notes'],
  },
  {
    id: 'feedback',
    iconKey: 'file',
    icon: <MessageSquare size={18} />,
    title: 'משוב לקוחות',
    desc: 'דירוג + טקסט חופשי, אנונימי או מזוהה',
    name: 'משוב לקוחות',
    folder: 'משוב',
    keys: ['rating', 'recommend', 'message'],
  },
  {
    id: 'survey',
    iconKey: 'chart',
    icon: <BarChart3 size={18} />,
    title: 'סקר / שאלון',
    desc: 'שאלות בחירה ודירוג לאיסוף דעות',
    name: 'סקר חדש',
    folder: 'משוב',
    keys: ['full_name', 'email', 'choice', 'rating', 'message'],
  },
  {
    id: 'support',
    iconKey: 'ticket',
    icon: <LifeBuoy size={18} />,
    title: 'פניית תמיכה',
    desc: 'קריאת שירות עם דחיפות ומחלקה',
    name: 'פניית תמיכה',
    folder: 'תמיכה',
    keys: ['full_name', 'email', 'department', 'priority', 'subject', 'message'],
  },
  {
    id: 'hr',
    iconKey: 'user',
    icon: <UserPlus size={18} />,
    title: 'הצטרפות עובד/ת',
    desc: 'קליטת עובד: פרטים אישיים ותפקיד',
    name: 'טופס קליטת עובד',
    folder: 'HR',
    keys: ['first_name', 'last_name', 'id_number', 'birth_date', 'phone', 'email', 'role'],
  },
  {
    id: 'job',
    iconKey: 'user',
    icon: <Briefcase size={18} />,
    title: 'הגשת מועמדות',
    desc: 'משרה, ניסיון וקישור לתיק עבודות',
    name: 'הגשת מועמדות',
    folder: 'HR',
    keys: ['full_name', 'email', 'phone', 'position', 'experience', 'linkedin', 'message'],
  },
  {
    id: 'newsletter',
    iconKey: 'mail',
    icon: <Mail size={18} />,
    title: 'הרשמה לרשימת תפוצה',
    desc: 'איסוף מיילים לניוזלטר במהירות',
    name: 'הרשמה לעדכונים',
    folder: 'שיווק',
    keys: ['full_name', 'email', 'newsletter', 'terms'],
  },
  {
    id: 'payment',
    iconKey: 'card',
    icon: <CreditCard size={18} />,
    title: 'תשלום / תרומה',
    desc: 'גביית תשלום עם פרטי משלם וסכום',
    name: 'טופס תשלום',
    folder: 'תשלומים',
    keys: ['full_name', 'email', 'phone', 'amount', 'terms'],
  },
  {
    id: 'registration',
    iconKey: 'ticket',
    icon: <GraduationCap size={18} />,
    title: 'הרשמה לקורס',
    desc: 'רישום לתוכנית לימוד עם פרטי משתתף',
    name: 'הרשמה לקורס',
    folder: 'אירועים',
    keys: ['first_name', 'last_name', 'email', 'phone', 'choice', 'terms'],
  },
]

const FOLDERS = ['כללי', 'אירועים', 'מכירות', 'משוב', 'תמיכה', 'HR', 'שיווק', 'תשלומים']
const TOTAL = 4

export default function NewFormWizard() {
  const { user } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const preselect = (location.state as { template?: string } | null)?.template

  const [step, setStep] = useState(1)
  const [templateId, setTemplateId] = useState(preselect ?? 'event')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [folder, setFolder] = useState('אירועים')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(TEMPLATES.find((t) => t.id === (preselect ?? 'event'))!.keys),
  )
  const [confirmEmail, setConfirmEmail] = useState(true)
  const [notifyOwner, setNotifyOwner] = useState(true)
  const [creating, setCreating] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId)!

  const chooseTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!
    setTemplateId(id)
    setSelectedKeys(new Set(t.keys))
    setFolder(t.folder)
    /* switching templates refreshes the suggested name unless the user typed one */
    if (!nameTouched) setName(t.name)
  }

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const fieldsPreview = useMemo(
    () => CATALOG.filter((f) => selectedKeys.has(f.key)),
    [selectedKeys],
  )

  const create = async () => {
    setCreating(true)
    const finalName = name.trim() || template.name
    const fields: FormField[] = fieldsPreview.map((f, i) => ({
      id: `fld-wiz-${Date.now()}-${i}`,
      type: f.type,
      label: f.label,
      required: !!f.required,
      unique: f.unique,
      fieldKey: f.key,
      half: f.half,
      options: f.options,
      placeholder: f.placeholder,
      help: f.help,
      errorMessage: f.type === 'email' ? 'נא להזין כתובת מייל תקינה' : undefined,
      page: 1,
    }))
    const notifDoc = {
      ...defaultNotif,
      subject: `קיבלנו את הפנייה שלך — ${finalName}`,
      confirmEnabled: confirmEmail,
      ownerEnabled: notifyOwner,
      recipients: user ? [user.email] : defaultNotif.recipients,
    }
    try {
      /* provisions real form infrastructure (server or local backend),
       * then building starts on the newly created form */
      const form = await api.createForm({
        name: finalName,
        folder,
        icon: template.iconKey,
        fields,
        notif: notifDoc,
        branding: { ...defaultBranding },
        settings: { ...defaultSettings },
      })
      navigate(`/form/${form.id}/build`)
    } catch (err) {
      setCreating(false)
      console.error('Form creation failed', err)
      alert('יצירת הטופס נכשלה. נסו שוב או פנו לתמיכה.')
    }
  }

  const next = () => {
    if (step === 1 && !name.trim()) setName(template.name)
    if (step < TOTAL) setStep(step + 1)
    else create()
  }

  const stepTitles = ['נקודת פתיחה', 'פרטי הטופס', 'בחירת שדות', 'התראות וסיכום']

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />

      <div className="flow-card wide fade-up">
        <div className="flow-steps" aria-label={`שלב ${step} מתוך ${TOTAL}`}>
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={`bar${s < step ? ' done' : s === step ? ' current' : ''}`}>
              <span />
            </span>
          ))}
          <span className="flow-step-label">
            {step} / {TOTAL} · {stepTitles[step - 1]}
          </span>
        </div>

        {step === 1 && (
          <>
            <div>
              <h1 className="flow-title">טופס חדש — מאיפה מתחילים?</h1>
              <div className="flow-sub">אפשר מתבנית מוכנה או מאפס. הכל ניתן לעריכה אחר כך בבונה.</div>
            </div>
            <div className="goal-grid" role="radiogroup" aria-label="נקודת פתיחה">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={templateId === t.id}
                  className={`goal-card${templateId === t.id ? ' selected' : ''}`}
                  onClick={() => chooseTemplate(t.id)}
                >
                  <span className="icon-tile" style={{ width: 34, height: 34 }}>
                    {t.icon}
                  </span>
                  <span className="g-title">{t.title}</span>
                  <span className="g-desc">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="settings-note">
              <LayoutTemplate size={13} style={{ verticalAlign: -2 }} /> הבונה יחליף את
              תוכן טופס הדמו — אפשר תמיד לחזור אליו דרך «היסטוריית גרסאות» (אייקון
              השעון בבונה).
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h1 className="flow-title">איך נקרא לטופס?</h1>
              <div className="flow-sub">השם מופיע לממלאים בכותרת ובמייל האישור</div>
            </div>
            <div className="pub-field">
              <label htmlFor="wiz-name">שם הטופס</label>
              <input
                id="wiz-name"
                className="pub-input"
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value)
                  setNameTouched(e.target.value.trim() !== '')
                }}
                placeholder={template.name}
              />
            </div>
            <div className="limits-grid">
              <div className="pub-field">
                <label htmlFor="wiz-folder">תיקייה</label>
                <select
                  id="wiz-folder"
                  className="select-input"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                >
                  {FOLDERS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pub-field">
                <label htmlFor="wiz-lang">שפת הטופס</label>
                <select id="wiz-lang" className="select-input" defaultValue="he">
                  <option value="he">עברית (RTL)</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h1 className="flow-title">אילו שדות נכניס?</h1>
              <div className="flow-sub">
                נבחרו {selectedKeys.size} שדות · אפשר לגרור, לערוך ולהוסיף עוד בבונה
              </div>
            </div>
            <div className="wiz-fields">
              {CATALOG.map((f) => {
                const on = selectedKeys.has(f.key)
                return (
                  <div key={f.key} className="wiz-field-row">
                    <Toggle small on={on} onChange={() => toggleKey(f.key)} label={f.label} />
                    <span className="nm">
                      {f.label}
                      {f.required && on && <span className="req-star"> *</span>}
                    </span>
                    <span className="tp">{f.typeLabel}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <h1 className="flow-title">רגע לפני שיוצרים</h1>
              <div className="flow-sub">התראות בסיס — אפשר לדייק הכל אחר כך בלשונית ההגדרות</div>
            </div>
            <div className="toggle-row">
              מייל אישור אוטומטי לממלא
              <Toggle on={confirmEmail} onChange={setConfirmEmail} label="מייל אישור לממלא" />
            </div>
            <div className="toggle-row">
              התראה אליי על כל תשובה
              <Toggle on={notifyOwner} onChange={setNotifyOwner} label="התראה לבעל הטופס" />
            </div>
            <div className="wiz-summary">
              <div className="row">
                <span className="k">שם הטופס</span>
                <span className="v">{name.trim() || template.name}</span>
              </div>
              <div className="row">
                <span className="k">תיקייה</span>
                <span className="v">{folder}</span>
              </div>
              <div className="row">
                <span className="k">שדות</span>
                <span className="v">
                  {fieldsPreview.map((f) => f.label).join(' · ') || '—'}
                </span>
              </div>
              <div className="row">
                <span className="k">התראות</span>
                <span className="v">
                  {[confirmEmail && 'אישור לממלא', notifyOwner && 'התראה אליי']
                    .filter(Boolean)
                    .join(' + ') || 'כבויות'}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flow-footer">
          <button
            type="button"
            className="pub-cta"
            style={{ color: '#12265a' }}
            onClick={next}
            disabled={creating || (step === 3 && selectedKeys.size === 0)}
          >
            {creating ? 'יוצר…' : step === TOTAL ? 'יצירת הטופס ←' : 'להמשך ←'}
          </button>
          {step > 1 && (
            <button type="button" className="pub-back" onClick={() => setStep(step - 1)}>
              → חזרה
            </button>
          )}
          <button type="button" className="flow-skip" onClick={() => navigate('/')}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
