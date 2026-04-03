import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import '@cloudscape-design/global-styles/index.css'
import './index.css'

const oidcConfig = {
  authority: `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}`,
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid email profile',
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OidcAuthProvider {...oidcConfig}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </OidcAuthProvider>
  </React.StrictMode>,
)
