import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

const markdownComponents = {
  p:          ({ children }: any) => <p style={{ margin: '0 0 0.4rem 0' }}>{children}</p>,
  strong:     ({ children }: any) => <strong style={{ color: '#7eb8d4' }}>{children}</strong>,
  em:         ({ children }: any) => <em style={{ color: '#a8c8e0' }}>{children}</em>,
  code:       ({ children }: any) => (
    <code style={{ background: '#0a1220', border: '1px solid #1e4470', borderRadius: 2, padding: '0.1em 0.3em', fontSize: '0.8em', color: '#52b3d9', fontFamily: 'monospace' }}>{children}</code>
  ),
  pre:        ({ children }: any) => (
    <pre style={{ background: '#0a1220', border: '1px solid #1e4470', borderRadius: 3, padding: '0.6rem 0.75rem', overflowX: 'auto' as const, fontSize: '0.8em', margin: '0.4rem 0' }}>{children}</pre>
  ),
  ul:         ({ children }: any) => <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>{children}</ul>,
  ol:         ({ children }: any) => <ol style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>{children}</ol>,
  li:         ({ children }: any) => <li style={{ marginBottom: '0.15rem' }}>{children}</li>,
  a:          ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#52809e', textDecoration: 'underline' }}>{children}</a>,
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #1e4470', margin: '0.4rem 0', padding: '0.2rem 0.75rem', color: '#7a9ab5' }}>{children}</blockquote>,
  h1:         ({ children }: any) => <h1 style={{ fontSize: '1.1em', color: '#7eb8d4', margin: '0.5rem 0 0.25rem' }}>{children}</h1>,
  h2:         ({ children }: any) => <h2 style={{ fontSize: '1em',   color: '#7eb8d4', margin: '0.5rem 0 0.25rem' }}>{children}</h2>,
  h3:         ({ children }: any) => <h3 style={{ fontSize: '0.95em',color: '#7eb8d4', margin: '0.5rem 0 0.25rem' }}>{children}</h3>,
}

const STATUSES = ['todo', 'in_progress', 'done']

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
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.color}`,
        }}
      />
      {cfg.label}
    </span>
  )
}

function PanelHeader({ title, accent = '#00d4ff' }: { title: string; accent?: string }) {
  return (
    <div
      style={{
        padding: '0.5rem 1.25rem',
        borderBottom: '1px solid #1e4470',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <span
        style={{
          color: accent,
          fontSize: '0.68rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
        }}
      >
        {title}
      </span>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' as const }}>
      {children}
    </span>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Users and CTI data
  const [users, setUsers] = useState<UserPublic[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editTypes, setEditTypes] = useState<CtiType[]>([])
  const [editItems, setEditItems] = useState<CtiItem[]>([])

  // Edit form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editTypeId, setEditTypeId] = useState('')
  const [editItemId, setEditItemId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Notes state
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  // Load task + users + categories in parallel
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

        // Pre-populate CTI selections if the task already has one
        if (t.cti) {
          setEditCategoryId(t.cti.category_id)
          setEditTypeId(t.cti.type_id)
          setEditItemId(t.cti.item_id)
        }
      })
      .catch(() => setError('Task not found'))
      .finally(() => setLoading(false))
  }, [id])

  // When edit category changes, load types
  useEffect(() => {
    setEditTypeId('')
    setEditItemId('')
    setEditItems([])
    if (!editCategoryId) { setEditTypes([]); return }
    api
      .get<CtiType[]>(`/api/cti/types?category_id=${editCategoryId}`)
      .then((r) => {
        setEditTypes(r.data)
        // Re-apply saved type selection after types are loaded (initial hydration)
        if (task?.cti?.category_id === editCategoryId && task?.cti?.type_id) {
          setEditTypeId(task.cti.type_id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCategoryId])

  // When edit type changes, load items
  useEffect(() => {
    setEditItemId('')
    if (!editTypeId) { setEditItems([]); return }
    api
      .get<CtiItem[]>(`/api/cti/items?type_id=${editTypeId}`)
      .then((r) => {
        setEditItems(r.data)
        // Re-apply saved item selection after items are loaded (initial hydration)
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

  const loadingEl = (
    <>
      <Navbar />
      <div style={{ padding: '2rem', color: '#52809e', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
        Loading…
      </div>
    </>
  )
  const errorEl = (
    <>
      <Navbar />
      <div
        style={{
          padding: '2rem',
          color: '#ff3a3a',
          fontSize: '0.8rem',
          letterSpacing: '0.1em',
          borderLeft: '3px solid #ff3a3a',
          margin: '2rem',
          background: 'rgba(255,58,58,0.07)',
        }}
      >
        {error || 'Task not found'}
      </div>
    </>
  )

  if (loading) return loadingEl
  if (error || !task) return errorEl

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 760, margin: '0 auto' }}>
        {/* Back */}
        <button
          onClick={() => navigate('/tasks')}
          style={{
            color: '#4a7aa7',
            borderColor: 'transparent',
            padding: 0,
            marginBottom: '1.25rem',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            background: 'none',
          }}
        >
          ← Back to Tasks
        </button>

        {/* Page heading */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '0.8rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#00d4ff',
            }}
          >
            Task Detail
          </h1>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)',
              marginTop: '0.5rem',
            }}
          />
        </div>

        {/* Edit panel */}
        <div
          style={{
            background: '#132035',
            border: '1px solid #1e4470',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: '1.25rem',
          }}
        >
          <PanelHeader title="Edit Task" />
          <div style={{ padding: '1.25rem' }}>
            {saveError && (
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
                {saveError}
              </div>
            )}
            <form onSubmit={handleSave}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <FieldLabel>Title</FieldLabel>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <FieldLabel>Description</FieldLabel>
                <input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <FieldLabel>Status</FieldLabel>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              {/* Assignee */}
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <FieldLabel>Assignee</FieldLabel>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </label>

              {/* CTI cascading dropdowns */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                <div style={{ flex: '1 1 130px' }}>
                  <FieldLabel>Category</FieldLabel>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
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
                    value={editTypeId}
                    onChange={(e) => setEditTypeId(e.target.value)}
                    disabled={!editCategoryId}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">— none —</option>
                    {editTypes.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <FieldLabel>Item</FieldLabel>
                  <select
                    value={editItemId}
                    onChange={(e) => setEditItemId(e.target.value)}
                    disabled={!editTypeId}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">— none —</option>
                    {editItems.map((i) => (
                      <option key={i._id} value={i._id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1rem' }}>
                <button type="submit" disabled={saving} style={{ letterSpacing: '0.1em' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <StatusBadge status={task.status} />
                <span style={{ fontSize: '0.7rem', color: '#52809e' }}>
                  {assigneeName(task.assignee_id)}
                </span>
              </div>
            </form>
          </div>
        </div>

        {/* Notes panel */}
        <div
          style={{
            background: '#132035',
            border: '1px solid #1e4470',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <PanelHeader title="Notes" accent="#f59e0b" />
          <div style={{ padding: '1.25rem' }}>
            {task.notes.length === 0 && (
              <p style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.08em', marginTop: 0 }}>
                No notes yet.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {task.notes.map((n, idx) => (
                <div
                  key={n._id}
                  style={{
                    background: '#0e1828',
                    border: '1px solid #1e4470',
                    borderLeft: '2px solid #52809e',
                    borderRadius: 3,
                    padding: '0.6rem 0.875rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#52809e', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                        [{String(idx + 1).padStart(3, '0')}]
                      </span>
                      <span style={{ color: '#52809e', fontSize: '0.65rem' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#c8ddf0', wordBreak: 'break-word', lineHeight: '1.5' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {n.note}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(n._id)}
                    style={{
                      color: '#ff3a3a',
                      borderColor: 'transparent',
                      background: 'none',
                      padding: '0.1rem 0.4rem',
                      fontSize: '0.65rem',
                      letterSpacing: '0.08em',
                      flexShrink: 0,
                    }}
                  >
                    DEL
                  </button>
                </div>
              ))}
            </div>

            {noteError && (
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
                {noteError}
              </div>
            )}
            <form onSubmit={handleAddNote}>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <FieldLabel>Add a note</FieldLabel>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  required
                  rows={3}
                  placeholder="Add a note…"
                  style={{ resize: 'vertical' }}
                />
              </label>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.65rem', color: '#52809e', letterSpacing: '0.05em' }}>
                Markdown supported
              </p>
              <button type="submit" disabled={addingNote} style={{ letterSpacing: '0.1em' }}>
                {addingNote ? 'Adding…' : 'Add Note'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
