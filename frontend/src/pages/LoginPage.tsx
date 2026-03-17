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

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('AUTH FAILURE — invalid credentials')
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
              <Box variant="p" textAlign="center" color="text-body-secondary">Operator Login</Box>
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
                    loadingText="Authenticating..."
                  >
                    Authenticate
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
                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </FormField>
                  <Box textAlign="center">
                    <Box variant="small">
                      No account?{' '}
                      <RouterLink to="/register">Register operator</RouterLink>
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
