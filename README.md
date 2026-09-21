#  KisanSlot / FarmQueue — Farmer Procurement Queue & Slot Management Platform

> **Smart India Hackathon 2026**  
> **Problem Statement ID**: 26032  
> **Ministry**: Ministry of Consumer Affairs, Food & Public Distribution  
> **Theme**: Agriculture, Foodtech & Rural Development  

---

##  Overview

**KisanSlot** is an enterprise-grade digital procurement queue and slot scheduling platform engineered to eliminate chaotic physical queues, long waiting times, and crop distress sales at Minimum Support Price (MSP) grain procurement centres across India.

### Core Objectives:
1. **Dynamic Slot Booking**: Farmers can reserve time slots for grain delivery based on daily centre capacity and crop type.
2. **Real-time Queue Management**: Live token tracking and wait-time estimation via WebSockets (Django Channels).
3. **Automated Reminders & Alerts**: Scheduled notifications for slot confirmations, weather advisories, and document readiness via Celery Beat.
4. **Bilingual Accessibility**: Multi-language support (English & Hindi) powered by `next-intl`.
5. **Secure Authentication**: Role-based access control (Farmers, Centre Officials, Admin) using JWT (`djangorestframework-simplejwt`).

---

##  Architecture & Technology Stack

```
+-----------------------------------------------------------------------+
|                             Docker Network                            |
|                                                                       |
|   +-----------------------+              +-----------------------+    |
|   |   Next.js 15 Frontend | <----------->|   Django 5.x Backend  |    |
|   |  (React 19, TS, TW)   |   HTTP/WS    |   (Daphne ASGI Server)|    |
|   |     Port: 3000        |              |       Port: 8000      |    |
|   +-----------------------+              +-----------------------+    |
|                                                      |                |
|                                        +-------------+-------------+  |
|                                        |                           |  |
|                             +--------------------+     +--------------------+
|                             |   PostgreSQL 16    |     |      Redis 7       |
|                             |     Port: 5432     |     |   Broker/Channels  |
|                             +--------------------+     +--------------------+
|                                                                    |  |
|                                        +---------------------------+  |
|                                        |                              |
|                             +--------------------+     +--------------------+
|                             |   Celery Worker    |     |    Celery Beat     |
|                             |  (Async Tasks)     |     |  (Periodic Tasks)  |
|                             +--------------------+     +--------------------+
+-----------------------------------------------------------------------+
```

### Backend (`/backend`)
- **Framework**: Django 5.1.x with Daphne ASGI server
- **REST & Auth**: Django REST Framework (DRF) + `djangorestframework-simplejwt`
- **Real-time WebSockets**: Django Channels with Redis Channel Layer (`channels-redis`)
- **Background & Periodic Workers**: Celery + Celery Beat + Redis
- **Database**: PostgreSQL 16
- **Config & Secrets**: `python-decouple`

#### Modular Django Apps:
- `accounts`: User authentication, KYC verification, farmer profiles, and role management.
- `centres`: Procurement centre directory, storage capacity, daily quotas, and grain types.
- `bookings`: Slot booking engine, time-window allocation, and cancellation workflows.
- `queue_app` (`queue`): Dynamic token issuance, real-time queue ordering, and live gate status.
- `notifications`: Multi-channel SMS/WhatsApp notification triggers and delivery tracking.

---

###  Frontend (`/frontend`)
- **Framework**: Next.js 15 (App Router) + TypeScript + React 19
- **Styling & UI**: Tailwind CSS + shadcn/ui component architecture
- **Internationalization**: `next-intl` (English `en` & Hindi `hi`)
- **Typed API Client**: Centralized, type-safe API fetch wrapper (`lib/api.ts`)
- **Route Groups**:
  - `app/(farmer)/`: Farmer-facing portal for booking, live queue tracker, and history.
  - `app/(admin)/`: Centre manager and administration dashboard for capacity & queue control.

---

##  Repository Structure

```
.
├── backend/
│   ├── core/                   # Django project configuration (settings, urls, asgi, wsgi, celery)
│   ├── accounts/               # User and farmer profile management
│   ├── centres/                # Procurement centres and intake quotas
│   ├── bookings/               # Slot reservations and scheduling
│   ├── queue_app/              # Live queue engine and token ordering
│   ├── notifications/          # Alert dispatcher and reminder queues
│   ├── manage.py
│   ├── requirements.txt        # Pinned Python dependencies
│   ├── Dockerfile              # Backend container definition
│   └── .env.example            # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (farmer)/       # Farmer route group
│   │   │   ├── (admin)/        # Admin dashboard route group
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Homepage with backend health-check display
│   │   ├── components/         # UI components & shadcn widgets
│   │   ├── messages/           # i18n translation files (en.json, hi.json)
│   │   ├── i18n/               # next-intl configuration & routing
│   │   └── lib/
│   │       ├── api.ts          # Typed API fetch wrapper
│   │       └── utils.ts        # Common utility helpers
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── Dockerfile              # Frontend container definition
│   └── .env.local.example      # Frontend environment template
├── docker-compose.yml          # Multi-container orchestration (6 services)
├── .env.example                # Root environment template
├── .gitignore                  # Combined Python, Node & Docker gitignore
└── README.md                   # Project documentation
```

---

## Quick Start (Run with One Command)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose v2+)

### 1. Clone & Configure
```bash
# Copy the environment file
cp .env.example .env
```

### 2. Start the Entire Stack
```bash
docker-compose up --build
```
*To run in detached (background) mode, append `-d`: `docker-compose up --build -d`*

---

## Service URLs & Access Points

| Service | URL | Description |
|---|---|---|
| **Frontend Portal** | [http://localhost:3000](http://localhost:3000) | Next.js 15 Web Application |
| **Backend API Root** | [http://localhost:8000/api/](http://localhost:8000/api/) | Django REST Framework API |
| **Health Check API** | [http://localhost:8000/api/health/](http://localhost:8000/api/health/) | System health & status endpoint |
| **Django Admin Panel**| [http://localhost:8000/admin/](http://localhost:8000/admin/) | Administration interface |
| **JWT Token Obtain** | [http://localhost:8000/api/auth/token/](http://localhost:8000/api/auth/token/) | POST username & password |
| **JWT Token Refresh**| [http://localhost:8000/api/auth/token/refresh/](http://localhost:8000/api/auth/token/refresh/) | POST refresh token |
| **PostgreSQL Database**| `localhost:5432` | DB: `kisan_procure_db` |
| **Redis Broker** | `localhost:6379` | Cache, Channels & Celery broker |

---

##  Local Development (Without Docker)

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Security & Environment Variables

Key environment variables in `.env`:
- `SECRET_KEY`: Django secret key
- `DEBUG`: Set to `True` for development, `False` in production
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: PostgreSQL credentials
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`: Redis connection settings
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL`: Backend URL accessed from client browser

---

##  SIH 2026 Team & Submission
- **Platform**: KisanSlot Procurement System
- **Problem Statement**: 26032
- **Ministry**: Ministry of Consumer Affairs, Food & Public Distribution
