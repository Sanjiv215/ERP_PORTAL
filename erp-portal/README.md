# TheWoodWise

TheWoodWise is a multi-tenant ERP and operations platform for interior contractors, custom furniture businesses, carpentry workshops, and project-based field teams. It centralizes employee management, attendance, payroll, project tracking, financial documents, and tenant administration in a single workflow.

---

## Features

- Tenant-aware authentication and role-based access control
- Employee directory with project assignments and status management
- Attendance tracking and monthly payroll calculation
- Draft and finalized payroll runs with versioned recalculation logic
- Project-based profit and loss tracking
- Quotations, invoices, bills, pending payment aging, and document management
- Meetings, session tracking, and audit logging
- PostgreSQL-backed multi-tenant data model with Redis session support

---

## Tech Stack

- Frontend: React 19, Vite, React Router 7
- Backend: Node.js, Express 5, PostgreSQL, Redis
- Validation: Zod
- Security: JWT, cookie-based auth, bcrypt, AES-256-GCM encrypted employee fields
- Testing: Vitest

---

## Prerequisites

Before you start, make sure the following are available:

1. Node.js 20+ recommended
2. npm 10+
3. PostgreSQL 14+ or 15+ (this project is configured for PostgreSQL)
4. Redis 7+ for session cache and revocation support

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env
```

The project expects values such as:

- `PORT`
- `CLIENT_ORIGIN`
- `DATABASE_URL` or `PG_*` values
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64`
- `REDIS_URL`

For local development, a typical setup looks like this:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/contractoros
JWT_ACCESS_SECRET=replace_with_a_long_random_value
JWT_REFRESH_SECRET=replace_with_a_different_long_random_value
EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64=replace_with_32_byte_base64_key
REDIS_URL=redis://127.0.0.1:6379
```

You can generate the secrets with:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

### 3. Run database migration

```bash
npm run migrate
```

### 4. Start the app

```bash
npm run dev
```

This starts:

- API server on http://localhost:4000
- Vite frontend on http://localhost:5173

Open the app in your browser at:

```text
http://localhost:5173
```

---

## Demo setup

A demo tenant and admin user can be created with:

```bash
node server/src/db/seed_demo_account.js
```

This script creates a separate demo workspace and inserts a demo `TenantAdmin` account for the email `sanjiv@gmail.com`.

If you want a consistent password, set this variable before running the script:

```env
DEMO_ACCOUNT_PASSWORD=your_password_here
```

If it is not set, a random password is generated automatically for that run.

---

## Project structure

```text
LMS/
├── client/                        # React frontend
│   ├── public/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── pages/
│       ├── state/
│       └── styles.css
├── server/
│   └── src/
│       ├── config/
│       ├── constants/
│       ├── db/
│       ├── middleware/
│       ├── redis/
│       ├── repositories/
│       ├── routes/
│       ├── services/
│       ├── tests/
│       └── utils/
├── .env.example
├── package.json
├── vite.config.js
├── render.yaml
├── vercel.json
├── LICENSE
├── README.md
└── backups/
```

---

## Available scripts

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run preview
npm run start
npm run migrate
npm test
```

---

## Notes

- The backend validates environment variables at startup using Zod.
- The app uses tenant-scoped access patterns across repositories and routes.
- Role permissions are enforced server-side for admin, manager, accountant, and employee flows.
- Payroll and document flows are designed around production-grade business accounting needs.

---

## License

Proprietary — All Rights Reserved.

Copyright © 2026 TheWoodWise. Unauthorized reproduction, distribution, or deployment of this software is prohibited.
