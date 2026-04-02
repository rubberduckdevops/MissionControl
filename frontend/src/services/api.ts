import axios from 'axios'

const api = axios.create({
  baseURL: '',
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

export interface CaHealthResponse {
  status: string
  [key: string]: unknown
}

export interface CaProvisioner {
  name: string
  type: string
  [key: string]: unknown
}

export interface CaProvisionersResponse {
  provisioners: CaProvisioner[]
  [key: string]: unknown
}

export interface CaCrlResponse {
  thisUpdate?: string
  nextUpdate?: string
  [key: string]: unknown
}

export interface CaCertStatusResponse {
  subject: string
  issuer: string
  serial: string
  not_before: string
  not_after: string
  days_remaining: number
  status: 'ok' | 'expiring_soon' | 'expired'
}

export const getCaHealth = () => api.get<CaHealthResponse>('/api/ca/health')
export const getCaRoots = () => api.get<unknown>('/api/ca/roots')
export const getCaCrl = () => api.get<CaCrlResponse>('/api/ca/crl')
export const getCaProvisioners = () => api.get<CaProvisionersResponse>('/api/ca/provisioners')
export const getCaCertStatus = () => api.get<CaCertStatusResponse>('/api/ca/cert-status')

export interface TlsSignRequest {
  commonName: string
  sans: string[]
}

export interface TlsSignResponse {
  cert_pem: string
  key_pem: string
}

export interface SshSignRequest {
  publicKey: string
  principals: string[]
}

export interface SshSignResponse {
  signed_cert: string
}

export interface IssuedCert {
  id: string
  requested_by: string
  requested_by_email: string
  common_name: string
  sans: string[]
  serial: string
  expires_at: string
  issued_at: string
}

export const requestTlsCert = (body: TlsSignRequest) =>
  api.post<TlsSignResponse>('/api/ca/sign/tls', {
    common_name: body.commonName,
    sans: body.sans,
  })

export const requestSshCert = (body: SshSignRequest) =>
  api.post<SshSignResponse>('/api/ca/sign/ssh', {
    public_key: body.publicKey,
    principals: body.principals,
  })

export const listIssuedCerts = () =>
  api.get<IssuedCert[]>('/api/ca/certificates')
