import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Box from '@cloudscape-design/components/box'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Table from '@cloudscape-design/components/table'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Link from '@cloudscape-design/components/link'
import Alert from '@cloudscape-design/components/alert'
import Spinner from '@cloudscape-design/components/spinner'
import Layout from '../components/Layout'
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

interface Feed {
  _id: string
  name: string
}

interface FeedItem {
  title: string
  link: string
  published: string | null
  sourceName: string
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

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function taskStatusIndicator(status: string): 'pending' | 'in-progress' | 'success' | 'info' {
  if (status === 'todo') return 'pending'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'done') return 'success'
  return 'info'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState({ time: '', date: '' })
  const [weather, setWeather] = useState<WeatherState>({ temp: 0, condition: '', windspeed: 0, status: 'loading' })
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedsLoading, setFeedsLoading] = useState(true)

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
    setFeedsLoading(true)
    api
      .get<Feed[]>('/api/feeds')
      .then(async (res) => {
        const feeds = res.data.slice(0, 3)
        const fetched = await Promise.allSettled(
          feeds.map((feed) =>
            api
              .get<{ items: { title: string; link: string; published: string | null }[] }>(`/api/feeds/${feed._id}/items`)
              .then((r) =>
                r.data.items.slice(0, 3).map((item) => ({ ...item, sourceName: feed.name }))
              )
          )
        )
        const all: FeedItem[] = fetched
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .sort((a, b) => {
            if (!a.published) return 1
            if (!b.published) return -1
            return new Date(b.published).getTime() - new Date(a.published).getTime()
          })
        setFeedItems(all)
      })
      .catch(() => {})
      .finally(() => setFeedsLoading(false))
  }, [])

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
    <Layout>
      <ContentLayout header={<Header variant="h1">Mission Status</Header>}>
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}

          {/* Stats row */}
          {data && (
            <ColumnLayout columns={4}>
              <Container>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Todo</Box>
                  <Box variant="h1">{data.stats.tasks.todo}</Box>
                </SpaceBetween>
              </Container>
              <Container>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">In Progress</Box>
                  <Box variant="h1">{data.stats.tasks.in_progress}</Box>
                </SpaceBetween>
              </Container>
              <Container>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Resolved</Box>
                  <Box variant="h1">{data.stats.tasks.done}</Box>
                </SpaceBetween>
              </Container>
              <Container>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Operators</Box>
                  <Box variant="h1">{data.stats.total_users}</Box>
                </SpaceBetween>
              </Container>
            </ColumnLayout>
          )}

          {/* Clock + Weather row */}
          <ColumnLayout columns={2}>
            <Container header={<Header variant="h2">Zulu Time</Header>}>
              <SpaceBetween size="xs">
                <Box variant="h1" fontSize="display-l">
                  {clock.time || '——:——:——'}
                </Box>
                <Box color="text-body-secondary">{clock.date || '————-——-——'}</Box>
              </SpaceBetween>
            </Container>

            <Container header={<Header variant="h2">Local Weather</Header>}>
              {weather.status === 'loading' && <Box color="text-body-secondary">Acquiring position…</Box>}
              {weather.status === 'denied' && (
                <Box color="text-body-secondary">Location access denied — enable geolocation to view weather.</Box>
              )}
              {weather.status === 'error' && (
                <Box color="text-status-error">Weather feed unavailable.</Box>
              )}
              {weather.status === 'ok' && (
                <SpaceBetween size="xs" direction="horizontal">
                  <Box variant="h1" fontSize="display-l">{weather.temp}°F</Box>
                  <SpaceBetween size="xxs">
                    <Box>{weather.condition}</Box>
                    <Box color="text-body-secondary">Wind {weather.windspeed} mph</Box>
                  </SpaceBetween>
                </SpaceBetween>
              )}
            </Container>
          </ColumnLayout>

          {/* My Active Assignments */}
          <Table
            header={<Header variant="h2">My Active Assignments</Header>}
            columnDefinitions={[
              {
                id: 'status',
                header: 'Status',
                cell: (item: Task) => (
                  <StatusIndicator type={taskStatusIndicator(item.status)}>
                    {item.status.replace('_', ' ')}
                  </StatusIndicator>
                ),
              },
              {
                id: 'title',
                header: 'Title',
                cell: (item: Task) => (
                  <RouterLink to={`/tasks/${item._id}`}>{item.title}</RouterLink>
                ),
              },
            ]}
            items={myTasks}
            empty={
              <Box textAlign="center" color="text-body-secondary">
                No active assignments
              </Box>
            }
          />

          {/* Intelligence Headlines */}
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <Link href="/feeds" onFollow={(e) => { e.preventDefault(); window.location.href = '/feeds' }}>
                    Manage feeds →
                  </Link>
                }
              >
                Intelligence Headlines
              </Header>
            }
          >
            {feedsLoading && <Spinner />}
            {!feedsLoading && feedItems.length === 0 && (
              <Box color="text-body-secondary">
                No feeds configured —{' '}
                <RouterLink to="/feeds">add feeds on the Intelligence Feeds page</RouterLink>
              </Box>
            )}
            {!feedsLoading && feedItems.length > 0 && (
              <SpaceBetween size="xs">
                {feedItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <Link href={item.link} external fontSize="body-m">
                      {item.title || '(no title)'}
                    </Link>
                    <Box variant="small" color="text-body-secondary">{item.sourceName}</Box>
                    {item.published && (
                      <Box variant="small" color="text-body-secondary">{relativeTime(item.published)}</Box>
                    )}
                  </div>
                ))}
              </SpaceBetween>
            )}
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </Layout>
  )
}
