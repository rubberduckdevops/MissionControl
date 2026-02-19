import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

interface UserPublic {
  id: string
  email: string
  username: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<UserPublic[]>('/api/admin/users')
      .then((res) => setUsers(res.data))
      .catch(() => setError('Failed to load user list'))
      .finally(() => setLoading(false))
  }, [])

  const handleRoleToggle = async (u: UserPublic) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    try {
      const res = await api.put<UserPublic>(`/api/admin/users/${u.id}/role`, { role: newRole })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)))
    } catch {
      setError(`Failed to update role for ${u.username}`)
    }
  }

  const startEdit = (u: UserPublic) => {
    setEditingId(u.id)
    setEditEmail(u.email)
    setEditUsername(u.username)
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (id: string) => {
    setEditSaving(true)
    setEditError('')
    try {
      const res = await api.put<UserPublic>(`/api/admin/users/${id}`, {
        email: editEmail,
        username: editUsername,
      })
      setUsers((prev) => prev.map((x) => (x.id === id ? res.data : x)))
      setEditingId(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save changes'
      setEditError(msg)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/users/${id}`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      setConfirmDeleteId(null)
    } catch {
      setError('Failed to delete user')
      setConfirmDeleteId(null)
    }
  }

  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.75rem',
    fontSize: '0.78rem',
    color: '#c8d8e8',
    borderBottom: '1px solid #1e4470',
    verticalAlign: 'middle',
  }

  const headerCellStyle: React.CSSProperties = {
    padding: '0.6rem 0.75rem',
    color: '#4a7aa7',
    fontSize: '0.65rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    borderBottom: '2px solid #1e4470',
    background: '#0e1a2b',
    fontWeight: 600,
    verticalAlign: 'middle',
  }

  const inputStyle: React.CSSProperties = {
    background: '#0e1a2b',
    border: '1px solid #1e4470',
    color: '#c8d8e8',
    padding: '0.25rem 0.5rem',
    fontSize: '0.78rem',
    borderRadius: 2,
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
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
            Operator Management
          </h1>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)',
              marginTop: '0.5rem',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              borderLeft: '3px solid #ff3a3a',
              background: 'rgba(255,58,58,0.07)',
              padding: '0.5rem 0.75rem',
              marginBottom: '1.5rem',
              color: '#ff3a3a',
              fontSize: '0.78rem',
              letterSpacing: '0.05em',
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <p style={{ color: '#52809e', fontSize: '0.78rem', letterSpacing: '0.1em' }}>
            LOADING OPERATORS…
          </p>
        )}

        {!loading && users.length === 0 && !error && (
          <p style={{ color: '#52809e', fontSize: '0.78rem', letterSpacing: '0.1em' }}>
            No operators found.
          </p>
        )}

        {!loading && users.length > 0 && (
          <div
            style={{
              background: '#132035',
              border: '1px solid #1e4470',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Username</th>
                  <th style={headerCellStyle}>Email</th>
                  <th style={headerCellStyle}>Role</th>
                  <th style={headerCellStyle}>Joined</th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = u.id === currentUser?.id
                  const isEditing = editingId === u.id
                  const isConfirmingDelete = confirmDeleteId === u.id

                  return (
                    <tr
                      key={u.id}
                      style={{ background: isEditing ? '#0e1a2b' : 'transparent' }}
                    >
                      <td style={cellStyle}>
                        {isEditing ? (
                          <input
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            style={inputStyle}
                          />
                        ) : (
                          <>
                            {u.username}
                            {isMe && (
                              <span
                                style={{
                                  marginLeft: '0.4rem',
                                  color: '#00d4ff',
                                  fontSize: '0.65rem',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                (you)
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td style={cellStyle}>
                        {isEditing ? (
                          <input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            style={inputStyle}
                          />
                        ) : (
                          <span style={{ color: '#52809e' }}>{u.email}</span>
                        )}
                      </td>

                      <td style={cellStyle}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: u.role === 'admin' ? '#00d4ff' : '#4a7aa7',
                          }}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td style={{ ...cellStyle, color: '#52809e' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        {isEditing ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              gap: '0.3rem',
                            }}
                          >
                            {editError && (
                              <span style={{ color: '#ff3a3a', fontSize: '0.68rem' }}>
                                {editError}
                              </span>
                            )}
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => saveEdit(u.id)}
                                disabled={editSaving}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.2rem 0.6rem',
                                  letterSpacing: '0.08em',
                                }}
                              >
                                {editSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.2rem 0.6rem',
                                  letterSpacing: '0.08em',
                                  color: '#4a7aa7',
                                  borderColor: '#4a7aa7',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : isConfirmingDelete ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.4rem',
                            }}
                          >
                            <span style={{ color: '#ff3a3a', fontSize: '0.68rem' }}>
                              Confirm?
                            </span>
                            <button
                              onClick={() => handleDelete(u.id)}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                letterSpacing: '0.08em',
                                color: '#ff3a3a',
                                borderColor: '#ff3a3a',
                              }}
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                letterSpacing: '0.08em',
                                color: '#4a7aa7',
                                borderColor: '#4a7aa7',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '0.4rem',
                            }}
                          >
                            <button
                              onClick={() => startEdit(u)}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                letterSpacing: '0.08em',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRoleToggle(u)}
                              disabled={isMe}
                              title={isMe ? 'Cannot change your own role' : undefined}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                letterSpacing: '0.08em',
                                color: u.role === 'admin' ? '#f59e0b' : '#00d4ff',
                                borderColor: u.role === 'admin' ? '#f59e0b' : '#00d4ff',
                                opacity: isMe ? 0.4 : 1,
                                cursor: isMe ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {u.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              disabled={isMe}
                              title={isMe ? 'Cannot delete your own account' : undefined}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                letterSpacing: '0.08em',
                                color: '#ff3a3a',
                                borderColor: '#ff3a3a',
                                opacity: isMe ? 0.4 : 1,
                                cursor: isMe ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
