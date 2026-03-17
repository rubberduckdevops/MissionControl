import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import Table from '@cloudscape-design/components/table'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Select from '@cloudscape-design/components/select'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Pagination from '@cloudscape-design/components/pagination'
import Modal from '@cloudscape-design/components/modal'
import Link from '@cloudscape-design/components/link'
import Layout from '../components/Layout'
import api from '../services/api'

interface UserPublic {
  id: string
  email: string
  username: string
  role: string
}

interface Category {
  _id: string
  name: string
}

interface CtiType {
  _id: string
  name: string
  category_id: string
}

interface CtiItem {
  _id: string
  name: string
  type_id: string
}

interface CtiSelection {
  category_id: string
  type_id: string
  item_id: string
}

interface Task {
  _id: string
  title: string
  description: string
  status: string
  assignee_id?: string
  cti?: CtiSelection
  created_at: string
  updated_at: string
}

interface PaginatedTasksResponse {
  tasks: Task[]
  total: number
  page: number
  limit: number
  total_pages: number
}

const ALL_STATUSES = ['todo', 'in_progress', 'done'] as const
type TaskStatus = typeof ALL_STATUSES[number]

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

function taskStatusType(status: string): 'pending' | 'in-progress' | 'success' | 'info' {
  if (status === 'todo') return 'pending'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'done') return 'success'
  return 'info'
}

export default function TasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const limit = 25
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>(['todo', 'in_progress'])

  const [users, setUsers] = useState<UserPublic[]>([])

  const [categories, setCategories] = useState<Category[]>([])
  const [formTypes, setFormTypes] = useState<CtiType[]>([])
  const [formItems, setFormItems] = useState<CtiItem[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formTypeId, setFormTypeId] = useState('')
  const [formItemId, setFormItemId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [deleteModalTask, setDeleteModalTask] = useState<Task | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<UserPublic[]>('/api/users'),
      api.get<Category[]>('/api/cti/categories'),
    ])
      .then(([usersRes, catRes]) => {
        setUsers(usersRes.data)
        setCategories(catRes.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const statusParam = statusFilter.length > 0 ? statusFilter.join(',') : undefined
    api.get<PaginatedTasksResponse>('/api/tasks', {
      params: {
        page,
        limit,
        ...(statusParam ? { status: statusParam } : {}),
      },
    })
      .then((res) => {
        setTasks(res.data.tasks)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
      })
      .catch(() => setError('Could not load tasks'))
      .finally(() => setLoading(false))
  }, [page, limit, statusFilter])

  useEffect(() => {
    setFormTypeId('')
    setFormItemId('')
    setFormItems([])
    if (!formCategoryId) { setFormTypes([]); return }
    api
      .get<CtiType[]>(`/api/cti/types?category_id=${formCategoryId}`)
      .then((r) => setFormTypes(r.data))
      .catch(() => {})
  }, [formCategoryId])

  useEffect(() => {
    setFormItemId('')
    if (!formTypeId) { setFormItems([]); return }
    api
      .get<CtiItem[]>(`/api/cti/items?type_id=${formTypeId}`)
      .then((r) => setFormItems(r.data))
      .catch(() => {})
  }, [formTypeId])

  const toggleStatus = (s: TaskStatus) => {
    setPage(1)
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const cti =
        formCategoryId && formTypeId && formItemId
          ? { category_id: formCategoryId, type_id: formTypeId, item_id: formItemId }
          : null
      const res = await api.post<Task>('/api/tasks', {
        title,
        description,
        assignee_id: assigneeId || null,
        cti,
      })
      const newTask = res.data
      if (statusFilter.length === 0 || statusFilter.includes(newTask.status as TaskStatus)) {
        setTasks((prev) => [newTask, ...prev])
        setTotal((prev) => prev + 1)
      }
      setTitle('')
      setDescription('')
      setAssigneeId('')
      setFormCategoryId('')
      setFormTypeId('')
      setFormItemId('')
    } catch {
      setCreateError('Failed to create task')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/tasks/${id}`)
      setTasks((prev) => prev.filter((t) => t._id !== id))
      setTotal((prev) => prev - 1)
      setDeleteModalTask(null)
    } catch {
      setError('Failed to delete task')
      setDeleteModalTask(null)
    }
  }

  const usernameFor = (id?: string) => {
    if (!id) return null
    return users.find((u) => u.id === id)?.username ?? null
  }

  const userOptions = [
    { label: 'Unassigned', value: '' },
    ...users.map((u) => ({ label: u.username, value: u.id })),
  ]

  const categoryOptions = [
    { label: '— none —', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c._id })),
  ]

  const typeOptions = [
    { label: '— none —', value: '' },
    ...formTypes.map((t) => ({ label: t.name, value: t._id })),
  ]

  const itemOptions = [
    { label: '— none —', value: '' },
    ...formItems.map((i) => ({ label: i.name, value: i._id })),
  ]

  return (
    <Layout>
      <ContentLayout header={<Header variant="h1" counter={total > 0 ? `(${total})` : undefined}>Tasks</Header>}>
        <SpaceBetween size="l">
          {/* Create form */}
          <Container header={<Header variant="h2">New Task</Header>}>
            <form onSubmit={handleCreate}>
              <Form
                actions={
                  <Button variant="primary" formAction="submit" loading={creating} loadingText="Creating...">
                    Create Task
                  </Button>
                }
              >
                <SpaceBetween size="m">
                  {createError && <Alert type="error">{createError}</Alert>}
                  <SpaceBetween size="m" direction="horizontal">
                    <FormField label="Title" stretch>
                      <Input
                        value={title}
                        onChange={({ detail }) => setTitle(detail.value)}
                        placeholder="Task title"
                      />
                    </FormField>
                    <FormField label="Objective" stretch>
                      <Input
                        value={description}
                        onChange={({ detail }) => setDescription(detail.value)}
                        placeholder="What needs to be done?"
                      />
                    </FormField>
                  </SpaceBetween>
                  <SpaceBetween size="m" direction="horizontal">
                    <FormField label="Assignee">
                      <Select
                        selectedOption={userOptions.find((o) => o.value === assigneeId) ?? userOptions[0]}
                        onChange={({ detail }) => setAssigneeId(detail.selectedOption?.value ?? '')}
                        options={userOptions}
                      />
                    </FormField>
                    <FormField label="Category">
                      <Select
                        selectedOption={categoryOptions.find((o) => o.value === formCategoryId) ?? categoryOptions[0]}
                        onChange={({ detail }) => setFormCategoryId(detail.selectedOption?.value ?? '')}
                        options={categoryOptions}
                      />
                    </FormField>
                    <FormField label="Type">
                      <Select
                        selectedOption={typeOptions.find((o) => o.value === formTypeId) ?? typeOptions[0]}
                        onChange={({ detail }) => setFormTypeId(detail.selectedOption?.value ?? '')}
                        options={typeOptions}
                        disabled={!formCategoryId}
                      />
                    </FormField>
                    <FormField label="Item">
                      <Select
                        selectedOption={itemOptions.find((o) => o.value === formItemId) ?? itemOptions[0]}
                        onChange={({ detail }) => setFormItemId(detail.selectedOption?.value ?? '')}
                        options={itemOptions}
                        disabled={!formTypeId}
                      />
                    </FormField>
                  </SpaceBetween>
                </SpaceBetween>
              </Form>
            </form>
          </Container>

          {/* Task list */}
          {error && <Alert type="error">{error}</Alert>}

          <Table
            loading={loading}
            loadingText="Loading tasks..."
            header={
              <Header
                variant="h2"
                actions={
                  <SpaceBetween size="xs" direction="horizontal">
                    {ALL_STATUSES.map((s) => (
                      <Button
                        key={s}
                        variant={statusFilter.includes(s) ? 'primary' : 'normal'}
                        onClick={() => toggleStatus(s)}
                      >
                        {STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </SpaceBetween>
                }
              >
                Tasks
              </Header>
            }
            columnDefinitions={[
              {
                id: 'title',
                header: 'Title',
                cell: (item: Task) => (
                  <Link onFollow={(e) => { e.preventDefault(); navigate(`/tasks/${item._id}`) }}>
                    {item.title}
                  </Link>
                ),
              },
              {
                id: 'description',
                header: 'Description',
                cell: (item: Task) => item.description,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (item: Task) => (
                  <StatusIndicator type={taskStatusType(item.status)}>
                    {item.status.replace('_', ' ')}
                  </StatusIndicator>
                ),
              },
              {
                id: 'assignee',
                header: 'Assignee',
                cell: (item: Task) => usernameFor(item.assignee_id) ?? '—',
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (item: Task) => (
                  <Button
                    variant="inline-link"
                    onClick={() => setDeleteModalTask(item)}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
            items={tasks}
            empty={
              <Box textAlign="center" color="text-body-secondary">
                No tasks yet — create one above
              </Box>
            }
            pagination={
              totalPages > 1 ? (
                <Pagination
                  currentPageIndex={page}
                  pagesCount={totalPages}
                  onChange={({ detail }) => setPage(detail.currentPageIndex)}
                />
              ) : undefined
            }
          />
        </SpaceBetween>
      </ContentLayout>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalTask !== null}
        onDismiss={() => setDeleteModalTask(null)}
        header="Confirm Delete"
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="normal" onClick={() => setDeleteModalTask(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => deleteModalTask && handleDelete(deleteModalTask._id)}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {deleteModalTask && (
          <Box>
            Are you sure you want to delete task "<strong>{deleteModalTask.title}</strong>"? This action cannot be undone.
          </Box>
        )}
      </Modal>
    </Layout>
  )
}
