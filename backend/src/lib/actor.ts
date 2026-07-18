// The authenticated caller, as carried by the JWT and threaded through every
// service call. `role` is the permission role (core/permissions.ts), NOT the
// job-title Staff.role — see the Staff.systemRole schema comment. `name` and
// `role` are exactly the two fields the frontend's audit entries stamp as
// `by`/`role`, so an audit row written server-side matches the shape
// AppContext.jsx already produces.

import type { Role } from '../core/permissions.js'

export interface Actor {
  id: string // Staff.id
  name: string // Staff.name — audit `by`
  role: Role // systemRole — audit `role`, permission checks
}
