# Security Considerations

This is an implementation-focused security review. It describes what is present, what is absent or limited, and what should change before a production deployment. It does not claim that the application is fully production-secure.

## Authentication and passwords

### Implemented

- Account passwords are salted with 16 random bytes and hashed with Node's scrypt function using a 64-byte derived value.
- Password verification uses timingSafeEqual after length checking.
- Password hashes are removed by publicUser before user data is sent in normal auth/user responses.
- The signed token has a user ID, sessionVersion, and eight-hour expiry. It is signed with HMAC-SHA256 using AUTH_SECRET.
- requireAuth verifies the token signature and expiry, then loads the user from the database and compares sessionVersion.
- Logout, password changes, and admin role changes increment sessionVersion, invalidating older tokens for that account.
- AUTH_SECRET is required to be at least 24 characters; the server throws if it is absent/too short when token operations occur.
- The frontend stores its token in sessionStorage rather than localStorage.

### Limitations

- The token format is custom and is not an established JWT/OIDC implementation.
- sessionStorage is readable by JavaScript running in the page. An XSS compromise could steal it.
- There is no refresh token, password reset, email verification, account lockout, or multi-device session view.
- No password-complexity rule beyond 8-128 characters is enforced.
- Demo passwords are intentionally documented for local seed data. They must not be used in a deployment.

### Production improvements

- Prefer secure, HttpOnly, SameSite cookies plus an explicit CSRF design, or use a mature managed identity/OIDC provider.
- Add password reset and verification flows, breach/password policy checks, session/device management, and stronger login-abuse controls.
- Rotate secrets through a secrets manager and revoke compromised sessions centrally.

## Authorization and data access

### Implemented

- All API routes after registration/login use requireAuth.
- allowRoles enforces ADMIN, MANAGER, and MEMBER role boundaries.
- Project access uses ProjectMember for non-admin accounts. The project list, project detail, stories, tasks, dashboard, search, and Kanban routes apply membership access checks.
- The API verifies project membership before a user can be assigned to a task.
- Members can only update the status of a task assigned to themselves; non-status field changes are rejected.
- Only admins can create users, change roles, or delete projects. Managers/admins can manage accessible project work.
- Notification ownership is checked before marking a notification read, except that admins may do so.

### Limitations

- There is no organisation-level tenancy model, invitation flow, or member-removal endpoint.
- Admins can access all projects by design.
- Some role/membership endpoints are not surfaced in the UI, which can make administration less discoverable but does not weaken backend enforcement.
- Activity.actorId is not a database foreign key, so referential integrity for that optional field is not enforced by the schema.

### Production improvements

- Define organisation ownership, project ownership, member removal, invitation, and admin-delegation policies.
- Add audit events for permission/role changes and destructive actions.
- Consider explicit authorization tests for every new route as part of CI.

## Input validation, database access, and errors

### Implemented

- Zod validates project, story, task, registration, login, password, user-create, and task-filter input.
- Validation covers required values, string lengths, enumerations, email format, CUID structure for relevant IDs, nullable dates, and key formats.
- Prisma ORM is used for all application database access; the code does not build SQL strings from request data.
- Unique database constraints protect emails, project/story/task keys, project membership pairs, and notification source job IDs.
- The error middleware maps Zod errors to 400, Prisma unique errors to 409, known application errors to their explicit safe responses, and unknown errors to a generic 500 response.
- JSON body size is limited to 100kb.

### Limitations

- User role update validates request body manually rather than with a Zod schema.
- Search uses user-provided contains matching without pagination/rate limiting. Prisma parameterizes it, but broad search/load controls are not implemented.
- Unknown errors are logged with console.error; there is no structured redaction, error tracker, or log-retention policy.
- Database files are local SQLite files; encryption at rest is not configured by the application.

### Production improvements

- Validate every route with a single schema convention.
- Add request-size limits suitable for all endpoints, pagination, per-route throttling, structured logs, and centralised error tracking.
- Use managed database encryption/backups and a production database service.

## Browser and HTTP protections

### Implemented

- Helmet middleware is installed.
- CORS is configured from CORS_ORIGIN, split by commas, allowing local frontend origin by default.
- React escapes text nodes by default; the current UI does not use dangerouslySetInnerHTML.
- The frontend API wrapper consistently sends JSON and bearer authorization through one code path.

### Limitations

- Helmet is configured with contentSecurityPolicy: false. Therefore the application does not currently send a Helmet CSP.
- HTTPS enforcement, HSTS deployment policy, reverse-proxy configuration, and security-header verification are not included in the repository.
- CORS origin configuration alone is not an authentication or authorization mechanism.
- No CSRF protection is implemented. The current bearer token is header-based rather than cookie-based, reducing the usual browser-cookie CSRF exposure, but this must be reassessed if cookies are introduced.
- External Google font import is used by the frontend CSS.

### Production improvements

- Enable and test a restrictive Content Security Policy compatible with the frontend.
- Serve only behind HTTPS and configure HSTS, trusted proxy settings, and production CORS origins.
- Reassess CSRF if moving to cookie authentication; add security-header and CSP regression checks.

## Rate limiting and abuse handling

### Implemented

- POST /api/auth/login has an in-memory limit of 10 attempts per req.ip in 15 minutes.
- The limit responds with 429 TOO_MANY_LOGIN_ATTEMPTS.

### Limitations

- The rate limit is only on login, not registration, search, task writes, or other APIs.
- It is an in-process Map, so it resets on restart and is not shared across multiple API instances.
- It does not clear/adjust attempts after successful login.
- Correct client IP handling behind a proxy is not configured in this repository.

### Production improvements

- Use a shared store such as Redis or an API gateway/WAF for rate limits.
- Rate-limit authentication, registration, search, and write endpoints according to measured policy.
- Configure trusted proxies and monitoring/alerting for abuse signals.

## Secrets, configuration, and source control

### Implemented

- .env is ignored by Git.
- .env.example lists DATABASE_URL, PORT, CORS_ORIGIN, worker intervals, and AUTH_SECRET without a real deployment secret.
- .gitignore excludes node_modules, build artifacts, coverage, caches, .env, SQLite database files, and TypeScript build info.

### Limitations

- The repository does not include deployment-specific secret injection, rotation, or environment validation beyond AUTH_SECRET use.
- The default .env.example database file is local and not a production configuration.

### Production improvements

- Inject secrets through a platform secret manager.
- Validate all production environment variables at process startup.
- Add dependency vulnerability scanning and secret scanning in CI.

## Background jobs and notifications

### Implemented

- Task write and job creation occur in one Prisma transaction.
- Jobs record status, attempts, maxAttempts, lastError, lockedAt, and runAfter.
- Stale PROCESSING jobs are returned to PENDING after JOB_STALE_AFTER_MS.
- Notification.sourceJobId is unique, preventing the same job from creating a second notification row.
- The worker completes stale assignments safely when the task is gone or reassigned.

### Limitations

- The worker runs in the same process as the API, so a process outage affects request handling and job processing together.
- Job payload is JSON text and has no foreign-key constraint to the task/user.
- There is no interface to review or retry FAILED jobs.
- Recovery depends on the process starting and polling.

### Production improvements

- Separate worker deployment and use a queue/monitoring system appropriate to scale.
- Add a dead-letter/retry operational path and alerting.
- Consider retaining job audit information according to a defined policy.

## Testing coverage relevant to security

The integration suite verifies protected routes, logout token invalidation, membership data isolation, role restrictions, invalid filters, member task-update restrictions, and worker idempotency/recovery. It does not include browser security tests, penetration tests, dependency scanning, CSP tests, or load testing.

