import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../services/api'

interface Task {
  _id: string
  title: string
  description: string
  status: string
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    api
      .get<Task[]>('/api/tasks')
      .then((res) => setTasks(res.data))
      .catch(() => setError('Could not load tasks'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const res = await api.post<Task>('/api/tasks', { title, description })
      setTasks((prev) => [res.data, ...prev])
      setTitle('')
      setDescription('')
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
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Task title"
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: '2 1 240px' }}>
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#4a7aa7', textTransform: 'uppercase' }}>
                  Objective
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="What needs to be done?"
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1rem' }}>
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

        {/* Operations list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tasks.map((task) => (
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
          ))}
        </div>
      </div>
    </>
  )
}
