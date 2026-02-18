import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

interface DashboardData {
  message: string
  user_id: string
  stats: {
    total_users: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<DashboardData>('/api/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError('TELEMETRY FAILURE — could not load dashboard data'))
  }, [])

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        {/* Page heading */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '0.8rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#00d4ff',
            }}
          >
            Mission Status
          </h1>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)',
              marginTop: '0.5rem',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              borderLeft: '3px solid #ff3a3a',
              background: 'rgba(255, 58, 58, 0.07)',
              padding: '0.5rem 0.75rem',
              marginBottom: '1.5rem',
              color: '#ff3a3a',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
          >
            {error}
          </div>
        )}

        {data ? (
          <>
            <p style={{ color: '#52809e', fontSize: '0.8rem', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
              {data.message}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <StatCard label="Total Operators" value={data.stats.total_users} />
            </div>
          </>
        ) : (
          !error && (
            <p style={{ color: '#52809e', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
              LOADING TELEMETRY…
            </p>
          )
        )}
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: '#132035',
        border: '1px solid #1e4470',
        borderLeft: '3px solid #00d4ff',
        borderRadius: 4,
        padding: '1.25rem',
      }}
    >
      <div
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: '#00d4ff',
          textShadow: '0 0 16px rgba(0, 212, 255, 0.5)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: '0.5rem',
          color: '#4a7aa7',
          fontSize: '0.68rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  )
}
