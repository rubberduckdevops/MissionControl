import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../services/api'

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
  created_at: string
  updated_at: string
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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  useEffect(() => {
    api
      .get<Task>(`/api/tasks/${id}`)
      .then((res) => {
        setTask(res.data)
        setTitle(res.data.title)
        setDescription(res.data.description)
        setStatus(res.data.status)
      })
      .catch(() => setError('Task not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      const res = await api.put<Task>(`/api/tasks/${id}`, { title, description, status })
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
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Title
                </span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Description
                </span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Status
                </span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button type="submit" disabled={saving} style={{ letterSpacing: '0.1em' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <StatusBadge status={task.status} />
              </div>
            </form>
          </div>
        </div>

        {/* Log panel */}
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
            {/* Log entries */}
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
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#c8ddf0', wordBreak: 'break-word' }}>
                      {n.note}
                    </p>
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

            {/* Add note */}
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
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Add a note
                </span>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  required
                  rows={3}
                  placeholder="Add a note…"
                  style={{ resize: 'vertical' }}
                />
              </label>
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
