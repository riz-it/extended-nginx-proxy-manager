# NPM Custom Load Balancer

Sistem manajemen **Nginx Load Balancer** berbasis web yang terintegrasi dengan [Nginx Proxy Manager](https://nginxproxymanager.com/). Dibangun menggunakan **NestJS** (backend) + **React/Vite** (frontend), berjalan sebagai service tambahan di dalam container NPM via **s6-overlay**.

---

## 📋 Daftar Isi

- [Arsitektur](#arsitektur)
- [Fitur](#fitur)
- [Persyaratan](#persyaratan)
- [Quick Start](#quick-start)
- [Konfigurasi Environment](#konfigurasi-environment)
- [API Reference](#api-reference)
- [Penggunaan UI](#penggunaan-ui)
- [Struktur Proyek](#struktur-proyek)
- [Development Lokal](#development-lokal)
- [Troubleshooting](#troubleshooting)

---

## Arsitektur

```
┌─────────────────────────────────────────────────┐
│                Docker Container                  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │          Nginx Proxy Manager              │    │
│  │    :80 (HTTP) · :81 (Admin) · :443 (SSL)  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │        Custom LB API (NestJS)             │    │
│  │              :3001                        │    │
│  │                                           │    │
│  │  ┌─────────┐  ┌────────┐  ┌───────────┐  │    │
│  │  │ LB CRUD │  │ Nginx  │  │  Prisma   │  │    │
│  │  │   API   │→ │ Config │  │ + LibSQL  │  │    │
│  │  └─────────┘  │ Engine │  └───────────┘  │    │
│  │               └────────┘                  │    │
│  │  ┌─────────────────────────────────────┐  │    │
│  │  │     React UI (static files)         │  │    │
│  │  └─────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  /data/custom-lb.sqlite  ← Database              │
│  /data/nginx/custom/*.conf ← Generated configs   │
└─────────────────────────────────────────────────┘
```

**Alur Kerja:**
1. User membuat/mengedit Load Balancer via **UI** atau **API**
2. Backend menyimpan konfigurasi ke **SQLite** (via Prisma + LibSQL)
3. Backend men-generate file **Nginx `.conf`** dari template EJS
4. Backend menjalankan `nginx -t` (validasi) lalu `nginx -s reload` (apply tanpa downtime)

---

## Fitur

- ✅ **CRUD Load Balancer** — Buat, lihat, edit, hapus load balancer
- ✅ **Multi-Upstream** — Dukung banyak backend server per LB
- ✅ **Weight & Backup** — Weighted round-robin, backup server support
- ✅ **Health Check** — `max_fails` dan `fail_timeout` per upstream
- ✅ **Toggle On/Off** — Aktifkan/nonaktifkan LB tanpa hapus konfigurasi
- ✅ **Config Preview** — Lihat hasil Nginx config sebelum di-apply
- ✅ **Auto Reload** — Nginx otomatis reload setelah setiap perubahan
- ✅ **Rollback** — Jika config gagal validasi, perubahan otomatis di-rollback
- ✅ **Web UI** — Dashboard visual untuk manajemen LB

---

## Persyaratan

- **Docker** ≥ 20.10
- **Docker Compose** ≥ 2.0
- Port yang tersedia: `80`, `81`, `443`, `3000`

---

## Quick Start

### 1. Clone & Deploy

```bash
# Clone repository
git clone <repo-url> npm-custom-lb
cd npm-custom-lb

# Build dan jalankan
docker compose up -d --build
```

### 2. Akses Aplikasi

| Service                  | URL                         | Keterangan                    |
| ------------------------ | --------------------------- | ----------------------------- |
| **Custom LB UI**         | http://localhost:3000        | Dashboard manajemen LB        |
| **Custom LB API**        | http://localhost:3000/api    | REST API                      |
| **NPM Admin Panel**      | http://localhost:81          | Nginx Proxy Manager dashboard |
| **HTTP Proxy**           | http://localhost:80          | Traffic masuk HTTP             |
| **HTTPS Proxy**          | https://localhost:443        | Traffic masuk HTTPS            |

### 3. Login NPM (Pertama Kali)

Nginx Proxy Manager default credentials:
- **Email:** `admin@example.com`
- **Password:** `changeme`

> ⚠️ Segera ganti password setelah login pertama!

---

## Konfigurasi Environment

Environment variables dikonfigurasi di `docker-compose.yml`:

| Variable        | Default                        | Keterangan                              |
| --------------- | ------------------------------ | --------------------------------------- |
| `DATABASE_URL`  | `file:/data/custom-lb.sqlite`  | Path database SQLite (format LibSQL)    |
| `PORT`          | `3001`                         | Port internal API (jangan ubah)         |
| `NODE_ENV`      | `production`                   | Environment mode                        |

Contoh konfigurasi:
```yaml
# docker-compose.yml
services:
  npm-lb:
    environment:
      - DATABASE_URL=file:/data/custom-lb.sqlite
      - PORT=3001
      - NODE_ENV=production
```

---

## API Reference

Base URL: `http://localhost:3000/api`

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-09T03:29:51.000Z",
  "service": "npm-custom-lb"
}
```

---

### List Semua Load Balancer

```
GET /api/lb
```

Response: Array of LoadBalancer objects

---

### Detail Load Balancer

```
GET /api/lb/:id
```

| Parameter | Tipe     | Keterangan      |
| --------- | -------- | --------------- |
| `id`      | `number` | ID load balancer |

---

### Buat Load Balancer Baru

```
POST /api/lb
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "my-backend-app",
  "listenPort": 8080,
  "upstreams": [
    {
      "host": "10.0.0.1:3000",
      "weight": 5,
      "maxFails": 3,
      "failTimeout": "10s",
      "isBackup": false
    },
    {
      "host": "10.0.0.2:3000",
      "weight": 3,
      "maxFails": 3,
      "failTimeout": "10s",
      "isBackup": false
    },
    {
      "host": "10.0.0.3:3000",
      "weight": 1,
      "maxFails": 5,
      "failTimeout": "30s",
      "isBackup": true
    }
  ]
}
```

| Field                    | Tipe      | Required | Default | Keterangan                          |
| ------------------------ | --------- | -------- | ------- | ----------------------------------- |
| `name`                   | `string`  | ✅       | —       | Nama unik (hanya alfanumerik + `-`) |
| `listenPort`             | `number`  | ❌       | `80`    | Port yang di-listen Nginx           |
| `upstreams`              | `array`   | ✅       | —       | Min. 1 upstream server              |
| `upstreams[].host`       | `string`  | ✅       | —       | `IP:PORT` backend server            |
| `upstreams[].weight`     | `number`  | ❌       | `1`     | Bobot round-robin (makin besar = makin sering dipilih)    |
| `upstreams[].maxFails`   | `number`  | ❌       | `3`     | Jumlah gagal sebelum dianggap down  |
| `upstreams[].failTimeout`| `string`  | ❌       | `"10s"` | Durasi cooldown setelah max fails   |
| `upstreams[].isBackup`   | `boolean` | ❌       | `false` | Backup server (hanya aktif jika semua primary down) |

**Response:** Created LoadBalancer object with upstreams

> 💡 Jika validasi Nginx gagal, perubahan otomatis di-rollback dan LB tidak akan dibuat.

---

### Update Load Balancer

```
PUT /api/lb/:id
Content-Type: application/json
```

**Request Body** (semua field opsional):
```json
{
  "name": "new-name",
  "listenPort": 9090,
  "status": "active",
  "upstreams": [
    {
      "host": "10.0.0.10:3000",
      "weight": 1,
      "isActive": true
    }
  ]
}
```

> ⚠️ Jika `upstreams` dikirim, **semua upstream lama akan dihapus** dan diganti yang baru.

---

### Hapus Load Balancer

```
DELETE /api/lb/:id
```

Response:
```json
{
  "message": "LoadBalancer \"my-backend-app\" deleted"
}
```

---

### Preview Config Nginx

Lihat config Nginx yang akan di-generate **tanpa mengapply** perubahan.

```
GET /api/lb/:id/preview
```

Response: `text/plain` Nginx configuration content

---

### Toggle Aktif/Nonaktif

Toggle status load balancer antara `active` dan `inactive`.

```
PATCH /api/lb/:id/toggle
```

- **active → inactive:** File `.conf` dihapus, Nginx di-reload
- **inactive → active:** File `.conf` di-generate, Nginx di-reload

---

## Penggunaan UI

### Membuat Load Balancer Baru

1. Buka `http://localhost:3000`
2. Klik tombol **"+ Create"** atau **"Add Load Balancer"**
3. Isi nama load balancer (contoh: `my-backend`)
4. Set **Listen Port** (port Nginx yang menerima traffic)
5. Tambahkan **upstream servers**:
   - IP:Port backend (contoh: `192.168.1.10:8080`)
   - Weight (bobot traffic)
   - Centang **Backup** jika server hanya untuk failover
6. Klik **Save**

### Mengelola Load Balancer

- **Toggle On/Off:** Klik switch untuk mengaktifkan/menonaktifkan tanpa hilangkan konfigurasi
- **Edit:** Klik ikon edit untuk mengubah upstream servers
- **Preview:** Klik ikon preview untuk melihat Nginx config yang dihasilkan
- **Delete:** Klik ikon hapus untuk menghapus load balancer beserta config Nginx-nya

---

## Struktur Proyek

```
npm-custom-lb/
├── docker-compose.yml       # Konfigurasi Docker
├── Dockerfile               # Multi-stage build (NPM + Backend + Frontend)
├── .dockerignore             # Exclude files dari Docker build
│
├── app/                     # 🔧 Backend (NestJS)
│   ├── src/
│   │   ├── main.ts                    # Bootstrap aplikasi
│   │   ├── app.module.ts              # Root module
│   │   ├── app.controller.ts          # Health check endpoint
│   │   ├── lb/                        # Load Balancer module
│   │   │   ├── lb.controller.ts       # REST API routes
│   │   │   ├── lb.service.ts          # Business logic
│   │   │   ├── lb.module.ts           # Module definition
│   │   │   └── dto/                   # Data Transfer Objects
│   │   │       ├── create-lb.dto.ts
│   │   │       └── update-lb.dto.ts
│   │   ├── nginx/                     # Nginx Config Engine
│   │   │   ├── nginx.service.ts       # Generate, validate, reload
│   │   │   ├── nginx.module.ts
│   │   │   └── templates/
│   │   │       └── upstream.conf.ejs  # Template EJS Nginx config
│   │   └── prisma/                    # Database layer
│   │       ├── prisma.service.ts      # Prisma + LibSQL adapter
│   │       └── prisma.module.ts
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema
│   │   └── migrations/                # Database migrations
│   ├── prisma.config.ts               # Prisma runtime config
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                # 🎨 Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx                    # Komponen utama
│   │   ├── api.ts                     # API client
│   │   ├── types.ts                   # TypeScript types
│   │   ├── index.css                  # Styling
│   │   └── main.tsx                   # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── data/                    # 📂 Runtime data (di-mount ke container)
│   ├── custom-lb.sqlite               # Database Custom LB
│   ├── database.sqlite                # Database NPM
│   └── nginx/custom/                  # Generated Nginx configs
│
└── letsencrypt/             # 🔐 SSL certificates (di-mount)
```

---

## Development Lokal

### Backend (NestJS)

```bash
cd app

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Buat file .env
echo "DATABASE_URL=file:./dev.db" > .env

# Jalankan migrasi database
npx prisma migrate dev

# Jalankan dev server
npm run start:dev
```

Backend berjalan di `http://localhost:3001/api`

### Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Jalankan dev server
npm run dev
```

Frontend berjalan di `http://localhost:5173` (proxy ke API di `localhost:3001`)

---

## Docker Commands

```bash
# Build dan jalankan
docker compose up -d --build

# Lihat logs
docker compose logs -f npm-lb

# Restart container
docker compose restart

# Stop dan hapus container
docker compose down

# Rebuild dari awal (tanpa cache)
docker compose build --no-cache && docker compose up -d

# Masuk ke dalam container
docker compose exec npm-lb bash

# Cek status Nginx dari dalam container
docker compose exec npm-lb nginx -t
```

---

## Troubleshooting

### ❌ Error: `URL_INVALID: The URL 'undefined'`

**Penyebab:** Environment variable `DATABASE_URL` tidak tersedia di proses Node.js.

**Solusi:**
1. Pastikan `docker-compose.yml` memiliki entry:
   ```yaml
   environment:
     - DATABASE_URL=file:/data/custom-lb.sqlite
   ```
2. Rebuild container: `docker compose build --no-cache && docker compose up -d`

### ❌ Error: `Nginx config validation FAILED`

**Penyebab:** Format upstream host salah, atau port konflik.

**Solusi:**
- Pastikan format host upstream: `IP:PORT` (contoh: `10.0.0.1:3000`)
- Pastikan `listenPort` tidak konflik dengan port 80, 81, 443

### ❌ Container berjalan tapi LB tidak bekerja

**Cek:**
1. `docker compose logs -f npm-lb` — lihat error log
2. `docker compose exec npm-lb ls /data/nginx/custom/` — pastikan file `.conf` ada
3. `docker compose exec npm-lb nginx -t` — validasi config Nginx
4. `docker compose exec npm-lb cat /data/nginx/custom/<name>.conf` — lihat isi config

### ❌ Perubahan tidak ter-apply

**Solusi:** Nginx perlu di-reload. Jika API sedang error, manual reload:
```bash
docker compose exec npm-lb nginx -s reload
```

---

## Contoh Nginx Config yang Dihasilkan

Berikut contoh config yang di-generate untuk LB bernama `my-app` dengan 3 upstream:

```nginx
upstream my-app {
    server 10.0.0.1:3000 weight=5 max_fails=3 fail_timeout=10s;
    server 10.0.0.2:3000 weight=3 max_fails=3 fail_timeout=10s;
    server 10.0.0.3:3000 weight=1 max_fails=5 fail_timeout=30s backup;

    # Keep connections alive to upstream servers
    keepalive 32;
}

server {
    listen 8080;

    location / {
        proxy_pass http://my-app;

        # Failover & Retry
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 5s;

        # Timeouts
        proxy_connect_timeout 3s;
        proxy_read_timeout 10s;
        proxy_send_timeout 10s;

        # Keepalive
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Header Forwarding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}
```

---

## License

MIT
