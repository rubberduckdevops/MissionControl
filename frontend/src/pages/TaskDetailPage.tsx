import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Textarea from '@cloudscape-design/components/textarea'
import Select from '@cloudscape-design/components/select'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Spinner from '@cloudscape-design/components/spinner'
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

interface TaskNote {
  _id: string
  note: string
  author: string
  created_at: string
}

interface Task {
  _id: string
  title: string
  description: string
  status: string
  notes: TaskNote[]
  assignee_id?: string
  cti?: CtiSelection
  created_at: string
  updated_at: string
}

const STATUSES = ['todo', 'in_progress', 'done']

function taskStatusType(status: string): 'pending' | 'in-progress' | 'success' | 'info' {
  if (status === 'todo') return 'pending'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'done') return 'success'
  return 'info'
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [users, setUsers] = useState<UserPublic[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editTypes, setEditTypes] = useState<CtiType[]>([])
  const [editItems, setEditItems] = useState<CtiItem[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editTypeId, setEditTypeId] = useState('')
  const [editItemId, setEditItemId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Task>(`/api/tasks/${id}`),
      api.get<UserPublic[]>('/api/users'),
      api.get<Category[]>('/api/cti/categories'),
    ])
      .then(([taskRes, usersRes, catRes]) => {
        const t = taskRes.data
        setTask(t)
        setTitle(t.title)
        setDescription(t.description)
        setStatus(t.status)
        setAssigneeId(t.assignee_id ?? '')
        setUsers(usersRes.data)
        setCategories(catRes.data)

        if (t.cti) {
          setEditCategoryId(t.cti.category_id)
          setEditTypeId(t.cti.type_id)
          setEditItemId(t.cti.item_id)
        }
      })
      .catch(() => setError('Task not found'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setEditTypeId('')
    setEditItemId('')
    setEditItems([])
    if (!editCategoryId) { setEditTypes([]); return }
    api
      .get<CtiType[]>(`/api/cti/types?category_id=${editCategoryId}`)
      .then((r) => {
        setEditTypes(r.data)
        if (task?.cti?.category_id === editCategoryId && task?.cti?.type_id) {
          setEditTypeId(task.cti.type_id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCategoryId])

  useEffect(() => {
    setEditItemId('')
    if (!editTypeId) { setEditItems([]); return }
    api
      .get<CtiItem[]>(`/api/cti/items?type_id=${editTypeId}`)
      .then((r) => {
        setEditItems(r.data)
        if (task?.cti?.type_id === editTypeId && task?.cti?.item_id) {
          setEditItemId(task.cti.item_id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTypeId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      const cti =
        editCategoryId && editTypeId && editItemId
          ? { category_id: editCategoryId, type_id: editTypeId, item_id: editItemId }
          : null
      const res = await api.put<Task>(`/api/tasks/${id}`, {
        title,
        description,
        status,
        assignee_id: assigneeId || null,
        cti,
      })
      setTask(res.data)
    } catch {
      setSaveError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setNoteError('')
    setAddingNote(true)
    try {
      const res = await api.post<Task>(`/api/tasks/${id}/notes`, { note: noteText })
      setTask(res.data)
      setNoteText('')
    } catch {
      setNoteError('Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await api.delete<Task>(`/api/tasks/${id}/notes/${noteId}`)
      setTask(res.data)
    } catch {
      setNoteError('Failed to delete note')
    }
  }

  const assigneeName = (uid?: string) =>
    uid ? (users.find((u) => u.id === uid)?.username ?? uid) : 'Unassigned'

  if (loading) {
    return (
      <Layout>
        <ContentLayout header={<Header variant="h1">Loading...</Header>}>
          <Spinner size="large" />
        </ContentLayout>
      </Layout>
    )
  }

  if (error || !task) {
    return (
      <Layout>
        <ContentLayout header={<Header variant="h1">Error</Header>}>
          <Alert type="error">{error || 'Task not found'}</Alert>
        </ContentLayout>
      </Layout>
    )
  }

  const userOptions = [
    { label: 'Unassigned', value: '' },
    ...users.map((u) => ({ label: u.username, value: u.id })),
  ]

  const statusOptions = STATUSES.map((s) => ({
    label: s.replace('_', ' ').toUpperCase(),
    value: s,
  }))

  const categoryOptions = [
    { label: '— none —', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c._id })),
  ]

  const typeOptions = [
    { label: '— none —', value: '' },
    ...editTypes.map((t) => ({ label: t.name, value: t._id })),
  ]

  const itemOptions = [
    { label: '— none —', value: '' },
    ...editItems.map((i) => ({ label: i.name, value: i._id })),
  ]

  return (
    <Layout>
      <ContentLayout
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: 'Tasks', href: '/tasks' },
              { text: task.title, href: '#' },
            ]}
            onFollow={(e) => {
              e.preventDefault()
              navigate(e.detail.href === '#' ? `/tasks/${id}` : e.detail.href)
            }}
          />
        }
        header={
          <Header variant="h1">
            {task.title}
          </Header>
        }
      >
        <SpaceBetween size="l">
          {/* Edit form */}
          <Container header={<Header variant="h2">Edit Task</Header>}>
            <form onSubmit={handleSave}>
              <Form
                actions={
                  <SpaceBetween size="xs" direction="horizontal">
                    <StatusIndicator type={taskStatusType(task.status)}>
                      {task.status.replace('_', ' ')}
                    </StatusIndicator>
                    <Box color="text-body-secondary">{assigneeName(task.assignee_id)}</Box>
                    <Button variant="primary" formAction="submit" loading={saving} loadingText="Saving...">
                      Save Changes
                    </Button>
                  </SpaceBetween>
                }
              >
                <SpaceBetween size="m">
                  {saveError && <Alert type="error">{saveError}</Alert>}
                  <FormField label="Title">
                    <Input value={title} onChange={({ detail }) => setTitle(detail.value)} />
                  </FormField>
                  <FormField label="Description">
                    <Input value={description} onChange={({ detail }) => setDescription(detail.value)} />
                  </FormField>
                  <SpaceBetween size="m" direction="horizontal">
                    <FormField label="Status">
                      <Select
                        selectedOption={statusOptions.find((o) => o.value === status) ?? statusOptions[0]}
                        onChange={({ detail }) => setStatus(detail.selectedOption?.value ?? '')}
                        options={statusOptions}
                      />
                    </FormField>
                    <FormField label="Assignee">
                      <Select
                        selectedOption={userOptions.find((o) => o.value === assigneeId) ?? userOptions[0]}
                        onChange={({ detail }) => setAssigneeId(detail.selectedOption?.value ?? '')}
                        options={userOptions}
                      />
                    </FormField>
                  </SpaceBetween>
                  <SpaceBetween size="m" direction="horizontal">
                    <FormField label="Category">
                      <Select
                        selectedOption={categoryOptions.find((o) => o.value === editCategoryId) ?? categoryOptions[0]}
                        onChange={({ detail }) => setEditCategoryId(detail.selectedOption?.value ?? '')}
                        options={categoryOptions}
                      />
                    </FormField>
                    <FormField label="Type">
                      <Select
                        selectedOption={typeOptions.find((o) => o.value === editTypeId) ?? typeOptions[0]}
                        onChange={({ detail }) => setEditTypeId(detail.selectedOption?.value ?? '')}
                        options={typeOptions}
                        disabled={!editCategoryId}
                      />
                    </FormField>
                    <FormField label="Item">
                      <Select
                        selectedOption={itemOptions.find((o) => o.value === editItemId) ?? itemOptions[0]}
                        onChange={({ detail }) => setEditItemId(detail.selectedOption?.value ?? '')}
                        options={itemOptions}
                        disabled={!editTypeId}
                      />
                    </FormField>
                  </SpaceBetween>
                </SpaceBetween>
              </Form>
            </form>
          </Container>

          {/* Notes panel */}
          <Container header={<Header variant="h2">Notes</Header>}>
            <SpaceBetween size="m">
              {task.notes.length === 0 && (
                <Box color="text-body-secondary">No notes yet.</Box>
              )}
              {task.notes.map((n, idx) => (
                <div
                  key={n._id}
                  style={{
                    borderLeft: '2px solid var(--color-border-divider-default)',
                    paddingLeft: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <SpaceBetween size="xxs">
                      <Box variant="small" color="text-body-secondary">
                        [{String(idx + 1).padStart(3, '0')}] {new Date(n.created_at).toLocaleString()}
                      </Box>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {n.note}
                        </ReactMarkdown>
                      </div>
                    </SpaceBetween>
                    <Button
                      variant="inline-link"
                      onClick={() => handleDeleteNote(n._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}

              {noteError && <Alert type="error">{noteError}</Alert>}

              <form onSubmit={handleAddNote}>
                <Form
                  actions={
                    <SpaceBetween size="xs" direction="horizontal">
                      <Box variant="small" color="text-body-secondary">Markdown supported</Box>
                      <Button variant="primary" formAction="submit" loading={addingNote} loadingText="Adding...">
                        Add Note
                      </Button>
                    </SpaceBetween>
                  }
                >
                  <FormField label="Add a note">
                    <Textarea
                      value={noteText}
                      onChange={({ detail }) => setNoteText(detail.value)}
                      placeholder="Add a note…"
                      rows={3}
                    />
                  </FormField>
                </Form>
              </form>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </Layout>
  )
}
