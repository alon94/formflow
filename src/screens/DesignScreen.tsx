import { useStore } from '../lib/store'
import { LogoArrow } from '../components/LogoMark'
import type { BrandingState } from '../lib/types'

const THEMES: {
  id: BrandingState['themeId']
  name: string
  gradient: string
  colors: Partial<BrandingState>
}[] = [
  {
    id: 'shaveh',
    name: 'שווה 360',
    gradient: 'linear-gradient(135deg,#0D4EF2,#A9CBF1)',
    colors: { primary: '#0d4ef2', textColor: '#12265a', ctaColor: '#d9f051', bgColor: '#e9f2fd' },
  },
  {
    id: 'business',
    name: 'עסקי',
    gradient: 'linear-gradient(135deg,#12265A,#4A5A7A)',
    colors: { primary: '#12265a', textColor: '#12265a', ctaColor: '#12265a', bgColor: '#eef1f6' },
  },
  {
    id: 'events',
    name: 'אירועים',
    gradient: 'linear-gradient(135deg,#EE2BC3,#F79A6B)',
    colors: { primary: '#ee2bc3', textColor: '#3c1030', ctaColor: '#f79a6b', bgColor: '#fdeef8' },
  },
]

export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return true
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

const HEAD_FONTS = ['Rubik', 'Heebo', 'Assistant']
const BODY_FONTS = ['Assistant', 'Open Sans', 'Rubik', 'Heebo']

export default function DesignScreen() {
  const { branding, setBranding } = useStore()

  const colorRows: { key: keyof BrandingState; label: string }[] = [
    { key: 'primary', label: 'ראשי' },
    { key: 'textColor', label: 'טקסט' },
    { key: 'ctaColor', label: 'כפתור שליחה' },
    { key: 'bgColor', label: 'רקע' },
  ]

  const ctaText = isLightColor(branding.ctaColor) ? '#12265a' : '#ffffff'

  return (
    <div className="dsn-body">
      <aside className="dsn-panel" aria-label="הגדרות עיצוב">
        <div>
          <span className="dsn-group-label">ערכת נושא</span>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card${branding.themeId === t.id ? ' selected' : ''}`}
                onClick={() => setBranding({ themeId: t.id, ...t.colors })}
              >
                <span className="swatch-bar" style={{ background: t.gradient }} />
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="dsn-group-label">צבעים</span>
          <div className="color-rows">
            {colorRows.map((row) => (
              <div key={row.key} className="color-row">
                <span className="color-swatch">
                  <input
                    type="color"
                    value={branding[row.key] as string}
                    onChange={(e) => setBranding({ [row.key]: e.target.value })}
                    aria-label={`בחירת צבע — ${row.label}`}
                  />
                  <span className="fill" style={{ background: branding[row.key] as string }} />
                </span>
                {row.label}
                <span className="hex mono" dir="ltr">
                  {(branding[row.key] as string).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="dsn-group-label">טיפוגרפיה</span>
          <select
            className="font-select"
            value={branding.headFont}
            onChange={(e) => setBranding({ headFont: e.target.value })}
            aria-label="פונט כותרות"
          >
            {HEAD_FONTS.map((f) => (
              <option key={f} value={f}>
                {f} — כותרות
              </option>
            ))}
          </select>
          <select
            className="font-select"
            style={{ marginTop: 8 }}
            value={branding.bodyFont}
            onChange={(e) => setBranding({ bodyFont: e.target.value })}
            aria-label="פונט טקסט"
          >
            {BODY_FONTS.map((f) => (
              <option key={f} value={f}>
                {f} — טקסט
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="dsn-group-label">לוגו</span>
          <div className="logo-box">
            <span className="logo-tile">
              <LogoArrow size={20} />
            </span>
            <div className="logo-meta">
              shaveh-logo.svg
              <br />
              <button type="button" className="action">
                החלפה
              </button>{' '}
              · מוצג בכותרת ובמייל
            </div>
          </div>
        </div>

        <div className="dsn-row">
          <span className="dsn-row-label">מצב כהה</span>
          <div className="mode-seg" role="radiogroup" aria-label="מצב תצוגה של הטופס">
            {(
              [
                ['auto', 'אוטומטי'],
                ['light', 'בהיר'],
                ['dark', 'כהה'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={branding.darkMode === id}
                className={branding.darkMode === id ? 'active' : ''}
                onClick={() => setBranding({ darkMode: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dsn-row">
          <span className="dsn-row-label">דומיין מותאם</span>
          <span className="domain-value" dir="ltr">
            forms.shaveh360.co.il ✓
          </span>
        </div>
      </aside>

      {/* live preview */}
      <section className="dsn-preview" aria-label="תצוגה מקדימה חיה">
        <div>
          <div className="dsn-stage" style={{ background: branding.bgColor }}>
            <div
              className="dsn-mini-form"
              style={{ fontFamily: `'${branding.bodyFont}', sans-serif` }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <LogoArrow size={20} />
                <span
                  style={{
                    fontFamily: `'${branding.headFont}', sans-serif`,
                    fontWeight: 800,
                    fontSize: 15,
                    color: branding.textColor,
                  }}
                >
                  שווה
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 9.5,
                    lineHeight: 1.15,
                    color: branding.textColor,
                  }}
                >
                  מועדון
                  <br />
                  עסקים 360
                </span>
              </span>
              <div
                className="mini-title"
                style={{
                  fontFamily: `'${branding.headFont}', sans-serif`,
                  color: branding.textColor,
                }}
              >
                הרשמה לכנס המוצר 2026
              </div>
              <div className="mini-progress">
                <span style={{ background: branding.primary }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="mini-label" style={{ color: branding.textColor }}>
                  שם מלא
                </span>
                <span className="mini-input">ישראל ישראלי</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="mini-label" style={{ color: branding.textColor }}>
                  כתובת מייל
                </span>
                <span className="mini-input" dir="ltr">
                  name@company.co.il
                </span>
              </div>
              <span
                className="mini-cta"
                style={{
                  background: branding.ctaColor,
                  color: ctaText,
                  fontFamily: `'${branding.headFont}', sans-serif`,
                }}
              >
                המשך ←
              </span>
            </div>
            <div className="dsn-caption" style={{ color: branding.textColor, opacity: 0.6 }}>
              תצוגה מקדימה חיה · דסקטופ
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
