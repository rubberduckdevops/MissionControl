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

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: [] })
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
      if (url === '/api/tasks') return Promise.resolve({ data: [emptyTask] })
      return Promise.resolve({ data: [] })
    })

    // parallel Promise.all call in useEffect
    mockApi.get.mockImplementation(() => Promise.resolve({ data: [] }))
    mockApi.get
      .mockResolvedValueOnce({ data: [emptyTask] }) // tasks
      .mockResolvedValueOnce({ data: [] })           // users
      .mockResolvedValueOnce({ data: [] })           // categories

    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.getByText('Do something')).toBeInTheDocument()
    })
  })

  it('populates assignee dropdown with users', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [] })                                       // tasks
      .mockResolvedValueOnce({ data: [{ id: 'u1', username: 'alice', email: 'a@a.com', role: 'user' }] }) // users
      .mockResolvedValueOnce({ data: [] })                                       // categories

    renderTasksPage()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'alice' })).toBeInTheDocument()
    })
  })

  it('creates a task and adds it to the list', async () => {
    const user = userEvent.setup()
    mockApi.get.mockResolvedValue({ data: [] })
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
    mockApi.get
      .mockResolvedValueOnce({ data: [emptyTask] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    mockApi.delete.mockResolvedValue({})

    renderTasksPage()
    await waitFor(() => screen.getByText('Test Task'))

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/api/tasks/t1')
      expect(screen.queryByText('Test Task')).not.toBeInTheDocument()
    })
  })
})
