# ERP Portal

ERP Portal is a modern, full-stack multi-tenant Enterprise Resource Planning and operations management platform. It centralizes employee management, attendance tracking, payroll calculation, project and site accounting, quotations, invoices, vendor bills, profit & loss analysis, and tenant administration in a unified workspace.

---

## Features

- **Multi-Tenant Architecture**: Complete data isolation across organizations with tenant-scoped routing and context.
- **Authentication & RBAC**: Secure JWT access & HTTP-only refresh tokens, bcrypt password hashing, and role-based permissions (`PlatformSuperAdmin`, `TenantAdmin`, `Manager`, `Accountant`, `Employee`).
- **Self-Registration**: Built-in signup workflow allowing new organizations to initialize their isolated workspace.
- **Employee Directory & Attendance**: Staff profiles, secure AES-256-GCM encrypted sensitive fields, daily attendance logging, and project assignments.
- **Salary & Payroll Engine**: Versioned payroll calculations, attendance-linked wage calculation, customizable overtime/multipliers, advance ledger deductions, and branded PDF payslips.
- **Financial Documents & Billing**: Branded Quotations & Invoices with PDF/Excel export, vendor bills tracking, aging receivables, and P&L analytics.
- **Meetings & Audit Trail**: Team meetings tracker and comprehensive system audit logging.

> [!NOTE]
> This repository is initialized **data-free** with empty database tables (only core system roles defined) and includes a temporary mock logo ready for customization.

---

## Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS, React Router 7, `@tanstack/react-query`, Lucide React
- **Backend**: Node.js, Express 5, PostgreSQL (`pg`), Redis (`ioredis`)
- **Validation & Security**: Zod, Helmet, CORS, Cookie-parser, AES-256-GCM, Bcrypt
- **Document Engines**: PDFKit (PDF generation), ExcelJS (Spreadsheets)
- **Testing**: Vitest with JSDOM

---

## Prerequisites

Before starting, ensure the following are installed:

1. **Node.js**: 20+ (ES Modules supported)
2. **npm**: 10+
3. **PostgreSQL**: 14+ (or Managed PostgreSQL on Render / Supabase / Neon)
4. **Redis**: 7+ (or Upstash Redis for cloud caching / session tracking)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in your configuration values:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/erp_portal
JWT_ACCESS_SECRET=replace_with_a_long_random_jwt_access_secret_min_32_chars
JWT_REFRESH_SECRET=replace_with_a_different_long_random_jwt_refresh_secret_min_32_chars
EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64=replace_with_32_random_bytes_base64_key==
REDIS_URL=redis://127.0.0.1:6379
```

Generate secure secrets using:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

### 3. Initialize Database & Run Migrations

```bash
npm run migrate
```

To reset all data to a clean state:

```bash
node server/src/db/reset_and_seed_user.js
```

### 4. Start Development Server

```bash
npm run dev
```

This starts:
- **API Server**: `http://localhost:4000`
- **Vite Web Frontend**: `http://localhost:5173`

Navigate to `http://localhost:5173` in your browser. You can click **Sign up** to create your first workspace and administrator account.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs both backend API and frontend dev server concurrently |
| `npm run dev:api` | Runs backend API server with nodemon auto-reloading |
| `npm run dev:web` | Runs Vite frontend development server |
| `npm run build` | Builds production frontend bundles to `dist/client` |
| `npm run start` | Runs the production backend Express server |
| `npm run migrate` | Executes PostgreSQL database migrations |
| `npm test` | Runs Vitest automated test suites |

---

## License

Copyright © 2026 ERP Portal. All rights reserved.
