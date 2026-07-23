import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

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

export default function LoginScreen() {
  const { login, onboardingDone } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mfa, setMfa] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])
  const [pendingUser] = useState<{ name: string; email: string } | null>(null)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (mode === 'signup' && name.trim().length < 2) next.name = 'נא להזין שם מלא'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      next.email = 'נא להזין כתובת מייל תקינה'
    if (password.length < 6) next.password = 'סיסמה באורך 6 תווים לפחות'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const finishLogin = async (u: { name: string; email: string }) => {
    login(u)
    try {
      /* creates the customer's workspace on first login (clear tenant separation) */
      const session = await api.createSession(u.email, u.name)
      navigate(session.formsCount === 0 ? '/onboarding' : returnTo)
    } catch {
      navigate(onboardingDone ? returnTo : '/onboarding')
    }
  }

  const submit = async () => {
    if (!validate()) return
    const guessedName =
      mode === 'signup' ? name.trim() : email.split('@')[0].replace(/[._-]/g, ' ')
    /* real authentication via Supabase (email + password) */
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: guessedName } },
      })
      if (error) return setErrors({ email: error.message })
      if (!data.session) {
        return setErrors({ email: 'נשלח מייל אימות — אשרו אותו והתחברו שוב' })
      }
      finishLogin({ name: guessedName, email: email.trim() })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        return setErrors({ password: 'מייל או סיסמה שגויים' })
      }
      finishLogin({ name: guessedName, email: email.trim() })
    }
  }

  const sso = async (provider: 'Google' | 'Microsoft') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider === 'Google' ? 'google' : 'azure',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    if (error) setErrors({ email: 'התחברות ' + provider + ' אינה מוגדרת עדיין — נסו מייל' })
  }

  /* OAuth redirect return + restored sessions: finish login automatically */
  useEffect(() => {
    let done = false
    const complete = (sEmail: string, sName: string) => {
      if (done) return
      done = true
      finishLogin({ name: sName, email: sEmail })
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      if (u?.email) {
        complete(u.email, (u.user_metadata?.full_name as string) ?? u.email.split('@')[0])
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user
      if (u?.email) {
        complete(u.email, (u.user_metadata?.full_name as string) ?? u.email.split('@')[0])
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[i] = digit
    setCode(next)
    if (digit && i < 5) codeRefs.current[i + 1]?.focus()
    if (next.every((d) => d !== '') && pendingUser) {
      window.setTimeout(() => finishLogin(pendingUser), 250)
    }
  }

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />

      {mfa ? (
        <div className="flow-card fade-up" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="icon-tile" style={{ width: 52, height: 52, borderRadius: 16 }}>
            <ShieldCheck size={24} />
          </span>
          <div>
            <div className="flow-title" style={{ fontSize: 21 }}>
              אימות דו-שלבי
            </div>
            <div className="flow-sub">
              הזינו את הקוד מאפליקציית האימות (TOTP)
              <br />
              <span dir="ltr">{pendingUser?.email}</span>
            </div>
          </div>
          <div className="mfa-boxes">
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  codeRefs.current[i] = el
                }}
                className="mfa-input"
                inputMode="numeric"
                value={d}
                autoFocus={i === 0}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus()
                }}
                aria-label={`ספרה ${i + 1}`}
              />
            ))}
          </div>
          <div className="demo-hint">סביבת דמו — כל 6 ספרות יתקבלו</div>
          <button type="button" className="flow-skip" onClick={() => setMfa(false)}>
            → חזרה להתחברות
          </button>
        </div>
      ) : (
        <div className="flow-card fade-up">
          <div>
            <h1 className="flow-title">
              {mode === 'login' ? 'התחברות ל-FormFlow' : 'יצירת חשבון חדש'}
            </h1>
            <div className="flow-sub">
              {mode === 'login'
                ? 'מערכת הטפסים של שווה עסקים 360'
                : 'פחות מדקה — ומתחילים לבנות טפסים'}
            </div>
          </div>

          <div className="sso-row">
            <button type="button" className="sso-btn" onClick={() => sso('Google')}>
              <GoogleIcon /> Google
            </button>
            <button type="button" className="sso-btn" onClick={() => sso('Microsoft')}>
              <MicrosoftIcon /> Microsoft
            </button>
          </div>

          <div className="or-divider">או עם מייל</div>

          <form
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
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
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <div className="pub-error" role="alert">
                  {errors.email}
                </div>
              )}
            </div>
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
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <div className="pub-error" role="alert">
                  {errors.password}
                </div>
              )}
            </div>
            <div className="flow-footer">
              <button type="submit" className="pub-cta" style={{ color: '#12265a' }}>
                {mode === 'login' ? 'התחברות ←' : 'יצירת חשבון ←'}
              </button>
              {mode === 'login' && (
                <button type="button" className="flow-skip">
                  שכחתי סיסמה
                </button>
              )}
            </div>
          </form>

          <div className="auth-toggle">
            {mode === 'login' ? (
              <>
                אין לכם חשבון?{' '}
                <button type="button" onClick={() => setMode('signup')}>
                  הרשמה
                </button>
              </>
            ) : (
              <>
                כבר יש חשבון?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  התחברות
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="pub-footer">SSO ארגוני (SAML), ‏MFA והצפנה — לפי פרק 5.3 באיפיון</div>
    </div>
  )
}
