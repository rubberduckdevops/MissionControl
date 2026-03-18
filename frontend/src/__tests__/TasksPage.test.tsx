import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TasksPage from '../pages/TasksPage'

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
      expect(screen.getAllByText('Tasks').length).toBeGreaterThan(0)
      expect(screen.getByText('New Task')).toBeInTheDocument()
    })
  })

  it('renders assignee and CTI dropdowns in the create form', async () => {
    renderTasksPage()
    await waitFor(() => {
      expect(screen.getAllByText('Assignee').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Category').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Type').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Item').length).toBeGreaterThan(0)
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
    // Open the Assignee select to reveal options in CloudScape's custom dropdown
    await waitFor(() => screen.getAllByText('Assignee')[0])
    const assigneeButton = screen.getByRole('button', { name: /Unassigned/i })
    await userEvent.click(assigneeButton)

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

  it('deletes a task after confirming the modal', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/api/tasks') return Promise.resolve({ data: paginatedWithTask })
      return Promise.resolve({ data: [] })
    })
    mockApi.delete.mockResolvedValue({})

    renderTasksPage()
    await waitFor(() => screen.getByText('Test Task'))

    // Click the inline Delete button (first one) to open the confirmation modal
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(deleteButtons[0])

    // Confirm in the modal — click the last Delete button (the modal confirm)
    await waitFor(() => screen.getByText('Confirm Delete'))
    const allDeleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(allDeleteButtons[allDeleteButtons.length - 1])

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
      expect(screen.getByRole('button', { name: 'Todo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })
  })

  it('toggles a status filter and resets to page 1', async () => {
    const user = userEvent.setup()
    renderTasksPage()
    await waitFor(() => screen.getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Done' }))

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
      expect(screen.queryByTestId('task-pagination')).not.toBeInTheDocument()
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
      expect(screen.getByTestId('task-pagination')).toBeInTheDocument()
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
    await waitFor(() => screen.getByTestId('task-pagination'))
    // Click the page 2 button to navigate to next page
    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      const taskCalls = mockApi.get.mock.calls.filter(
        ([url]: [string]) => url === '/api/tasks'
      )
      const pages = taskCalls.map(([, opts]: [string, { params: { page: number } }]) => opts.params.page)
      expect(pages).toContain(2)
    })
  })
})
