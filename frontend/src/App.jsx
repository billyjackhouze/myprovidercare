import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from '@/store/auth'
import AppLayout from '@/components/layout/AppLayout'

// Pages
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import FormIngestion from '@/pages/FormIngestion'
import FormBuilder from '@/pages/FormBuilder'
import FormEdit from '@/pages/FormEdit'
import FormsList from '@/pages/FormsList'
import ClientList from '@/pages/ClientList'
import ClientDetail from '@/pages/ClientDetail'
import WorkflowSettings from '@/pages/WorkflowSettings'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  const { isAuthenticated, fetchMe } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) fetchMe()
  }, [isAuthenticated])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute><FormsList /></ProtectedRoute>} />
      <Route path="/forms/ingest" element={<ProtectedRoute><FormIngestion /></ProtectedRoute>} />
      <Route path="/forms/build"      element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
      <Route path="/forms/:id/edit"   element={<ProtectedRoute><FormEdit /></ProtectedRoute>} />

      {/* Clients */}
      <Route path="/clients"           element={<ProtectedRoute><ClientList /></ProtectedRoute>} />
      <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><PlaceholderPage title="Schedule" /></ProtectedRoute>} />
      <Route path="/visits"   element={<ProtectedRoute><PlaceholderPage title="Visits" /></ProtectedRoute>} />
      <Route path="/notes"    element={<ProtectedRoute><PlaceholderPage title="Progress Notes" /></ProtectedRoute>} />
      <Route path="/claims"   element={<ProtectedRoute><PlaceholderPage title="Claims" /></ProtectedRoute>} />
      <Route path="/payroll"  element={<ProtectedRoute><PlaceholderPage title="Payroll" /></ProtectedRoute>} />
      <Route path="/map"      element={<ProtectedRoute><PlaceholderPage title="Live Map" /></ProtectedRoute>} />
      <Route path="/audit"    element={<ProtectedRoute><PlaceholderPage title="Audit" /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><PlaceholderPage title="Settings" /></ProtectedRoute>} />
      <Route path="/settings/workflow" element={<ProtectedRoute><WorkflowSettings /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div>
      <h1 className="text-2xl font-medium text-heading mb-1">{title}</h1>
      <p className="text-muted text-sm">Coming soon — module under construction.</p>
    </div>
  )
}
