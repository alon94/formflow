/**
 * LoginScreen - real authentication against Supabase Auth.
 *
 * Email + password sign-in, sign-up with email verification, password reset
 * and Google / Microsoft SSO. There are no demo shortcuts: the admin area is
 * reachable only with a live Supabase session (see src/lib/useAuthGate.ts).
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

const RETURN_KEY = 'formflow.auth-return'

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#f25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7fba00" />
      <rect width="10" height="10" x="1" y="12" fill="#00a4ef" />
      <rect width="10" height="10" x="12" y="12" fill="#ffb900" />
    </svg>
  )
}

/* Supabase returns English messages - surface them in Hebrew, like the rest of the UI */
function hebrewError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials')) return 'מייל או סיסמה שגויים'
  if (m.includes('email not confirmed')) return 'המייל עדיין לא אומת - בדקו את תיבת הדואר'
  if (m.includes('already registered')) return 'כתובת המייל כבר רשומה - נסו להתחבר'
  if (m.includes('user already')) return 'כתובת המייל כבר רשומה - נסו להתחבר'
  if (m.includes('rate limit') || m.includes('too many')) return 'יותר מדי ניסיונות - נסו שוב בעוד כמה דקות'
  if (m.includes('password should be')) return 'הסיסמה חייבת להכיל לפחות 8 תווים'
  if (m.includes('provider is not enabled')) return 'ההתחברות עם הספק הזה עדיין לא הופעלה בפרויקט'
  if (m.includes('failed to fetch') || m.includes('network')) return 'אין חיבור לשירות ההתחברות - בדקו את הרשת ונסו שוב'
  return raw
}

export default function LoginScreen() {
  const { login, onboardingDone } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo =
    (location.state as { from?: string } | null)?.from ?? sessionStorage.getItem(RETURN_KEY) ?? '/'
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const handled = useRef(false)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (mode === 'signup' && name.trim().length < 2) next.name = 'נא להזין שם מלא'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      next.email = 'נא להזין כתובת מייל תקינה'
    if (mode === 'signup' && password.length < 8) next.password = 'סיסמה באורך 8 תווים לפחות'
    if (mode === 'login' && password.length === 0) next.password = 'נא להזין סיסמה'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /* a verified session exists - hand the user over to the app */
  const finishLogin = async (u: { name: string; email: string }) => {
    if (handled.current) return
    handled.current = true
    login(u)
    sessionStorage.removeItem(RETURN_KEY)
    try {
      /* creates the customer's workspace on first login (clear tenant separation) */
      const session = await api.createSession(u.email, u.name)
      navigate(session.formsCount === 0 ? '/onboarding' : returnTo, { replace: true })
    } catch {
      navigate(onboardingDone ? returnTo : '/onboarding', { replace: true })
    }
  }

  const submit = async () => {
    setNotice('')
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/reset-password',
        })
        if (error) return setErrors({ email: hebrewError(error.message) })
        setNotice('שלחנו קישור לאיפוס סיסמה אל ' + email.trim())
        return
      }

      if (mode === 'signup') {
        const fullName = name.trim()
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + '/login',
          },
        })
        if (error) return setErrors({ email: hebrewError(error.message) })
        if (!data.session) {
          setNotice('שלחנו מייל אימות אל ' + email.trim() + ' - אשרו אותו וחזרו להתחבר')
          return
        }
        await finishLogin({ name: fullName, email: email.trim() })
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return setErrors({ password: hebrewError(error.message) })
      const metaName = data.user?.user_metadata?.full_name as string | undefined
      const fallbackName = email.trim().split("@")[0].replace(/[._-]/g, " ")
      await finishLogin({ name: metaName || fallbackName, email: email.trim() })
    } finally {
      setBusy(false)
    }
  }

  const sso = async (provider: 'Google' | 'Microsoft') => {
    setErrors({})
    setNotice('')
    sessionStorage.setItem(RETURN_KEY, returnTo)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider === 'Google' ? 'google' : 'azure',
      options: { redirectTo: window.location.origin + '/login' },
    })
    if (error)
      setErrors({ email: 'התחברות ' + provider + ' אינה מוגדרת עדיין - נסו עם מייל וסיסמה' })
  }

  /* OAuth / magic-link return and restored sessions finish the login automatically */
  useEffect(() => {
    const complete = (sEmail: string, sName: string) => {
      void finishLogin({ name: sName, email: sEmail })
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      if (u?.email) {
        complete(u.email, (u.user_metadata?.full_name as string) || u.email.split('@')[0])
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
        return
      }
      const u = session?.user
      if (u?.email) {
        complete(u.email, (u.user_metadata?.full_name as string) || u.email.split('@')[0])
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const title =
    mode === 'login' ? 'התחברות ל-FormFlow' : mode === 'signup' ? 'יצירת חשבון חדש' : 'איפוס סיסמה'
  const subtitle =
    mode === 'login'
      ? 'מערכת הטפסים של שווה עסקים 360'
      : mode === 'signup'
        ? 'פחות מדקה - ומתחילים לבנות טפסים'
        : 'הזינו את כתובת המייל ונשלח קישור לבחירת סיסמה חדשה'
  const cta =
    busy
      ? mode === 'login'
        ? 'מתחבר...'
        : mode === 'signup'
          ? 'יוצר חשבון...'
          : 'שולח...'
      : mode === 'login'
        ? 'התחברות ←'
        : mode === 'signup'
          ? 'יצירת חשבון ←'
          : 'שליחת קישור איפוס'

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />

      <div className="flow-card fade-up">
        <div>
          <h1 className="flow-title">{title}</h1>
          <div className="flow-sub">{subtitle}</div>
        </div>

        {mode !== 'forgot' && (
          <>
            <div className="sso-row">
              <button
                type="button"
                className="sso-btn"
                disabled={busy}
                onClick={() => sso('Google')}
              >
                <GoogleIcon /> Google
              </button>
              <button
                type="button"
                className="sso-btn"
                disabled={busy}
                onClick={() => sso('Microsoft')}
              >
                <MicrosoftIcon /> Microsoft
              </button>
            </div>
            <div className="or-divider">או עם מייל</div>
          </>
        )}

        <form
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {mode === 'signup' && (
            <div className="pub-field">
              <label htmlFor="auth-name">שם מלא</label>
              <input
                id="auth-name"
                className={`pub-input${errors.name ? ' invalid' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ישראל ישראלי"
                autoComplete="name"
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <div className="pub-error" role="alert">
                  {errors.name}
                </div>
              )}
            </div>
          )}
          <div className="pub-field">
            <label htmlFor="auth-email">כתובת מייל</label>
            <input
              id="auth-email"
              className={`pub-input${errors.email ? ' invalid' : ''}`}
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.il"
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <div className="pub-error" role="alert">
                {errors.email}
              </div>
            )}
          </div>
          {mode !== 'forgot' && (
            <div className="pub-field">
              <label htmlFor="auth-pass">סיסמה</label>
              <input
                id="auth-pass"
                className={`pub-input${errors.password ? ' invalid' : ''}`}
                dir="ltr"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <div className="pub-error" role="alert">
                  {errors.password}
                </div>
              )}
            </div>
          )}
          {notice && (
            <div
              className="flow-sub"
              role="status"
              style={{ fontWeight: 700, color: 'var(--brand-ink, #12265a)' }}
            >
              {notice}
            </div>
          )}
          <div className="flow-footer">
            <button
              type="submit"
              className="pub-cta"
              style={{ color: '#12265a' }}
              disabled={busy}
            >
              {cta}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                className="flow-skip"
                onClick={() => {
                  setErrors({})
                  setNotice('')
                  setMode('forgot')
                }}
              >
                שכחתי סיסמה
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="flow-skip"
                onClick={() => {
                  setErrors({})
                  setNotice('')
                  setMode('login')
                }}
              >
                חזרה להתחברות
              </button>
            )}
          </div>
        </form>

        {mode !== 'forgot' && (
          <div className="auth-toggle">
            {mode === 'login' ? (
              <>
                אין לכם חשבון?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrors({})
                    setNotice('')
                    setMode('signup')
                  }}
                >
                  הרשמה
                </button>
              </>
            ) : (
              <>
                כבר יש חשבון?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrors({})
                    setNotice('')
                    setMode('login')
                  }}
                >
                  התחברות
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="pub-footer">SSO ארגוני (SAML), MFA והצפנה - לפי פרק 5.3 באיפיון</div>
    </div>
  )
}
