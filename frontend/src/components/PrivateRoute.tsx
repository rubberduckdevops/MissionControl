import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

export default function PrivateRoute({ children }: Props) {
  const { user, loading, login } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    login()
    return null
  }

  return <>{children}</>
}
