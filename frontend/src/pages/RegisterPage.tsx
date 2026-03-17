import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Container from '@cloudscape-design/components/container'
import Header from '@cloudscape-design/components/header'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Button from '@cloudscape-design/components/button'
import Alert from '@cloudscape-design/components/alert'
import Box from '@cloudscape-design/components/box'
import SpaceBetween from '@cloudscape-design/components/space-between'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, username, password, inviteCode)
      navigate('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.error
      if (err?.response?.status === 403) {
        setError('REGISTRATION FAILED — invalid invite code')
      } else if (msg) {
        setError(`REGISTRATION FAILED — ${msg}`)
      } else {
        setError('REGISTRATION FAILED — email or username already taken')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <ContentLayout
          header={
            <SpaceBetween size="xs">
              <Box variant="h1" textAlign="center">MissionControl</Box>
              <Box variant="p" textAlign="center" color="text-body-secondary">Operator Registration</Box>
            </SpaceBetween>
          }
        >
          <Container>
            <form onSubmit={handleSubmit}>
              <Form
                actions={
                  <Button
                    variant="primary"
                    formAction="submit"
                    loading={loading}
                    loadingText="Registering..."
                  >
                    Register Operator
                  </Button>
                }
              >
                <SpaceBetween size="m">
                  {error && (
                    <Alert type="error">{error}</Alert>
                  )}
                  <FormField label="Email">
                    <Input
                      type="email"
                      value={email}
                      onChange={({ detail }) => setEmail(detail.value)}
                      placeholder="operator@missioncontrol.io"
                      autoComplete="email"
                    />
                  </FormField>
                  <FormField label="Callsign">
                    <Input
                      type="text"
                      value={username}
                      onChange={({ detail }) => setUsername(detail.value)}
                      placeholder="callsign"
                      autoComplete="username"
                    />
                  </FormField>
                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </FormField>
                  <FormField label="Invite Code">
                    <Input
                      type="password"
                      value={inviteCode}
                      onChange={({ detail }) => setInviteCode(detail.value)}
                      placeholder="••••••••"
                      autoComplete="off"
                    />
                  </FormField>
                  <Box textAlign="center">
                    <Box variant="small">
                      Already registered?{' '}
                      <RouterLink to="/login">Login</RouterLink>
                    </Box>
                  </Box>
                </SpaceBetween>
              </Form>
            </form>
          </Container>
        </ContentLayout>
      </div>
    </div>
  )
}
