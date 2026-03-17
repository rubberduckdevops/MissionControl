import { useEffect, useState } from 'react'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Table from '@cloudscape-design/components/table'
import Input from '@cloudscape-design/components/input'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import Modal from '@cloudscape-design/components/modal'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Spinner from '@cloudscape-design/components/spinner'
import Layout from '../components/Layout'
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

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserPublic | null>(null)

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
      setConfirmDeleteUser(null)
    } catch {
      setError('Failed to delete user')
      setConfirmDeleteUser(null)
    }
  }

  if (loading) {
    return (
      <Layout>
        <ContentLayout header={<Header variant="h1">Operator Management</Header>}>
          <Spinner size="large" />
        </ContentLayout>
      </Layout>
    )
  }

  return (
    <Layout>
      <ContentLayout header={<Header variant="h1">Operator Management</Header>}>
        <SpaceBetween size="m">
          {error && <Alert type="error">{error}</Alert>}
          {editError && <Alert type="error">{editError}</Alert>}

          <Table
            columnDefinitions={[
              {
                id: 'username',
                header: 'Username',
                cell: (u: UserPublic) => {
                  const isMe = u.id === currentUser?.id
                  if (editingId === u.id) {
                    return (
                      <Input
                        value={editUsername}
                        onChange={({ detail }) => setEditUsername(detail.value)}
                      />
                    )
                  }
                  return (
                    <span>
                      {u.username}
                      {isMe && (
                        <Box variant="small" color="text-status-info" display="inline">
                          {' '}(you)
                        </Box>
                      )}
                    </span>
                  )
                },
              },
              {
                id: 'email',
                header: 'Email',
                cell: (u: UserPublic) => {
                  if (editingId === u.id) {
                    return (
                      <Input
                        value={editEmail}
                        onChange={({ detail }) => setEditEmail(detail.value)}
                      />
                    )
                  }
                  return <Box color="text-body-secondary">{u.email}</Box>
                },
              },
              {
                id: 'role',
                header: 'Role',
                cell: (u: UserPublic) => (
                  <StatusIndicator type={u.role === 'admin' ? 'success' : 'info'}>
                    {u.role}
                  </StatusIndicator>
                ),
              },
              {
                id: 'joined',
                header: 'Joined',
                cell: (u: UserPublic) => (
                  <Box color="text-body-secondary">
                    {new Date(u.created_at).toLocaleDateString()}
                  </Box>
                ),
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (u: UserPublic) => {
                  const isMe = u.id === currentUser?.id
                  if (editingId === u.id) {
                    return (
                      <SpaceBetween size="xs" direction="horizontal">
                        <Button
                          variant="primary"
                          loading={editSaving}
                          loadingText="Saving..."
                          onClick={() => saveEdit(u.id)}
                        >
                          Save
                        </Button>
                        <Button variant="normal" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </SpaceBetween>
                    )
                  }
                  return (
                    <SpaceBetween size="xs" direction="horizontal">
                      <Button variant="normal" onClick={() => startEdit(u)}>
                        Edit
                      </Button>
                      <Button
                        variant="inline-link"
                        disabled={isMe}
                        onClick={() => handleRoleToggle(u)}
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </Button>
                      <Button
                        variant="inline-link"
                        disabled={isMe}
                        onClick={() => setConfirmDeleteUser(u)}
                      >
                        Delete
                      </Button>
                    </SpaceBetween>
                  )
                },
              },
            ]}
            items={users}
            empty={
              <Box textAlign="center" color="text-body-secondary">
                No operators found.
              </Box>
            }
            header={<Header variant="h2" counter={`(${users.length})`}>Operators</Header>}
          />
        </SpaceBetween>
      </ContentLayout>

      <Modal
        visible={confirmDeleteUser !== null}
        onDismiss={() => setConfirmDeleteUser(null)}
        header="Confirm Delete"
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="normal" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => confirmDeleteUser && handleDelete(confirmDeleteUser.id)}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {confirmDeleteUser && (
          <Box>
            Are you sure you want to delete operator <strong>{confirmDeleteUser.username}</strong>? This action cannot be undone.
          </Box>
        )}
      </Modal>
    </Layout>
  )
}
