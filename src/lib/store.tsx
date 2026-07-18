import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { defaultBranding, defaultNotif, FORM_NAME, seedFields, seedRules } from './data'
import type {
  BrandingState,
  FormField,
  FormStatus,
  LogicRule,
  NotifState,
} from './types'

export type Theme = 'light' | 'dark'
export type SaveState = 'saved' | 'saving' | 'offline'

interface AppStore {
  theme: Theme
  toggleTheme: () => void
  serverReady: boolean
  saveState: SaveState
  formName: string
  formStatus: FormStatus
  fields: FormField[]
  setFields: (next: FormField[]) => void
  rules: LogicRule[]
  setRules: (next: LogicRule[]) => void
  branding: BrandingState
  setBranding: (next: Partial<BrandingState>) => void
  notif: NotifState
  setNotif: (next: Partial<NotifState>) => void
  publish: () => Promise<void>
}

const StoreContext = createContext<AppStore | null>(null)

const THEME_KEY = 'formflow.theme'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [serverReady, setServerReady] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [formStatus, setFormStatus] = useState<FormStatus>('draft')
  const [fields, setFieldsState] = useState<FormField[]>(seedFields)
  const [rules, setRulesState] = useState<LogicRule[]>(seedRules)
  const [branding, setBrandingState] = useState<BrandingState>(defaultBranding)
  const [notif, setNotifState] = useState<NotifState>(defaultNotif)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  /* load server truth once */
  useEffect(() => {
    let cancelled = false
    api
      .getForm()
      .then((form) => {
        if (cancelled) return
        setFieldsState(form.fields)
        setRulesState(form.rules)
        setBrandingState(form.branding)
        setNotifState(form.notif)
        setFormStatus(form.status)
        setServerReady(true)
      })
      .catch(() => {
        if (!cancelled) setSaveState('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* debounced autosave of edited groups to the server */
  const pendingPatch = useRef<Record<string, unknown>>({})
  const patchTimer = useRef<number | undefined>(undefined)
  const queuePatch = useCallback((key: string, value: unknown) => {
    pendingPatch.current[key] = value
    setSaveState((s) => (s === 'offline' ? s : 'saving'))
    window.clearTimeout(patchTimer.current)
    patchTimer.current = window.setTimeout(() => {
      const patch = pendingPatch.current
      pendingPatch.current = {}
      api
        .patchForm(patch)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('offline'))
    }, 900)
  }, [])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    [],
  )

  const setFields = useCallback(
    (next: FormField[]) => {
      setFieldsState(next)
      queuePatch('fields', next)
    },
    [queuePatch],
  )

  const setRules = useCallback(
    (next: LogicRule[]) => {
      setRulesState(next)
      queuePatch('rules', next)
    },
    [queuePatch],
  )

  const setBranding = useCallback(
    (patch: Partial<BrandingState>) => {
      setBrandingState((prev) => {
        const next = { ...prev, ...patch }
        queuePatch('branding', next)
        return next
      })
    },
    [queuePatch],
  )

  const setNotif = useCallback(
    (patch: Partial<NotifState>) => {
      setNotifState((prev) => {
        const next = { ...prev, ...patch }
        queuePatch('notif', next)
        return next
      })
    },
    [queuePatch],
  )

  const publish = useCallback(async () => {
    try {
      const form = await api.publishForm()
      setFormStatus(form.status)
    } catch {
      setFormStatus('published') /* optimistic when offline */
    }
  }, [])

  const value = useMemo<AppStore>(
    () => ({
      theme,
      toggleTheme,
      serverReady,
      saveState,
      formName: FORM_NAME,
      formStatus,
      fields,
      setFields,
      rules,
      setRules,
      branding,
      setBranding,
      notif,
      setNotif,
      publish,
    }),
    [
      theme,
      toggleTheme,
      serverReady,
      saveState,
      formStatus,
      fields,
      setFields,
      rules,
      setRules,
      branding,
      setBranding,
      notif,
      setNotif,
      publish,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
