import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import ExtensionsPage from './pages/Extensions'
import UsersPage from './pages/Users'
import SitesPage from './pages/Sites'
import RequestsPage from './pages/Requests'
import LogsPage from './pages/Logs'
import SettingsPage from './pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/extensions" element={<ExtensionsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/sites" element={<SitesPage />} />
                    <Route path="/requests" element={<RequestsPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
