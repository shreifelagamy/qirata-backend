# AI Agent Implementation Rules for Qirata Express Backend

This document defines strict implementation rules and architectural guidelines for any AI agent or developer working on the Qirata Express backend. Adhering to these rules ensures consistency, maintainability, and seamless integration with the existing codebase and frontend.

---

## 1. Project Structure & Layering

- **Entities**: Define database models in `src/entities/`. Use TypeORM conventions. Each table must have a corresponding entity.
- **DTOs**: Place Data Transfer Objects in `src/dtos/`. Use `{Entity}Dto` naming. DTOs define request/response shapes and validation.
- **Controllers**: Implement REST endpoints in `src/controllers/`. Controllers must:
  - Only handle HTTP logic (request parsing, response formatting)
  - Delegate business logic to services
- **Services**: Place business logic in `src/services/`. Services must:
  - Be stateless and reusable
  - Handle all data access via repositories/entities
- **Routes**: Define Express routes in `src/routes/`. Each resource (e.g., posts, links) has its own route file.
- **Middleware**: Place reusable middleware in `src/middleware/` (e.g., validation, error handling, rate limiting).
- **WebSocket**: All real-time logic goes in `src/websocket/` (e.g., events, socket service).

## 2. API & WebSocket Conventions

- **Authentication**: Use JWT. Require `Authorization: Bearer <token>` for protected endpoints.
- **Rate Limiting**: Enforce 100 req/min (authenticated), 20 req/min (unauthenticated) via middleware.
- **REST Endpoints**:
  - Use `/api/{resource}` pattern
  - Support pagination with `page` and `limit` query params
  - Return data in `{ data: [...], meta: { ... } }` format
- **WebSocket Events**:
  - Use event namespaced as `{resource}:{action}` (e.g., `chat:message`, `post:created`)
  - Document all events in `docs/API.md`

## 3. Database & Migrations

- All schema changes must be implemented as TypeORM migrations in `src/database/migrations/`
- Entity fields must match the schema in `README.md` and `docs/API.md`
- Use UUIDs for primary keys
- Timestamps: `created_at`, `updated_at` with defaults

## 4. Error Handling & Responses

- All error responses must follow:
  ```json
  { "error": { "code": "string", "message": "string" } }
  ```
- Use standard HTTP status codes (400, 401, 403, 404, 429, 500)
- Centralize error handling in `error.middleware.ts`

## 5. Coding & Architectural Best Practices

- **Separation of Concerns**: Controllers = HTTP, Services = business logic, Entities = data
- **Type Safety**: Use TypeScript everywhere. Strongly type all DTOs, responses, and props.
- **Validation**: Use validation middleware for all incoming data (see `validation.middleware.ts`)
- **Logging**: Use the logger utility for all errors and important events
- **Testing**: Place tests in a `__tests__` or similar directory. Cover controllers and services.
- **Documentation**: Update `docs/API.md` for all new endpoints/events

## 6. Integration with Frontend

- API request/response types must match frontend expectations
- Pagination, error, and success formats must be consistent
- Document all changes that affect the frontend

## 7. Environment, Setup, and Deployment

- Follow `docs/SETUP.md` for environment variables and setup
- Use `.env.example` as the template for new environments
- All deployment scripts and configs must be documented in `README.md`

## 8. General Rules

- Never bypass service or validation layers
- Never expose sensitive data in responses
- Always use async/await for asynchronous code
- Keep code modular and single-responsibility
- Use comments for complex logic

---

**Any AI agent or developer must strictly follow these rules. All new features, bug fixes, and refactors must adhere to this document and the established project patterns.**
