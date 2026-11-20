# Job Tracker

A personal job-application tracker for organizing a job search in one place. Applications are grouped by status on a Kanban board. You can add and delete applications, search and filter them, sort the list, and drag applications between status columns.

## Table of contents

- [Demo](#demo)
- [Architecture](#architecture)
- [Techstack](#techstack)
- [Accounts and security](#accounts-and-security)
- [AI import from a job offer link](#ai-import-from-a-job-offer-link)
- [Email automation with n8n](#email-automation-with-n8n)
- [Testing](#testing)
- [How to Run Locally](#how-to-run-locally)
  - [Run everything in Docker (one command)](#run-everything-in-docker-one-command)
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
  - **Accounts:** `/auth/*` handles sign-up with email confirmation, login, password reset and account deletion. Each user only sees their own applications.
  - **AI import:** `POST /ai/parse-offer` downloads a job offer page and extracts its data with an LLM: Groq in the cloud or a local Ollama model.
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
- **Groq (openai/gpt-oss-20b) or Ollama (qwen2.5:7b):** LLM with JSON-schema structured output for the AI offer import, hosted or local.
- **n8n:** Workflow automation connecting Gmail, the local LLM and the JobTracker API.
- **Prisma and PostgreSQL:** Typed database access and relational persistence.
- **GitHub Actions and GitHub Pages:** Automated deployment of the frontend-only demo.

## Accounts and security

Each account sees only its own applications. Reading or changing someone else's application answers **404**, as if it did not exist.

- **Sessions, not tokens in the browser:** login creates a session row in PostgreSQL and an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `__Host-session`. Scripts cannot read it, and the database stores only a SHA-256 hash of the token. Sessions last 30 days, and logging out, resetting or changing the password ends them.
- **Passwords:** Argon2id with OWASP's parameters, 12–128 characters, common passwords refused. No rules about digits or symbols (NIST guidance).
- **Sign-up with email confirmation:** the account is created only when the emailed link is opened. Until then the email and password hash wait in a single-use token, so nobody can register someone else's address first and choose its password.
- **No account enumeration:** sign-up and "forgot password" give the same answer for every address. The email itself says whether the address already has an account. Login gives one message for a wrong password and an unknown address, and takes as long either way.
- **Email links** are single-use, stored hashed, and expire (sign-up 24 hours, reset 30 minutes). The token is in the URL fragment (`#token=`), so it is not sent to the server in page requests or leaked through the `Referer` header.
- **Abuse protection:** Cloudflare Turnstile CAPTCHA on sign-up and "forgot password". Rate limits per client address: failed logins (also per email), emails sent, link openings, and all API requests.
- **CSRF:** besides `SameSite=Lax`, requests that change data are refused when the browser marks them as coming from another site (`Origin`, `Sec-Fetch-Site`).
- **Headers:** `helmet` (HSTS, `nosniff`, CSP, frame protection), no `X-Powered-By`, 200 kB body limit.
- **"Try the demo"** on the login page creates a temporary account per visitor with its own copy of the sample applications, so visitors never see each other's changes. It needs the CAPTCHA, is limited to 5 per address per day and 1,000 active demo accounts, ends after 24 hours (account, data and cookie), and logging out deletes it at once. Demo accounts cannot change a password or delete themselves, and have 3 AI imports per address per day.
- **Account deletion** removes the user with all applications and logged emails. Expired sessions, links and demo accounts are deleted every hour.

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/signup` | `{ email, password, captchaToken }` → 202, emails a confirmation link |
| `POST /auth/confirm-signup` | `{ token }` → 201, creates the account and logs in |
| `POST /auth/login` / `POST /auth/logout` | Start / end a session (logout deletes a demo account) |
| `POST /auth/demo` | `{ captchaToken }` → 201, temporary demo account, logged in |
| `GET /auth/me` | The logged-in user, or 401 |
| `POST /auth/forgot-password` | `{ email, captchaToken }` → 202, emails a reset link |
| `POST /auth/reset-password` | `{ token, password }` → 204, logs out everywhere |
| `POST /auth/password` | `{ currentPassword, newPassword }` → 204, logs out other sessions |
| `DELETE /auth/account` | `{ password }` → 204 |

Error codes: `UNAUTHENTICATED` and `INVALID_CREDENTIALS` (401), `WRONG_PASSWORD`, `INVALID_LINK` and `CAPTCHA_FAILED` (400), `DEMO_ACCOUNT` and `FORBIDDEN_ORIGIN` (403), `RATE_LIMITED` (429), `EMAIL_UNAVAILABLE` and `DEMO_UNAVAILABLE` (503).

## AI import from a job offer link

Paste a job offer link in the **Add application** form and click **Fill with AI**. The app reads the offer and fills in the company, job title, salary, currency and notes (summary, location, work mode, contract type, technologies). You check the fields and save.

How it works:

- **Two providers:** [Groq](https://groq.com) (`LLM_PROVIDER=groq`, free tier, used when hosted) or a local [Ollama](https://ollama.com) model (default in development; offer data stays on your machine). Both sit behind one small `LlmClient` interface; any OpenAI-compatible API works through the Groq client.
- **Structured output:** one Zod schema describes the data. It is sent to the model as a JSON schema (strict mode on Groq), so the model can only answer in that shape, and the same schema validates the answer. If the answer is invalid, the model gets its mistake and one more try.
- **Token budget:** Groq's free tier allows about 8,000 tokens per minute, so at most 8,000 characters of the offer are sent (`LLM_MAX_INPUT_CHARS`), a third of them for structured data.
- **Daily limits** (rolling 24 hours, `AI_LIMIT_*`): 20 imports per user, 3 per address for demo accounts, 50 for all demo accounts and 500 in total, below Groq's daily request limit. Only calls that reach the model count; when the provider is down the import is given back. Addresses are stored only as an HMAC (`IP_HASH_SECRET`), IPv6 per /64 network. The form shows how many imports are left (`GET /ai/usage`).
- **Code does the maths:** the model copies salaries as written (per hour, day, month or year). The server converts them to monthly amounts, because small models make arithmetic mistakes.
- **The user stays in control:** nothing is saved automatically. If the model doubts the page is a single offer, the form shows a warning.
- **Blocked sites:** some job boards (e.g. LinkedIn) block automatic downloads or load offers with JavaScript. The form then asks you to paste the offer text, and the link is still saved.
- **Safe downloads:** the server only fetches public http(s) pages. Links to localhost or private network addresses are refused, with a 10-second timeout and a size limit.

Errors have clear codes for the client: `FETCH_FAILED` and `NOT_A_JOB_OFFER` (422), `AI_LIMIT_REACHED` (429), `AI_INVALID_OUTPUT` (502) and `AI_UNAVAILABLE` (503, e.g. Ollama is not running or Groq is busy).

**The AI import needs the local backend, so it is hidden in the GitHub Pages demo.**

## Email automation with n8n

Recruiter emails update the board by themselves. An interview invitation in Gmail moves the card to **Interview**, a rejection to **Rejected**. Every email the automation reads appears under **Email activity** on the application's details page, with the AI's decision and reason.

The work is split on purpose:

- **n8n handles integration and AI:** it reads Gmail, asks the LLM to classify each email (application received, interview invitation, rejection, offer or not job related), extracts the company and job title, and labels the email in Gmail with the result.
- **The API owns the business rules:** it decides what a classification means for the tracker. That logic is TypeScript with unit and integration tests.

How the API handles an email:

- **Off by default:** the route exists only with `ENABLE_EMAIL_WEBHOOK=true`. Emails are matched against all applications in the database, whoever owns them, so enable it only when you are the only user.
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

### Run everything in Docker (one command)

Only Docker is needed (no Node.js or pnpm). The web container (Caddy) serves the built client and forwards `/api/*` to the API; the API applies pending database migrations on every start; PostgreSQL is reachable only from the API container.

1. Copy `.env.example` to `.env` in the repository root and set at least `POSTGRES_PASSWORD` (letters and digits) and, to log in straight away, `INITIAL_USER_EMAIL` and `INITIAL_USER_PASSWORD` (12+ characters). That account is created verified on the first start; later changes to these values don't change an existing account's password.
2. Start it:

   ```powershell
   docker compose -f compose.prod.yaml up -d --build      # or: pnpm start:prod
   ```

3. Open <http://localhost:8080> (`APP_PORT` changes the port).

| Task | Command |
|---|---|
| Logs (sign-up links are printed here unless Resend is set) | `docker compose -f compose.prod.yaml logs -f server` |
| Stop (data is kept) | `docker compose -f compose.prod.yaml down` (or `pnpm stop:prod`) |
| Update after `git pull` | run the start command again |
| Delete all data | `docker compose -f compose.prod.yaml down -v` |

- **AI import:** by default the API calls Ollama on your machine (`host.docker.internal:11434`). For Groq set `LLM_PROVIDER=groq` and `LLM_API_KEY`. To run Ollama in Docker too: add `--profile ai` to the start command, set `LLM_BASE_URL=http://ollama:11434`, then `docker compose -f compose.prod.yaml exec ollama ollama pull qwen2.5:7b`.
- **Local use only:** the port is bound to `127.0.0.1` and the server runs with the development rules (plain HTTP, console email, CAPTCHA only when `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` are set). The login cookie is `Secure`, which browsers accept over HTTP only on `localhost`, so opening the app from another device by IP address won't keep you logged in.
- It uses its own Compose project (`jobtracker-prod`), so its database is separate from the development one in `compose.yaml` and both can run at the same time.

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

In development, emails are printed in the API terminal (open the link from there) and the CAPTCHA is off. Optional settings in `server/.env`:

```env
APP_URL="http://localhost:5173"   # base of email links and the allowed Origin
TURNSTILE_SECRET_KEY=""           # unset: CAPTCHA off (required in production)
EMAIL_PROVIDER="console"          # or "resend" with RESEND_API_KEY and EMAIL_FROM (required in production)
TRUST_PROXY=0                     # number of reverse proxies in front of the API
```

The server checks these when it starts and refuses to run with `NODE_ENV=production` unless `APP_URL` is https and Turnstile and Resend are configured. The session cookie is `Secure`; Chrome, Edge and Firefox accept it on `http://localhost`, Safari does not.

AI settings in `server/.env`. Without them the local Ollama model is used:

```env
LLM_PROVIDER="groq"            # or "ollama" (default)
LLM_API_KEY="gsk_..."          # Groq API key from console.groq.com (needed for groq)
LLM_MODEL=""                   # default: openai/gpt-oss-20b (groq), qwen2.5:7b (ollama)
LLM_BASE_URL=""                # default: Groq's OpenAI-compatible API, or http://localhost:11434
LLM_MAX_INPUT_CHARS=""         # default: 8000 (groq), 24000 (ollama)
AI_LIMIT_PER_USER=20           # daily limits, see "AI import"
AI_LIMIT_PER_DEMO_IP=3
AI_LIMIT_DEMO_TOTAL=50
AI_LIMIT_TOTAL=500
IP_HASH_SECRET=""              # random, 32+ characters; required in production
```

Without Ollama installed you can run it in Docker instead: `docker compose --profile ai up -d`, then `docker compose exec ollama ollama pull qwen2.5:7b`. A native install is faster on Windows, because it uses the GPU without extra setup.

Start PostgreSQL and apply database migrations:

```powershell
docker compose up -d
pnpm --filter server exec prisma migrate dev --config prisma7.config.ts
```

Create the demo user `demo@jobtracker.local` with fictional applications. Its password is `DEMO_USER_PASSWORD` from `server/.env`, or a random one printed once when the user is created. `db:seed` adds the data only if the demo user has none; `db:seed:reset` replaces the demo user's data and leaves other users alone:

```powershell
pnpm --filter server db:seed
```

Every application belongs to a user. A database created before user accounts were added already has applications without an owner, and the migration stops on them. Recreate it (this deletes all local data):

```powershell
pnpm --filter server exec prisma migrate reset --config prisma7.config.ts
pnpm --filter server db:seed
```

Start the API and frontend in separate terminals:

```powershell
pnpm start:backend
```

```powershell
pnpm start:frontend
```

Open `http://localhost:5173` and log in as `demo@jobtracker.local`, or create an account. In development the confirmation link is printed in the API terminal.

**CAPTCHA (Cloudflare Turnstile).** Off locally unless both keys are set. To try it locally, use Cloudflare's test keys, which work on `localhost` and always pass (use them as a pair; the test secret rejects real tokens):

```env
# client/.env.local
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
# server/.env
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

For production, create a widget in the Cloudflare dashboard (**Turnstile → Add widget**, Managed mode, hostname = your domain; the domain does not have to use Cloudflare). The site key is public and is built into the client; the secret key goes only into the server's `.env`.

Optional client settings in `client/.env.local`:

```env
VITE_TURNSTILE_SITE_KEY=""     # Turnstile site key; unset = no CAPTCHA widget (matches the server)
VITE_EMAIL_AUTOMATION=true     # show "Email activity" (only with ENABLE_EMAIL_WEBHOOK on the server)
```

### Set up the email automation (optional)

n8n is opt-in. Start it with:

```powershell
docker compose --profile automation up -d
```

Open `http://localhost:5678` and, on the first visit, create the local n8n owner account.

1. **Enable the webhook.** It is off by default, because it matches emails against every user's applications and so only suits a single-user installation. Add this to `server/.env`, with a long random secret, and restart the API:

   ```env
   ENABLE_EMAIL_WEBHOOK=true
   WEBHOOK_API_KEY="<random secret>"
   ```

2. **Import the workflow.** In n8n: _Workflows → Import from file_ and pick `n8n/email-status-workflow.json`.
3. **Credentials in n8n:**
   - _Ollama_: base URL `http://host.docker.internal:11434`, used by the **Ollama** node.
   - _Header Auth_: name `X-Api-Key`, value = your `WEBHOOK_API_KEY`, used by **Send to JobTracker**.
4. **Test without Gmail.** Open the workflow and run **Test with sample emails**. With the demo data loaded, the Acorn Labs, Cedar Cloud and Birch AI cards move. For a demo with real Gmail, send the emails in [n8n/demo-emails.md](n8n/demo-emails.md).
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
