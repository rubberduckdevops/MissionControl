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
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Textarea from '@cloudscape-design/components/textarea'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import {
  getCaHealth,
  getCaCertStatus,
  getCaProvisioners,
  getCaCrl,
  requestTlsCert,
  requestSshCert,
  listIssuedCerts,
  type CaHealthResponse,
  type CaCertStatusResponse,
  type CaProvisioner,
  type CaCrlResponse,
  type IssuedCert,
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

function downloadPem(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function CaDashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [health, setHealth] = useState<SectionState<CaHealthResponse>>(initSection())
  const [certStatus, setCertStatus] = useState<SectionState<CaCertStatusResponse>>(initSection())
  const [provisioners, setProvisioners] = useState<SectionState<CaProvisioner[]>>(initSection())
  const [crl, setCrl] = useState<SectionState<CaCrlResponse>>(initSection())
  const [refreshing, setRefreshing] = useState(false)

  // TLS sign form
  const [tlsCommonName, setTlsCommonName] = useState('')
  const [tlsSans, setTlsSans] = useState('')
  const [tlsSubmitting, setTlsSubmitting] = useState(false)
  const [tlsError, setTlsError] = useState<string | null>(null)

  // SSH sign form
  const [sshPublicKey, setSshPublicKey] = useState('')
  const [sshPrincipals, setSshPrincipals] = useState('')
  const [sshSubmitting, setSshSubmitting] = useState(false)
  const [sshError, setSshError] = useState<string | null>(null)
  const [sshResult, setSshResult] = useState<string | null>(null)

  // Issued certs
  const [issuedCerts, setIssuedCerts] = useState<SectionState<IssuedCert[]>>(initSection())

  const fetchIssuedCerts = useCallback(async () => {
    if (!isAdmin) return
    setIssuedCerts((s) => ({ ...s, loading: true, error: null }))
    listIssuedCerts()
      .then((r) => setIssuedCerts({ data: r.data, error: null, loading: false }))
      .catch((e: unknown) =>
        setIssuedCerts({
          data: null,
          error: `Failed to fetch issued certificates: ${e instanceof Error ? e.message : String(e)}`,
          loading: false,
        })
      )
  }, [isAdmin])

  const fetchAll = useCallback(async () => {
    setHealth((s) => ({ ...s, loading: true, error: null }))
    setCertStatus((s) => ({ ...s, loading: true, error: null }))
    setProvisioners((s) => ({ ...s, loading: true, error: null }))
    setCrl((s) => ({ ...s, loading: true, error: null }))
    fetchIssuedCerts()

    await Promise.allSettled([
      getCaHealth()
        .then((r) => setHealth({ data: r.data, error: null, loading: false }))
        .catch((e: unknown) => setHealth({ data: null, error: `Failed to fetch CA health: ${e instanceof Error ? e.message : String(e)}`, loading: false })),

      getCaCertStatus()
        .then((r) => setCertStatus({ data: r.data, error: null, loading: false }))
        .catch((e: unknown) => setCertStatus({ data: null, error: `Failed to fetch certificate status: ${e instanceof Error ? e.message : String(e)}`, loading: false })),

      getCaProvisioners()
        .then((r) => {
          if (r.data.provisioners === undefined) {
            setProvisioners({ data: null, error: 'Provisioners missing from API response', loading: false })
          } else {
            setProvisioners({ data: r.data.provisioners, error: null, loading: false })
          }
        })
        .catch((e: unknown) => setProvisioners({ data: null, error: `Failed to fetch provisioners: ${e instanceof Error ? e.message : String(e)}`, loading: false })),

      getCaCrl()
        .then((r) => setCrl({ data: r.data, error: null, loading: false }))
        .catch((e: unknown) => setCrl({ data: null, error: `Failed to fetch CRL: ${e instanceof Error ? e.message : String(e)}`, loading: false })),
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

  const handleTlsSign = async () => {
    setTlsError(null)
    setTlsSubmitting(true)
    const sans = tlsSans.split(',').map((s) => s.trim()).filter(Boolean)
    try {
      const res = await requestTlsCert({ commonName: tlsCommonName, sans })
      downloadPem(res.data.cert_pem, `${tlsCommonName}.crt`)
      downloadPem(res.data.key_pem, `${tlsCommonName}.key`)
      setTlsCommonName('')
      setTlsSans('')
      fetchIssuedCerts()
    } catch (e: unknown) {
      setTlsError(e instanceof Error ? e.message : String(e))
    } finally {
      setTlsSubmitting(false)
    }
  }

  const handleSshSign = async () => {
    setSshError(null)
    setSshResult(null)
    setSshSubmitting(true)
    const principals = sshPrincipals.split(',').map((s) => s.trim()).filter(Boolean)
    try {
      const res = await requestSshCert({ publicKey: sshPublicKey, principals })
      setSshResult(res.data.signed_cert)
    } catch (e: unknown) {
      setSshError(e instanceof Error ? e.message : String(e))
    } finally {
      setSshSubmitting(false)
    }
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

          {isAdmin && (
            <>
              {/* Request TLS Certificate */}
              <Container header={<Header variant="h2">Request TLS Certificate</Header>}>
                <SpaceBetween size="m">
                  {tlsError && <Alert type="error">{tlsError}</Alert>}
                  <FormField label="Common Name" description="Primary domain for the certificate (e.g. example.com)">
                    <Input
                      value={tlsCommonName}
                      onChange={(e) => setTlsCommonName(e.detail.value)}
                      placeholder="example.com"
                      disabled={tlsSubmitting}
                    />
                  </FormField>
                  <FormField
                    label="Additional SANs"
                    description="Comma-separated additional DNS names (optional)"
                  >
                    <Input
                      value={tlsSans}
                      onChange={(e) => setTlsSans(e.detail.value)}
                      placeholder="www.example.com, api.example.com"
                      disabled={tlsSubmitting}
                    />
                  </FormField>
                  <Button
                    variant="primary"
                    loading={tlsSubmitting}
                    onClick={handleTlsSign}
                    disabled={!tlsCommonName.trim()}
                  >
                    Request &amp; Download
                  </Button>
                </SpaceBetween>
              </Container>

              {/* Sign SSH Key */}
              <Container header={<Header variant="h2">Sign SSH Public Key</Header>}>
                <SpaceBetween size="m">
                  {sshError && <Alert type="error">{sshError}</Alert>}
                  <FormField label="SSH Public Key">
                    <Textarea
                      value={sshPublicKey}
                      onChange={(e) => setSshPublicKey(e.detail.value)}
                      placeholder="ssh-ed25519 AAAA..."
                      rows={3}
                      disabled={sshSubmitting}
                    />
                  </FormField>
                  <FormField
                    label="Principals"
                    description="Comma-separated usernames allowed by this certificate (e.g. ec2-user, ubuntu)"
                  >
                    <Input
                      value={sshPrincipals}
                      onChange={(e) => setSshPrincipals(e.detail.value)}
                      placeholder="ec2-user, ubuntu"
                      disabled={sshSubmitting}
                    />
                  </FormField>
                  <Button
                    variant="primary"
                    loading={sshSubmitting}
                    onClick={handleSshSign}
                    disabled={!sshPublicKey.trim() || !sshPrincipals.trim()}
                  >
                    Sign Key
                  </Button>
                  {sshResult && (
                    <FormField label="Signed Certificate">
                      <SpaceBetween size="xs">
                        <Textarea value={sshResult} readOnly rows={4} />
                        <Button
                          onClick={() => {
                            downloadPem(sshResult, 'id_signed-cert.pub')
                          }}
                        >
                          Download
                        </Button>
                      </SpaceBetween>
                    </FormField>
                  )}
                </SpaceBetween>
              </Container>

              {/* Issued TLS Certificates */}
              <Container header={<Header variant="h2">Issued TLS Certificates</Header>}>
                {issuedCerts.loading ? (
                  <Spinner />
                ) : issuedCerts.error ? (
                  <Alert type="error">{issuedCerts.error}</Alert>
                ) : (
                  <Table
                    items={issuedCerts.data ?? []}
                    columnDefinitions={[
                      { id: 'cn', header: 'Common Name', cell: (c) => c.common_name },
                      { id: 'sans', header: 'SANs', cell: (c) => c.sans.join(', ') || '—' },
                      { id: 'serial', header: 'Serial', cell: (c) => c.serial },
                      { id: 'expires', header: 'Expires', cell: (c) => formatDate(c.expires_at) },
                      { id: 'requested_by', header: 'Requested By', cell: (c) => c.requested_by_email },
                      { id: 'issued_at', header: 'Issued At', cell: (c) => formatDate(c.issued_at) },
                    ]}
                    empty={<Box color="text-body-secondary">No certificates issued yet.</Box>}
                  />
                )}
              </Container>
            </>
          )}
        </SpaceBetween>
      </ContentLayout>
    </Layout>
  )
}
