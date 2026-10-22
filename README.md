# Job Tracker

A personal job-application tracker for organizing a job search in one place. Applications are grouped by status on a Kanban board. You can add and delete applications, search and filter them, sort the list, and drag applications between status columns.

## Demo

**GitHub Pages demo:** Visit [demo](https://kamilfischbach.github.io/JobTracker/) to play with the app.

![Job application demo](demo.png)

The public demo uses fictional sample data stored in the visitor's browser. It does not connect to the personal PostgreSQL database.

## Architecture

- **Frontend:**
  - **React client:** Kanban board, application form, details pages, filters, and sorting.
  - **Data layer:** TanStack Query manages API requests and cache updates. Zustand stores demo data in browser localStorage.
- **Backend:**
  - **Express REST API:** REST endpoints validate application data with Zod.
  - **Database:** PostgreSQL ran using Docker, accessed through Prisma.

- **Demo deployment:** GitHub Actions builds the client in mock mode and publishes it to GitHub Pages. No backend credentials or personal database data are included.

## Techstack

- **React and TypeScript:** Component-based UI with typing.
- **Vite:** Local development and production builds.
- **TanStack Query:** API request state, cache invalidation, and status updates.
- **Zustand:** In-browser, local state management library for the demo.
- **dnd-kit:** Drag-and-drop interactions for the Kanban board.
- **Tailwind CSS and shadcn/ui:** Reusable personalized components.
- **Node.js and Express:** Backend with REST API.
- **Zod:** Runtime validation of API input.
- **Prisma and PostgreSQL:** Typed database access and relational persistence.
- **GitHub Actions and GitHub Pages:** Automated deployment of the frontend-only demo.

## Testing

The tests are split by scope so there are separate test for frontend and backend:

- **Frontend:** Vitest is used to perform unit testing of utility function such as search, filtering and sorting. Integration testing is conducted using Vitest, React Testing library and mocking with MSW to verify exisiting components and their interaction with services.
- **Backend:** Unit testing is done using Vitest that checks Zod request schemas and validation rules. Integration testing done using Vitest, Supertest, pg and Testcontainer libraries. It ensures correctness of HTTP status codes, validation, persitance and CRUD operations.

The test are run on push and on pull request to main: [Tests pipeline](https://github.com/kamilfischbach/JobTracker/actions/workflows/test.yml)

Run individual suites from the repository root:

```powershell
pnpm test:frontend:unit
pnpm test:frontend:integration
pnpm test:backend:unit
pnpm test:backend:integration
```

Run everything with `pnpm test`. Docker Desktop must be running for backend route integration tests; the other three suites do not require Docker or a local database.

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
pnpm start:backend
```

```powershell
pnpm start:frontend
```

Open `http://localhost:5173`.

### Run the frontend-only demo locally

In PowerShell, set the mock-mode flag and start the frontend:

```powershell
$env:VITE_DEMO_MODE = 'true'
pnpm start:frontend
```

Demo changes are saved in the current browser's localStorage.
