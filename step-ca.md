**Feature: step-ca Certificate Authority Dashboard**

**Context:**
An Axum-based Rust web application running at mc.rubberduck.work. A step-ca instance is running in a Docker container on the same server at `https://127.0.0.1:9000`, serving its own self-signed TLS cert. The app already has authentication middleware. The goal is to add a read-only CA dashboard section gated behind existing auth.

The frontend is a React 18 + TypeScript SPA (Vite + Tailwind CSS). There is no server-side templating — all UI lives in React.

**step-ca root CA certificate** is available at `certs/root_ca.crt` relative to the project root and should be used to verify TLS connections to step-ca rather than skipping verification entirely.

---

## Backend Requirements

**1. New route group `/api/ca` gated behind existing auth middleware**
- All `/api/ca/*` routes must pass through the existing `require_auth` middleware — no CA routes should be publicly accessible without auth
- Mount the CA router into `protected_routes` in `routes/mod.rs` following the same pattern as existing protected routes
- Use the `/api/ca/` prefix (not `/ca/`) to stay consistent with the existing `/api/` convention and avoid changes to the Vite proxy config

**2. Shared reqwest client as Axum state**
- A single `reqwest::Client` instance configured with the step-ca root CA cert loaded from `certs/root_ca.crt`
- Add the client to `AppState` in `handlers/auth.rs` — `reqwest::Client` is `Clone` and `Arc`-backed internally so no wrapping needed
- Connection timeout of 5 seconds, request timeout of 10 seconds

**3. API proxy routes**
The following routes should proxy to step-ca and return JSON:

| Route | Proxies to | Description |
|---|---|---|
| `GET /api/ca/health` | `https://127.0.0.1:9000/health` | CA health status |
| `GET /api/ca/roots` | `https://127.0.0.1:9000/roots` | Root certificate info |
| `GET /api/ca/crl` | `https://127.0.0.1:9000/1.0/crl` | Current CRL |
| `GET /api/ca/provisioners` | `https://127.0.0.1:9000/1.0/provisioners` | List provisioners |

Each handler should:
- Return a structured JSON response
- Return a `503 Service Unavailable` with a clear error message if step-ca is unreachable
- Return a `502 Bad Gateway` if step-ca returns an unexpected response
- Log errors using the existing tracing setup (`tracing::error!`)

**4. Certificate parsing**
- Parse the intermediate CA cert from `certs/intermediate_ca.crt` at startup
- Expose a `GET /api/ca/cert-status` route that returns:
  - Subject name
  - Issuer name
  - Serial number
  - Not before / not after dates
  - Days remaining until expiry
  - A status field: `ok` (>30 days), `expiring_soon` (≤30 days), `expired`
- Use the `x509-parser` crate for parsing

**5. Configuration**
- step-ca base URL (`https://127.0.0.1:9000`) should be configurable via environment variable `STEP_CA_URL` with that value as the default
- Root CA cert path should be configurable via `STEP_CA_ROOT_CERT` env var defaulting to `certs/root_ca.crt`
- Add both fields to `AppConfig` in `config.rs` following the existing pattern

**6. New dependencies to add to Cargo.toml**
- `reqwest` is already present but currently uses `native-tls` — change the features to `json` and `rustls-tls` with `default-features = false` to remove the OpenSSL dependency
- `x509-parser` for certificate parsing
- `serde` / `serde_json` are already present

---

## Frontend Requirements

**1. New route `/ca`**
- Add to React Router in `App.tsx` behind the existing `PrivateRoute` wrapper
- Add a nav link alongside the existing dashboard/tasks/weather links

**2. API service functions** in `services/api.ts`
Add the following typed functions using the existing axios instance:
- `getCaHealth()` → `GET /api/ca/health`
- `getCaRoots()` → `GET /api/ca/roots`
- `getCaCrl()` → `GET /api/ca/crl`
- `getCaProvisioners()` → `GET /api/ca/provisioners`
- `getCaCertStatus()` → `GET /api/ca/cert-status`

**3. `CaDashboardPage` component**
- Fetches all 5 endpoints in parallel (`Promise.all`) on mount and on manual refresh
- Sections to display:
  - CA health indicator (green/red badge)
  - Intermediate cert expiry with days remaining and status badge
  - Provisioner list (name and type columns only)
  - CRL last update timestamp and next update timestamp
- "Refresh" button re-runs the parallel fetch — no full page reload, just React state update
- If an individual fetch fails, that section shows an inline error and other sections still render
- If health is offline (`503`), show a prominent "CA Offline" banner at the top of the page

**4. Styling**
- Use the same Tailwind utility classes already used throughout the app for consistency
- Health badge: green for up, red for offline
- Cert status badge: green for `ok`, amber for `expiring_soon`, red for `expired`

**5. No new dependencies needed**
React, axios, and Tailwind are sufficient — no new packages required.

---

## Error States
- If step-ca is unreachable, the dashboard should display a clear "CA Offline" banner rather than a blank page or unhandled error
- Individual sections should degrade gracefully — if one API call fails, other sections should still render

---

## Out of Scope
- Certificate issuance via the UI
- Revocation via the UI
- SSH certificate management
- Any write operations to step-ca
- User-specific cert tracking
