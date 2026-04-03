import axios from 'axios'

const api = axios.create({
  baseURL: '',
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

// Attach Keycloak access token to every request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
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
