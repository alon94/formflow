import { Navigate, Route, Routes } from 'react-router-dom'
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
import ResponsesScreen from './screens/ResponsesScreen'
import TemplatesScreen from './screens/TemplatesScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="/new" element={<NewFormWizard />} />
      <Route path="/integrations" element={<IntegrationsScreen />} />
      <Route path="/templates" element={<TemplatesScreen />} />
      <Route path="/form/:formId" element={<FormShell />}>
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
