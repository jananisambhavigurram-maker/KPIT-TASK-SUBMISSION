# API Documentation

Base URL: http://localhost:4000/api in local development. The Vite frontend uses the relative base path /api.

All successful JSON responses use this envelope:

~~~json
{ "data": { } }
~~~

A 204 response has no body. Except where noted, endpoints require:

~~~http
Authorization: Bearer <signed-token>
Content-Type: application/json
~~~

CUID values below are placeholders for existing record IDs.

## Public endpoints

### GET /api/health

Purpose: lightweight health response.

Authentication: none.

Success: 200.

~~~json
{ "data": { "status": "ok" } }
~~~

### POST /api/auth/register

Purpose: create a new MEMBER account and immediately return a signed token.

Authentication: none.

Request body:

~~~json
{
  "name": "Asha Patel",
  "email": "asha@example.com",
  "password": "Password123!"
}
~~~

Validation: name is trimmed, 2-100 characters; email is lowercased, valid, and at most 254 characters; password is 8-128 characters.

Success: 201 with data containing token and a safe user object. The response does not include passwordHash.

Errors: 400 validation error; 409 DUPLICATE_EMAIL.

### POST /api/auth/login

Purpose: authenticate an existing account and return a signed token.

Authentication: none.

Request body:

~~~json
{
  "email": "manager@agileflow.demo",
  "password": "DemoPass123!"
}
~~~

Validation: valid lowercased email up to 254 characters; password 1-128 characters.

Success: 200.

Errors: 400 validation error; 401 INVALID_CREDENTIALS; 429 TOO_MANY_LOGIN_ATTEMPTS.

Rate limit: this endpoint has a process-memory limit of 10 attempts per IP address in a 15-minute window. The limit applies only to the running process.

## Authentication endpoints

### POST /api/auth/logout

Purpose: invalidate existing tokens for the current account by incrementing its sessionVersion.

Authentication: required.

Success: 204.

### GET /api/auth/me

Purpose: return the current authenticated user without passwordHash.

Authentication: required.

Success: 200.

~~~json
{
  "data": {
    "id": "cm...",
    "name": "Rahul Manager",
    "email": "manager@agileflow.demo",
    "sessionVersion": 0,
    "role": "MANAGER",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
~~~

### PUT /api/auth/password

Purpose: change the current user's password, invalidate earlier tokens, and return a new token.

Authentication: required.

Request body:

~~~json
{
  "currentPassword": "DemoPass123!",
  "newPassword": "NewPassword123!"
}
~~~

Validation: currentPassword 1-128 characters; newPassword 8-128 characters.

Success: 200 with data containing a new token and safe user object.

Errors: 400 validation error; 401 INVALID_CREDENTIALS when the supplied current password does not match.

## User administration

### GET /api/users

Purpose: list all users ordered by name, with passwordHash removed.

Authentication: required; ADMIN or MANAGER.

Success: 200 with an array of safe user objects.

### POST /api/users

Purpose: create a user account with a selected role.

Authentication: required; ADMIN only.

Request body:

~~~json
{
  "name": "New Manager",
  "email": "new.manager@example.com",
  "password": "Password123!",
  "role": "MANAGER"
}
~~~

Validation: name 1-100 characters, valid email at most 254 characters, password 8-128 characters, optional role ADMIN, MANAGER, or MEMBER. Omitted role defaults to MEMBER.

Success: 201 with a safe user object.

Errors: 400 validation error; 403 permission denied; 409 unique constraint error for duplicate email.

### PUT /api/users/:id/role

Purpose: change a user's role and invalidate that user's existing tokens.

Authentication: required; ADMIN only.

Path parameter: id is the target user CUID.

Request body:

~~~json
{ "role": "MEMBER" }
~~~

Validation: role must be ADMIN, MANAGER, or MEMBER.

Success: 200 with the updated safe user object.

Errors: 400 VALIDATION_ERROR; 403; 404 USER_NOT_FOUND.

## Projects and project membership

### GET /api/projects

Purpose: list projects available to the current user, ordered by most recently updated. Each project includes computed storyCount, taskCount, completedCount, statusCounts, and progress.

Authentication: required. ADMIN sees all projects; other roles see projects in ProjectMember.

Success: 200 with an array.

### POST /api/projects

Purpose: create a project and add the creator as a project member.

Authentication: required; ADMIN or MANAGER.

Request body:

~~~json
{
  "key": "ECOM",
  "name": "E-Commerce Platform",
  "description": "A shopping platform.",
  "status": "ACTIVE"
}
~~~

Validation: name is required and 1-120 characters. Key is optional; if supplied it is uppercase and must match 2-12 uppercase letters, numbers, or hyphens, beginning with a letter. Description is optional, trimmed, and up to 2000 characters. Status is optional: ACTIVE, COMPLETED, or ARCHIVED.

If key is omitted, the API derives a key from the name and adds a numeric suffix when necessary.

Success: 201 with the created Project.

Errors: 400; 403; 409 DUPLICATE_PROJECT_KEY.

### GET /api/projects/:id

Purpose: return an accessible project with its stories, each story's tasks and safe assignee, 12 most recent activities, and computed progress totals.

Authentication: required and project access required.

Success: 200.

Errors: 403 if the project exists but is not accessible; 404 PROJECT_NOT_FOUND if it does not exist.

### PUT /api/projects/:id

Purpose: update a project.

Authentication: required; ADMIN or MANAGER who belongs to the project.

Request body: same project body as POST; name remains required because projectInput is used for this update.

Key rule: a key can change only while the project has no stories. A supplied duplicate key is rejected.

Success: 200 with updated Project.

Errors: 400; 403; 404; 409 PROJECT_KEY_LOCKED or DUPLICATE_PROJECT_KEY.

### DELETE /api/projects/:id

Purpose: delete a project and its database-cascaded stories, tasks, activities, and project memberships.

Authentication: required; ADMIN only. The admin must also have access to the project under the route's access check.

Success: 204.

Errors: 403; 404.

### GET /api/projects/:id/members

Purpose: list safe user objects that belong to an accessible project, ordered by name.

Authentication: required and project access required.

Success: 200.

### POST /api/projects/:id/members

Purpose: add an existing user to a project.

Authentication: required; ADMIN or MANAGER who belongs to the project.

Request body:

~~~json
{ "userId": "cm-existing-user-id" }
~~~

Success: 201 with no body.

Errors: 403; 404 USER_NOT_FOUND or PROJECT_NOT_FOUND; 409 DUPLICATE_MEMBERSHIP.

## User stories

### GET /api/projects/:projectId/stories

Purpose: list all stories in an accessible project. Each story includes its tasks and safe assignee data.

Authentication: required and project access required.

Success: 200.

### POST /api/projects/:projectId/stories

Purpose: create a user story in a project.

Authentication: required; ADMIN or MANAGER who belongs to the project.

Request body:

~~~json
{
  "key": "ECOM-US-010",
  "title": "Customer registration",
  "description": "Allow a customer to create an account.",
  "status": "TODO",
  "priority": "HIGH",
  "allowSimilar": false
}
~~~

Validation: title is required, trimmed, and 1-180 characters; description is optional and up to 2000 characters; status is TODO, IN_PROGRESS, or DONE; priority is LOW, MEDIUM, or HIGH; optional explicit key is uppercase and 4-31 characters matching the configured pattern.

Duplicate handling: without allowSimilar true, a title equal after lowercasing, trimming, and collapsing whitespace is rejected within the same project. Omitted key is generated from the project key.

Success: 201 with the created story.

Errors: 400; 403; 404; 409 SIMILAR_STORY_EXISTS or DUPLICATE_STORY_KEY.

### GET /api/stories/:id

Purpose: return one story, its tasks, safe assignees, and parent project.

Authentication: required and parent project access required.

Success: 200.

Errors: 403; 404 USER_STORY_NOT_FOUND.

### PUT /api/stories/:id

Purpose: update an existing story.

Authentication: required; ADMIN or MANAGER who belongs to the parent project.

Request body: same story fields as POST; title remains required.

Success: 200.

Errors: 400; 403; 404; 409 DUPLICATE_STORY_KEY.

### DELETE /api/stories/:id

Purpose: delete a story and its database-cascaded tasks.

Authentication: required; ADMIN or MANAGER who belongs to the parent project.

Success: 204.

Errors: 403; 404.

## Tasks

### GET /api/stories/:storyId/tasks

Purpose: list tasks under one accessible story, ordered by dueDate ascending.

Authentication: required and parent project access required.

Query parameters, all optional:

| Name | Allowed value |
|---|---|
| status | TODO, IN_PROGRESS, DONE |
| priority | LOW, MEDIUM, HIGH |
| assignedToId | user CUID |

Success: 200 with tasks and safe assignee data.

Errors: 400 for invalid query value; 403; 404 USER_STORY_NOT_FOUND.

### GET /api/tasks

Purpose: list tasks across projects accessible to the requester. Each item includes safe assignee data, its story, and parent project.

Authentication: required.

Query parameters, all optional:

| Name | Allowed value/meaning |
|---|---|
| status | TODO, IN_PROGRESS, DONE |
| priority | LOW, MEDIUM, HIGH |
| assignedToId | user CUID |
| projectId | accessible project CUID |
| storyId | story CUID |
| overdue | true or false; true applies dueDate before now and status not DONE |
| completed | true or false; true applies status DONE |

Success: 200, ordered by dueDate ascending.

Errors: 400 validation error; 403 for inaccessible supplied projectId.

### POST /api/stories/:storyId/tasks

Purpose: create a task in a story. If an assignee is supplied, persist a TASK_ASSIGNED job in the same transaction.

Authentication: required; ADMIN or MANAGER who belongs to the parent project.

Request body:

~~~json
{
  "key": "ECOM-T-020",
  "title": "Implement registration form",
  "description": "Build the accessible form.",
  "status": "TODO",
  "priority": "HIGH",
  "assignedToId": "cm-project-member-id",
  "dueDate": "2026-10-15T00:00:00.000Z"
}
~~~

Validation: title is required and 1-180 characters; description optional up to 2000 characters; optional key follows the story/task key pattern; status and priority are enumerations; assignedToId is nullable CUID; dueDate is nullable date.

The assignee must be an existing member of the project's ProjectMember set. An omitted key is generated from the project key.

Success: 201 with task and safe assignee.

Errors: 400; 403; 404; 409 DUPLICATE_TASK_KEY.

### GET /api/tasks/:id

Purpose: return one accessible task with safe assignee, story, and project.

Authentication: required and parent project access required.

Success: 200.

Errors: 403; 404 TASK_NOT_FOUND.

### PUT /api/tasks/:id

Purpose: update a task. A changed assignment enqueues a durable assignment job; a changed status writes a project activity record.

Authentication: required. ADMIN/MANAGER must belong to the parent project. MEMBER may update only status for a task assigned to that same member.

Request body: same task shape as POST. Because taskInput is used, title is required on the update request.

Additional rules: explicit changed key must be unique. An assigned user must be a project member. A MEMBER request that changes title, description, priority, assignee, key, or due date is rejected.

Success: 200.

Errors: 400 ASSIGNEE_NOT_IN_PROJECT or validation error; 403; 404; 409 DUPLICATE_TASK_KEY.

### DELETE /api/tasks/:id

Purpose: delete a task.

Authentication: required; ADMIN or MANAGER who belongs to the parent project.

Success: 204.

Errors: 403; 404.

## Notifications

### GET /api/notifications

Purpose: list notifications ordered newest first.

Authentication: required. Normal users receive their own notifications. An ADMIN may request another user's notifications with optional userId query parameter.

Query parameter: userId, optional string, honoured only for ADMIN.

Success: 200 with notifications and user name.

### PUT /api/notifications/:id/read

Purpose: mark a notification as read.

Authentication: required. The notification owner or an ADMIN may mark it read.

Success: 200 with updated notification.

Errors: 403; 404 NOTIFICATION_NOT_FOUND.

### PUT /api/notifications/read-all

Purpose: mark all unread notifications for the current user as read.

Authentication: required.

Success: 204.

## Read models

### GET /api/dashboard

Purpose: return calculated totals for projects available to the requester, including active projects, stories, tasks, current user's tasks, completed tasks, overdue tasks, unread notifications, status distribution, priority distribution, and per-project progress.

Authentication: required.

Success: 200.

### GET /api/search

Purpose: search accessible projects, stories, and tasks.

Authentication: required.

Query parameter: q, optional string. Empty or absent q returns empty projects, stories, and tasks arrays. Non-empty search uses database contains matching on project key/name, story key/title, and task key/title, with at most 10 results per resource type.

Success: 200.

### GET /api/kanban

Purpose: return accessible tasks grouped into TODO, IN_PROGRESS, and DONE arrays.

Authentication: required.

Query parameter: projectId, optional project ID. When supplied, the API first verifies access to that project.

Success: 200.

## Background-job API availability

BackgroundJob records are created and processed internally. There is no HTTP endpoint to list, create, retry, or inspect background jobs in the current implementation.

## Error handling

The error middleware returns the following shapes:

~~~json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "fields": {
      "fieldName": ["reason"]
    }
  }
}
~~~

The fields property is present for Zod validation errors. Other application errors normally contain code and message only.

| Status | Meaning in this API |
|---|---|
| 400 | Invalid request body/query or a route-level validation rule such as invalid role or assignee not in project. |
| 401 | Missing/invalid/expired token, invalid credentials, or wrong current password. |
| 403 | Authenticated user lacks required role, project membership, or ownership. |
| 404 | Requested project, story, task, user, or notification does not exist. |
| 409 | Duplicate unique value, duplicate membership, similar story, or locked project key. |
| 429 | Login limit reached. |
| 500 | Unexpected server error; implementation details are not returned to the client. |

## Swagger/OpenAPI

Swagger UI is mounted at:

~~~text
http://localhost:4000/api-docs
~~~

It is generated from backend/src/swagger.ts and provides interactive documentation for a useful subset of routes. The implementation contains more routes than the current Swagger definition, including logout, password change, user administration, project membership, story retrieval/update/delete, task list/get, and notification read-all. This document is the complete route reference for the current codebase.

