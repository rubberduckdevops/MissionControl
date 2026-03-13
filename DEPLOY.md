# Deploying to a VPS (DigitalOcean — Fedora)

## Prerequisites

- A Droplet running Fedora
- A domain pointed at the Droplet's IP
- Docker + Docker Compose installed on the server
- `git` installed on the server

---

## 1. Firewall (firewalld)

Fedora uses `firewalld` by default. Ensure it is running, then open only the
ports nginx needs:

```bash
systemctl enable --now firewalld

firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

Ports 8080, 3000, and 27017 are not opened. The Docker containers are bound to
`127.0.0.1` only, so they are unreachable from outside even without explicit
deny rules.

---

## 2. Install Nginx + Certbot

```bash
dnf install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx
```

---

## 3. Nginx Config

Fedora's nginx uses `conf.d/` (not `sites-available/`). Copy the config directly there:

```bash
cp deploy/nginx.conf /etc/nginx/conf.d/missioncontrol.conf
nginx -t && systemctl reload nginx
```

The config in `deploy/nginx.conf`:
- Redirects HTTP → HTTPS
- Proxies `/api/` and `/health` to the backend on `127.0.0.1:8080`
- Proxies everything else to the frontend on `127.0.0.1:3000`
- Sets `X-Forwarded-For` and `X-Real-IP` so per-IP rate limiting works correctly

---

## 4. TLS Certificate

With the nginx config in place, run Certbot:

```bash
certbot --nginx -d mc.rubberduck.work
```

Certbot will find the matching `server_name`, install the certificate, and patch the config.
Renewal is handled automatically by the systemd timer Certbot installs (`certbot renew` runs twice daily).

---

## 5. Environment File

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Set strong values for every secret:

```bash
# Generate a strong MongoDB password
openssl rand -hex 32

# Generate a strong JWT secret
openssl rand -hex 32
```

Set `FRONTEND_ORIGIN` to your public domain (used for CORS):

```
FRONTEND_ORIGIN=https://mc.rubberduck.work
```

---

## 6. First-time GHCR Setup

After your first `git push` to `main`, GitHub Actions builds and pushes both images to GHCR.

Confirm the packages exist at `https://github.com/<username>?tab=packages` — you should see `missioncontrol-backend` and `missioncontrol-frontend`.

Since the source repo is public, GHCR packages inherit public visibility automatically — no auth token is needed on the server to pull them.

Also set `GHCR_OWNER` in your `.env` to your GitHub username or org:

```
GHCR_OWNER=your-github-username
```

---

## 7. Start the Stack

```bash
# Pull pre-built images from GHCR (no build on server)
sudo docker compose pull
sudo docker compose up -d
```

Verify containers are running:

```bash
sudo docker compose ps
```

---

## 8. Create Admin User

Register your account through the UI first, then promote it:

```bash
./scripts/make-admin.sh you@example.com
```

The script reads credentials from `.env` automatically and connects to the running MongoDB container. Re-run it any time you need to promote another user.

---

## 9. Verify

```bash
# TLS + correlation ID header
curl -sv https://mc.rubberduck.work/health 2>&1 | grep -i correlation

# Rate limiting on auth endpoints (expect 10× 401 then 2× 429)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://mc.rubberduck.work/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"wrong"}'
done
```

---

## 10. Ongoing

### Subsequent deploys

```bash
git push                          # triggers GitHub Actions build
# Wait ~3 minutes for the build to complete, then on the server:
sudo docker compose pull && sudo docker compose up -d
```

### Docker log rotation

Add `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker: `systemctl restart docker`

### Automatic security updates

```bash
dnf install -y dnf-automatic
# Configure to apply security updates automatically
sed -i 's/apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer
```

### SSH + nginx brute force protection

```bash
dnf install -y fail2ban
systemctl enable --now fail2ban
```

The default config protects SSH. Add nginx jails to also ban IPs that repeatedly
hit 401 (bad credentials) or 429 (rate-limited) on the auth endpoints.

**1. Create a custom filter for 429 responses** (`/etc/fail2ban/filter.d/nginx-429.conf`):

```ini
[Definition]
failregex = ^<HOST> - \S+ \[.*\] "POST /api/auth/\S+ HTTP/\d\.\d" 429
ignoreregex =
```

**2. Create the jail config** (`/etc/fail2ban/jail.d/nginx.conf`):

```ini
# Ban IPs that get 5 failed logins (401) within 10 minutes for 1 hour
[nginx-http-auth]
enabled  = true
port     = http,https
filter   = nginx-http-auth
logpath  = /var/log/nginx/access.log
maxretry = 5
findtime = 600
bantime  = 3600

# Ban IPs that are still hammering after hitting the rate limit (429)
[nginx-429]
enabled  = true
port     = http,https
filter   = nginx-429
logpath  = /var/log/nginx/access.log
maxretry = 3
findtime = 600
bantime  = 86400
```

`nginx-http-auth` is a built-in fail2ban filter. The `nginx-429` filter is the
custom one created above — 3 rate-limited responses within 10 minutes earns a
24-hour ban.

**3. Reload fail2ban:**

```bash
systemctl reload fail2ban

# Verify jails are active
fail2ban-client status
fail2ban-client status nginx-429
```
