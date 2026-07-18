import { useMemo, useState } from 'react'
import AdminTopbar from '../components/AdminTopbar'
import Toggle from '../components/Toggle'

interface Integration {
  name: string
  desc: string
  color: string
  initial: string
}

interface Category {
  title: string
  how: string
  items: Integration[]
}

/* per spec §4.9.1 — native integrations catalogue */
const CATALOGUE: Category[] = [
  {
    title: 'גיליונות',
    how: 'הזרמת כל תשובה כשורה בזמן אמת (OAuth)',
    items: [
      { name: 'Google Sheets', desc: 'כל תשובה נכתבת כשורה בגיליון', color: '#188038', initial: 'S' },
      { name: 'Excel Online', desc: 'סנכרון לחוברת עבודה ב-OneDrive', color: '#107c41', initial: 'X' },
    ],
  },
  {
    title: 'CRM',
    how: 'יצירת ליד/רשומה עם מיפוי שדות',
    items: [
      { name: 'monday.com', desc: 'פריט חדש בלוח לכל תשובה', color: '#ff3d57', initial: 'm' },
      { name: 'Salesforce', desc: 'יצירת Lead עם מיפוי שדות', color: '#00a1e0', initial: 'SF' },
      { name: 'HubSpot', desc: 'איש קשר + עסקה חדשים', color: '#ff7a59', initial: 'H' },
      { name: 'Pipedrive', desc: 'עסקה חדשה בצינור המכירות', color: '#1a1a1a', initial: 'P' },
    ],
  },
  {
    title: 'תקשורת פנים-ארגונית',
    how: 'הודעה בערוץ על כל תשובה',
    items: [
      { name: 'Slack', desc: 'הודעה מעוצבת בערוץ שתבחרו', color: '#611f69', initial: '#' },
      { name: 'Microsoft Teams', desc: 'כרטיס Adaptive בערוץ הצוות', color: '#6264a7', initial: 'T' },
    ],
  },
  {
    title: 'דיוור',
    how: 'הוספת נרשם לרשימת תפוצה',
    items: [
      { name: 'Mailchimp', desc: 'הוספה לקהל + תגיות', color: '#ffe01b', initial: 'M' },
      { name: 'ActiveCampaign', desc: 'איש קשר + אוטומציה', color: '#356ae6', initial: 'A' },
      { name: 'Smoove', desc: 'נרשם חדש לרשימה בעברית', color: '#00c4b3', initial: 'ס' },
    ],
  },
  {
    title: 'תשלומים',
    how: 'שדה תשלום בטופס, אישור עסקה כתנאי לשליחה',
    items: [
      { name: 'Stripe', desc: 'סליקה בינלאומית בטופס', color: '#635bff', initial: 'S' },
      { name: 'Tranzila', desc: 'סליקה ישראלית מאובטחת', color: '#0d4ef2', initial: 'ת' },
      { name: 'Meshulam', desc: 'ביט, אשראי והוראות קבע', color: '#00b8d9', initial: 'מ' },
    ],
  },
  {
    title: 'אוטומציה ואנליטיקה',
    how: 'טריגר "תשובה חדשה" + אירועי צפייה/שליחה',
    items: [
      { name: 'Zapier', desc: 'חיבור ל-6,000+ אפליקציות', color: '#ff4a00', initial: 'Z' },
      { name: 'Make', desc: 'תרחישים ויזואליים מתקדמים', color: '#6d00cc', initial: 'M' },
      { name: 'Google Analytics 4', desc: 'אירועי צפייה/התחלה/שליחה', color: '#f9ab00', initial: 'G' },
      { name: 'Meta Pixel', desc: 'המרות לקמפיינים', color: '#0081fb', initial: 'f' },
    ],
  },
]

export default function IntegrationsScreen() {
  const [search, setSearch] = useState('')
  const [connected, setConnected] = useState<Set<string>>(
    () => new Set(['Slack', 'Google Sheets']),
  )

  const toggle = (name: string) =>
    setConnected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const catalogue = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CATALOGUE
    return CATALOGUE.map((cat) => ({
      ...cat,
      items: cat.items.filter((i) => i.name.toLowerCase().includes(q)),
    })).filter((cat) => cat.items.length > 0)
  }, [search])

  return (
    <div className="admin-shell">
      <AdminTopbar search={search} onSearch={setSearch} searchPlaceholder="חיפוש אינטגרציה…" />
      <main className="page-body">
        <div className="home-title-row">
          <h1>אינטגרציות</h1>
          <span className="count-chip">{connected.size} מחוברות</span>
        </div>
        {catalogue.map((cat) => (
          <section key={cat.title}>
            <div className="int-cat-title">{cat.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 10px' }}>
              {cat.how}
            </div>
            <div className="int-grid">
              {cat.items.map((item) => {
                const on = connected.has(item.name)
                return (
                  <div key={item.name} className="int-card">
                    <div className="int-head">
                      <span className="int-logo" style={{ background: item.color }} dir="ltr">
                        {item.initial}
                      </span>
                      <div>
                        <div className="int-name" dir="ltr">
                          {item.name}
                        </div>
                        <span className={`int-status${on ? ' on' : ''}`}>
                          {on ? 'מחובר ✓' : 'לא מחובר'}
                        </span>
                      </div>
                    </div>
                    <div className="int-desc">{item.desc}</div>
                    <div className="int-foot">
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {on ? 'פעיל לכל תשובה חדשה' : 'הפעלה מיידית'}
                      </span>
                      <Toggle small on={on} onChange={() => toggle(item.name)} label={`חיבור ${item.name}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
