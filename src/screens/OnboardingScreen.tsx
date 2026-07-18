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
  const [workspace, setWorkspace] = useState('שווה עסקים 360')
  const [domain, setDomain] = useState('אירועים')
  const [goal, setGoal] = useState('events')
  const [invites, setInvites] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')
  const [done, setDone] = useState(false)

  const addInvite = () => {
    const email = inviteInput.trim()
    if (email.includes('@') && !invites.includes(email)) {
      setInvites([...invites, email])
    }
    setInviteInput('')
  }

  const next = () => {
    if (step < TOTAL) setStep(step + 1)
    else {
      completeOnboarding()
      setDone(true)
    }
  }

  const finish = (to: string) => {
    navigate(to)
  }

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />

      {done ? (
        <div className="flow-card fade-up" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="success-circle">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="flow-title">הכל מוכן, {user?.name?.split(' ')[0] ?? 'חברים'}! 🎉</h1>
          <p className="flow-sub" style={{ margin: 0 }}>
            ה-Workspace «{workspace}» הוקם — תחום {domain}
            {invites.length > 0 && ` · נשלחו ${invites.length} הזמנות לצוות`}.
            <br />
            מה עכשיו?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="pub-cta" style={{ color: '#12265a' }} onClick={() => finish('/new')}>
              <Sparkles size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
              יצירת הטופס הראשון ←
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => finish('/')}>
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
                <div className="flow-sub">
                  נתאים את המערכת אליכם בשלושה צעדים קצרים. קודם כל — איך נקרא
                  ל-Workspace שלכם?
                </div>
              </div>
              <div className="pub-field">
                <label htmlFor="onb-ws">שם ה-Workspace</label>
                <input
                  id="onb-ws"
                  className="pub-input"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                />
                <div className="pub-help">יופיע בכותרות, במיילים ובטפסים הציבוריים</div>
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
            <button type="button" className="pub-cta" style={{ color: '#12265a' }} onClick={next}>
              {step === TOTAL ? 'סיום ←' : 'להמשך ←'}
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
                completeOnboarding()
                navigate('/')
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
