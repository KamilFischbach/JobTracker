# Job Tracker

A personal job-application tracker for organizing a job search in one place. Applications are grouped by status on a Kanban board. You can add and delete applications, search and filter them, sort the list, and drag applications between status columns.

## Demo

**GitHub Pages demo:** Visit [demo](https://kamilfischbach.github.io/JobTracker/) to play with the app.

![Job application demo header and filters](demoScreenshots/demo1.png)
![Job application demo kanban board](demoScreenshots/demo2.png)

The public demo uses fictional sample data stored in the visitor's browser. It does not connect to the personal PostgreSQL database.

## Architecture

- **Frontend:**
  - **React client:** Kanban board, application form, details pages, filters, and sorting.
  - **Data layer:** TanStack Query manages API requests and cache updates. Zustand stores demo data in browser localStorage.
- **Backend:**
  - **Express REST API:** REST endpoints validate application data with Zod.
  - **AI import:** `POST /ai/parse-offer` downloads a job offer page and extracts its data with a local LLM (Ollama).
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
- **Zod:** Runtime validation of API input and of the LLM's answers.
- **Ollama (qwen2.5:7b):** Local LLM with JSON-schema structured output for the AI offer import.
- **Prisma and PostgreSQL:** Typed database access and relational persistence.
- **GitHub Actions and GitHub Pages:** Automated deployment of the frontend-only demo.

## AI import from a job offer link

Paste a job offer link in the **Add application** form and click **Fill with AI**. The app reads the offer and fills in the company, job title, salary, currency and notes (summary, location, work mode, contract type, technologies). You check the fields and save.

```mermaid
flowchart LR
    A[Offer link] --> B[Express API<br/>POST /ai/parse-offer]
    B --> C[Download page<br/>JSON-LD + visible text]
    C --> D[Local LLM in Ollama<br/>qwen2.5:7b]
    D --> E[Zod validation<br/>retry once if invalid]
    E --> F[Salary converted<br/>to monthly]
    F --> G[Form filled,<br/>user reviews and saves]
```

How it works:

- **Runs locally:** the model runs in [Ollama](https://ollama.com) on your machine, so offer data is not sent to an external AI service and it costs nothing.
- **Structured output:** one Zod schema describes the data. It is sent to Ollama as a JSON schema, so the model can only answer in that shape, and the same schema validates the answer. If the answer is invalid, the model gets its mistake and one more try.
- **Code does the maths:** the model copies salaries as written (per hour, day, month or year). The server converts them to monthly amounts, because small models make arithmetic mistakes.
- **The user stays in control:** nothing is saved automatically. If the model doubts the page is a single offer, the form shows a warning.
- **Blocked sites:** some job boards (e.g. LinkedIn) block automatic downloads or load offers with JavaScript. The form then asks you to paste the offer text, and the link is still saved.
- **Safe downloads:** the server only fetches public http(s) pages. Links to localhost or private network addresses are refused, with a 10-second timeout and a size limit.

Errors have clear codes for the client: `FETCH_FAILED` and `NOT_A_JOB_OFFER` (422), `AI_INVALID_OUTPUT` (502) and `AI_UNAVAILABLE` (503, e.g. Ollama is not running).

The AI import needs the local backend, so it is hidden in the GitHub Pages demo.

## Testing

The tests are split by scope so there are separate test for frontend and backend:

- **Frontend:** Vitest is used to perform unit testing of utility function such as search, filtering and sorting. Integration testing is conducted using Vitest, React Testing library and mocking with MSW to verify exisiting components and their interaction with services.
- **Backend:** Unit testing is done using Vitest that checks Zod request schemas and validation rules. The AI import is tested with a fake LLM: page parsing, blocked local addresses, salary conversion, retries after invalid answers and error codes. Integration testing done using Vitest, Supertest, pg and Testcontainer libraries. It ensures correctness of HTTP status codes, validation, persitance and CRUD operations.

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
- [Ollama](https://ollama.com) with a model, for the AI import (optional): `ollama pull qwen2.5:7b`

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

Optional AI settings in `server/.env` (these are the defaults):

```env
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:7b"
```

Without Ollama installed you can run it in Docker instead: `docker compose --profile ai up -d`, then `docker compose exec ollama ollama pull qwen2.5:7b`. A native install is faster on Windows, because it uses the GPU without extra setup.

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
