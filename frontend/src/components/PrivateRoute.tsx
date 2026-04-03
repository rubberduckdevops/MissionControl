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
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4rem', gap: '1rem' }}>
        <p>Not authenticated</p>
        <button onClick={login}>Login</button>
      </div>
    )
  }

  return <>{children}</>
}
