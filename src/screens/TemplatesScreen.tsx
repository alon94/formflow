import {
  Briefcase,
  CalendarHeart,
  ClipboardList,
  Copy,
  Download,
  GraduationCap,
  HeartPulse,
  Home,
  MessageSquare,
  PartyPopper,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminTopbar from '../components/AdminTopbar'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { CustomTemplate } from '../lib/types'

interface BuiltinTemplate {
  name: string
  category: string
  desc: string
  fields: number
  icon: React.ReactNode
  wizardId?: string
}

const TEMPLATES: BuiltinTemplate[] = [
  { name: 'הרשמה לכנס / אירוע', wizardId: 'event', category: 'אירועים', desc: 'מסלולים, מספר משתתפים, אישור הגעה ותזכורת SMS לפני האירוע', fields: 9, icon: <Ticket size={18} /> },
  { name: 'הרשמה לוובינר', wizardId: 'event', category: 'אירועים', desc: 'שם, מייל, שאלה למרצה — עם קובץ iCal אוטומטי במייל האישור', fields: 5, icon: <PartyPopper size={18} /> },
  { name: 'צור קשר לעסק', wizardId: 'contact', category: 'עסקי', desc: 'ליד חדש ישירות ל-CRM דרך Webhook, עם ניתוב לפי סוג הפנייה', fields: 6, icon: <Briefcase size={18} /> },
  { name: 'משוב לקוחות NPS', wizardId: 'feedback', category: 'עסקי', desc: 'סולם 0–10 עם חישוב Promoters/Detractors אוטומטי בדשבורד', fields: 4, icon: <MessageSquare size={18} /> },
  { name: 'קליטת עובד חדש', wizardId: 'hr', category: 'HR', desc: 'פרטים אישיים, ת״ז עם ספרת ביקורת, העלאת מסמכים וחתימה', fields: 12, icon: <UserPlus size={18} /> },
  { name: 'בקשת חופשה', wizardId: 'hr', category: 'HR', desc: 'טווח תאריכים, סוג חופשה, ניתוב לאישור מנהל/ת ישיר/ה', fields: 5, icon: <ClipboardList size={18} /> },
  { name: 'הרשמה לקורס', wizardId: 'event', category: 'חינוך', desc: 'בחירת מחזור, תשלום מקוון ותנאי ביטול — עם מכסת נרשמים', fields: 8, icon: <GraduationCap size={18} /> },
  { name: 'שאלון בריאות', wizardId: 'scratch', category: 'בריאות', desc: 'הצהרת בריאות עם לוגיקה מותנית ושדות רגישים מוצפנים', fields: 10, icon: <HeartPulse size={18} /> },
  { name: 'טופס התעניינות בנכס', wizardId: 'contact', category: 'נדל״ן', desc: 'פרטי קשר, תקציב וטווח חדרים — ליד חם ישירות לסוכן/ת', fields: 7, icon: <Home size={18} /> },
  { name: 'אישורי הגעה לחתונה', wizardId: 'event', category: 'אירועים', desc: 'כמה מגיעים, העדפות תפריט וברכה — עם SMS תזכורת', fields: 5, icon: <CalendarHeart size={18} /> },
]

const CATEGORIES = ['הכל', 'שלי', 'אירועים', 'עסקי', 'HR', 'חינוך', 'בריאות', 'נדל״ן']

export default function TemplatesScreen() {
  const navigate = useNavigate()
  const { activeWorkspace } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('הכל')
  const [custom, setCustom] = useState<CustomTemplate[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    try {
      const list = (await api.getTemplates()) as CustomTemplate[]
      setCustom(list)
    } catch {
      setCustom([])
    }
  }

  useEffect(() => {
    void reload()
  }, [activeWorkspace?.id])

  const builtins = useMemo(
    () =>
      TEMPLATES.filter(
        (t) =>
          (category === 'הכל' || t.category === category) &&
          (search === '' || t.name.includes(search) || t.desc.includes(search)),
      ),
    [search, category],
  )

  const mine = useMemo(
    () =>
      custom.filter(
        (t) =>
          (category === 'הכל' || category === 'שלי' || t.category === category) &&
          (search === '' || t.name.includes(search) || t.description.includes(search)),
      ),
    [custom, search, category],
  )

  async function useTemplate(tpl: CustomTemplate) {
    const form = await api.createForm({
      name: tpl.name,
      folder: 'תיקייה: ' + tpl.category,
      icon: tpl.icon,
      fields: tpl.fields,
      notif: {
        confirmEnabled: true,
        subject: tpl.name,
        fromAddress: 'no-reply@shaveh360.co.il',
        attachPdf: false,
        attachIcal: false,
        ownerEnabled: true,
        recipients: [],
        digest: false,
        smsEnabled: false,
        smsTemplate: '',
        smsReminder: false,
      },
      branding: {
        themeId: 'shaveh',
        primary: '#1d4ed8',
        textColor: '#0f172a',
        ctaColor: '#c8e00f',
        bgColor: '#eef2ff',
        headFont: 'Heebo',
        bodyFont: 'Heebo',
        darkMode: 'auto',
      },
      settings: { closeAt: '', maxResponses: '', onePerUser: false, passwordProtect: false },
    })
    navigate('/form/' + form.id + '/build')
  }

  async function duplicate(id: string) {
    await api.duplicateTemplate(id)
    void reload()
  }

  async function remove(id: string) {
    if (!window.confirm('למחוק את התבנית?')) return
    await api.deleteTemplate(id)
    void reload()
  }

  function exportOne(tpl: CustomTemplate) {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-' + tpl.name + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function triggerImport() {
    fileRef.current?.click()
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed.name || !Array.isArray(parsed.fields)) throw new Error('bad file')
      await api.createTemplate({
        name: parsed.name,
        description: parsed.description ?? '',
        icon: parsed.icon ?? 'file',
        category: parsed.category ?? 'כללי',
        fields: parsed.fields,
        scope: 'workspace',
      })
      void reload()
    } catch {
      window.alert('קובץ תבנית לא תקין')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="admin-shell">
      <AdminTopbar search={search} onSearch={setSearch} searchPlaceholder="חיפוש תבנית…" />
      <main className="page-body">
        <div className="home-title-row">
          <h1>תבניות</h1>
          <span className="count-chip">{builtins.length + mine.length} תבניות</span>
          <div className="title-actions">
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
            <button type="button" className="btn" onClick={triggerImport}>
              <Upload size={15} /> ייבוא JSON
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/templates/new')}>
              <Plus size={15} /> תבנית חדשה
            </button>
          </div>
        </div>

        <div className="home-filters">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={${category === c ? 'chip-filter active' : 'chip-filter'}}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {mine.length > 0 && (
          <>
            <h2 className="section-title">התבניות שלי</h2>
            <div className="tpl-grid">
              {mine.map((t) => (
                <div key={t.id} className="tpl-card">
                  <div className="tpl-head">
                    <span className="icon-tile">
                      <Pencil size={18} />
                    </span>
                    <div>
                      <div className="tpl-name">{t.name}</div>
                      <span className="tpl-cat">
                        {t.category}
                        {t.scope === 'global' ? ' · גלובלית' : ' · לעסק זה'}
                      </span>
                    </div>
                  </div>
                  <div className="tpl-desc">{t.description || '—'}</div>
                  <div className="tpl-foot">
                    <span className="tpl-fields">{t.fields.length} שדות</span>
                    <div className="tpl-actions">
                      <button type="button" className="icon-btn" title="שכפול" onClick={() => duplicate(t.id)}>
                        <Copy size={15} />
                      </button>
                      <button type="button" className="icon-btn" title="ייצוא" onClick={() => exportOne(t)}>
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="עריכה"
                        onClick={() => navigate('/templates/new?edit=' + t.id)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="icon-btn danger" title="מחיקה" onClick={() => remove(t.id)}>
                        <Trash2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => useTemplate(t)}
                      >
                        שימוש
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {category !== 'שלי' && (
          <>
            {mine.length > 0 && <h2 className="section-title">תבניות מובנות</h2>}
            <div className="tpl-grid">
              {builtins.map((t) => (
                <div key={t.name} className="tpl-card">
                  <div className="tpl-head">
                    <span className="icon-tile">{t.icon}</span>
                    <div>
                      <div className="tpl-name">{t.name}</div>
                      <span className="tpl-cat">{t.category}</span>
                    </div>
                  </div>
                  <div className="tpl-desc">{t.desc}</div>
                  <div className="tpl-foot">
                    <span className="tpl-fields">{t.fields} שדות מוכנים</span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 18px', fontSize: 13 }}
                      onClick={() => navigate('/new', { state: { template: t.wizardId ?? 'scratch' } })}
                    >
                      שימוש בתבנית
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
