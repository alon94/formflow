import {
  Briefcase,
  FilePlus2,
  LayoutTemplate,
  MessageSquare,
  Ticket,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import Toggle from '../components/Toggle'
import { FORM_ID } from '../lib/data'
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
  { key: 'email', label: 'כתובת מייל', type: 'email', typeLabel: 'מייל', required: true, unique: true, placeholder: 'name@company.co.il', help: 'האישור יישלח לכתובת זו' },
  { key: 'phone', label: 'טלפון נייד', type: 'phone', typeLabel: 'טלפון', placeholder: '050-0000000' },
  { key: 'company', label: 'שם החברה', type: 'short_text', typeLabel: 'טקסט קצר', placeholder: 'החברה שלי בע״מ' },
  { key: 'choice', label: 'בחירה מרשימה', type: 'radio', typeLabel: 'בחירה יחידה', options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3'] },
  { key: 'event_date', label: 'תאריך מועדף', type: 'date', typeLabel: 'תאריך' },
  { key: 'rating', label: 'דירוג כללי', type: 'rating', typeLabel: 'דירוג' },
  { key: 'notes', label: 'הערות חופשיות', type: 'long_text', typeLabel: 'טקסט ארוך', placeholder: 'ספרו לנו עוד…' },
  { key: 'terms', label: 'אישור תקנון', type: 'radio', typeLabel: 'אישור', required: true, options: ['קראתי ואני מאשר/ת את התנאים'] },
]

const TEMPLATES = [
  {
    id: 'scratch',
    icon: <FilePlus2 size={18} />,
    title: 'טופס ריק',
    desc: 'מתחילים מאפס ובוחרים שדות בעצמכם',
    name: 'טופס חדש',
    folder: 'כללי',
    keys: ['first_name', 'last_name', 'email'],
  },
  {
    id: 'event',
    icon: <Ticket size={18} />,
    title: 'הרשמה לאירוע',
    desc: 'פרטי קשר, בחירת מסלול ואישור תקנון',
    name: 'הרשמה לאירוע חדש',
    folder: 'אירועים',
    keys: ['first_name', 'last_name', 'email', 'phone', 'choice', 'terms'],
  },
  {
    id: 'contact',
    icon: <Briefcase size={18} />,
    title: 'צור קשר / ליד',
    desc: 'ליד נקי ל-CRM: פרטי קשר וחברה + הודעה',
    name: 'צור קשר',
    folder: 'מכירות',
    keys: ['first_name', 'last_name', 'email', 'phone', 'company', 'notes'],
  },
  {
    id: 'feedback',
    icon: <MessageSquare size={18} />,
    title: 'משוב לקוחות',
    desc: 'דירוג + טקסט חופשי, אנונימי או מזוהה',
    name: 'משוב לקוחות',
    folder: 'משוב',
    keys: ['rating', 'notes', 'email'],
  },
  {
    id: 'hr',
    icon: <UserPlus size={18} />,
    title: 'קליטת עובד/ת',
    desc: 'פרטים אישיים מלאים לתחילת עבודה',
    name: 'קליטת עובד/ת חדש/ה',
    folder: 'HR',
    keys: ['first_name', 'last_name', 'email', 'phone', 'event_date', 'terms'],
  },
]

const FOLDERS = ['כללי', 'אירועים', 'מכירות', 'משוב', 'HR']
const TOTAL = 4

export default function NewFormWizard() {
  const { setFields, setFormName, setNotif } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const preselect = (location.state as { template?: string } | null)?.template

  const [step, setStep] = useState(1)
  const [templateId, setTemplateId] = useState(preselect ?? 'event')
  const [name, setName] = useState('')
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
    if (!name.trim()) setName(t.name)
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

  const create = () => {
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
    setFormName(finalName)
    setFields(fields)
    setNotif({ confirmEnabled: confirmEmail, ownerEnabled: notifyOwner })
    window.setTimeout(() => navigate(`/form/${FORM_ID}/build`), 350)
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
                onChange={(e) => setName(e.target.value)}
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
