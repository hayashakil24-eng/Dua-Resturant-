// Service-layer errors, thrown by src/services/* and mapped to HTTP status
// codes by the Fastify error handler in app.ts. Keeping this a plain class (no
// Fastify dependency) is what lets the service layer stay a pure core that a
// future Socket.IO or VPS adapter can call the same way (docs/00-overview.md's
// "one shared core service layer, pluggable adapters").
//
// The frontend mutators return `{ error: '...' }` objects for validation
// failures and silently `return` for permission failures. The backend makes
// both explicit: a validation failure is a 400, a permission failure a 403,
// "not found" a 404 — the route turns them into `{ error }` JSON so the
// eventual frontend fetch() layer sees a shape it can surface unchanged.

export class ServiceError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ServiceError'
    this.statusCode = statusCode
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = 'Not authorised.') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ServiceError {
  constructor(message = 'Not found.') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}
