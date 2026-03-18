import { useEffect, useState } from 'react'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import Modal from '@cloudscape-design/components/modal'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Form from '@cloudscape-design/components/form'
import Spinner from '@cloudscape-design/components/spinner'
import Tabs from '@cloudscape-design/components/tabs'
import Badge from '@cloudscape-design/components/badge'
import Layout from '../components/Layout'
import api from '../services/api'

interface WeatherLocation {
  _id: string
  label: string
  lat: number
  lon: number
  zone_id: string | null
  observation_station_id: string | null
  last_polled_at: string | null
  created_at: string
}

interface WeatherAlert {
  _id: string
  event: string
  headline: string | null
  description: string | null
  severity: string | null
  urgency: string | null
  certainty: string | null
  effective: string | null
  expires: string | null
}

interface WeatherObservation {
  _id: string
  station_id: string
  timestamp: string
  temperature_c: number | null
  dewpoint_c: number | null
  wind_direction_deg: number | null
  wind_speed_kmh: number | null
  barometric_pressure_pa: number | null
  visibility_m: number | null
  text_description: string | null
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

function severityColor(severity: string | null): 'red' | 'severity-critical' | 'severity-high' | 'severity-medium' | 'grey' {
  switch (severity?.toLowerCase()) {
    case 'extreme': return 'red'
    case 'severe': return 'severity-critical'
    case 'moderate': return 'severity-high'
    case 'minor': return 'severity-medium'
    default: return 'grey'
  }
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32)
}

export default function WeatherPage() {
  const [locations, setLocations] = useState<WeatherLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation | null>(null)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [observations, setObservations] = useState<WeatherObservation[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [polling, setPolling] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLon, setNewLon] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.get<WeatherLocation[]>('/api/weather/locations')
      .then((res) => setLocations(res.data))
      .catch(() => {})
  }, [])

  const loadLocationData = (loc: WeatherLocation) => {
    setSelectedLocation(loc)
    setAlerts([])
    setObservations([])
    setDetailError('')
    setDetailLoading(true)

    Promise.all([
      api.get<WeatherAlert[]>(`/api/weather/locations/${loc._id}/alerts`),
      api.get<WeatherObservation[]>(`/api/weather/locations/${loc._id}/observations`),
    ])
      .then(([alertsRes, obsRes]) => {
        setAlerts(alertsRes.data)
        setObservations(obsRes.data)
      })
      .catch(() => setDetailError('Failed to load weather data for this location'))
      .finally(() => setDetailLoading(false))
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim() || !newLat.trim() || !newLon.trim()) {
      setAddError('Label, latitude, and longitude are required')
      return
    }
    const lat = parseFloat(newLat)
    const lon = parseFloat(newLon)
    if (isNaN(lat) || isNaN(lon)) {
      setAddError('Latitude and longitude must be valid numbers')
      return
    }
    setAdding(true)
    try {
      const res = await api.post<WeatherLocation>('/api/weather/locations', {
        label: newLabel.trim(),
        lat,
        lon,
      })
      setLocations((l) => [...l, res.data])
      setNewLabel('')
      setNewLat('')
      setNewLon('')
      setShowAddModal(false)
      setAddError('')
    } catch {
      setAddError('Failed to add location')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/weather/locations/${id}`)
      setLocations((l) => l.filter((loc) => loc._id !== id))
      if (selectedLocation?._id === id) {
        setSelectedLocation(null)
        setAlerts([])
        setObservations([])
      }
    } catch {}
  }

  const handlePollNow = async () => {
    setPolling(true)
    try {
      await api.post('/api/weather/poll')
      // Re-fetch locations so last_polled_at updates after a short delay
      setTimeout(() => {
        api.get<WeatherLocation[]>('/api/weather/locations')
          .then((res) => setLocations(res.data))
          .catch(() => {})
          .finally(() => setPolling(false))
      }, 2000)
    } catch {
      setPolling(false)
    }
  }

  const latestObs = observations[0] ?? null

  return (
    <Layout>
      <ContentLayout
        header={
          <Header
            variant="h1"
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  variant="normal"
                  loading={polling}
                  loadingText="Polling..."
                  onClick={handlePollNow}
                >
                  Refresh Now
                </Button>
                <Button
                  variant="primary"
                  onClick={() => { setShowAddModal(true); setAddError('') }}
                >
                  + Add Location
                </Button>
              </SpaceBetween>
            }
          >
            Weather Locations
          </Header>
        }
      >
        <ColumnLayout columns={2}>
          {/* Left panel: location list */}
          <Container header={<Header variant="h2">Monitored Locations</Header>}>
            <SpaceBetween size="xs">
              {locations.length === 0 && (
                <Box color="text-body-secondary">No locations — add one above.</Box>
              )}
              {locations.map((loc) => (
                <div
                  key={loc._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: `1px solid ${selectedLocation?._id === loc._id ? 'var(--color-border-item-selected)' : 'var(--color-border-divider-default)'}`,
                    background: selectedLocation?._id === loc._id ? 'var(--color-background-item-selected)' : 'transparent',
                  }}
                  onClick={() => loadLocationData(loc)}
                >
                  <SpaceBetween size="xxs">
                    <Box fontWeight={selectedLocation?._id === loc._id ? 'bold' : 'normal'}>
                      {loc.label}
                    </Box>
                    <Box variant="small" color="text-body-secondary">
                      {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                      {loc.last_polled_at && ` · polled ${relativeTime(loc.last_polled_at)}`}
                    </Box>
                  </SpaceBetween>
                  <Button
                    variant="inline-link"
                    onClick={(e) => { e.stopPropagation(); handleDelete(loc._id) }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </SpaceBetween>
          </Container>

          {/* Right panel: alerts + observations */}
          <Container
            header={
              <Header variant="h2">
                {selectedLocation ? selectedLocation.label : 'Weather Detail'}
              </Header>
            }
          >
            {!selectedLocation && (
              <Box color="text-body-secondary">Select a location to view weather data.</Box>
            )}
            {detailLoading && <Spinner />}
            {detailError && <Alert type="error">{detailError}</Alert>}
            {selectedLocation && !detailLoading && !detailError && (
              <Tabs
                tabs={[
                  {
                    id: 'alerts',
                    label: `Active Alerts (${alerts.length})`,
                    content: (
                      <SpaceBetween size="s">
                        {alerts.length === 0 && (
                          <Box color="text-body-secondary">No active alerts for this location.</Box>
                        )}
                        {alerts.map((alert) => (
                          <div
                            key={alert._id}
                            style={{ borderBottom: '1px solid var(--color-border-divider-default)', paddingBottom: '0.75rem' }}
                          >
                            <SpaceBetween size="xxs">
                              <SpaceBetween size="xs" direction="horizontal">
                                <Box fontWeight="bold">{alert.event}</Box>
                                {alert.severity && (
                                  <Badge color={severityColor(alert.severity)}>
                                    {alert.severity}
                                  </Badge>
                                )}
                              </SpaceBetween>
                              {alert.headline && (
                                <Box variant="small">{alert.headline}</Box>
                              )}
                              {alert.expires && (
                                <Box variant="small" color="text-body-secondary">
                                  Expires: {new Date(alert.expires).toLocaleString()}
                                </Box>
                              )}
                            </SpaceBetween>
                          </div>
                        ))}
                      </SpaceBetween>
                    ),
                  },
                  {
                    id: 'conditions',
                    label: 'Current Conditions',
                    content: latestObs ? (
                      <SpaceBetween size="s">
                        {latestObs.text_description && (
                          <Box><strong>Conditions:</strong> {latestObs.text_description}</Box>
                        )}
                        {latestObs.temperature_c !== null && (
                          <Box>
                            <strong>Temperature:</strong>{' '}
                            {celsiusToFahrenheit(latestObs.temperature_c)}°F
                            ({latestObs.temperature_c.toFixed(1)}°C)
                          </Box>
                        )}
                        {latestObs.wind_speed_kmh !== null && (
                          <Box>
                            <strong>Wind Speed:</strong>{' '}
                            {latestObs.wind_speed_kmh.toFixed(1)} km/h
                          </Box>
                        )}
                        {latestObs.visibility_m !== null && (
                          <Box>
                            <strong>Visibility:</strong>{' '}
                            {(latestObs.visibility_m / 1000).toFixed(1)} km
                          </Box>
                        )}
                        <Box variant="small" color="text-body-secondary">
                          Station: {latestObs.station_id} · Observed {relativeTime(latestObs.timestamp)}
                        </Box>
                      </SpaceBetween>
                    ) : (
                      <Box color="text-body-secondary">No observation data available yet.</Box>
                    ),
                  },
                ]}
              />
            )}
          </Container>
        </ColumnLayout>
      </ContentLayout>

      {/* Add location modal */}
      <Modal
        visible={showAddModal}
        onDismiss={() => { setShowAddModal(false); setAddError('') }}
        header="Add Weather Location"
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                variant="normal"
                onClick={() => { setShowAddModal(false); setAddError('') }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={adding}
                loadingText="Adding..."
                onClick={handleAddLocation as any}
              >
                Save Location
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <form onSubmit={handleAddLocation}>
          <Form>
            <SpaceBetween size="m">
              {addError && <Alert type="error">{addError}</Alert>}
              <FormField label="Label">
                <Input
                  value={newLabel}
                  onChange={({ detail }) => setNewLabel(detail.value)}
                  placeholder="New York City"
                />
              </FormField>
              <FormField label="Latitude" description="Between -90 and 90">
                <Input
                  value={newLat}
                  onChange={({ detail }) => setNewLat(detail.value)}
                  placeholder="40.7128"
                  type="number"
                />
              </FormField>
              <FormField label="Longitude" description="Between -180 and 180">
                <Input
                  value={newLon}
                  onChange={({ detail }) => setNewLon(detail.value)}
                  placeholder="-74.0060"
                  type="number"
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </Modal>
    </Layout>
  )
}
