import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import WeatherPage from '../pages/WeatherPage'

vi.mock('../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../services/api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  }
  return { default: api }
})

import api from '../services/api'
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const mockLocation = {
  _id: 'loc1',
  label: 'New York City',
  lat: 40.7128,
  lon: -74.006,
  zone_id: 'OKX_Z001',
  observation_station_id: 'KOKC',
  last_polled_at: new Date(Date.now() - 5 * 60000).toISOString(),
  created_at: new Date().toISOString(),
}

const mockAlert = {
  _id: 'alert1',
  event: 'Tornado Warning',
  headline: 'Tornado Warning for New York',
  description: 'A tornado has been sighted.',
  severity: 'Extreme',
  urgency: 'Immediate',
  certainty: 'Observed',
  effective: new Date().toISOString(),
  expires: new Date(Date.now() + 3600000).toISOString(),
}

const mockObservation = {
  _id: 'obs1',
  station_id: 'KOKC',
  timestamp: new Date().toISOString(),
  temperature_c: 20.0,
  dewpoint_c: 15.0,
  wind_direction_deg: 270,
  wind_speed_kmh: 15.0,
  barometric_pressure_pa: 101325,
  visibility_m: 16093,
  text_description: 'Partly Cloudy',
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <WeatherPage />
    </MemoryRouter>
  )

describe('WeatherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: [] })
  })

  it('renders the page heading', async () => {
    renderPage()
    expect(screen.getByText('Weather Locations')).toBeInTheDocument()
  })

  it('shows empty state when no locations', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No locations — add one above.')).toBeInTheDocument()
    })
  })

  it('renders a location label from the API response', async () => {
    mockApi.get.mockResolvedValue({ data: [mockLocation] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('New York City')).toBeInTheDocument()
    })
  })

  it('shows "Select a location" prompt before any selection', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Select a location to view weather data.')).toBeInTheDocument()
    })
  })

  it('opens add modal when "+ Add Location" is clicked', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Location' }))
    expect(screen.getByText('Add Weather Location')).toBeInTheDocument()
  })

  it('shows validation error when submitting empty form', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Location' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Location' }))
    await waitFor(() => {
      expect(
        screen.getByText('Label, latitude, and longitude are required')
      ).toBeInTheDocument()
    })
  })

  it('calls api.post with correct payload on create', async () => {
    const user = userEvent.setup()
    mockApi.post.mockResolvedValue({ data: mockLocation })
    renderPage()

    await user.click(screen.getByRole('button', { name: '+ Add Location' }))

    await user.type(screen.getByPlaceholderText('New York City'), 'New York City')
    await user.type(screen.getByPlaceholderText('40.7128'), '40.7128')
    await user.type(screen.getByPlaceholderText('-74.0060'), '-74.006')

    await user.click(screen.getByRole('button', { name: 'Save Location' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/weather/locations',
        expect.objectContaining({ label: 'New York City' })
      )
    })
  })

  it('calls api.delete with the correct ID on delete', async () => {
    mockApi.get.mockResolvedValue({ data: [mockLocation] })
    mockApi.delete.mockResolvedValue({})
    renderPage()

    await waitFor(() => screen.getByText('New York City'))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/api/weather/locations/loc1')
      expect(screen.queryByText('New York City')).not.toBeInTheDocument()
    })
  })

  it('loads alerts and observations when a location is selected', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [mockLocation] })
      .mockResolvedValueOnce({ data: [mockAlert] })
      .mockResolvedValueOnce({ data: [mockObservation] })
    renderPage()

    await waitFor(() => screen.getByText('New York City'))
    await userEvent.click(screen.getByText('New York City'))

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/weather/locations/loc1/alerts')
      expect(mockApi.get).toHaveBeenCalledWith('/api/weather/locations/loc1/observations')
    })
  })

  it('shows no active alerts empty state when alert list is empty', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [mockLocation] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    renderPage()

    await waitFor(() => screen.getByText('New York City'))
    await userEvent.click(screen.getByText('New York City'))

    await waitFor(() => {
      expect(
        screen.getByText('No active alerts for this location.')
      ).toBeInTheDocument()
    })
  })

  it('renders alert event name when alerts are present', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [mockLocation] })
      .mockResolvedValueOnce({ data: [mockAlert] })
      .mockResolvedValueOnce({ data: [] })
    renderPage()

    await waitFor(() => screen.getByText('New York City'))
    await userEvent.click(screen.getByText('New York City'))

    await waitFor(() => {
      expect(screen.getByText('Tornado Warning')).toBeInTheDocument()
    })
  })

  it('renders current conditions when observation data is present', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [mockLocation] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [mockObservation] })
    renderPage()

    await waitFor(() => screen.getByText('New York City'))
    await userEvent.click(screen.getByText('New York City'))

    // Switch to conditions tab
    await userEvent.click(screen.getByText('Current Conditions'))

    await waitFor(() => {
      expect(screen.getByText(/Partly Cloudy/)).toBeInTheDocument()
    })
  })
})
