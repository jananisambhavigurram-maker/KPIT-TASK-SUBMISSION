# Architecture Notes

## 1. Project overview

AgileFlow is a full-stack Agile work-management application for a small software team. It gives authenticated users one place to organise delivery work, track progress, view a Kanban board, search accessible work, and receive task-assignment notifications.

The central delivery hierarchy is Project -> User Story -> Task. A project has a unique human-readable key such as ECOM. A story belongs to one project and normally receives a key such as ECOM-US-001. A task belongs to one story and normally receives a key such as ECOM-T-001. Tasks hold status, priority, optional assignee, and optional due date.

Users sign up or log in, then work in a React workspace with Overview, Projects, and Kanban tabs. Managers and admins can create and manage project work; project membership controls which projects non-admin users can see. Members can change the status of tasks assigned to them. The UI also exposes project progress, status/priority summaries, search results, notifications, and recent project activity.

## 2. High-level architecture

AgileFlow is a TypeScript modular monolith. It has one browser client, one Express API process, one SQLite database accessed through Prisma, and an in-process polling worker started by the API server.

~~~mermaid
flowchart LR
  B[Browser] --> F[React + Vite client]
  F -->|JSON REST + Bearer token| A[Express API]
  A -->|Prisma Client| D[(SQLite)]
  A -->|creates BackgroundJob in task transaction| D
  W[Polling worker in API process] -->|claims/processes jobs| D
  W -->|creates Notification| D
~~~

The frontend proxies /api requests to http://localhost:4000 during local Vite development. The server mounts the API at /api and Swagger UI at /api-docs.

## 3. Frontend architecture

### Technology and structure

The frontend is React 19 with TypeScript and Vite. There is no routing library or external state-management library. frontend/src/App.tsx is the main feature-composition file and keeps page-level state with React useState and useEffect.

| File | Responsibility |
|---|---|
| frontend/src/main.tsx | Mounts React in strict mode and imports global styles. |
| frontend/src/App.tsx | Login/signup, workspace state, dashboard, project view, Kanban, search, notifications, and forms. |
| frontend/src/services/api.ts | Fetch wrapper, API functions, typed error wrapper, and token storage. |
| frontend/src/types.ts | Client-side TypeScript shapes for API data. |
| frontend/src/components/Modal.tsx | Reusable form modal shell. |
| frontend/src/components/StatusPill.tsx | Reusable status/priority label. |
| frontend/src/styles.css | Responsive visual system and component styles. |

### API communication and state

api.ts calls relative /api endpoints with fetch. When a token is present, it adds Authorization: Bearer <token>. It stores that token in browser sessionStorage, so it survives a refresh in the same tab but not a browser-session restart. A non-2xx response is converted into ApiError, which includes status and server error code when available.

App.tsx loads the current user from /auth/me when a saved token exists. The workspace loads projects, dashboard data, users for managers/admins, and notifications in parallel. The project detail is fetched after project selection. There is no client cache library; a successful mutation calls the workspace refresh function.

### Forms, validation, and feedback

Forms use native React form events and FormData, not a form library. Inputs supply browser-side required, minLength, and maxLength attributes. The authoritative validation is on the server via Zod. API errors are displayed in the workspace banner or login form; loading states include a startup check, dashboard skeletons, and Kanban loading text. Kanban updates optimistically and restores the preceding board state if the task update fails.

The user interface intentionally does not duplicate every API endpoint. The API has user administration, password change, task-list filtering, and project-member endpoints that are not all exposed as dedicated screens in the current client.

## 4. Backend architecture

The backend is Node.js TypeScript using Express 5 and Prisma.

| Layer/file | Actual responsibility |
|---|---|
| backend/src/server.ts | Loads environment variables, starts Express, starts/stops the worker, and disconnects Prisma on SIGINT/SIGTERM. |
| backend/src/app.ts | Applies Helmet, CORS, JSON body limit, Swagger UI, API router, and final error middleware. |
| backend/src/routes.ts | Single Express route module containing route handlers, project/task access helpers, aggregation helpers, and transaction boundaries. There is no separate controller directory. |
| backend/src/auth.ts | Password hashing/verification, custom HMAC token signing/verification, authentication middleware, role middleware, and safe-user projection. |
| backend/src/validators.ts | Zod request schemas and task-query schema. |
| backend/src/errors.ts | AppError, async wrapper, and standard JSON error responses. |
| backend/src/db.ts | Shared Prisma client. |
| backend/src/services/activityService.ts | Creates project activity rows. |
| backend/src/services/jobService.ts | Enqueues, claims, retries, recovers, and completes durable assignment jobs. |
| backend/src/services/loginRateLimit.ts | Process-memory IP-based limit for the login endpoint. |
| backend/src/workers/worker.ts | Starts one interval that processes jobs and performs stale-job recovery. |
| backend/src/swagger.ts | Defines the currently exposed Swagger/OpenAPI document. |

All routes except health, registration, and login are protected by requireAuth. Route helpers check both project membership and role where necessary. Prisma is used for all database access.

## 5. Concrete data flows

### Create a project

1. A manager or admin submits the project modal in React.
2. The client sends POST /api/projects with JSON and the bearer token.
3. projectInput validates the name, optional key, description, and status.
4. The route checks the user role and unique key.
5. A Prisma transaction creates the Project, a ProjectMember record for the creator, and a PROJECT_CREATED activity row.
6. The API returns a data envelope containing the project.
7. The UI refreshes projects and dashboard data and shows a toast.

### Create or update a task

1. A manager/admin sends task data to POST /api/stories/:storyId/tasks or PUT /api/tasks/:id.
2. The API validates task data, verifies project access, and verifies that any assignee is a member of that project.
3. The API writes the task in a Prisma transaction. A newly assigned task or a changed assignee creates a TASK_ASSIGNED background-job row in the same transaction.
4. Status changes create an Activity row.
5. The response returns the task with safe assignee data. The frontend refreshes and displays the changed workflow state.

For a member, the update endpoint additionally verifies that the task is assigned to that member and that all fields other than status are unchanged.

### Search and dashboard

The client debounces global search by 250 ms. GET /api/search?q=... searches accessible project keys/names, story keys/titles, and task keys/titles. GET /api/dashboard computes accessible project/story/task totals and status/priority distributions from database records. The dashboard is not populated from static fixture data.

## 6. Asynchronous assignment-notification workflow

Task-assignment notification creation is asynchronous so the task write can return without waiting for separate notification processing.

~~~mermaid
flowchart TD
  A[Manager/admin creates task or changes assignee] --> B[Express task route]
  B --> C[Validate input, membership, and role]
  C --> D[Prisma transaction]
  D --> E[Task write]
  D --> J[BackgroundJob: TASK_ASSIGNED, PENDING]
  J --> F[Polling worker]
  F --> G[Atomically claim as PROCESSING and set lockedAt]
  G --> H{Task still assigned to target user?}
  H -- No --> I[Mark job COMPLETED]
  H -- Yes --> K{Notification for sourceJobId exists?}
  K -- No --> L[Create Notification]
  K -- Yes --> M[Skip duplicate]
  L --> N[Mark job COMPLETED]
  M --> N
  G --> O[Processing error]
  O --> P{Attempts reached maxAttempts?}
  P -- No --> Q[Return to PENDING with delayed runAfter]
  P -- Yes --> R[Mark FAILED and store lastError]
~~~

### Actual behaviour

- Trigger: task creation with assignedToId, or task update that changes assignedToId.
- Job storage: BackgroundJob records use type, JSON payload, status, attempts, maxAttempts, runAfter, and lockedAt.
- Claiming: processNextJob finds the oldest due pending job, then uses updateMany with a pending-status condition to claim it. This reduces double-processing when two calls see the same job.
- Success: for TASK_ASSIGNED, the worker checks that the task still exists and is still assigned to the payload user. If so, it creates a notification only when no notification already has the job ID in sourceJobId, then marks the job COMPLETED.
- Stale assignment: if the task was deleted or reassigned, the job is marked COMPLETED without creating a notification.
- Failure and retry: an error increments attempts. Before the default maximum of three attempts, the job is returned to PENDING with runAfter delayed by attempts x 1000 ms. At or beyond maxAttempts it becomes FAILED and stores lastError.
- Stale lock recovery: when the worker starts, jobs that remain PROCESSING past JOB_STALE_AFTER_MS (default 60 seconds) are returned to PENDING with the lock cleared. The worker source does not schedule this recovery on each later interval tick.
- Idempotency: Notification.sourceJobId is unique, so the same background job cannot create more than one notification. This is at-least-once job processing with idempotent notification insertion; it is not a claim of exactly-once delivery.

The worker is an interval in the same API process, controlled by startWorker and stopWorker. It is not a separate queue service or separate deployed worker process.

## 7. Project structure

~~~text
AGILE_MODEL/
├── backend/
│   ├── src/                 Express app, routes, auth, services, worker, tests
│   ├── package.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/                 React app, API client, types, components, styles
│   ├── package.json
│   └── vite.config.ts
├── prisma/
│   ├── schema.prisma        SQLite models, enums, relations, indexes
│   ├── seed.ts              Local demo reset and data seed
│   └── backfill-keys.ts     Key backfill helper for older local data
├── docs/                    Technical documentation
├── submission/              KPIT submission index and detailed workflow text
├── .env.example             Required runtime configuration template
├── .gitignore               Ignored secrets, databases, build output, caches
├── package.json             Workspaces and root scripts
└── README.md                Setup and documentation entry point
~~~

There is no prisma/migrations directory in the repository. The database workflow uses prisma db push, not committed migration files.
