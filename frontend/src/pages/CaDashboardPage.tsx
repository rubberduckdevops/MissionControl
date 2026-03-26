import { useEffect, useState, useCallback } from 'react'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import Badge from '@cloudscape-design/components/badge'
import Spinner from '@cloudscape-design/components/spinner'
import Table from '@cloudscape-design/components/table'
import Layout from '../components/Layout'
import {
  getCaHealth,
  getCaCertStatus,
  getCaProvisioners,
  getCaCrl,
  type CaHealthResponse,
  type CaCertStatusResponse,
  type CaProvisioner,
  type CaCrlResponse,
} from '../services/api'

type SectionState<T> = { data: T | null; error: string | null; loading: boolean }

function initSection<T>(): SectionState<T> {
  return { data: null, error: null, loading: true }
}

function certStatusColor(status: string): 'green' | 'severity-medium' | 'red' {
  if (status === 'ok') return 'green'
  if (status === 'expiring_soon') return 'severity-medium'
  return 'red'
}

function certStatusLabel(status: string): string {
  if (status === 'ok') return 'OK'
  if (status === 'expiring_soon') return 'Expiring Soon'
  return 'Expired'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function CaDashboardPage() {
  const [health, setHealth] = useState<SectionState<CaHealthResponse>>(initSection())
  const [certStatus, setCertStatus] = useState<SectionState<CaCertStatusResponse>>(initSection())
  const [provisioners, setProvisioners] = useState<SectionState<CaProvisioner[]>>(initSection())
  const [crl, setCrl] = useState<SectionState<CaCrlResponse>>(initSection())
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setHealth((s) => ({ ...s, loading: true, error: null }))
    setCertStatus((s) => ({ ...s, loading: true, error: null }))
    setProvisioners((s) => ({ ...s, loading: true, error: null }))
    setCrl((s) => ({ ...s, loading: true, error: null }))

    await Promise.allSettled([
      getCaHealth()
        .then((r) => setHealth({ data: r.data, error: null, loading: false }))
        .catch(() => setHealth({ data: null, error: 'Failed to fetch CA health', loading: false })),

      getCaCertStatus()
        .then((r) => setCertStatus({ data: r.data, error: null, loading: false }))
        .catch(() => setCertStatus({ data: null, error: 'Failed to fetch certificate status', loading: false })),

      getCaProvisioners()
        .then((r) => setProvisioners({ data: r.data.provisioners ?? [], error: null, loading: false }))
        .catch(() => setProvisioners({ data: null, error: 'Failed to fetch provisioners', loading: false })),

      getCaCrl()
        .then((r) => setCrl({ data: r.data, error: null, loading: false }))
        .catch(() => setCrl({ data: null, error: 'Failed to fetch CRL', loading: false })),
    ])
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const caOffline =
    !health.loading && health.data === null

  return (
    <Layout>
      <ContentLayout
        header={
          <Header
            variant="h1"
            actions={
              <Button
                variant="normal"
                loading={refreshing}
                loadingText="Refreshing..."
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            }
          >
            CA Dashboard
          </Header>
        }
      >
        <SpaceBetween size="l">
          {caOffline && (
            <Alert type="error" header="CA Offline">
              The step-ca service is unreachable. Certificate operations are unavailable.
            </Alert>
          )}

          <ColumnLayout columns={2}>
            {/* Health */}
            <Container header={<Header variant="h2">CA Health</Header>}>
              {health.loading ? (
                <Spinner />
              ) : health.error ? (
                <Alert type="error">{health.error}</Alert>
              ) : (
                <SpaceBetween size="s">
                  <SpaceBetween size="xs" direction="horizontal">
                    <Box fontWeight="bold">Status</Box>
                    <Badge color={health.data?.status === 'ok' ? 'green' : 'red'}>
                      {health.data?.status?.toUpperCase() ?? 'UNKNOWN'}
                    </Badge>
                  </SpaceBetween>
                </SpaceBetween>
              )}
            </Container>

            {/* Certificate status */}
            <Container header={<Header variant="h2">Intermediate Certificate</Header>}>
              {certStatus.loading ? (
                <Spinner />
              ) : certStatus.error ? (
                <Alert type="error">{certStatus.error}</Alert>
              ) : certStatus.data ? (
                <SpaceBetween size="s">
                  <SpaceBetween size="xs" direction="horizontal">
                    <Box fontWeight="bold">Status</Box>
                    <Badge color={certStatusColor(certStatus.data.status)}>
                      {certStatusLabel(certStatus.data.status)}
                    </Badge>
                  </SpaceBetween>
                  <Box>
                    <strong>Days remaining:</strong> {certStatus.data.days_remaining}
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    <strong>Subject:</strong> {certStatus.data.subject}
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    <strong>Issuer:</strong> {certStatus.data.issuer}
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    <strong>Serial:</strong> {certStatus.data.serial}
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    <strong>Valid from:</strong> {formatDate(certStatus.data.not_before)}
                  </Box>
                  <Box variant="small" color="text-body-secondary">
                    <strong>Expires:</strong> {formatDate(certStatus.data.not_after)}
                  </Box>
                </SpaceBetween>
              ) : null}
            </Container>
          </ColumnLayout>

          {/* CRL */}
          <Container header={<Header variant="h2">Certificate Revocation List</Header>}>
            {crl.loading ? (
              <Spinner />
            ) : crl.error ? (
              <Alert type="error">{crl.error}</Alert>
            ) : crl.data ? (
              <ColumnLayout columns={2}>
                <Box>
                  <strong>Last update:</strong>{' '}
                  {crl.data.thisUpdate ? formatDate(crl.data.thisUpdate) : '—'}
                </Box>
                <Box>
                  <strong>Next update:</strong>{' '}
                  {crl.data.nextUpdate ? formatDate(crl.data.nextUpdate) : '—'}
                </Box>
              </ColumnLayout>
            ) : null}
          </Container>

          {/* Provisioners */}
          <Container header={<Header variant="h2">Provisioners</Header>}>
            {provisioners.loading ? (
              <Spinner />
            ) : provisioners.error ? (
              <Alert type="error">{provisioners.error}</Alert>
            ) : (
              <Table
                items={provisioners.data ?? []}
                columnDefinitions={[
                  { id: 'name', header: 'Name', cell: (p) => p.name },
                  { id: 'type', header: 'Type', cell: (p) => p.type },
                ]}
                empty={<Box color="text-body-secondary">No provisioners found.</Box>}
              />
            )}
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </Layout>
  )
}
