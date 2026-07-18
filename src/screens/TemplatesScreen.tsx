import {
  Briefcase,
  CalendarHeart,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  Home,
  MessageSquare,
  PartyPopper,
  Ticket,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminTopbar from '../components/AdminTopbar'

interface Template {
  name: string
  category: string
  desc: string
  fields: number
  icon: React.ReactNode
  wizardId?: string
}

/* template library per spec §4.7.1 categories */
const TEMPLATES: Template[] = [
  {
    name: 'הרשמה לכנס / אירוע',
    wizardId: 'event',
    category: 'אירועים',
    desc: 'מסלולים, מספר משתתפים, אישור הגעה ותזכורת SMS לפני האירוע',
    fields: 9,
    icon: <Ticket size={18} />,
  },
  {
    name: 'הרשמה לוובינר',
    wizardId: 'event',
    category: 'אירועים',
    desc: 'שם, מייל, שאלה למרצה — עם קובץ iCal אוטומטי במייל האישור',
    fields: 5,
    icon: <PartyPopper size={18} />,
  },
  {
    name: 'צור קשר לעסק',
    wizardId: 'contact',
    category: 'עסקי',
    desc: 'ליד חדש ישירות ל-CRM דרך Webhook, עם ניתוב לפי סוג הפנייה',
    fields: 6,
    icon: <Briefcase size={18} />,
  },
  {
    name: 'משוב לקוחות NPS',
    wizardId: 'feedback',
    category: 'עסקי',
    desc: 'סולם 0–10 עם חישוב Promoters/Detractors אוטומטי בדשבורד',
    fields: 4,
    icon: <MessageSquare size={18} />,
  },
  {
    name: 'קליטת עובד חדש',
    wizardId: 'hr',
    category: 'HR',
    desc: 'פרטים אישיים, ת״ז עם ספרת ביקורת, העלאת מסמכים וחתימה',
    fields: 12,
    icon: <UserPlus size={18} />,
  },
  {
    name: 'בקשת חופשה',
    wizardId: 'hr',
    category: 'HR',
    desc: 'טווח תאריכים, סוג חופשה, ניתוב לאישור מנהל/ת ישיר/ה',
    fields: 5,
    icon: <ClipboardList size={18} />,
  },
  {
    name: 'הרשמה לקורס',
    wizardId: 'event',
    category: 'חינוך',
    desc: 'בחירת מחזור, תשלום מקוון ותנאי ביטול — עם מכסת נרשמים',
    fields: 8,
    icon: <GraduationCap size={18} />,
  },
  {
    name: 'שאלון בריאות',
    wizardId: 'scratch',
    category: 'בריאות',
    desc: 'הצהרת בריאות עם לוגיקה מותנית ושדות רגישים מוצפנים',
    fields: 10,
    icon: <HeartPulse size={18} />,
  },
  {
    name: 'טופס התעניינות בנכס',
    wizardId: 'contact',
    category: 'נדל״ן',
    desc: 'פרטי קשר, תקציב וטווח חדרים — ליד חם ישירות לסוכן/ת',
    fields: 7,
    icon: <Home size={18} />,
  },
  {
    name: 'אישורי הגעה לחתונה',
    wizardId: 'event',
    category: 'אירועים',
    desc: 'כמה מגיעים, העדפות תפריט וברכה — עם SMS תזכורת',
    fields: 5,
    icon: <CalendarHeart size={18} />,
  },
]

const CATEGORIES = ['הכל', 'אירועים', 'עסקי', 'HR', 'חינוך', 'בריאות', 'נדל״ן']

export default function TemplatesScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('הכל')

  const templates = useMemo(
    () =>
      TEMPLATES.filter(
        (t) =>
          (category === 'הכל' || t.category === category) &&
          (search.trim() === '' || t.name.includes(search.trim())),
      ),
    [category, search],
  )

  return (
    <div className="admin-shell">
      <AdminTopbar search={search} onSearch={setSearch} searchPlaceholder="חיפוש תבנית…" />
      <main className="page-body">
        <div className="home-title-row">
          <h1>תבניות</h1>
          <span className="count-chip">{templates.length} תבניות</span>
        </div>
        <div className="home-filters">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip-filter${category === c ? ' active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="tpl-grid">
          {templates.map((t) => (
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
      </main>
    </div>
  )
}
