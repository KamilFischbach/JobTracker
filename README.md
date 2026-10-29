# Job Tracker

A personal job-application tracker for organizing a job search in one place. Applications are grouped by status on a Kanban board. You can add and delete applications, search and filter them, sort the list, and drag applications between status columns.

## Table of contents

- [Demo](#demo)
- [Architecture](#architecture)
- [Techstack](#techstack)
- [AI import from a job offer link](#ai-import-from-a-job-offer-link)
- [Email automation with n8n](#email-automation-with-n8n)
- [Testing](#testing)
- [How to Run Locally](#how-to-run-locally)
  - [Requirements](#requirements)
  - [Run with the local API and PostgreSQL](#run-with-the-local-api-and-postgresql)
  - [Set up the email automation (optional)](#set-up-the-email-automation-optional)
  - [Run the frontend-only demo locally](#run-the-frontend-only-demo-locally)

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
  - **Email webhook:** `POST /webhooks/email-status` receives classified recruiter emails from n8n and updates application statuses.
  - **Database:** PostgreSQL ran using Docker, accessed through Prisma.
- **Automation (optional):** n8n (Docker) reads Gmail, classifies emails with the local LLM and calls the email webhook.

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
- **n8n:** Workflow automation connecting Gmail, the local LLM and the JobTracker API.
- **Prisma and PostgreSQL:** Typed database access and relational persistence.
- **GitHub Actions and GitHub Pages:** Automated deployment of the frontend-only demo.

## AI import from a job offer link

Paste a job offer link in the **Add application** form and click **Fill with AI**. The app reads the offer and fills in the company, job title, salary, currency and notes (summary, location, work mode, contract type, technologies). You check the fields and save.

How it works:

- **Runs locally:** the model runs in [Ollama](https://ollama.com) on your machine, so offer data is not sent to an external AI service and it costs nothing.
- **Structured output:** one Zod schema describes the data. It is sent to Ollama as a JSON schema, so the model can only answer in that shape, and the same schema validates the answer. If the answer is invalid, the model gets its mistake and one more try.
- **Code does the maths:** the model copies salaries as written (per hour, day, month or year). The server converts them to monthly amounts, because small models make arithmetic mistakes.
- **The user stays in control:** nothing is saved automatically. If the model doubts the page is a single offer, the form shows a warning.
- **Blocked sites:** some job boards (e.g. LinkedIn) block automatic downloads or load offers with JavaScript. The form then asks you to paste the offer text, and the link is still saved.
- **Safe downloads:** the server only fetches public http(s) pages. Links to localhost or private network addresses are refused, with a 10-second timeout and a size limit.

Errors have clear codes for the client: `FETCH_FAILED` and `NOT_A_JOB_OFFER` (422), `AI_INVALID_OUTPUT` (502) and `AI_UNAVAILABLE` (503, e.g. Ollama is not running).

**The AI import needs the local backend, so it is hidden in the GitHub Pages demo.**

## Email automation with n8n

Recruiter emails update the board by themselves. An interview invitation in Gmail moves the card to **Interview**, a rejection to **Rejected**. Every email the automation reads appears under **Email activity** on the application's details page, with the AI's decision and reason.

The work is split on purpose:

- **n8n handles integration and AI:** it reads Gmail, asks the LLM to classify each email (application received, interview invitation, rejection, offer or not job related), extracts the company and job title, and labels the email in Gmail with the result.
- **The API owns the business rules:** it decides what a classification means for the tracker. That logic is TypeScript with unit and integration tests.

How the API handles an email:

- **Security:** n8n sends a shared secret in the `X-Api-Key` header (`WEBHOOK_API_KEY`), compared in constant time.
- **Each email once:** the Gmail message ID is unique in the database, so retries and re-reads change nothing.
- **Matching:** company names are compared without legal suffixes and accents (`Acorn Labs Sp. z o.o.` matches `Acorn Labs`). When a company has several applications, the job title decides.
- **No guessing:** if the match is unclear or the AI is less than 70% sure, nothing changes. The email is logged as _needs review_ and labelled `JobTracker/Review` in Gmail.
- **The board never moves backwards:**

| Email                | Moves the application from | To        |
| -------------------- | -------------------------- | --------- |
| Application received | Saved                      | Applied   |
| Interview invitation | Saved, Applied             | Interview |
| Rejection            | Saved, Applied, Interview  | Rejected  |
| Offer                | Saved, Applied, Interview  | Offer     |

- **Audit log:** every email is saved as an `EmailEvent` with the category, confidence, reason and status change. Email bodies are not stored.

The workflow is in [n8n/email-status-workflow.json](n8n/email-status-workflow.json). It includes a **Test with sample emails** trigger that runs four example emails through the same steps, without Gmail.

## Testing

The tests are split by scope so there are separate test for frontend and backend:

- **Frontend:** Vitest is used to perform unit testing of utility function such as search, filtering and sorting. Integration testing is conducted using Vitest, React Testing library and mocking with MSW to verify exisiting components and their interaction with services.
- **Backend:** Unit testing is done using Vitest that checks Zod request schemas and validation rules, and the email rules (company matching and status changes). The AI import is tested with a fake LLM: page parsing, blocked local addresses, salary conversion, retries after invalid answers and error codes. Integration testing done using Vitest, Supertest, pg and Testcontainer libraries. It ensures correctness of HTTP status codes, validation, persitance and CRUD operations, and of the email webhook: API key, duplicates, status updates and review cases.

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

### Set up the email automation (optional)

n8n is opt-in. Start it with:

```powershell
docker compose --profile automation up -d
```

Open `http://localhost:5678` and, on the first visit, create the local n8n owner account.

1. **API key.** Add a long random secret to `server/.env` and restart the API:

   ```env
   WEBHOOK_API_KEY="<random secret>"
   ```

2. **Import the workflow.** In n8n: _Workflows → Import from file_ and pick `n8n/email-status-workflow.json`.
3. **Credentials in n8n:**
   - _Ollama_: base URL `http://host.docker.internal:11434`, used by the **Ollama** node.
   - _Header Auth_: name `X-Api-Key`, value = your `WEBHOOK_API_KEY`, used by **Send to JobTracker**.
4. **Test without Gmail.** Open the workflow and run **Test with sample emails**. Add an application for "Acorn Labs" first to see a card move.
5. **Connect Gmail.** n8n needs permission to read and label your emails. Google gives that permission only to a registered app, so you register a small private app for yourself in [Google Cloud Console](https://console.cloud.google.com). This is free and done once.

   **a) Create a project and turn on Gmail access**
   1. In the top bar, open the project picker and click **New project**. Any name works, for example `JobTracker`. Select the project after it is created.
   2. Go to **APIs & Services → Library**, search for **Gmail API** and click **Enable**.

   **b) Describe the app and allow only yourself to use it**
   1. Go to **APIs & Services → OAuth consent screen** (newer consoles call it **Google Auth Platform**) and click **Get started**.
   2. Enter an app name (e.g. `JobTracker n8n`) and your email as the support and contact email.
   3. For the audience (user type), choose **External**. Leave the app in **Testing**; do not publish it.
   4. Under **Test users**, add your own Gmail address. Only test users can sign in to an app in Testing mode.

   **c) Create the login keys for n8n**
   1. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID** (or **Clients → Create client**).
   2. Application type: **Web application**.
   3. Under **Authorized redirect URIs**, add `http://localhost:5678/rest/oauth2-credential/callback`. This is where Google sends you back to n8n after you sign in.
   4. Click **Create** and copy the **Client ID** and **Client secret**.

   **d) Sign in from n8n**
   1. In n8n, go to **Credentials → Add credential → Gmail OAuth2 API**.
   2. Paste the Client ID and Client secret, click **Sign in with Google** and pick the Gmail address you added as a test user.
   3. Google warns that the app is not verified. That is expected for your own private app: click **Continue** and allow access.
   4. Open the workflow and select this credential in the **New Gmail email** node and in the three nodes whose names start with **Gmail:**.

   In Testing mode Google ends the sign-in after 7 days. When the workflow stops reading emails, open the credential in n8n and click **Sign in with Google** again.

6. **Publish** the workflow (top right in the editor). New emails are checked every minute.

### Run the frontend-only demo locally

In PowerShell, set the mock-mode flag and start the frontend:

```powershell
$env:VITE_DEMO_MODE = 'true'
pnpm start:frontend
```

Demo changes are saved in the current browser's localStorage.
