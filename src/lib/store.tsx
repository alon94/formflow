import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultBranding,
  defaultNotif,
  seedFields,
  seedForms,
  seedRules,
  seedSubmissions,
} from './data'
import type {
  BrandingState,
  FormField,
  FormMeta,
  LogicRule,
  NotifState,
  Submission,
} from './types'

export type Theme = 'light' | 'dark'

interface AppStore {
  theme: Theme
  toggleTheme: () => void
  forms: FormMeta[]
  fields: FormField[]
  setFields: (next: FormField[]) => void
  rules: LogicRule[]
  setRules: (next: LogicRule[]) => void
  submissions: Submission[]
  addLiveSubmission: (s: Omit<Submission, 'id' | 'sentAt'>) => void
  branding: BrandingState
  setBranding: (next: Partial<BrandingState>) => void
  notif: NotifState
  setNotif: (next: Partial<NotifState>) => void
}

const StoreContext = createContext<AppStore | null>(null)

const THEME_KEY = 'formflow.theme'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [forms] = useState(seedForms)
  const [fields, setFields] = useState<FormField[]>(() => {
    try {
      const saved = localStorage.getItem('formflow.fields')
      if (saved) return JSON.parse(saved) as FormField[]
    } catch {
      /* corrupted draft — fall back to seed */
    }
    return seedFields
  })
  const [rules, setRules] = useState<LogicRule[]>(seedRules)
  const [submissions, setSubmissions] = useState<Submission[]>(seedSubmissions)
  const [branding, setBrandingState] = useState<BrandingState>(defaultBranding)
  const [notif, setNotifState] = useState<NotifState>(defaultNotif)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    [],
  )

  const addLiveSubmission = useCallback((s: Omit<Submission, 'id' | 'sentAt'>) => {
    setSubmissions((prev) => {
      const nextId = Math.max(...prev.map((p) => p.id)) + 1
      const cleared = prev.map((p) => ({ ...p, isNew: false }))
      return [{ ...s, id: nextId, sentAt: 'ממש עכשיו', isNew: true }, ...cleared]
    })
  }, [])

  const setBranding = useCallback(
    (next: Partial<BrandingState>) => setBrandingState((prev) => ({ ...prev, ...next })),
    [],
  )

  const setNotif = useCallback(
    (next: Partial<NotifState>) => setNotifState((prev) => ({ ...prev, ...next })),
    [],
  )

  const value = useMemo<AppStore>(
    () => ({
      theme,
      toggleTheme,
      forms,
      fields,
      setFields,
      rules,
      setRules,
      submissions,
      addLiveSubmission,
      branding,
      setBranding,
      notif,
      setNotif,
    }),
    [
      theme,
      toggleTheme,
      forms,
      fields,
      rules,
      submissions,
      addLiveSubmission,
      branding,
      setBranding,
      notif,
      setNotif,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
