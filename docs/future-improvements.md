# Future Improvements

The following improvements are not claimed as current functionality. They are reasonable next steps based on the implemented application and its current limits.

## Authentication and account lifecycle

- Move from sessionStorage bearer tokens to secure HttpOnly cookie sessions or a managed OIDC provider, with an appropriate CSRF design.
- Add password reset, email verification, account activation/deactivation, refresh-token/device management, and stronger login-abuse controls.
- Use a shared rate-limit store rather than the current process-memory login limit.

## Project membership and collaboration

- Extend the existing manager/admin Project Team panel with member removal, invitation, and project-ownership workflows.
- Add organisation/team boundaries and project-level permission administration.
- Add comments, attachments, @mentions, and a more comprehensive audit timeline.
- Add real-time updates for task movement and notifications using WebSocket/SSE infrastructure if needed.

## Agile workflow capability

- Add sprint planning, backlog ordering, story-point estimates, velocity/burndown reporting, and release views.
- Add richer task filters in the user interface; the task-list filter API exists but does not currently have a dedicated visual task-list screen.
- Add saved views, labels, task dependencies, and more complete project configuration.
- Improve duplicate-story handling in the UI by offering an explicit confirmation path for allowSimilar.

## User experience and accessibility

- Add a routing library so views have shareable URLs and browser history behaviour.
- Add per-field server validation messages, form pending states, and better recovery affordances for all mutations.
- Perform accessibility testing with keyboard/screen-reader tools and add tests for focus management in modals and drag-and-drop Kanban interactions.
- Localise date/time formatting and add timezone-aware due-date policy.

## Database, worker, and scalability

- Move from SQLite to PostgreSQL for concurrent/team-hosted deployments.
- Add versioned Prisma migrations and a non-destructive, repeatable test-schema setup; the current tests copy the local development database as their schema template.
- Separate the polling worker from the API process and use a production queue if throughput/reliability requirements grow.
- Add an operational view or API for FAILED jobs, manual retry, metrics, and alerting.
- Add pagination and database/full-text search improvements for large project/task volumes.

## Testing and quality

- Expand unit tests around token validation, validators, access helpers, key generation, and error branches.
- Add browser end-to-end tests for signup/login, role-based views, project/task workflow, Kanban rollback, search, and notifications.
- Add CI to run type checks, tests, builds, dependency audit, linting, and secret scanning on changes.
- Add coverage reporting and test-data factories.

## Deployment and operations

- Add containerisation or platform deployment configuration, environment validation at startup, and documented backup/restore procedures.
- Enforce HTTPS/HSTS and enable a tested Content Security Policy; the current application explicitly disables Helmet CSP.
- Add structured logging, error tracking, health/readiness checks suitable for deployment, and monitoring for API latency, failed jobs, and worker retries.
