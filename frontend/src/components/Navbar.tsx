import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkStyle = (name: string) => ({
    color: hoveredLink === name ? '#00d4ff' : '#4a7aa7',
    textDecoration: 'none',
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    transition: 'color 0.15s',
    padding: '0.25rem 0',
    borderBottom: hoveredLink === name ? '1px solid #00d4ff' : '1px solid transparent',
  })

  return (
    <nav
      style={{
        padding: '0 1.5rem',
        height: '52px',
        background: '#132035',
        borderBottom: '1px solid #1e4470',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link
          to="/dashboard"
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#00d4ff',
            textDecoration: 'none',
            textShadow: '0 0 12px rgba(0, 212, 255, 0.5)',
          }}
        >
          MissonControl
        </Link>
        {user && (
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link
              to="/dashboard"
              style={linkStyle('dashboard')}
              onMouseEnter={() => setHoveredLink('dashboard')}
              onMouseLeave={() => setHoveredLink(null)}
            >
              Dashboard
            </Link>
            <Link
              to="/tasks"
              style={linkStyle('tasks')}
              onMouseEnter={() => setHoveredLink('tasks')}
              onMouseLeave={() => setHoveredLink(null)}
            >
              Tasks
            </Link>
          </div>
        )}
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              color: '#ff3a3a',
              borderColor: '#ff3a3a',
              padding: '0.2rem 0.75rem',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
            }}
          >
            LOGOUT
          </button>
        </div>
      )}
    </nav>
  )
}
