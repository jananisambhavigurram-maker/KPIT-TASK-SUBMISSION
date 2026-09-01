# AgileFlow — Agile Project Management Tool

AgileFlow is a full-stack Agile work-management application created for a small software team workflow. It organises work as Project -> User Story -> Task, with role-aware access, project membership, dashboard metrics, a Kanban board, search, assignment notifications, and a durable background-job workflow.

This repository includes a KPIT internship-assignment documentation package. Start with the [submission index](submission/README.md).

## Project overview

The application supports a practical delivery workflow:

1. A manager/admin creates a project.
2. The creator is added as a project member.
3. Managers/admins add existing users through the Project Team panel, then create user stories and tasks in accessible projects.
4. Task assignee choices contain only users who belong to that project.
5. The recipient receives a persisted in-app notification after the worker processes the assignment job.
6. Members can update the status of tasks assigned to them; managers/admins can manage project work.
7. Users use dashboard, project, Kanban, search, and notification views to monitor the work.

Human-readable keys are stored alongside internal CUIDs:

~~~text
ECOM
ECOM-US-001
ECOM-T-001
~~~

## Key features

- Signup, login, logout, password change, and signed bearer-token authentication.
- ADMIN, MANAGER, and MEMBER roles with backend enforcement.
- Project membership scoping for non-admin project data, with a manager/admin Project Team panel to add members before assignment.
- Project, user-story, and task creation/update/delete routes.
- Global project/story/task search, computed dashboard metrics, and Kanban grouping.
- Task status, priority, due date, optional assignee, and project activity.
- Unique project/story/task keys and duplicate/similar-story handling.
- Persistent assignment jobs, notification creation, retry/failure state, stale-lock recovery, and per-job notification idempotency.
- Responsive React interface with validation feedback, loading states, notification panel, and Kanban rollback after a rejected update.
- Swagger UI and HTTP integration tests.

## Tech stack

| Area | Technology actually used |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express 5, TypeScript |
| Persistence | SQLite and Prisma 6 |
| Validation | Zod |
| Security middleware | Helmet and CORS |
| API explorer | swagger-jsdoc and swagger-ui-express |
| Test tooling | Vitest and Supertest |
| Background work | Database-backed polling worker in the API process |

## Architecture

~~~mermaid
flowchart LR
  B[React browser client] -->|REST /api| A[Express API]
  A --> P[Prisma]
  P --> D[(SQLite)]
  A -->|assignment job stored in transaction| D
  W[Polling worker] -->|claims job and creates notification| D
~~~

Detailed architecture, frontend/backend responsibilities, data flows, and worker behaviour: [docs/architecture.md](docs/architecture.md).

## Project structure

~~~text
backend/       Express API, validation, auth, services, worker, tests
frontend/      React/Vite application, API client, types, components, styles
prisma/        Prisma schema, local seed script, key-backfill script
docs/          Detailed technical documentation
submission/    KPIT submission index and detailed workflow/feature text
~~~

## Setup instructions

Prerequisite: Node.js 20 or newer.

~~~bash
npm install
copy .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
~~~

The frontend runs at http://localhost:5173 and the API at http://localhost:4000.

Run the production build:

~~~bash
npm run build
~~~

Run integration tests:

~~~bash
npm test
~~~

## Environment variables

The template is in [.env.example](.env.example).

| Variable | Purpose |
|---|---|
| DATABASE_URL | Prisma SQLite datasource URL. |
| PORT | Express port; default 4000. |
| CORS_ORIGIN | Allowed development/browser origin(s), comma-separated. |
| JOB_POLL_INTERVAL_MS | Worker polling interval; default 1000 ms. |
| JOB_STALE_AFTER_MS | Age after which PROCESSING jobs are requeued; default 60000 ms. |
| AUTH_SECRET | HMAC signing secret; must be at least 24 characters. |

Do not commit .env. It is ignored by .gitignore.

## Database setup and seed data

The Prisma schema is [prisma/schema.prisma](prisma/schema.prisma). This repository uses prisma db push; it does not contain a committed prisma/migrations directory.

~~~bash
npm run db:generate
npm run db:push
npm run db:seed
~~~

Warning: db:seed deletes and recreates local demonstration data. It creates admin, manager, and member accounts, projects, memberships, stories, tasks, activity, and a notification.

Demo password for all seeded accounts: DemoPass123!

| Role | Email |
|---|---|
| Admin | admin@agileflow.demo |
| Manager | manager@agileflow.demo |
| Member | alice@agileflow.demo |

The key backfill helper is intended only for older local data:

~~~bash
npm run db:backfill-keys
~~~

## API documentation

Swagger UI is available while the backend is running:

~~~text
http://localhost:4000/api-docs
~~~

The Swagger definition covers a useful subset of the routes. The complete code-checked endpoint reference is [docs/api.md](docs/api.md).

## Database schema

The complete model, field, relationship, index, and delete-behaviour documentation is [docs/database-schema.md](docs/database-schema.md).

## Async/background workflow and retry behaviour

Creating a task with an assignee, or changing a task assignee, writes the task and a TASK_ASSIGNED BackgroundJob in the same Prisma transaction. The in-process worker polls pending jobs, conditionally claims them, creates one notification per source job, and marks them complete.

A processing error stores lastError. The worker retries before the default maximum of three attempts, delaying each retry by attempts x 1000 ms. A job at the limit becomes FAILED. PROCESSING jobs left past JOB_STALE_AFTER_MS are returned to PENDING. This is an at-least-once processing design with idempotent notification insertion, not exactly-once processing.

More detail and a flow diagram: [docs/architecture.md](docs/architecture.md#6-asynchronous-assignment-notification-workflow).

## Security considerations

Implemented controls include salted scrypt password hashing, HMAC-signed expiring tokens, session-version invalidation, backend roles and project membership checks, Zod validation, Prisma database access, JSON request size limit, login rate limiting, CORS configuration, Helmet middleware, and safe error responses.

Important limitations are documented honestly: the frontend token is in sessionStorage, Helmet CSP is explicitly disabled, rate limiting is process-memory and login-only, there is no production deployment configuration, and the worker shares the API process.

Read the complete assessment: [docs/security.md](docs/security.md).

## Design decisions and tradeoffs

The rationale and limitations for React/Vite, Express REST, SQLite/Prisma, membership/RBAC, custom signed tokens, Zod, polling jobs, calculated read models, and tests are documented in [docs/design-decisions.md](docs/design-decisions.md).

## Testing

The repository has an HTTP integration suite at backend/src/app.test.ts. It covers:

- registration, invalid login, protected endpoints, and logout token invalidation;
- role and membership access boundaries;
- key generation, duplicate keys, similar stories, and invalid filters;
- MEMBER task-status-only restriction;
- membership-scoped dashboard/search;
- assignment-notification idempotency;
- retry-to-failure and stale-job recovery.

The Vitest global setup copies prisma/dev.db to a disposable prisma/test.db and removes the copy afterwards. The test setup therefore depends on a compatible local development database existing.

## Future improvements

Planned production-scale improvements are documented in [docs/future-improvements.md](docs/future-improvements.md). They include stronger account lifecycle controls, full membership management, collaboration features, sprint planning, PostgreSQL and versioned migrations, dedicated queue workers, browser E2E tests/CI, and deployment observability.

## AI usage

AI tools were used as development assistance for exploring implementation approaches, generating and improving boilerplate, debugging, reviewing security and workflow behaviour, proposing test cases, improving the interface, and producing documentation. Generated suggestions and code were reviewed, adapted to this repository, and checked through the available build/test commands. AI assistance does not replace the source-code and behaviour verification described in the documentation.

## Demo walkthrough

1. Run setup and seed commands, then open the frontend.
2. Sign in as manager@agileflow.demo with DemoPass123!.
3. Open Overview to see persisted metrics and progress.
4. Open a project to inspect its stories, tasks, activity, and status controls.
5. Open Kanban to see tasks grouped by TODO, IN_PROGRESS, and DONE. Managers/admins may drag cards.
6. Use global search to find accessible projects, stories, or tasks.
7. Open a project, add a user in the Project Team panel, then create/assign a task. The assignee will see that project/task after signing in and receives a worker-backed notification.
8. Sign in as a member to observe membership-scoped data and status-only updates for assigned tasks.

## Documentation index

- [Architecture notes](docs/architecture.md)
- [Complete API documentation](docs/api.md)
- [Documented database schema](docs/database-schema.md)
- [Design decisions and tradeoffs](docs/design-decisions.md)
- [Security considerations](docs/security.md)
- [Future improvements](docs/future-improvements.md)
- [KPIT submission package](submission/README.md)
- [Detailed workflows and features text file](submission/project-workflows-and-features.txt)
