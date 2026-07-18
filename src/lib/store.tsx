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
import {
  defaultBranding,
  defaultNotif,
  defaultSettings,
  defaultWebhooks,
  FORM_NAME,
  seedFields,
  seedRules,
} from './data'
import type {
  BrandingState,
  FormField,
  FormSettings,
  FormStatus,
  LogicRule,
  NotifState,
  WebhookConfig,
} from './types'

export type Theme = 'light' | 'dark'
export type SaveState = 'saved' | 'saving' | 'offline'

export interface AppUser {
  name: string
  email: string
}

interface AppStore {
  theme: Theme
  toggleTheme: () => void
  user: AppUser | null
  login: (user: AppUser) => void
  logout: () => void
  onboardingDone: boolean
  completeOnboarding: () => void
  serverReady: boolean
  saveState: SaveState
  formName: string
  setFormName: (name: string) => void
  formStatus: FormStatus
  fields: FormField[]
  setFields: (next: FormField[]) => void
  rules: LogicRule[]
  setRules: (next: LogicRule[]) => void
  branding: BrandingState
  setBranding: (next: Partial<BrandingState>) => void
  notif: NotifState
  setNotif: (next: Partial<NotifState>) => void
  webhooks: WebhookConfig[]
  setWebhooks: (next: WebhookConfig[]) => void
  settings: FormSettings
  setSettings: (next: Partial<FormSettings>) => void
  publish: () => Promise<void>
}

const StoreContext = createContext<AppStore | null>(null)

const THEME_KEY = 'formflow.theme'
const USER_KEY = 'formflow.user'
const ONBOARDING_KEY = 'formflow.onboarding-done'
/* static hosting (no API): edits persist per-browser so the demo survives reloads */
const OFFLINE_DOC_KEY = 'formflow.offline-doc'

interface OfflineDoc {
  fields: FormField[]
  rules: LogicRule[]
  branding: BrandingState
  notif: NotifState
  webhooks: WebhookConfig[]
  settings: FormSettings
  name: string
}

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
  const [webhooks, setWebhooksState] = useState<WebhookConfig[]>(defaultWebhooks)
  const [settings, setSettingsState] = useState<FormSettings>(defaultSettings)
  const [formName, setFormNameState] = useState(FORM_NAME)
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as AppUser) : null
    } catch {
      return null
    }
  })
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === '1',
  )

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
        setWebhooksState(form.webhooks ?? defaultWebhooks)
        setSettingsState(form.settings ?? defaultSettings)
        setFormNameState(form.name)
        setFormStatus(form.status)
        setServerReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setSaveState('offline')
        try {
          const raw = localStorage.getItem(OFFLINE_DOC_KEY)
          if (raw) {
            const doc = JSON.parse(raw) as OfflineDoc
            setFieldsState(doc.fields)
            setRulesState(doc.rules)
            setBrandingState(doc.branding)
            setNotifState(doc.notif)
            setWebhooksState(doc.webhooks)
            setSettingsState(doc.settings)
            setFormNameState(doc.name)
          }
        } catch {
          /* corrupted offline doc — keep seeds */
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* while offline, mirror every edit to localStorage (debounced) */
  useEffect(() => {
    if (saveState !== 'offline') return
    const t = window.setTimeout(() => {
      const doc: OfflineDoc = {
        fields,
        rules,
        branding,
        notif,
        webhooks,
        settings,
        name: formName,
      }
      localStorage.setItem(OFFLINE_DOC_KEY, JSON.stringify(doc))
    }, 600)
    return () => window.clearTimeout(t)
  }, [saveState, fields, rules, branding, notif, webhooks, settings, formName])

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

  const login = useCallback((u: AppUser) => {
    setUser(u)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setOnboardingDone(false)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ONBOARDING_KEY)
  }, [])

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true)
    localStorage.setItem(ONBOARDING_KEY, '1')
  }, [])

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

  const setWebhooks = useCallback(
    (next: WebhookConfig[]) => {
      setWebhooksState(next)
      queuePatch('webhooks', next)
    },
    [queuePatch],
  )

  const setSettings = useCallback(
    (patch: Partial<FormSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch }
        queuePatch('settings', next)
        return next
      })
    },
    [queuePatch],
  )

  const setFormName = useCallback(
    (name: string) => {
      setFormNameState(name)
      queuePatch('name', name)
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
      user,
      login,
      logout,
      onboardingDone,
      completeOnboarding,
      serverReady,
      saveState,
      formName,
      setFormName,
      formStatus,
      fields,
      setFields,
      rules,
      setRules,
      branding,
      setBranding,
      notif,
      setNotif,
      webhooks,
      setWebhooks,
      settings,
      setSettings,
      publish,
    }),
    [
      theme,
      toggleTheme,
      user,
      login,
      logout,
      onboardingDone,
      completeOnboarding,
      serverReady,
      saveState,
      formName,
      setFormName,
      formStatus,
      fields,
      setFields,
      rules,
      setRules,
      branding,
      setBranding,
      notif,
      setNotif,
      webhooks,
      setWebhooks,
      settings,
      setSettings,
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
