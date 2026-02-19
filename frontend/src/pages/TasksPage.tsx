import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
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

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  todo:        { color: '#4a7aa7', label: 'TODO' },
  in_progress: { color: '#f59e0b', label: 'IN PROGRESS' },
  done:        { color: '#00ff9f', label: 'DONE' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: '#4a7aa7', label: status.toUpperCase() }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.color}`,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' as const }}>
      {children}
    </span>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Users
  const [users, setUsers] = useState<UserPublic[]>([])

  // CTI data for create form
  const [categories, setCategories] = useState<Category[]>([])
  const [formTypes, setFormTypes] = useState<CtiType[]>([])
  const [formItems, setFormItems] = useState<CtiItem[]>([])

  // Create form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formTypeId, setFormTypeId] = useState('')
  const [formItemId, setFormItemId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Load tasks, users, and categories in parallel
  useEffect(() => {
    Promise.all([
      api.get<Task[]>('/api/tasks'),
      api.get<UserPublic[]>('/api/users'),
      api.get<Category[]>('/api/cti/categories'),
    ])
      .then(([tasksRes, usersRes, catRes]) => {
        setTasks(tasksRes.data)
        setUsers(usersRes.data)
        setCategories(catRes.data)
      })
      .catch(() => setError('Could not load page data'))
      .finally(() => setLoading(false))
  }, [])

  // When form category changes, load types and reset deeper selections
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

  // When form type changes, load items
  useEffect(() => {
    setFormItemId('')
    if (!formTypeId) { setFormItems([]); return }
    api
      .get<CtiItem[]>(`/api/cti/items?type_id=${formTypeId}`)
      .then((r) => setFormItems(r.data))
      .catch(() => {})
  }, [formTypeId])

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
      setTasks((prev) => [res.data, ...prev])
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
    } catch {
      setError('Failed to delete task')
    }
  }

  const usernameFor = (id?: string) => {
    if (!id) return null
    return users.find((u) => u.id === id)?.username ?? null
  }

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        {/* Page heading */}
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
            Tasks
          </h1>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)',
              marginTop: '0.5rem',
            }}
          />
        </div>

        {/* Create form */}
        <div
          style={{
            background: '#132035',
            border: '1px solid #1e4470',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem 1.25rem',
              borderBottom: '1px solid #1e4470',
              borderLeft: '3px solid #00d4ff',
            }}
          >
            <span style={{ color: '#00d4ff', fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              New Task
            </span>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {createError && (
              <div
                style={{
                  borderLeft: '3px solid #ff3a3a',
                  background: 'rgba(255,58,58,0.07)',
                  padding: '0.4rem 0.75rem',
                  marginBottom: '0.75rem',
                  color: '#ff3a3a',
                  fontSize: '0.78rem',
                }}
              >
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate}>
              {/* Row 1: title + description */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <FieldLabel>Title</FieldLabel>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Task title"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ flex: '2 1 240px' }}>
                  <FieldLabel>Objective</FieldLabel>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="What needs to be done?"
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </div>

              {/* Row 2: assignee + CTI */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <FieldLabel>Assignee</FieldLabel>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ marginBottom: 0 }}>
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <FieldLabel>Category</FieldLabel>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">— none —</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <FieldLabel>Type</FieldLabel>
                  <select
                    value={formTypeId}
                    onChange={(e) => setFormTypeId(e.target.value)}
                    disabled={!formCategoryId}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">— none —</option>
                    {formTypes.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <FieldLabel>Item</FieldLabel>
                  <select
                    value={formItemId}
                    onChange={(e) => setFormItemId(e.target.value)}
                    disabled={!formTypeId}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">— none —</option>
                    {formItems.map((i) => (
                      <option key={i._id} value={i._id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <button type="submit" disabled={creating} style={{ letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                  {creating ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Status messages */}
        {loading && (
          <p style={{ color: '#52809e', fontSize: '0.78rem', letterSpacing: '0.1em' }}>LOADING OPERATIONS…</p>
        )}
        {error && (
          <div
            style={{
              borderLeft: '3px solid #ff3a3a',
              background: 'rgba(255,58,58,0.07)',
              padding: '0.5rem 0.75rem',
              marginBottom: '1rem',
              color: '#ff3a3a',
              fontSize: '0.78rem',
            }}
          >
            {error}
          </div>
        )}
        {!loading && tasks.length === 0 && !error && (
          <p style={{ color: '#52809e', fontSize: '0.78rem', letterSpacing: '0.08em' }}>
            No tasks yet — create one above
          </p>
        )}

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tasks.map((task) => {
            const assignee = usernameFor(task.assignee_id)
            return (
              <div
                key={task._id}
                style={{
                  background: '#132035',
                  border: '1px solid #1e4470',
                  borderRadius: 4,
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/tasks/${task._id}`}
                    style={{
                      fontWeight: 600,
                      color: '#00d4ff',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {task.title}
                  </Link>
                  <p
                    style={{
                      margin: '0.2rem 0 0',
                      color: '#52809e',
                      fontSize: '0.78rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.description}
                  </p>
                  {(assignee || task.cti) && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      {assignee && (
                        <span style={{ fontSize: '0.65rem', color: '#4a7aa7', letterSpacing: '0.05em' }}>
                          ✦ {assignee}
                        </span>
                      )}
                      {task.cti && (
                        <CtiLabel cti={task.cti} categories={categories} />
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                  <StatusBadge status={task.status} />
                  <button
                    onClick={() => handleDelete(task._id)}
                    style={{
                      color: '#ff3a3a',
                      borderColor: '#ff3a3a',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.68rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// Resolves CTI IDs to human-readable "Category / Type / Item" label
function CtiLabel({ cti, categories }: { cti: CtiSelection; categories: Category[] }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const catName = categories.find((c) => c._id === cti.category_id)?.name ?? '?'

    Promise.all([
      api.get<CtiType[]>(`/api/cti/types?category_id=${cti.category_id}`),
      api.get<CtiItem[]>(`/api/cti/items?type_id=${cti.type_id}`),
    ])
      .then(([typesRes, itemsRes]) => {
        if (cancelled) return
        const typeName = typesRes.data.find((t) => t._id === cti.type_id)?.name ?? '?'
        const itemName = itemsRes.data.find((i) => i._id === cti.item_id)?.name ?? '?'
        setLabel(`${catName} / ${typeName} / ${itemName}`)
      })
      .catch(() => { if (!cancelled) setLabel(null) })

    return () => { cancelled = true }
  }, [cti, categories])

  if (!label) return null
  return (
    <span style={{ fontSize: '0.65rem', color: '#52809e', letterSpacing: '0.04em' }}>
      [{label}]
    </span>
  )
}
