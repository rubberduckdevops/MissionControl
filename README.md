# MissonControl

A full-stack threat intelligence and task management platform.

| Layer | Technology |
|-------|-----------|
| Backend | Rust + [Axum](https://github.com/tokio-rs/axum) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Database | MongoDB 7 |
| Auth | JWT (HS256 via `jsonwebtoken`) + Argon2id password hashing |
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
# MongoDB  → localhost:27017
```

> On first run Docker will compile the Rust binary (~2–5 min). Subsequent builds are cached.

---

## Folder Structure

```
MissonControl/
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── entrypoint.sh           # Starts backend + sidecar health monitor
│   └── src/
│       ├── main.rs             # Entry point — DB connection, indexes, server
│       ├── config.rs           # AppConfig (loaded from env vars)
│       ├── errors.rs           # AppError enum + IntoResponse impl
│       ├── db/mod.rs           # Db type alias (mongodb::Database)
│       ├── models/
│       │   ├── user.rs         # User + UserPublic structs
│       │   ├── task.rs         # Task, TaskNote, TaskQuery, PaginatedTasksResponse
│       │   ├── cti.rs          # CtiCategory, CtiType, CtiItem, CtiSelection
│       │   └── artifacts.rs
│       ├── handlers/
│       │   ├── auth.rs         # register / login / me + AppState + Claims
│       │   ├── admin.rs        # Admin user management handlers
│       │   ├── tasks.rs        # Task CRUD + notes
│       │   ├── cti.rs          # CTI taxonomy CRUD
│       │   ├── users.rs        # list users
│       │   ├── dashboard.rs    # dashboard handler
│       │   └── health.rs       # GET /health
│       ├── middleware/
│       │   ├── auth.rs         # require_auth — validates JWT, injects Claims
│       │   └── admin.rs        # require_admin — checks role == "admin"
│       └── routes/mod.rs       # Router assembly + CORS + rate limiting
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts          # Dev proxy: /api → localhost:8080
│   ├── Dockerfile
│   ├── nginx.conf              # Prod: serves SPA + proxies /api → backend
│   └── src/
│       ├── main.tsx            # React root + AuthProvider wrapper
│       ├── App.tsx             # React Router v6 routes
│       ├── contexts/
│       │   └── AuthContext.tsx # Auth state, JWT in localStorage, actions
│       ├── services/
│       │   └── api.ts          # Axios instance with Bearer token interceptor
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── PrivateRoute.tsx
│       │   └── AdminRoute.tsx
│       └── pages/
│           ├── LoginPage.tsx
│           ├── RegisterPage.tsx
│           ├── DashboardPage.tsx
│           ├── TasksPage.tsx
│           ├── TaskDetailPage.tsx
│           ├── CtiPage.tsx
│           └── AdminPage.tsx
│
├── scripts/
│   └── make-admin.sh           # Promotes a registered user to admin role
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Endpoints

### Public

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | `{ email, username, password, invite_code }` | Register a new user |
| `POST` | `/api/auth/login` | `{ email, password }` | Login |

> Registration requires a valid `invite_code` matching the `INVITE_CODE` env var.

### Protected (requires `Authorization: Bearer <token>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/dashboard` | Dashboard stats |
| `GET` | `/api/users` | List all users |
| `GET` / `POST` | `/api/tasks` | List (paginated + filtered) / create tasks |
| `GET` / `PUT` / `DELETE` | `/api/tasks/:id` | Get / update / delete task |
| `POST` | `/api/tasks/:id/notes` | Add note to task |
| `DELETE` | `/api/tasks/:id/notes/:note_id` | Delete note |
| `GET` / `POST` | `/api/cti/categories` | List / create CTI categories |
| `DELETE` | `/api/cti/categories/:id` | Delete CTI category |
| `GET` / `POST` | `/api/cti/types` | List / create CTI types |
| `DELETE` | `/api/cti/types/:id` | Delete CTI type |
| `GET` / `POST` | `/api/cti/items` | List / create CTI items |
| `DELETE` | `/api/cti/items/:id` | Delete CTI item |

### Admin only

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `PUT` / `DELETE` | `/api/admin/users/:id` | Update / delete user |
| `PUT` | `/api/admin/users/:id/role` | Change user role |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_USER` | Yes | MongoDB username |
| `MONGO_PASSWORD` | Yes | MongoDB password |
| `MONGO_DB` | Yes | MongoDB database name |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 bytes in production) |
| `FRONTEND_ORIGIN` | Yes | Allowed CORS origin, e.g. `https://mc.example.com` |
| `INVITE_CODE` | Yes | Required to register new users — share out-of-band |
| `GHCR_OWNER` | Yes | GitHub username/org for pulling pre-built images |

---

## Local Development (without Docker)

### Backend

```bash
cd backend
export MONGODB_URI=mongodb://missoncontrol:changeme@localhost:27017/missoncontrol
export MONGODB_DB=missoncontrol
export JWT_SECRET=dev-secret
export INVITE_CODE=dev-invite
export FRONTEND_ORIGIN=http://localhost:5173

cargo run           # starts on :8080
cargo test          # run all tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # starts on :5173, proxies /api → localhost:8080
npm test            # run tests once
npm run test:watch  # watch mode
npm run build       # tsc + vite build
```

---

## Architecture Notes

- **Auth flow**: JWT tokens issued on login/register (24h expiry), stored in `localStorage`, attached by the Axios interceptor. `require_auth` middleware validates them on every protected route.
- **Password security**: Argon2id with a unique salt per user.
- **Rate limiting**: Auth endpoints are limited to 10 req/min per IP via `tower-governor`.
- **CORS**: Restricted to `FRONTEND_ORIGIN` — set this to your public domain in production.
- **Request IDs**: Every request gets a server-generated `X-Correlation-ID` UUID (client-supplied values are ignored to prevent log injection).
- **Task statuses**: `todo`, `in_progress`, `done`
- **User roles**: `user`, `admin`
