# NPM Load Balancer

Sistem manajemen **Nginx Load Balancer** berbasis web yang terintegrasi dengan [Nginx Proxy Manager](https://nginxproxymanager.com/). Dibangun menggunakan **NestJS** (backend) + **React/Vite** (frontend), berjalan sebagai service tambahan di dalam container NPM via **s6-overlay**.

---

## 📋 Daftar Isi

- [Arsitektur](#arsitektur)
- [Fitur](#fitur)
- [Persyaratan](#persyaratan)
- [Quick Start](#quick-start)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Otomatisasi Konfigurasi (startScript.sh)](#otomatisasi-konfigurasi-startscriptsh)
- [Struktur Proyek](#struktur-proyek)
- [CI/CD (GitLab)](#cicd-gitlab)
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
│  │  │   API   │→ │ Config │  │ + Postgres│  │    │
│  │  └─────────┘  │ Engine │  └───────────┘  │    │
│  │               └────────┘         │        │    │
│  │  ┌───────────────────────────┐   │        │    │
│  │  │   React UI (static)       │   │        │    │
│  │  └───────────────────────────┘   │        │    │
│  └──────────────────────────────────│───────┘    │
│                                     ▼            │
│                         ┌──────────────────────┐ │
│                         │  External Postgres   │ │
│                         └──────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Alur Kerja:**
1. User mengelola Load Balancer via **UI** atau **API**.
2. Backend menyimpan konfigurasi ke **PostgreSQL**.
3. Backend men-generate file **Nginx `.conf`** secara otomatis.
4. Backend melakukan validasi config dan reload Nginx secara otomatis.

---

## Fitur

- ✅ **CRUD Load Balancer** — Dashboard visual untuk manajemen LB.
- ✅ **PostgreSQL Integration** — Menggunakan database eksternal yang tangguh.
- ✅ **Auto-Generated Environment** — Skrip inisialisasi otomatis untuk kemudahan setup.
- ✅ **Multi-Upstream** — Dukung banyak backend server dengan bobot (weight) dan backup.
- ✅ **Health Check** — Integrasi `max_fails` dan `fail_timeout` Nginx.
- ✅ **CI/CD Ready** — Siap dideploy menggunakan GitLab CI/CD.

---

## Persyaratan

- **Docker** ≥ 20.10 & **Docker Compose** ≥ 2.0
- **PostgreSQL** ≥ 13 (Eksternal)
- Port yang tersedia: `80`, `81`, `443`, `3000`

---

## Quick Start

### 1. Persiapan Environment
Salin file example dan sesuaikan variabel PostgreSQL Anda:
```bash
cp env.example src/app/.env
# Edit src/app/.env sesuai kredensial database Anda
```

### 2. Deploy dengan Docker Compose
```bash
# Jalankan menggunakan docker-compose
docker compose up -d --build
```

### 3. Akses Dashboard
- **Custom LB UI**: `http://localhost:3000`
- **NPM Admin**: `http://localhost:81`

---

## Konfigurasi Environment

Variabel lingkungan dikelola melalui `docker-compose.yml` atau GitLab CI/CD Variables.

| Variable             | Default         | Keterangan                                  |
| -------------------- | --------------- | ------------------------------------------- |
| `POSTGRES_HOST`      | —               | Host PostgreSQL eksternal                   |
| `POSTGRES_PORT`      | `5432`          | Port PostgreSQL                             |
| `POSTGRES_USER`      | —               | Username database                           |
| `POSTGRES_PASSWORD`  | —               | Password database                           |
| `POSTGRES_DB`        | —               | Nama database                               |
| `TZ`                 | `Asia/Jakarta`  | Timezone container                          |
| `NODE_ENV`           | `production`    | Mode aplikasi                               |

---

## Otomatisasi Konfigurasi (startScript.sh)

Proyek ini menggunakan `startScript.sh` sebagai entrypoint internal untuk menyelaraskan environment:
- **Auto-Generate .env**: Membangun `DATABASE_URL` secara dinamis dari variabel `POSTGRES_*`.
- **Database Migration**: Menjalankan `prisma db push` otomatis setiap kali container dimulai.
- **Portability**: Skrip yang sama bisa digunakan di lokal untuk setup cepat.

---

## Struktur Proyek

```
npm-custom-lb/
├── config/                  # 📂 Data runtime (Nginx configs & SSL)
│   ├── data/                # Mounting /data di container
│   └── letsencrypt/         # Sertifikat SSL
├── gitlab-ci/               # 🚀 Script CI/CD (Build & Deploy)
├── src/
│   ├── app/                 # 🔧 Backend (NestJS)
│   └── frontend/            # 🎨 Frontend (React + Vite)
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Orchestrasi container
├── startScript.sh           # Script inisialisasi environment
└── env.example              # Template variabel lingkungan
```

---

## CI/CD (GitLab)

Pipeline didefinisikan secara modular:
1.  **Stage Build**: Membangun Docker image dan mempush ke GitLab Registry.
2.  **Stage Deploy**: Melakukan login ke server, menjalankan `docker compose pull`, dan merestart stack dengan variabel terbaru.

Pastikan variabel `POSTGRES_HOST`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` sudah diatur di **GitLab Settings > CI/CD > Variables**.

---

## Development Lokal

### Inisialisasi Environment
Jalankan skrip pembentuk `.env` (pastikan variabel `POSTGRES_*` sudah ada di shell Anda):
```bash
./startScript.sh
```

### Jalankan Backend & Frontend
```bash
# Di terminal 1 (Backend)
cd src/app
npm install
npm run start:dev

# Di terminal 2 (Frontend)
cd src/frontend
npm install
npm run dev
```

---

## Troubleshooting

### ❌ Gagal Koneksi Database
- Pastikan host PostgreSQL dapat dijangkau dari dalam container.
- Cek apakah password mengandung karakter khusus yang memerlukan URL encoding.
- Cek logs: `docker compose logs -f npm-lb`.

### ❌ File .env Tidak Update
- Hapus file `.env` lama dan jalankan ulang container atau `startScript.sh`.

### ❌ Nginx Reload Gagal
- Gunakan perintah `docker compose exec npm-lb nginx -t` untuk melihat error syntax pada konfigurasi Nginx yang digenerate.

---

## License
MIT
