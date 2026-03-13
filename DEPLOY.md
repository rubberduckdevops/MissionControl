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
FRONTEND_ORIGIN=https://example.com
```

---

## 6. Start the Stack

```bash
COMPOSE_BAKE=false sudo docker compose up -d --build
```

Verify containers are running:

```bash
sudo docker compose ps
```

---

## 7. Verify

```bash
# TLS + correlation ID header
curl -sv https://example.com/health 2>&1 | grep -i correlation

# Rate limiting on auth endpoints (expect 10× 401 then 2× 429)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://example.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"wrong"}'
done
```

---

## 8. Ongoing

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

### SSH brute force protection

```bash
dnf install -y fail2ban
systemctl enable --now fail2ban
```

The default `fail2ban` config protects SSH out of the box.
