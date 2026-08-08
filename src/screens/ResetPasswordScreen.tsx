/**
 * ResetPasswordScreen - completes the real "forgot password" flow.
 *
 * Supabase mails a recovery link that lands here with a one-time session
 * (detectSessionInUrl), and the user sets a new password for real.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoMark from '../components/LogoMark'
import { supabase } from '../lib/supabase'

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordScreen() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('checking')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setPhase(data.session ? 'ready' : 'invalid')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && alive) setPhase((p) => (p === 'done' ? p : 'ready'))
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const submit = async () => {
    setError('')
    if (pass.length < 8) return setError('הסיסמה צריכה להכיל לפחות 8 תווים')
    if (pass !== confirm) return setError('הסיסמאות אינן זהות')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    setBusy(false)
    if (err) return setError('לא הצלחנו לעדכן את הסיסמה - בקשו קישור איפוס חדש')
    setPhase('done')
    window.setTimeout(() => navigate('/login', { replace: true }), 1600)
  }

  return (
    <div className="flow-root" dir="rtl">
      <LogoMark size={24} />
      <div className="flow-card fade-up">
        <div>
          <h1 className="flow-title">בחירת סיסמה חדשה</h1>
          <div className="flow-sub">
            {phase === 'invalid'
              ? 'הקישור פג תוקף או שאינו תקין - בקשו קישור איפוס חדש ממסך ההתחברות'
              : 'הזינו סיסמה חדשה לחשבון שלכם'}
          </div>
        </div>

        {phase === 'done' && (
          <div className="flow-sub" role="status" style={{ fontWeight: 700 }}>
            הסיסמה עודכנה - מעבירים אתכם למסך ההתחברות...
          </div>
        )}

        {phase === 'ready' && (
          <form
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="pub-field">
              <label htmlFor="new-pass">סיסמה חדשה</label>
              <input
                id="new-pass"
                className="pub-input"
                dir="ltr"
                type="password"
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="לפחות 8 תווים"
              />
            </div>
            <div className="pub-field">
              <label htmlFor="new-pass2">אימות סיסמה</label>
              <input
                id="new-pass2"
                className="pub-input"
                dir="ltr"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="חזרו על הסיסמה"
              />
            </div>
            {error && (
              <div className="pub-error" role="alert">
                {error}
              </div>
            )}
            <div className="flow-footer">
              <button
                type="submit"
                className="pub-cta"
                style={{ color: '#12265a' }}
                disabled={busy}
              >
                {busy ? 'מעדכן...' : 'עדכון סיסמה'}
              </button>
            </div>
          </form>
        )}

        {phase !== 'ready' && phase !== 'done' && (
          <div className="flow-footer">
            <button
              type="button"
              className="pub-cta"
              style={{ color: '#12265a' }}
              onClick={() => navigate('/login', { replace: true })}
            >
              חזרה למסך ההתחברות
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
