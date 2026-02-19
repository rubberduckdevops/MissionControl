import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CtiPage from '../pages/CtiPage'

// Mock Navbar so it renders without auth context
vi.mock('../components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}))

// Mock the API module
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

const renderCtiPage = () =>
  render(
    <MemoryRouter>
      <CtiPage />
    </MemoryRouter>
  )

describe('CtiPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: empty lists
    mockApi.get.mockResolvedValue({ data: [] })
  })

  it('renders the page heading and CTI management subtitle', async () => {
    renderCtiPage()
    expect(screen.getByText('CTI Management')).toBeInTheDocument()
    // Each panel header is rendered as a <span> with specific label text
    expect(screen.getAllByText(/^Categories$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^Types$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^Items$/i).length).toBeGreaterThan(0)
  })

  it('fetches categories on mount', async () => {
    renderCtiPage()
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/cti/categories')
    })
  })

  it('shows empty state messages when no data', async () => {
    renderCtiPage()
    await waitFor(() => {
      expect(screen.getByText('No categories yet.')).toBeInTheDocument()
      expect(screen.getByText('Select a category first.')).toBeInTheDocument()
      expect(screen.getByText('Select a type first.')).toBeInTheDocument()
    })
  })

  it('displays fetched categories', async () => {
    mockApi.get.mockResolvedValue({
      data: [{ _id: 'c1', name: 'Malware' }],
    })
    renderCtiPage()
    await waitFor(() => {
      expect(screen.getByText('Malware')).toBeInTheDocument()
    })
  })

  it('creates a category and adds it to the list', async () => {
    const user = userEvent.setup()
    mockApi.get.mockResolvedValue({ data: [] })
    mockApi.post.mockResolvedValue({ data: { _id: 'c2', name: 'Vulnerability' } })

    renderCtiPage()
    await waitFor(() => screen.getByText('No categories yet.'))

    const inputs = screen.getAllByPlaceholderText('Category name…')
    await user.type(inputs[0], 'Vulnerability')
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0])

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/cti/categories', { name: 'Vulnerability' })
      expect(screen.getByText('Vulnerability')).toBeInTheDocument()
    })
  })

  it('fetches types when a category is clicked', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ _id: 'c1', name: 'Malware' }] }) // categories
      .mockResolvedValue({ data: [] }) // types

    renderCtiPage()
    await waitFor(() => screen.getByText('Malware'))

    await userEvent.click(screen.getByText('Malware'))

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/cti/types?category_id=c1')
      )
    })
  })

  it('deletes a category', async () => {
    mockApi.get.mockResolvedValue({
      data: [{ _id: 'c1', name: 'Malware' }],
    })
    mockApi.delete.mockResolvedValue({})

    renderCtiPage()
    await waitFor(() => screen.getByText('Malware'))

    await userEvent.click(screen.getByRole('button', { name: 'DEL' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/api/cti/categories/c1')
      expect(screen.queryByText('Malware')).not.toBeInTheDocument()
    })
  })
})
