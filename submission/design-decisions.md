# Design Decisions and Tradeoffs

This document records decisions visible in the current implementation. It distinguishes the current small-team scope from production-scale alternatives.

## 1. React, TypeScript, and Vite frontend

**Decision**  
Use React 19 with TypeScript and Vite, with a single App.tsx composition module, small reusable components, and React hooks for local state.

**Why**  
The project needs an interactive dashboard, hierarchy view, Kanban board, forms, search, and notifications. React provides a direct component model, while TypeScript supplies typed API data and safer refactoring. Vite provides the local development server and /api proxy.

**Benefits**

- Browser UI is separated from REST/API concerns.
- Typed shapes in frontend/src/types.ts mirror the API data used by the client.
- Hooks keep state dependencies explicit without adding a state library.
- Vite keeps the local setup compact.

**Tradeoffs**

- App.tsx is a large feature-composition file rather than page-level modules.
- There is no router, query-cache library, or global store.
- Successful mutations generally refresh workspace data rather than performing fine-grained cache updates.

**Alternative and suitability**  
A routing library plus a data-fetching cache could improve larger applications. The current approach is appropriate for a limited assessment scope because it has few top-level views and a small component set.

## 2. Express REST API in a modular monolith

**Decision**  
Use one Express 5 server and JSON REST endpoints, with route handlers in backend/src/routes.ts.

**Why**  
The application needs browser-accessible CRUD/read-model endpoints and a worker that shares the same database. A single service is easy to run locally and makes project/task authorization close to the operation it protects.

**Benefits**

- Simple developer workflow: one backend process and one SQLite database.
- Stable resource-oriented endpoints for projects, stories, tasks, notifications, dashboard, search, and Kanban.
- Central application setup for CORS, body parsing, Swagger UI, and errors.

**Tradeoffs**

- The route module contains handlers and domain coordination rather than separate controller/use-case modules.
- Horizontal API/worker scaling is not addressed.
- REST response shapes are manually defined rather than generated from a shared OpenAPI-first contract.

**Alternative and suitability**  
A layered controller/service/repository structure, GraphQL, or separate services could be reasonable for a much larger system. The current modular monolith keeps the assessment runnable and understandable.

## 3. SQLite with Prisma

**Decision**  
Use SQLite through Prisma ORM.

**Why**  
SQLite removes the need to provision a database server and Prisma provides typed database access, relations, enum support, and constraints.

**Benefits**

- Local persistence with minimal setup.
- Schema is explicit in prisma/schema.prisma.
- Prisma queries avoid string-built SQL in application code.
- Unique constraints, indexes, and delete actions are declared near the model.

**Tradeoffs**

- SQLite is not intended for high write concurrency or multiple application instances.
- The repository uses prisma db push and does not include committed Prisma migrations.
- The seed script is destructive by design.

**Alternative and suitability**  
PostgreSQL with versioned Prisma migrations is the next appropriate choice for deployed or team-shared environments. SQLite plus schema push is suitable for a local internship assignment demo.

## 4. Project membership plus roles

**Decision**  
Use both role checks and ProjectMember rows.

**Why**  
A role answers what an account can do; membership answers which project data a non-admin account may access. The API uses membership-scoped Prisma queries and explicit project checks.

**Benefits**

- Non-admin users do not receive unrelated project data from project lists, dashboard, search, Kanban, story, or task routes.
- Managers may operate only in projects they belong to.
- Task assignment is restricted to members of the task's project.
- The creator becomes a member in the same transaction that creates a project.

**Tradeoffs**

- Membership management supports list/add through the API and a manager/admin Project Team panel; there is no remove-member endpoint.
- The current frontend does not expose a complete user-administration or invitation-management screen.
- Admin access is intentionally global.

**Alternative and suitability**  
A fuller organisation/team model with invitations, ownership, and removal policies would be appropriate later. The current join model directly addresses project-level access for this scope.

## 5. Custom signed bearer tokens with session version

**Decision**  
Use a custom HMAC-SHA256 signed token containing user ID, expiration, and sessionVersion. Passwords use salted Node scrypt hashes.

**Why**  
This provides stateless request tokens while preserving a way to invalidate existing tokens after logout, password change, or role change.

**Benefits**

- Password hashes are not returned by public-user responses.
- Tokens expire after eight hours.
- sessionVersion invalidates previous tokens without per-token storage.
- The current frontend sends bearer tokens consistently through one fetch wrapper.

**Tradeoffs**

- The format is application-specific, not a JWT implementation.
- The token is stored in sessionStorage and is therefore accessible to JavaScript in the tab.
- There is no refresh-token flow, multi-device session management, password reset, or account-verification flow.

**Alternative and suitability**  
HttpOnly secure cookies plus CSRF protection, refresh-token rotation, or managed identity/OIDC would be stronger production choices. The current mechanism is compact and demonstrable for the assignment.

## 6. Zod validation and standard errors

**Decision**  
Validate request bodies and task query parameters with Zod, and return consistent JSON errors via Express error middleware.

**Why**  
The API needs one server-side boundary for text lengths, enums, CUID values, dates, and required fields.

**Benefits**

- Invalid values return 400 rather than reaching persistence code.
- Validation errors include a field-error map.
- AppError gives routes explicit code/status/message responses.
- Prisma known unique errors are mapped to 409.

**Tradeoffs**

- Not every route body is represented by a Zod schema; user role update validates manually.
- Browser form validation is basic and does not render the server field-error map next to individual inputs.

**Alternative and suitability**  
A shared client/server contract or generated API SDK could remove duplication. Zod in the backend is sufficient and clear for the current repository.

## 7. Database-backed polling jobs for notifications

**Decision**  
Store assignment jobs in BackgroundJob and process them from an interval in the API process.

**Why**  
A task write should not depend on notification handling completing, and the database provides durable records across process restarts.

**Benefits**

- Task assignment and job insertion share a transaction.
- Job state, retry count, failure message, scheduling time, and stale lock are observable in the database.
- Claiming uses a conditional update to reduce duplicate claims.
- Notification.sourceJobId makes notification creation idempotent per job.
- Failed jobs retry up to maxAttempts, defaulting to three.

**Tradeoffs**

- The worker is not isolated from the API process.
- Polling has latency and no queue throughput controls.
- BackgroundJob payload is JSON text without database foreign keys.
- The retry strategy is simple linear seconds, not configurable exponential backoff.
- There is no operational UI or API for failed jobs.

**Alternative and suitability**  
A dedicated worker service with Redis/BullMQ, RabbitMQ, or a managed queue would fit higher scale. The database-backed queue is a useful, durable asynchronous pattern for a small self-contained project.

## 8. Server-computed dashboard, search, and Kanban read models

**Decision**  
Compute dashboard aggregates in the API and retrieve Kanban/search results from the database.

**Why**  
The UI should reflect persisted accessible records rather than duplicate business calculations in the client.

**Benefits**

- Metrics respect membership scoping.
- Search includes projects, stories, and tasks with context.
- Kanban groups current tasks by WorkStatus.
- The client stays relatively simple.

**Tradeoffs**

- Dashboard calculations fetch accessible tasks and aggregate in application memory.
- Search is simple database contains matching, not full-text search.
- There is no pagination in the current resource/list endpoints.

**Alternative and suitability**  
Database aggregation queries, full-text indexing, paginated endpoints, and cached read models would be appropriate at larger data volumes. The current approach is transparent and sufficient for small seeded data.

## 9. Vitest and Supertest integration coverage

**Decision**  
Use Vitest and Supertest to exercise the Express app against a disposable SQLite test database.

**Why**  
The critical value is verifying HTTP authorization, validation, key handling, and worker effects together.

**Benefits**

- Tests cover registration, login failure, logout token invalidation, role/membership boundaries, duplicate keys, member task restrictions, scoped dashboard/search, notification idempotency, retry, and stale-job recovery.
- testDatabase.ts copies prisma/dev.db to prisma/test.db and removes the test copy afterward, avoiding deletion of the active development database.
- Test files run sequentially to reduce SQLite collisions.

**Tradeoffs**

- There are six integration tests in one file, not broad unit or browser end-to-end coverage.
- Test setup depends on prisma/dev.db existing and being schema-compatible.
- No coverage threshold or CI pipeline is configured.

**Alternative and suitability**  
Separate unit tests, factory-based disposable schema setup, Playwright/Cypress browser tests, and CI would be stronger for production. The current suite targets the highest-risk application behaviours for the assignment.
