import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('AUTH FAILURE — invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#00d4ff',
              textShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
              textTransform: 'uppercase',
            }}
          >
            MissonControl
          </div>
          <div style={{ color: '#52809e', fontSize: '0.72rem', letterSpacing: '0.15em', marginTop: '0.4rem' }}>
            // AUTHENTICATION REQUIRED
          </div>
        </div>

        {/* Panel */}
        <div
          style={{
            background: '#132035',
            border: '1px solid #1e4470',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Panel title bar */}
          <div
            style={{
              padding: '0.5rem 1.25rem',
              borderBottom: '1px solid #1e4470',
              borderLeft: '3px solid #00d4ff',
            }}
          >
            <span style={{ color: '#00d4ff', fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Operator Login
            </span>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {error && (
              <div
                style={{
                  borderLeft: '3px solid #ff3a3a',
                  background: 'rgba(255, 58, 58, 0.07)',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '1rem',
                  color: '#ff3a3a',
                  fontSize: '0.78rem',
                  letterSpacing: '0.05em',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label>
                <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="operator@missoncontrol.io"
                />
              </label>
              <label>
                <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', marginTop: '0.5rem', letterSpacing: '0.12em' }}
              >
                {loading ? 'AUTHENTICATING…' : 'AUTHENTICATE'}
              </button>
            </form>

            <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.75rem', color: '#52809e' }}>
              No account?{' '}
              <Link to="/register">Register operator</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
