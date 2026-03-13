import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface DashboardData {
  message: string
  user_id: string
  stats: {
    total_users: number
    tasks: {
      todo: number
      in_progress: number
      done: number
    }
  }
}

interface WeatherState {
  temp: number
  condition: string
  windspeed: number
  status: 'loading' | 'ok' | 'denied' | 'error'
}

interface Task {
  _id: string
  title: string
  status: string
  assignee_id: string | null
}

function wmoDescription(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly Cloudy'
  if (code <= 48) return 'Fog'
  if (code <= 55) return 'Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow Showers'
  return 'Thunderstorm'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState({ time: '', date: '' })
  const [weather, setWeather] = useState<WeatherState>({ temp: 0, condition: '', windspeed: 0, status: 'loading' })
  const [myTasks, setMyTasks] = useState<Task[]>([])

  useEffect(() => {
    api
      .get<DashboardData>('/api/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError('TELEMETRY FAILURE — could not load dashboard data'))
  }, [])

  useEffect(() => {
    if (!user) return
    api
      .get<{ tasks: Task[] }>('/api/tasks?status=todo,in_progress&limit=50')
      .then((res) => setMyTasks(res.data.tasks.filter((t) => t.assignee_id === user.id)))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const hh = now.getUTCHours().toString().padStart(2, '0')
      const mm = now.getUTCMinutes().toString().padStart(2, '0')
      const ss = now.getUTCSeconds().toString().padStart(2, '0')
      setClock({
        time: `${hh}:${mm}:${ss}`,
        date: now.toISOString().slice(0, 10),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather((w) => ({ ...w, status: 'denied' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph`
          )
          const json = await res.json()
          const c = json.current
          setWeather({
            temp: Math.round(c.temperature_2m),
            condition: wmoDescription(c.weathercode),
            windspeed: Math.round(c.windspeed_10m),
            status: 'ok',
          })
        } catch {
          setWeather((w) => ({ ...w, status: 'error' }))
        }
      },
      () => setWeather((w) => ({ ...w, status: 'denied' }))
    )
  }, [])

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
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

        {/* Row 1: Clock + Weather */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
          <ClockWidget clock={clock} />
          <WeatherWidget weather={weather} />
        </div>

        {/* Row 2: Task + operator stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {data ? (
            <>
              <StatCard label="Todo" value={data.stats.tasks.todo} accent="#f59e0b" />
              <StatCard label="In Progress" value={data.stats.tasks.in_progress} accent="#3b82f6" />
              <StatCard label="Resolved" value={data.stats.tasks.done} accent="#22c55e" />
              <StatCard label="Operators" value={data.stats.total_users} accent="#00d4ff" />
            </>
          ) : (
            !error && (
              <p style={{ color: '#52809e', fontSize: '0.8rem', letterSpacing: '0.1em', gridColumn: '1/-1' }}>
                LOADING TELEMETRY…
              </p>
            )
          )}
        </div>

        {/* Row 3: My active tasks */}
        <MyTasksWidget tasks={myTasks} />
      </div>
    </>
  )
}

function ClockWidget({ clock }: { clock: { time: string; date: string } }) {
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
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#4a7aa7', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Zulu Time
      </div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#00d4ff',
          textShadow: '0 0 16px rgba(0, 212, 255, 0.4)',
          letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {clock.time || '——:——:——'}
      </div>
      <div style={{ marginTop: '0.4rem', color: '#4a7aa7', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
        {clock.date || '————-——-——'}
      </div>
    </div>
  )
}

function WeatherWidget({ weather }: { weather: WeatherState }) {
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
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#4a7aa7', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Local Weather
      </div>
      {weather.status === 'loading' && (
        <p style={{ color: '#4a7aa7', fontSize: '0.75rem', letterSpacing: '0.1em', margin: 0 }}>ACQUIRING POSITION…</p>
      )}
      {weather.status === 'denied' && (
        <p style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.05em', margin: 0 }}>
          Location access denied — enable geolocation to view weather.
        </p>
      )}
      {weather.status === 'error' && (
        <p style={{ color: '#ff3a3a', fontSize: '0.75rem', letterSpacing: '0.05em', margin: 0 }}>
          Weather feed unavailable.
        </p>
      )}
      {weather.status === 'ok' && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem' }}>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#00d4ff',
              textShadow: '0 0 16px rgba(0, 212, 255, 0.4)',
              lineHeight: 1,
            }}
          >
            {weather.temp}°F
          </div>
          <div>
            <div style={{ color: '#e2e8f0', fontSize: '0.85rem', letterSpacing: '0.05em' }}>{weather.condition}</div>
            <div style={{ color: '#4a7aa7', fontSize: '0.7rem', letterSpacing: '0.08em', marginTop: '0.2rem' }}>
              Wind {weather.windspeed} mph
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      style={{
        background: '#132035',
        border: '1px solid #1e4470',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 4,
        padding: '1.25rem',
      }}
    >
      <div
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: accent,
          textShadow: `0 0 16px ${accent}66`,
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

const STATUS_LABEL: Record<string, string> = {
  todo: 'TODO',
  in_progress: 'IN PROGRESS',
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#f59e0b',
  in_progress: '#3b82f6',
}

function MyTasksWidget({ tasks }: { tasks: Task[] }) {
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
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#4a7aa7', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        My Active Assignments
      </div>
      {tasks.length === 0 ? (
        <p style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.08em', margin: 0 }}>
          NO ACTIVE ASSIGNMENTS
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tasks.map((t) => (
            <div
              key={t._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid #1a2f4a',
              }}
            >
              <span
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.1em',
                  color: STATUS_COLOR[t.status] ?? '#4a7aa7',
                  border: `1px solid ${STATUS_COLOR[t.status] ?? '#4a7aa7'}`,
                  borderRadius: 2,
                  padding: '0.1rem 0.35rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {STATUS_LABEL[t.status] ?? t.status.toUpperCase()}
              </span>
              <span style={{ color: '#c8d8e8', fontSize: '0.82rem' }}>{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
