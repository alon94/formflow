import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthGate } from './lib/useAuthGate'
import BuildScreen from './screens/BuildScreen'
import DesignScreen from './screens/DesignScreen'
import FormShell from './screens/FormShell'
import HomeScreen from './screens/HomeScreen'
import IntegrationsScreen from './screens/IntegrationsScreen'
import LogicScreen from './screens/LogicScreen'
import LoginScreen from './screens/LoginScreen'
import NewFormWizard from './screens/NewFormWizard'
import OnboardingScreen from './screens/OnboardingScreen'
import NotificationsScreen from './screens/NotificationsScreen'
import PublicFormScreen from './screens/PublicFormScreen'
import ResetPasswordScreen from './screens/ResetPasswordScreen'
import ResponsesScreen from './screens/ResponsesScreen'
import TemplateBuilderScreen from './screens/TemplateBuilderScreen'
import TemplatesScreen from './screens/TemplatesScreen'
import WorkspacesScreen from './screens/WorkspacesScreen'

function AuthSplash() {
  return (
    <div className="flow-root" dir="rtl">
      <div className="flow-sub" role="status">
        רגע, בודקים את ההתחברות...
      </div>
    </div>
  )
}

/* clear customer separation: the admin area requires a signed-in user (spec ch.3).
   The live Supabase session is the source of truth - see src/lib/useAuthGate.ts */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const phase = useAuthGate()
  const location = useLocation()
  if (phase === 'checking') return <AuthSplash />
  if (phase === 'anonymous') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeScreen />
          </RequireAuth>
        }
      />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/new"
        element={
          <RequireAuth>
            <NewFormWizard />
          </RequireAuth>
        }
      />
      <Route
        path="/integrations"
        element={
          <RequireAuth>
            <IntegrationsScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/templates"
        element={
          <RequireAuth>
            <TemplatesScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/templates/new"
        element={
          <RequireAuth>
            <TemplateBuilderScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/workspaces"
        element={
          <RequireAuth>
            <WorkspacesScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/form/:formId"
        element={
          <RequireAuth>
            <FormShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="build" replace />} />
        <Route path="build" element={<BuildScreen />} />
        <Route path="logic" element={<LogicScreen />} />
        <Route path="design" element={<DesignScreen />} />
        <Route path="settings" element={<NotificationsScreen />} />
        <Route path="responses" element={<ResponsesScreen />} />
      </Route>
      <Route path="/f/:slug" element={<PublicFormScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
