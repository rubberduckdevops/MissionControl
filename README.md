# MissonControl

A full-stack web application with user authentication and a real-time dashboard.

| Layer | Technology |
|-------|-----------|
| Backend | Rust + [Axum](https://github.com/tokio-rs/axum) |
| Frontend | React 18 + TypeScript + Vite |
| Database | PostgreSQL 16 |
| Auth | JWT (RS256 via `jsonwebtoken`) + Argon2id password hashing |
| Containerisation | Docker + Docker Compose |

---

## Quick Start

```bash
# 1. Copy the environment file and set your secrets
cp .env.example .env

# 2. Build and start all services
docker-compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:8080
# Postgres → localhost:5432
```

> On first run Docker will compile the Rust binary (~2–5 min). Subsequent builds are cached.

---

## Folder Structure

```
MissonControl/
├── backend/                    # Rust/Axum API server
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── migrations/             # SQLx migration files (run at startup)
│   │   └── 20240101000000_create_users.sql
│   └── src/
│       ├── main.rs             # Entry point — pool, migrations, server
│       ├── config.rs           # AppConfig (loaded from env vars)
│       ├── errors.rs           # AppError enum + IntoResponse impl
│       ├── db/mod.rs           # Db type alias (PgPool)
│       ├── models/
│       │   └── user.rs         # User + UserPublic structs
│       ├── handlers/
│       │   ├── auth.rs         # register / login / me handlers + AppState
│       │   ├── dashboard.rs    # dashboard handler
│       │   └── health.rs       # GET /health
│       ├── middleware/
│       │   └── auth.rs         # require_auth JWT middleware
│       └── routes/mod.rs       # Router assembly
│
├── frontend/                   # React SPA
│   ├── package.json
│   ├── vite.config.ts          # Dev proxy: /api → localhost:8080
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── nginx.conf              # Prod: serves SPA + proxies /api → backend
│   ├── index.html
│   └── src/
│       ├── main.tsx            # React root + AuthProvider wrapper
│       ├── App.tsx             # Router + route definitions
│       ├── index.css           # Global styles
│       ├── contexts/
│       │   └── AuthContext.tsx # Auth state, token persistence, actions
│       ├── services/
│       │   └── api.ts          # Axios instance with Bearer token interceptor
│       ├── components/
│       │   ├── Navbar.tsx      # Top nav with logout
│       │   └── PrivateRoute.tsx # Redirect unauthenticated users to /login
│       └── pages/
│           ├── LoginPage.tsx
│           ├── RegisterPage.tsx
│           └── DashboardPage.tsx
│
├── infra/
│   └── postgres/
│       └── init.sql            # Runs once on DB creation (enables uuid-ossp)
│
├── docker-compose.yml          # Orchestrates postgres + backend + frontend
├── .env.example                # Environment variable template
└── README.md
```

---

## API Endpoints

### Public

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/health` | — | `{ status, service }` |
| `POST` | `/api/auth/register` | `{ email, username, password }` | `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ token, user }` |

### Protected (requires `Authorization: Bearer <token>`)

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/auth/me` | `UserPublic` object |
| `GET` | `/api/dashboard` | `{ message, user_id, stats }` |

#### Example: Register

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","username":"alice","password":"secret123"}'
```

```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "email": "alice@example.com",
    "username": "alice",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Example: Dashboard

```bash
curl http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer <token>"
```

```json
{
  "message": "Welcome, alice@example.com!",
  "user_id": "...",
  "stats": { "total_users": 1 }
}
```

---

## Data Models

### `users` table

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | `UUID` | PK | Auto-generated via `uuid_generate_v4()` |
| `email` | `TEXT` | NOT NULL, UNIQUE | User's email address |
| `username` | `TEXT` | NOT NULL, UNIQUE | Display name |
| `password_hash` | `TEXT` | NOT NULL | Argon2id hash (never returned by API) |
| `role` | `TEXT` | NOT NULL, DEFAULT `'user'` | `'user'` or `'admin'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last update timestamp |

### `UserPublic` (API response shape)

```ts
{
  id: string        // UUID
  email: string
  username: string
  role: string
  created_at: string  // ISO 8601
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `JWT_SECRET` | Yes | Secret key for signing JWTs (use a long random string in production) |

---

## Local Development (without Docker)

### Backend

```bash
cd backend

# Requires a running Postgres instance
export DATABASE_URL=postgres://missoncontrol:changeme@localhost:5432/missoncontrol
export JWT_SECRET=dev-secret

cargo run
# Server starts on http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Dev server starts on http://localhost:5173
# /api requests are proxied to http://localhost:8080
```

---

## Architecture Notes

- **Migrations**: SQLx migrations in `backend/migrations/` run automatically at backend startup via `sqlx::migrate!()`.
- **Auth flow**: JWT tokens are issued on login/register (24h expiry), stored in `localStorage`, and attached to requests by the Axios interceptor. The `require_auth` middleware validates them server-side on every protected route.
- **Password security**: Argon2id (OWASP recommended) with a unique salt per user.
- **CORS**: Currently set to permissive for development. Restrict `CorsLayer` to your domain in production.
- **Docker networking**: The frontend Nginx container proxies `/api/` to the `backend` service by Docker service name — no hardcoded IPs needed.
