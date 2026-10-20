# Job Tracker

## General Idea

A personal job-application tracker for organizing a job search in one place. Applications are grouped by status on a Kanban board. You can add and delete applications, search and filter them, sort the list, and drag applications between status columns.

## Demo

**GitHub Pages demo:** `placeholder`

![Job application illustration placeholder](client/src/assets/Job%20Application.png)

The public demo uses fictional sample data stored in the visitor's browser. It does not connect to the personal PostgreSQL database.

## Architecture

- **React client:** Kanban board, application form, details pages, filters, and sorting.
- **Data layer:** TanStack Query manages API requests and cache updates. Zustand stores demo data in browser localStorage.
- **Express API:** REST endpoints validate application data with Zod.
- **Database:** PostgreSQL, accessed through Prisma.
- **Demo deployment:** GitHub Actions builds the client in mock mode and publishes it to GitHub Pages. No backend credentials or personal database data are included.

## Used Tech Stack and Why

- **React and TypeScript:** Component-based UI with typed application data.
- **Vite:** Local development and production builds.
- **TanStack Query:** API request state, cache invalidation, and optimistic status updates.
- **Zustand:** Lightweight browser-local state for the standalone demo.
- **dnd-kit:** Drag-and-drop interactions for the Kanban board.
- **Tailwind CSS and shadcn/ui:** Consistent, reusable interface components.
- **Node.js and Express:** REST API for application data.
- **Zod:** Runtime validation of API input.
- **Prisma and PostgreSQL:** Typed database access and relational persistence.
- **GitHub Actions and GitHub Pages:** Automated deployment of the frontend-only demo.

## How to Run Locally

### Requirements

- Node.js 22 or later
- pnpm 12.8.1
- Docker Desktop

### Run with the local API and PostgreSQL

Install dependencies from the repository root:

```powershell
pnpm install
```

Create a root `.env` file for Docker Compose:

```env
POSTGRES_PASSWORD=local_jobtracker_password
```

Create `server/.env` with the same password in the database URL:

```env
DATABASE_URL="postgresql://jobtracker_user:local_jobtracker_password@localhost:5432/jobtracker?schema=public"
```

Start PostgreSQL and apply database migrations:

```powershell
docker compose up -d
pnpm --filter server exec prisma migrate dev --config prisma7.config.ts
```

Start the API and frontend in separate terminals:

```powershell
pnpm start-backend
```

```powershell
pnpm start-frontend
```

Open `http://localhost:5173`.

### Run the frontend-only demo locally

In PowerShell, set the mock-mode flag and start the frontend:

```powershell
$env:VITE_DEMO_MODE = 'true'
pnpm start-frontend
```

Demo changes are saved in the current browser's localStorage.

## AI Assistance

Developed with help from agentic AI for implementation support, debugging, and iteration. Technical decisions and final changes were reviewed by me.
