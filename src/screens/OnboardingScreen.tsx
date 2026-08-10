import {
  BarChart3,
  Check,
  ClipboardList,
  MessageSquare,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

const DOMAINS = ['אירועים', 'משאבי אנוש', 'מכירות ולידים', 'חינוך', 'בריאות', 'נדל״ן', 'עמותות', 'אחר']

const GOALS = [
  {
    id: 'events',
    icon: <ClipboardList size={18} />,
    title: 'לאסוף הרשמות לאירוע',
    desc: 'כנסים, וובינרים, סדנאות — עם אישורי הגעה ותזכורות',
  },
  {
    id: 'leads',
    icon: <BarChart3 size={18} />,
    title: 'לקלוט לידים לעסק',
    desc: 'טפסי צור קשר שמוזרמים ישירות ל-CRM',
  },
  {
    id: 'feedback',
    icon: <MessageSquare size={18} />,
    title: 'למדוד שביעות רצון',
    desc: 'סקרי NPS ומשוב לקוחות עם דשבורד אוטומטי',
  },
  {
    id: 'internal',
    icon: <UserPlus size={18} />,
    title: 'תהליכים פנימיים',
    desc: 'קליטת עובדים, בקשות חופשה, טפסי הצהרה',
  },
]

const TOTAL = 3

export default function OnboardingScreen() {
  const { user, completeOnboarding } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  /* customer / business details */
  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('')
  const [domain, setDomain] = useState('אירועים')
  const [goal, setGoal] = useState('events')
  const [invites, setInvites] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  const addInvite = () => {
    const email = inviteInput.trim()
    if (email.includes('@') && !invites.includes(email)) setInvites([...invites, email])
    setInviteInput('')
  }

  const validateStep1 = (): boolean => {
    const next: Record<string, string> = {}
    if (businessName.trim().length < 2) next.businessName = 'נא להזין שם עסק / ארגון'
    if (contactName.trim().length < 2) next.contactName = 'נא להזין שם איש קשר'
    if (phone.trim() && !/^0(5\d|[2-9])-?\d{7}$/.test(phone.replaceAll(' ', '')))
      next.phone = 'מספר טלפון ישראלי לא תקין'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const persist = async () => {
    const biz = businessName.trim()
    /* Save the customer profile onto the workspace (cloud or local). Skipping
     * with an empty business name must never erase a profile saved earlier. */
    if (biz) {
      try {
        await api.updateWorkspace({
          name: `${biz} — FormFlow`,
          businessName: biz,
          phone: phone.trim(),
          domain,
          goal,
        })
      } catch {
        /* offline: the local flag below still marks onboarding as done */
      }
    }
    completeOnboarding()
  }

  const next = async () => {
    if (step === 1 && !validateStep1()) return
    if (step < TOTAL) {
      setStep(step + 1)
      return
    }
    /* wait for the save, so the profile is really stored before we celebrate */
    setSaving(true)
    try {
      await persist()
    } finally {
      setSaving(false)
    }
    setDone(true)
  }

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />

      {done ? (
        <div className="flow-card fade-up" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="success-circle">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="flow-title">הכל מוכן, {contactName.split(' ')[0] || 'חברים'}! 🎉</h1>
          <p className="flow-sub" style={{ margin: 0 }}>
            ה-Workspace של «{businessName}» הוקם — תחום {domain}
            {invites.length > 0 && ` · נשלחו ${invites.length} הזמנות לצוות`}.
            <br />
            מה עכשיו?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="pub-cta" style={{ color: '#12265a' }} onClick={() => navigate('/new')}>
              <Sparkles size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              יצירת הטופס הראשון ←
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              לריכוז הטפסים
            </button>
          </div>
        </div>
      ) : (
        <div className="flow-card fade-up">
          <div className="flow-steps" aria-label={`שלב ${step} מתוך ${TOTAL}`}>
            {[1, 2, 3].map((s) => (
              <span key={s} className={`bar${s < step ? ' done' : s === step ? ' current' : ''}`}>
                <span />
              </span>
            ))}
            <span className="flow-step-label">
              {step} / {TOTAL}
            </span>
          </div>

          {step === 1 && (
            <>
              <div>
                <h1 className="flow-title">ברוכים הבאים ל-FormFlow 👋</h1>
                <div className="flow-sub">כמה פרטים על העסק שלכם — כדי שנתאים את המערכת והמיתוג.</div>
              </div>
              <div className="pub-field">
                <label htmlFor="onb-biz">שם העסק / הארגון <span className="req-star">*</span></label>
                <input
                  id="onb-biz"
                  className={`pub-input${errors.businessName ? ' invalid' : ''}`}
                  value={businessName}
                  autoFocus
                  placeholder="למשל: שווה עסקים 360"
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                {errors.businessName && (
                  <div className="pub-error" role="alert">
                    {errors.businessName}
                  </div>
                )}
              </div>
              <div className="pub-row2">
                <div className="pub-field">
                  <label htmlFor="onb-contact">שם איש קשר <span className="req-star">*</span></label>
                  <input
                    id="onb-contact"
                    className={`pub-input${errors.contactName ? ' invalid' : ''}`}
                    value={contactName}
                    placeholder="ישראל ישראלי"
                    onChange={(e) => setContactName(e.target.value)}
                  />
                  {errors.contactName && (
                    <div className="pub-error" role="alert">
                      {errors.contactName}
                    </div>
                  )}
                </div>
                <div className="pub-field">
                  <label htmlFor="onb-phone">טלפון</label>
                  <input
                    id="onb-phone"
                    className={`pub-input${errors.phone ? ' invalid' : ''}`}
                    dir="ltr"
                    inputMode="numeric"
                    value={phone}
                    placeholder="050-0000000"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {errors.phone && (
                    <div className="pub-error" role="alert">
                      {errors.phone}
                    </div>
                  )}
                </div>
              </div>
              <div className="pub-field">
                <span className="pub-label" style={{ fontSize: 14 }}>
                  באיזה תחום אתם פועלים?
                </span>
                <div className="chips-select">
                  {DOMAINS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`chip-filter${domain === d ? ' active' : ''}`}
                      onClick={() => setDomain(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="flow-title">מה המטרה הראשונה שלכם?</h1>
                <div className="flow-sub">נתאים לפי זה את התבניות וההמלצות</div>
              </div>
              <div className="goal-grid" role="radiogroup" aria-label="מטרה ראשונה">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={goal === g.id}
                    className={`goal-card${goal === g.id ? ' selected' : ''}`}
                    onClick={() => setGoal(g.id)}
                  >
                    <span className="icon-tile" style={{ width: 34, height: 34 }}>
                      {g.icon}
                    </span>
                    <span className="g-title">{g.title}</span>
                    <span className="g-desc">{g.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h1 className="flow-title">מזמינים את הצוות?</h1>
                <div className="flow-sub">
                  עורכים יכולים לבנות טפסים ולצפות בתשובות. אפשר גם לדלג ולהזמין
                  אחר כך מהגדרות ה-Workspace.
                </div>
              </div>
              <div className="recipients-row">
                {invites.map((email) => (
                  <span key={email} className="recipient-chip" dir="ltr">
                    {email}
                    <button
                      type="button"
                      aria-label={`הסרת ${email}`}
                      onClick={() => setInvites(invites.filter((x) => x !== email))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="whk-add">
                <input
                  className="text-input"
                  dir="ltr"
                  placeholder="colleague@company.co.il"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInvite())}
                  aria-label="מייל להזמנה"
                />
                <button type="button" className="btn btn-primary" onClick={addInvite}>
                  הוספה
                </button>
              </div>
            </>
          )}

          <div className="flow-footer">
            <button
                type="button"
                className="pub-cta"
                style={{ color: '#12265a' }}
                disabled={saving}
                onClick={() => void next()}
              >
                {saving ? 'שומר...' : step === TOTAL ? 'סיום ←' : 'להמשך ←'}
              </button>
            {step > 1 && (
              <button type="button" className="pub-back" onClick={() => setStep(step - 1)}>
                → חזרה
              </button>
            )}
            <button
              type="button"
              className="flow-skip"
              onClick={() => {
                void persist().then(() => navigate('/'))
              }}
            >
              דילוג בינתיים
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
