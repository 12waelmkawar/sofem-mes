# SOFEM MES - Manufacturing Execution System

Complete manufacturing management system for SOFEM (metal fabrication company in Sfax, Tunisia).

## Tech Stack

**Frontend:**
- React 18+ with Vite 5+
- TypeScript (strict mode)
- React Router v6 (hash-based routing)
- Tailwind CSS 3+ with custom design tokens
- TanStack Query + Zustand
- React Hook Form + Zod

**Backend:**
- Node.js 20+ with Express 4
- TypeScript (ES2022, ESM modules)
- PostgreSQL 14+
- JWT authentication (HttpOnly cookies)
- Zod validation

**Infrastructure:**
- Docker Compose (PostgreSQL 16, optional Redis)
- Vercel deployment ready

## Project Structure

```
sofem-mes/
├── frontend/              # React + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx      # Entry point
│   │   ├── App.tsx       # Root component
│   │   └── index.css     # Global styles with Tailwind
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend-ts/            # Express + TypeScript
│   ├── src/
│   │   ├── index.ts      # Express server with /api/health
│   │   └── db/
│   │       └── pool.ts   # PostgreSQL connection pool
│   ├── db/init/          # Database initialization scripts
│   ├── tsconfig.json
│   └── package.json
├── docker-compose.yml     # PostgreSQL 16 + Redis (optional)
├── package.json           # Workspace root
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for database)
- npm

### Installation

1. **Clone the repository**
```bash
cd sofem-mes
```

2. **Install dependencies**
```bash
npm install
```

3. **Start database**
```bash
npm run db:up
```

4. **Copy environment files**
```bash
cp backend-ts/.env.example backend-ts/.env
```

5. **Run database migrations** (when available)
```bash
npm run db:migrate
```

### Development

**Run both frontend and backend:**
```bash
npm run dev
```

**Run individually:**
```bash
# Backend only (port 8000)
npm run dev:backend

# Frontend only (port 5173)
npm run dev:frontend
```

**With Docker:**
```bash
# Start all services
docker-compose up -d

# Start without Redis (optional)
docker-compose --profile optional down
docker-compose up -d
```

### API Endpoints

- **Health Check:** `http://localhost:8000/api/health`
- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:8000`

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Color System

The application uses CSS custom properties for theming (see spec section 3):

- `--red`, `--red-d`, `--red-g`: Primary brand colors
- `--bg`, `--bg2`, `--bg3`: Background hierarchy
- `--green`, `--blue`, `--accent`: Status colors
- `--muted`: Secondary text

Light/dark theme切换 via `.light` class on root element.

## Typography

Three font families (spec section 2):
- **Bebas Neue**: Logo, headers, KPIs
- **IBM Plex Mono**: Codes, badges, timestamps
- **IBM Plex Sans**: Body text, forms, tables

## Database

### Neon (Recommended for Production)

This project is **fully compatible with Neon** (serverless PostgreSQL).

**Setup:**
1. Create a Neon project at https://neon.tech
2. Create a database named `sofem_mes`
3. Copy your Neon connection string (includes `?sslmode=require`)
4. Update your `.env`:
```bash
DATABASE_URL=postgresql://user:pass@ep-xxx-yyy.region.aws.neon.tech/sofem_mes?sslmode=require
```

**Neon-specific features enabled:**
- ✅ SSL auto-detection (always on for Neon)
- ✅ Connection pool limits (8 max for Neon, 20 for local)
- ✅ Cold start handling (15s timeout for compute wake-up)
- ✅ PgBouncer compatible (no prepared statements issues)
- ✅ Connection error recovery (no process exit on errors)

### Local Development (Docker)

```bash
# Start PostgreSQL 16 locally
npm run db:up

# Run migrations
npm run migrate:up
```

PostgreSQL 16 with the following tables (29 total):
- users, clients, operateurs, produits, materiaux
- ordres_fabrication, of_operations, of_bom, op_operateurs
- bom, mouvements_stock, document_sequences
- bons_livraison, demandes_achat, bons_commande, bc_lignes
- bons_reception, br_lignes, factures_achat
- machines, maintenance_orders, planning_slots
- controle_qualite, non_conformites, fournisseurs
- materiau_fournisseurs, operation_types, settings, activity_log_v2

## User Roles

1. **ADMIN**: Full system access
2. **MANAGER**: Management access
3. **OPERATOR**: Production floor access

## Next Steps

- [ ] Database schema creation (29 tables)
- [ ] Authentication system (PIN + JWT)
- [ ] Admin dashboard pages
- [ ] Operator dashboard
- [ ] API routes and controllers
- [ ] Shared UI component library
- [ ] PDF generation (invoices, delivery notes)
- [ ] Quality control module
- [ ] Analytics and reporting

## License

SMARTMOVE - 2025
