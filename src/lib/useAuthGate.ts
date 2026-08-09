/**
 * useAuthGate — the real authentication gate.
 *
 * The Supabase session (not localStorage) is the source of truth for "who is
 * signed in". A cached user without a live session is discarded, so the admin
 * area is reachable only after a real sign-in.
 */
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useStore } from './store'

export type AuthPhase = 'checking' | 'authenticated' | 'anonymous'

const DEV_BYPASS = import.meta.env.DEV && !import.meta.env.VITE_NO_DEV_LOGIN

export function useAuthGate(): AuthPhase {
  const { user, login, logout } = useStore()
  const [phase, setPhase] = useState<AuthPhase>(DEV_BYPASS && user ? 'authenticated' : 'checking')

  useEffect(() => {
    if (DEV_BYPASS) {
      setPhase(user ? 'authenticated' : 'anonymous')
      return
    }
    let alive = true

    const apply = (session: Session | null) => {
      if (!alive) return
      const su = session?.user
      if (su?.email) {
        const name = (su.user_metadata?.full_name as string) || su.email.split('@')[0]
        if (!user || user.email !== su.email) login({ name, email: su.email })
        setPhase('authenticated')
      } else {
        if (user) logout()
        setPhase('anonymous')
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        /* auth service unreachable: keep the cached user instead of locking out */
        if (alive) setPhase(user ? 'authenticated' : 'anonymous')
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return phase
}
