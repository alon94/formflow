import { Check, Moon, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import LogoMark, { LogoArrow } from '../components/LogoMark'
import { useStore } from '../lib/store'
import type { FormField } from '../lib/types'
import { isLightColor } from './DesignScreen'

const DRAFT_KEY = 'formflow.public.draft'
const TOTAL_STEPS = 3

type Values = Record<string, string>

function validateField(field: FormField, value: string): string | null {
  const v = value.trim()
  if (field.required && v === '') return 'שדה חובה'
  if (v === '') return null
  switch (field.type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
        return field.errorMessage || 'נא להזין כתובת מייל תקינה'
      break
    case 'phone':
      if (!/^0(5\d|[2-9])-?\d{7}$/.test(v.replaceAll(' ', '')))
        return field.errorMessage || 'נא להזין מספר טלפון ישראלי תקין (05X-XXXXXXX)'
      break
    case 'id_number': {
      if (!/^\d{9}$/.test(v)) return field.errorMessage || 'ת״ז חייבת לכלול 9 ספרות'
      const sum = v
        .split('')
        .map((d, i) => {
          const n = Number(d) * (i % 2 === 0 ? 1 : 2)
          return n > 9 ? n - 9 : n
        })
        .reduce((a, b) => a + b, 0)
      if (sum % 10 !== 0) return field.errorMessage || 'מספר ת״ז אינו תקין'
      break
    }
    case 'number':
      if (!/^\d+$/.test(v)) return 'נא להזין מספר'
      break
    default:
      break
  }
  return null
}

export default function PublicFormScreen() {
  const { fields, branding, addLiveSubmission, submissions } = useStore()

  /* theme resolution: form setting (אוטומטי/בהיר/כהה) + local visitor override */
  const [override, setOverride] = useState<'light' | 'dark' | null>(null)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const resolved: 'light' | 'dark' =
    override ??
    (branding.darkMode === 'auto' ? (systemDark ? 'dark' : 'light') : branding.darkMode)

  const [step, setStep] = useState(1)
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submissionId, setSubmissionId] = useState<number | null>(null)
  const inputRefs = useRef<Record<string, HTMLElement | null>>({})
  const restored = useRef(false)

  /* restore visitor draft */
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as { values: Values; step: number }
        setValues(draft.values ?? {})
        if (draft.step >= 1 && draft.step <= TOTAL_STEPS) setStep(draft.step)
      }
    } catch {
      /* ignore corrupted draft */
    }
  }, [])

  /* autosave visitor draft */
  useEffect(() => {
    if (submitted) return
    const t = window.setTimeout(
      () => localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, step })),
      500,
    )
    return () => window.clearTimeout(t)
  }, [values, step, submitted])

  const setValue = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  /* step field definitions */
  const memberField: FormField = {
    id: 'pf-member',
    type: 'radio',
    label: 'חברת מועדון שווה?',
    required: true,
    fieldKey: 'member',
    options: ['כן, חברי מועדון', 'עדיין לא'],
  }
  const participantsField: FormField = {
    id: 'pf-participants',
    type: 'number',
    label: 'מספר משתתפים',
    required: true,
    fieldKey: 'participants',
    placeholder: 'למשל: 2',
  }
  const notesField: FormField = {
    id: 'pf-notes',
    type: 'long_text',
    label: 'הערות והעדפות (אופציונלי)',
    required: false,
    fieldKey: 'notes',
    placeholder: 'נגישות, תזונה, כל דבר שנצטרך לדעת…',
  }
  const termsField: FormField = {
    id: 'pf-terms',
    type: 'radio',
    label: 'אישור תקנון',
    required: true,
    fieldKey: 'terms',
    options: ['קראתי ואני מאשר/ת את תנאי ההשתתפות'],
  }

  const stepFields: FormField[][] = useMemo(
    () => [
      [memberField, participantsField],
      fields,
      [notesField, termsField],
    ],
    [fields],
  )

  const validateStep = (): boolean => {
    const current = stepFields[step - 1]
    const nextErrors: Record<string, string> = {}
    for (const f of current) {
      const err = validateField(f, values[f.fieldKey] ?? '')
      if (err) nextErrors[f.fieldKey] = err
    }
    setErrors(nextErrors)
    const firstKey = current.find((f) => nextErrors[f.fieldKey])?.fieldKey
    if (firstKey) {
      const el = inputRefs.current[firstKey]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus()
      return false
    }
    return true
  }

  const next = () => {
    if (!validateStep()) return
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    /* submit */
    const emailKey = fields.find((f) => f.type === 'email')?.fieldKey
    const trackKey = fields.find((f) => f.type === 'radio')?.fieldKey
    const first = values['first_name'] ?? ''
    const last = values['last_name'] ?? ''
    const id = Math.max(...submissions.map((s) => s.id)) + 1
    addLiveSubmission({
      name: `${first} ${last}`.trim() || 'ממלא/ת אנונימי/ת',
      email: emailKey ? (values[emailKey] ?? '') : '',
      track: trackKey ? (values[trackKey] ?? '—') : '—',
      status: 'new',
    })
    setSubmissionId(id)
    localStorage.removeItem(DRAFT_KEY)
    setSubmitted(true)
    window.scrollTo({ top: 0 })
  }

  const back = () => {
    if (step > 1) {
      setStep(step - 1)
      setErrors({})
    }
  }

  /* branding overrides */
  const styleVars: Record<string, string> = {
    '--font-head': `'${branding.headFont}', sans-serif`,
    '--font-body': `'${branding.bodyFont}', sans-serif`,
    '--lime': branding.ctaColor,
  }
  if (resolved === 'light') {
    styleVars['--bg-page'] = branding.bgColor
    styleVars['--text'] = branding.textColor
    styleVars['--heading'] = branding.textColor
    styleVars['--primary'] = branding.primary
    styleVars['--accent-blue-text'] = branding.primary
  }
  const ctaTextColor = isLightColor(branding.ctaColor) ? '#12265a' : '#ffffff'

  const renderInput = (f: FormField) => {
    const err = errors[f.fieldKey]
    const common = {
      id: `pf-${f.fieldKey}`,
      className: `pub-input${err ? ' invalid' : ''}`,
      value: values[f.fieldKey] ?? '',
      'aria-invalid': !!err,
      'aria-describedby': err ? `err-${f.fieldKey}` : undefined,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => setValue(f.fieldKey, e.target.value),
      onBlur: () => {
        const e2 = validateField(f, values[f.fieldKey] ?? '')
        if (e2) setErrors((prev) => ({ ...prev, [f.fieldKey]: e2 }))
      },
    }
    switch (f.type) {
      case 'radio': {
        const options = f.options ?? []
        const vertical = options.length !== 3
        return (
          <div
            className={vertical ? 'option-list' : 'track-grid'}
            role="radiogroup"
            aria-label={f.label}
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          >
            {options.map((opt) => {
              const selected = values[f.fieldKey] === opt
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`option-btn${selected ? ' selected' : ''}`}
                  onClick={() => setValue(f.fieldKey, selected ? '' : opt)}
                >
                  <span className="dot" aria-hidden="true" />
                  {opt}
                </button>
              )
            })}
          </div>
        )
      }
      case 'dropdown':
        return (
          <select
            {...common}
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          >
            <option value="">בחירה מהרשימה…</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )
      case 'long_text':
        return (
          <textarea
            {...common}
            rows={3}
            placeholder={f.placeholder}
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          />
        )
      case 'date':
        return (
          <input
            {...common}
            type="date"
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          />
        )
      case 'rating':
        return (
          <div
            className="rating-row"
            role="radiogroup"
            aria-label={f.label}
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const chosen = Number(values[f.fieldKey] ?? 0) >= n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values[f.fieldKey] === String(n)}
                  aria-label={`${n} מתוך 5`}
                  onClick={() => setValue(f.fieldKey, String(n))}
                  style={{ color: chosen ? 'var(--primary)' : 'var(--text-placeholder)', fontSize: 24, lineHeight: 1 }}
                >
                  ★
                </button>
              )
            })}
          </div>
        )
      default:
        return (
          <input
            {...common}
            type="text"
            inputMode={
              f.type === 'phone' || f.type === 'number' || f.type === 'id_number'
                ? 'numeric'
                : f.type === 'email'
                  ? 'email'
                  : undefined
            }
            dir={f.type === 'email' ? 'ltr' : undefined}
            placeholder={f.placeholder}
            ref={(el) => {
              inputRefs.current[f.fieldKey] = el
            }}
          />
        )
    }
  }

  const renderField = (f: FormField) => (
    <div className="pub-field" key={f.id}>
      {f.type === 'radio' || f.type === 'rating' ? (
        <span className="pub-label">
          {f.label} {f.required && <span className="req-star">*</span>}
        </span>
      ) : (
        <label htmlFor={`pf-${f.fieldKey}`}>
          {f.label} {f.required && <span className="req-star">*</span>}
        </label>
      )}
      {renderInput(f)}
      {errors[f.fieldKey] && (
        <div className="pub-error" id={`err-${f.fieldKey}`} role="alert">
          {errors[f.fieldKey]}
        </div>
      )}
      {!errors[f.fieldKey] && f.help && <div className="pub-help">{f.help}</div>}
    </div>
  )

  /* pair consecutive half-width fields */
  const renderFields = (list: FormField[]) => {
    const out: React.ReactNode[] = []
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      const nextF = list[i + 1]
      if (f.half && nextF?.half) {
        out.push(
          <div className="pub-row2" key={f.id}>
            {renderField(f)}
            {renderField(nextF)}
          </div>,
        )
        i++
      } else {
        out.push(renderField(f))
      }
    }
    return out
  }

  const stepTitles = ['פרטי מועדון', 'פרטים אישיים', 'כמעט סיימנו']

  return (
    <div className="pub-root" data-theme={resolved} style={styleVars} dir="rtl">
      <button
        type="button"
        className="icon-btn pub-theme-toggle"
        onClick={() => setOverride(resolved === 'dark' ? 'light' : 'dark')}
        aria-label={resolved === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      >
        {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <LogoMark
        size={24}
        textColor={resolved === 'dark' ? '#ffffff' : branding.textColor}
        subColor={resolved === 'dark' ? 'var(--lime)' : branding.textColor}
      />

      {submitted ? (
        <div className="pub-card pub-success fade-up">
          <span className="success-circle">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1>ההרשמה נקלטה!</h1>
          {submissionId && <span className="sub-id-chip">הרשמה מס׳ {submissionId}</span>}
          <p>
            שלחנו אישור למייל שהזנתם, כולל כרטיס iCal לאירוע.
            <br />
            נתראה ב-12 בנובמבר במרכז הכנסים תל אביב 🎉
          </p>
        </div>
      ) : (
        <form
          className="pub-card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
        >
          <div>
            <span className="pub-event-tag">🎟 12 בנובמבר · מרכז הכנסים תל אביב</span>
            <h1 className="pub-title">הרשמה לכנס המוצר 2026</h1>
            <div className="pub-sub">3 דקות וסיימתם — נשמח לראותכם!</div>
          </div>

          <div className="pub-progress-row">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }}
              />
            </div>
            <span className="step-label">
              שלב {step} מתוך {TOTAL_STEPS}
            </span>
          </div>

          <div className="pub-step-title">{stepTitles[step - 1]}</div>

          {renderFields(stepFields[step - 1])}

          <div className="pub-cta-row">
            <button type="submit" className="pub-cta" style={{ color: ctaTextColor }}>
              {step === TOTAL_STEPS ? 'שליחת הרשמה ←' : 'להמשך ←'}
            </button>
            {step > 1 && (
              <button type="button" className="pub-back" onClick={back}>
                → חזרה
              </button>
            )}
            <span className="autosave-note">💾 הטיוטה נשמרת אוטומטית</span>
          </div>
        </form>
      )}

      <div className="pub-footer">
        <LogoArrow size={12} /> מופעל ע״י שווה עסקים 360 ·{' '}
        <a href="#" onClick={(e) => e.preventDefault()}>
          נגישות
        </a>{' '}
        ·{' '}
        <a href="#" onClick={(e) => e.preventDefault()}>
          פרטיות
        </a>
      </div>
    </div>
  )
}
