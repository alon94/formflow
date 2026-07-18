import { useMutation } from '@tanstack/react-query'
import { Check, Moon, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeFillState, skippedPages } from '../../shared/rules.js'
import { validateValue } from '../../shared/validate.js'
import LogoMark, { LogoArrow } from '../components/LogoMark'
import { api, SubmitValidationError } from '../lib/api'
import { useStore } from '../lib/store'
import type { FormField, NotificationEntry, Submission } from '../lib/types'
import { isLightColor } from './DesignScreen'

const DRAFT_KEY = 'formflow.public.draft'

const PAGE_TITLES: Record<number, string> = {
  1: 'פרטי מועדון',
  2: 'פרטים אישיים',
  3: 'כמעט סיימנו',
}

type Values = Record<string, string>

export default function PublicFormScreen() {
  const { fields, rules, branding } = useStore()

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

  const pages = useMemo(
    () => [...new Set(fields.map((f) => f.page ?? 1))].sort((a, b) => a - b),
    [fields],
  )
  const [page, setPage] = useState(1)
  const [visited, setVisited] = useState<number[]>([])
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    submission: Submission
    notifications: NotificationEntry[]
  } | null>(null)
  const inputRefs = useRef<Record<string, HTMLElement | null>>({})
  const restored = useRef(false)

  /* restore + autosave visitor draft (spec §4.8) */
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as { values: Values; page: number }
        setValues(draft.values ?? {})
        if (draft.page && pages.includes(draft.page)) setPage(draft.page)
      }
    } catch {
      /* ignore corrupted draft */
    }
  }, [pages])

  useEffect(() => {
    if (result) return
    const t = window.setTimeout(
      () => localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, page })),
      500,
    )
    return () => window.clearTimeout(t)
  }, [values, page, result])

  const { hiddenFieldKeys, jumpTargets } = useMemo(
    () => computeFillState(fields, rules, values),
    [fields, rules, values],
  )

  const pageFields = useMemo(
    () =>
      fields.filter((f) => (f.page ?? 1) === page && !hiddenFieldKeys.has(f.fieldKey)),
    [fields, page, hiddenFieldKeys],
  )

  const setValue = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  const focusFirstError = (errs: Record<string, string>, fieldList: FormField[]) => {
    const firstKey = fieldList.find((f) => errs[f.fieldKey])?.fieldKey
    if (!firstKey) return
    const el = inputRefs.current[firstKey]
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus()
  }

  const validatePage = (): boolean => {
    const nextErrors: Record<string, string> = {}
    for (const f of pageFields) {
      const err = validateValue(f, values[f.fieldKey] ?? '')
      if (err) nextErrors[f.fieldKey] = err
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors, pageFields)
      return false
    }
    return true
  }

  const submit = useMutation({
    mutationFn: () => api.postSubmission(values),
    onSuccess: (data) => {
      localStorage.removeItem(DRAFT_KEY)
      setResult(data)
      window.scrollTo({ top: 0 })
    },
    onError: (err) => {
      if (err instanceof SubmitValidationError) {
        setErrors(err.errors)
        const errorPage = fields.find((f) => err.errors[f.fieldKey])?.page ?? page
        setPage(errorPage)
        window.setTimeout(
          () =>
            focusFirstError(
              err.errors,
              fields.filter((f) => (f.page ?? 1) === errorPage),
            ),
          80,
        )
      } else {
        setSubmitError('לא הצלחנו לשלוח את הטופס — ודאו ששרת ה-API רץ ונסו שוב')
      }
    },
  })

  const next = () => {
    setSubmitError(null)
    if (!validatePage()) return
    const isLast = page === pages[pages.length - 1]
    if (isLast) {
      submit.mutate()
      return
    }
    /* jump rules (skip logic) then default advance, skipping skipped pages */
    const skipped = skippedPages(fields, rules, values)
    let target = jumpTargets.get(page)
    if (!target || target <= page) {
      const idx = pages.indexOf(page)
      target = pages[idx + 1]
      while (target && skipped.has(target)) {
        const i = pages.indexOf(target)
        target = pages[i + 1]
      }
    }
    if (target) {
      setVisited((v) => [...v, page])
      setPage(target)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const back = () => {
    setVisited((v) => {
      if (v.length === 0) return v
      const prev = v[v.length - 1]
      setPage(prev)
      setErrors({})
      return v.slice(0, -1)
    })
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
        const e2 = validateValue(f, values[f.fieldKey] ?? '')
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
                  style={{
                    color: chosen ? 'var(--primary)' : 'var(--text-placeholder)',
                    fontSize: 24,
                    lineHeight: 1,
                  }}
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
    <div className="pub-field fade-up" key={f.id}>
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

  const stepIndex = pages.indexOf(page) + 1
  const isLast = page === pages[pages.length - 1]

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

      {result ? (
        <div className="pub-card pub-success fade-up">
          <span className="success-circle">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1>ההרשמה נקלטה!</h1>
          <span className="sub-id-chip">הרשמה מס׳ {result.submission.id}</span>
          <p>
            נתראה ב-12 בנובמבר במרכז הכנסים תל אביב 🎉
          </p>
          {result.notifications.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.notifications.map((n) => (
                <div key={n.id} className="notif-log-row">
                  <span className="rec" dir="ltr">
                    {n.recipient}
                  </span>
                  <span>· {n.note}</span>
                  <span className="when">נמסר ✓</span>
                </div>
              ))}
            </div>
          )}
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
                style={{ width: `${Math.round((stepIndex / pages.length) * 100)}%` }}
              />
            </div>
            <span className="step-label">
              שלב {stepIndex} מתוך {pages.length}
            </span>
          </div>

          <div className="pub-step-title">{PAGE_TITLES[page] ?? `שלב ${stepIndex}`}</div>

          {renderFields(pageFields)}

          {submitError && (
            <div className="pub-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="pub-cta-row">
            <button
              type="submit"
              className="pub-cta"
              style={{ color: ctaTextColor }}
              disabled={submit.isPending}
            >
              {submit.isPending ? 'שולח…' : isLast ? 'שליחת הרשמה ←' : 'להמשך ←'}
            </button>
            {visited.length > 0 && (
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
