import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

export default function PrivateRoute({ children }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        Loading...
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}
