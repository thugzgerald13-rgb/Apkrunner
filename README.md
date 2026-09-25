# /README.md
# APKRunner

> Self-hosted, client-side Android APK runner powered by WebAssembly (`bellum`) rendered to a hardware-accelerated WebGPU canvas.

Execution is **100% client-side**. The backend server is strictly responsible for metadata management, user authentication, and S3-compatible object storage (MinIO). **The server NEVER executes APKs.**

---

## 📐 Architecture Diagram

```
 +-----------------------------------------------------------------------------------+
 |                                   CLIENT BROWSER                                  |
 |                                                                                   |
 |  +-----------------------------------------------------------------------------+  |
 |  | Next.js 15 App Router (React 19, Tailwind CSS, Dark Theme)                 |  |
 |  |                                                                             |  |
 |  |  +--------------------+   +-----------------------+   +------------------+  |  |
 |  |  | /dashboard (Apps)  |   | /apps/[id] (Builds)   |   | /admin (Audit)   |  |  |
 |  |  +--------------------+   +-----------------------+   +------------------+  |  |
 |  |                                                                             |  |
 |  |  +-----------------------------------------------------------------------+  |  |
 |  |  | /apps/[id]/run  (Full-Screen APK Execution Workspace)                 |  |  |
 |  |  |                                                                       |  |  |
 |  |  |   +-----------------------+        +------------------------------+   |  |  |
 |  |  |   | Virtual Phone Frame   |        | Collapsible Side Inspector   |   |  |  |
 |  |  |   | 1080 x 1920 Canvas    |        | - Logcat Stream (Filterable) |   |  |  |
 |  |  |   | Context: 'webgpu'     |        | - Bellum Runtime Status      |   |  |  |
 |  |  |   +-----------^-----------+        | - Performance & FPS Counter  |   |  |  |
 |  |  |               | (Frame Blit)       +------------------------------+   |  |  |
 |  |  |   +-----------+-----------+                                           |  |  |
 |  |  |   | bellum WebAssembly    | <--- Fetch APK ArrayBuffer from MinIO     |  |  |
 |  |  |   | (Dalvik/ART + AOSP    | <--- Drag & Drop local .apk on canvas     |  |  |
 |  |  |   |  Subsystem Emulation) |                                           |  |  |
 |  |  |   +-----------------------+                                           |  |  |
 |  |  +-----------------------------------------------------------------------+  |  |
 |  +--------------------------------------^--------------------------------------+  |
 +-----------------------------------------|-----------------------------------------+
                                           | HTTPS / Presigned URLs / REST / tRPC
                                           v
 +-----------------------------------------------------------------------------------+
 |                        REVERSE PROXY: Caddy (Auto-HTTPS)                          |
 +--------------------+---------------------------------------+----------------------+
                      |                                       |
                      v                                       v
 +-----------------------------------------+   +-------------------------------------+
 |          apps/api (Hono + tRPC)         |   |          apps/web (Next.js 15)      |
 |  - JWT Auth (Better Auth)               |   |  - SSR Landing & Client Navigation  |
 |  - APK Metadata Extraction (package,    |   |  - WebGPU Compatibility Guard       |
 |    version, icon via app-info-parser)   |   |  - bellum WASM Loader & Controller  |
 |  - Presigned S3 Upload / Download URLs  |   +-------------------------------------+
 |  - Optional ClamAV Antivirus Scanner    |
 +--------------------+--------------------+
                      |
        +-------------+-------------+
        |                           |
        v                           v
 +--------------+            +--------------+
 |  PostgreSQL  |            |    MinIO     |
 |  (Prisma)    |            | (S3 Storage) |
 +--------------+            +--------------+
```

---

## ✨ Features

- **Zero-Server Execution**: APKs run entirely within the user's browser sandbox via WebAssembly (`/wasm/bellum.wasm`) rendered to WebGPU.
- **Hardware Acceleration**: WebGPU-accelerated rendering pipeline at 1080x1920 resolution with smooth touch/drag interaction.
- **Direct Drag & Drop**: Test local `.apk` packages instantly on the canvas without uploading to the cloud.
- **APK Inspection**: Automatic package name, version, and icon extraction from Android manifest upon upload.
- **Large File Support**: Upload limit of 500MB with chunked multipart uploads for files above 50MB.
- **Real-time Logcat**: Built-in Android logcat console showing system, Dalvik/ART, and bellum runtime logs with tag/level filtering.
- **Role-Gated Admin Panel**: System audit logs, user management, and MinIO storage consumption metrics.
- **Production Ready**: Full Docker Compose stack with Caddy automatic TLS, Postgres 16, and MinIO S3 storage.

---

## 🚀 Quick Start (Docker Compose)

### 1. Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Browser with WebGPU support: **Google Chrome 113+**, **Microsoft Edge 113+**, or **Firefox Nightly** (with `dom.webgpu.enabled` turned on)

### 2. Launch Stack
```bash
git clone https://github.com/example/apkrunner.git
cd apkrunner
cp .env.example .env
docker compose up -d --build
```

### 3. Initialize Database & Admin Seed
```bash
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed
```

**Default Admin Credentials:**
- **Email:** `admin@apkrunner.local`
- **Password:** `AdminPassword123!`

Open your browser at `https://apkrunner.local` or `http://localhost`.

---

## 🛠️ Local Development (Monorepo)

```bash
# Install root pnpm dependencies
pnpm install

# Start Postgres & MinIO in background
docker compose -f docker-compose.dev.yml up -d postgres minio

# Push database schema & seed admin
pnpm --filter @apkrunner/database db:push
pnpm --filter @apkrunner/database db:seed

# Start all workspaces (web + api)
pnpm dev
```

---

## 📋 API Specification

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Multipart APK upload, extracts metadata & icon, uploads to MinIO |
| `GET` | `/api/apps` | Paginated app catalog with search query filter |
| `GET` | `/api/apps/:id` | Detailed app overview with all build versions |
| `GET` | `/api/apps/:id/builds` | List all historical builds for an app |
| `POST` | `/api/sessions` | Initiates an execution session, generates presigned MinIO URL |
| `PATCH` | `/api/sessions/:id/end` | Marks active session as ended |
| `DELETE` | `/api/apps/:id` | Cascades deletion to builds and MinIO objects |
| `GET` | `/api/health` | Health check probe for container orchestrators |
| `GET` | `/api/admin/metrics` | Admin storage usage and user audit logs |

---

## 🔒 Security & Privacy

1. **Client Isolation**: APK bytecode is executed in WebAssembly memory boundaries without access to server filesystem or local OS.
2. **Virus Scanning**: Optional ClamAV daemon integration enabled via `ENABLE_VIRUS_SCAN=true`.
3. **Signed URLs**: APK downloads use short-lived presigned S3 URLs (15-minute expiration).
