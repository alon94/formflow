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
  FORM_ID,
  FORM_NAME,
  FORM_SLUG,
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

export interface WorkspaceInfo {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
  businessName?: string
  phone?: string
  domain?: string
  goal?: string
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
  formId: string
  formSlug: string
  formName: string
  setFormName: (name: string) => void
  formStatus: FormStatus
  loadForm: (idOrSlug: string, opts?: { publicView?: boolean }) => void
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
  workspaces: WorkspaceInfo[]
  activeWorkspaceId: string | null
  activeWorkspace: WorkspaceInfo | null
  refreshWorkspaces: () => Promise<void>
  switchWorkspace: (id: string) => void
}

const StoreContext = createContext<AppStore | null>(null)

const THEME_KEY = 'formflow.theme'
const USER_KEY = 'formflow.user'
const ONBOARDING_KEY = 'formflow.onboarding-done'
const ACTIVE_WS_KEY = 'formflow.active-workspace'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [serverReady, setServerReady] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [formId, setFormId] = useState(FORM_ID)
  const [formSlug, setFormSlug] = useState(FORM_SLUG)
  const [formStatus, setFormStatus] = useState<FormStatus>('published')
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
      if (raw) return JSON.parse(raw) as AppUser
    } catch {
      /* fall through to dev bypass */
    }
    /* Dev-only auto-login: skip the login screen during local development so the
       full admin UI (business switcher, template builder, workspaces) can be
       explored without seeded credentials. Never active in production builds,
       where import.meta.env.DEV is false. Opt out with VITE_NO_DEV_LOGIN=1. */
    if (import.meta.env.DEV && !import.meta.env.VITE_NO_DEV_LOGIN) {
      const devUser: AppUser = { name: 'Dev User', email: 'dev@formflow.local' }
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(devUser))
      } catch {
        /* ignore storage errors */
      }
      return devUser
    }
    return null
  })
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === '1',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  /* Dev-only: provision the server session for the auto-login dev user so API
     calls (workspaces, templates, forms) are authorized. Mirrors what the real
     login flow does via api.createSession. Runs only in development. */
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      !import.meta.env.VITE_NO_DEV_LOGIN &&
      user?.email === 'dev@formflow.local'
    ) {
      void api.createSession(user.email, user.name)
    }
  }, [user])

  const applyDoc = useCallback(
    (doc: {
      id?: string
      slug?: string
      name: string
      status?: FormStatus
      fields: FormField[]
      rules: LogicRule[]
      branding: BrandingState
      notif?: NotifState
      webhooks?: WebhookConfig[]
      settings?: FormSettings
    }) => {
      if (doc.id) setFormId(doc.id)
      if (doc.slug) setFormSlug(doc.slug)
      setFormNameState(doc.name)
      if (doc.status) setFormStatus(doc.status)
      setFieldsState(doc.fields)
      setRulesState(doc.rules)
      setBrandingState(doc.branding)
      if (doc.notif) setNotifState(doc.notif)
      setWebhooksState(doc.webhooks ?? [])
      setSettingsState(doc.settings ?? defaultSettings)
    },
    [],
  )

  const loadForm = useCallback(
    (idOrSlug: string, opts?: { publicView?: boolean }) => {
      setServerReady(false)
      const fetcher = opts?.publicView ? api.getPublicForm(idOrSlug) : api.getForm(idOrSlug)
      fetcher
        .then((form) => {
          applyDoc(form as Parameters<typeof applyDoc>[0])
          setSaveState(api.isLocalMode() ? 'offline' : 'saved')
          setServerReady(true)
        })
        .catch(() => setSaveState('offline'))
    },
    [applyDoc],
  )

  /* debounced autosave of edited groups to the server */
  const pendingPatch = useRef<Record<string, unknown>>({})
  const patchTimer = useRef<number | undefined>(undefined)
  const formIdRef = useRef(formId)
  formIdRef.current = formId
  const queuePatch = useCallback((key: string, value: unknown) => {
    pendingPatch.current[key] = value
    setSaveState((s) => (s === 'offline' ? s : 'saving'))
    window.clearTimeout(patchTimer.current)
    patchTimer.current = window.setTimeout(() => {
      const patch = pendingPatch.current
      pendingPatch.current = {}
      api
        .patchForm(formIdRef.current, patch)
        .then(() => setSaveState(api.isLocalMode() ? 'offline' : 'saved'))
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
    setOnboardingDone(localStorage.getItem(`${ONBOARDING_KEY}.${u.email}`) === '1')
  }, [])

  /* guards the sign-out below against re-entrancy */
  const signingOut = useRef(false)

  const logout = useCallback(() => {
    setUser(null)
    setOnboardingDone(false)
    localStorage.removeItem(USER_KEY)
    /* Terminate the Supabase session too — but never re-enter signOut(): the
     * auth gate calls logout() again when it receives SIGNED_OUT, and a nested
     * sign-out deadlocks supabase-js' internal auth lock, which used to leave
     * the app stuck forever on the "checking" splash. */
    if (signingOut.current) return
    signingOut.current = true
    void import('./supabase')
      .then(({ supabase }) => supabase.auth.signOut())
      .catch(() => {})
      .finally(() => {
        signingOut.current = false
      })
  }, [])

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true)
    localStorage.setItem(ONBOARDING_KEY, '1')
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      try {
        const u = JSON.parse(raw) as AppUser
        localStorage.setItem(`${ONBOARDING_KEY}.${u.email}`, '1')
      } catch {
        /* ignore */
      }
    }
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
      const form = await api.publishForm(formIdRef.current)
      setFormStatus(form.status)
    } catch {
      setFormStatus('published') /* optimistic when offline */
    }
  }, [])

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_WS_KEY),
  )

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = (await api.getWorkspaces()) as WorkspaceInfo[]
      setWorkspaces(list)
      /* the business profile lives in the cloud: once it has been filled in —
       * on any device or browser — never ask for it again */
      if (list.some((w) => (w.businessName ?? '').trim().length > 0)) {
        setOnboardingDone(true)
        localStorage.setItem(ONBOARDING_KEY, '1')
      }
      setActiveWorkspaceId((prev) => {
        if (prev && list.some((w) => w.id === prev)) return prev
        const next = list[0]?.id ?? null
        if (next) localStorage.setItem(ACTIVE_WS_KEY, next)
        return next
      })
    } catch {
      /* offline / no server — keep current */
    }
  }, [])

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id)
    localStorage.setItem(ACTIVE_WS_KEY, id)
  }, [])

  /* load the businesses this user can access whenever they sign in */
  useEffect(() => {
    if (user) void refreshWorkspaces()
    else {
      setWorkspaces([])
      setActiveWorkspaceId(null)
    }
  }, [user, refreshWorkspaces])

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  )

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
      formId,
      formSlug,
      formName,
      setFormName,
      formStatus,
      loadForm,
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
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      refreshWorkspaces,
      switchWorkspace,
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
      formId,
      formSlug,
      formName,
      setFormName,
      formStatus,
      loadForm,
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
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      refreshWorkspaces,
      switchWorkspace,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
