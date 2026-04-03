import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import TaskDetailPage from './pages/TaskDetailPage'
import CtiPage from './pages/CtiPage'
import AdminPage from './pages/AdminPage'
import FeedsPage from './pages/FeedsPage'
import WeatherPage from './pages/WeatherPage'
import CaDashboardPage from './pages/CaDashboardPage'
import CountdownPage from './pages/CountdownPage'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'

function OidcCallback() {
  const auth = useOidcAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth.isLoading) {
      navigate('/', { replace: true })
    }
  }, [auth.isLoading, navigate])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
      Signing in...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<OidcCallback />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <PrivateRoute>
              <TasksPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <PrivateRoute>
              <TaskDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/cti"
          element={
            <PrivateRoute>
              <CtiPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/feeds"
          element={
            <PrivateRoute>
              <FeedsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/weather"
          element={
            <PrivateRoute>
              <WeatherPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/ca"
          element={
            <PrivateRoute>
              <CaDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/countdown"
          element={
            <PrivateRoute>
              <CountdownPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
