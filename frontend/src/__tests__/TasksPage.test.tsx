import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TasksPage from '../pages/TasksPage'

vi.mock('../components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
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

const renderTasksPage = () =>
  render(
    <MemoryRouter>
      <TasksPage />
    </MemoryRouter>
  )

const emptyTask = {
  _id: 't1',
  title: 'Test Task',
  description: 'Do something',
  status: 'todo',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const paginatedEmpty = {
  tasks: [],
  total: 0,
  page: 1,
  limit: 25,
  total_pages: 1,
}

const paginatedWithTask = {
  tasks: [emptyTask],
  total: 1,
  page: 1,
  limit: 25,
  total_pages: 1,
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: tasks returns paginated empty, everything else returns []
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') {
        return Promise.resolve({ data: paginatedEmpty })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('renders the page heading and new task form', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(screen.getByText('New Task')).toBeInTheDocument()
    })
  })

  it('renders assignee and CTI dropdowns in the create form', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText('Assignee')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Item')).toBeInTheDocument()
    })
  })

  it('shows empty state when no tasks', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument()
    })
  })

  it('renders a task in the list', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') return Promise.resolve({ data: paginatedWithTask })
      return Promise.resolve({ data: [] })
    })

    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.getByText('Do something')).toBeInTheDocument()
    })
  })

  it('populates assignee dropdown with users', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/users') {
        return Promise.resolve({ data: [{ id: 'u1', username: 'alice', email: 'a@a.com', role: 'user' }] })
      }
      if (url === '/api/tasks') return Promise.resolve({ data: paginatedEmpty })
      return Promise.resolve({ data: [] })
    })

    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'alice' })).toBeInTheDocument()
    })
  })

  it('creates a task and adds it to the list', async () => {
    const user = userEvent.setup()
    mockApi.post.mockResolvedValue({ data: emptyTask })

    renderTasksPage()
    await waitFor(() => screen.getByText(/No tasks yet/i))

    await user.type(screen.getByPlaceholderText('Task title'), 'Test Task')
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Do something')
    await user.click(screen.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        title: 'Test Task',
        description: 'Do something',
        assignee_id: null,
        cti: null,
      }))
    })
  })

  it('deletes a task', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') return Promise.resolve({ data: paginatedWithTask })
      return Promise.resolve({ data: [] })
    })
    mockApi.delete.mockResolvedValue({})

    renderTasksPage()
    await waitFor(() => screen.getByText('Test Task'))

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/api/tasks/t1')
      expect(screen.queryByText('Test Task')).not.toBeInTheDocument()
    })
  })

  it('passes status filter and page as query params', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        params: expect.objectContaining({
          status: 'todo,in_progress',
          page: 1,
          limit: 25,
        }),
      }))
    })
  })

  it('renders filter toggle buttons for each status', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'TODO' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'IN PROGRESS' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'DONE' })).toBeInTheDocument()
    })
  })

  it('toggles a status filter and resets to page 1', async () => {
    const user = userEvent.setup()
    renderTasksPage()
    await waitFor(() => screen.getByRole('button', { name: 'DONE' }))

    await user.click(screen.getByRole('button', { name: 'DONE' }))

    await waitFor(() => {
      const taskCalls = mockApi.get.mock.calls.filter(
        ([url]: [string]) => url === '/api/tasks'
      )
      const lastCall = taskCalls[taskCalls.length - 1]
      expect(lastCall[1].params.status).toContain('done')
      expect(lastCall[1].params.page).toBe(1)
    })
  })

  it('does not render pagination controls when total_pages is 1', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.queryByText(/Page \d/)).not.toBeInTheDocument()
    })
  })

  it('renders pagination controls when total_pages > 1', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') {
        return Promise.resolve({
          data: { tasks: [], total: 50, page: 1, limit: 25, total_pages: 2 },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText('Page 1 / 2')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Prev' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })
  })

  it('advances to next page on Next click', async () => {
    const user = userEvent.setup()
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') {
        return Promise.resolve({
          data: { tasks: [], total: 50, page: 1, limit: 25, total_pages: 2 },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderTasksPage()
    await waitFor(() => screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      const taskCalls = mockApi.get.mock.calls.filter(
        ([url]: [string]) => url === '/api/tasks'
      )
      const pages = taskCalls.map(([, opts]: [string, { params: { page: number } }]) => opts.params.page)
      expect(pages).toContain(2)
    })
  })
})
