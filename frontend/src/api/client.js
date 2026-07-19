// Tiny fetch wrapper — the frontend's single door to the local backend (Phase
// 1). Base URL defaults to the local server on :4000 and is overridable with
// VITE_API_URL (e.g. to point a LAN device at the restaurant PC's IP in
// Phase 2/3). The JWT is held in localStorage and sent as a Bearer token; the
// backend enforces every permission, so nothing here needs to know about roles.

export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TOKEN_KEY = 'token'
let token = null

export function getToken() {
  if (token) return token
  try {
    token = localStorage.getItem(TOKEN_KEY)
  } catch {
    token = null
  }
  return token
}

export function setToken(next) {
  token = next || null
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore (private mode / quota) */
  }
}

// Thrown on any non-2xx response; carries the server's { error } message and
// status so callers can surface it (mutators map this back to { error } for the
// existing UI, which reads res.error).
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function api(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the local backend running?', 0, null)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty / non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data)
  }
  return data
}

export const apiGet = (path) => api('GET', path)
export const apiPost = (path, body) => api('POST', path, body)
export const apiPatch = (path, body) => api('PATCH', path, body)
export const apiPut = (path, body) => api('PUT', path, body)
export const apiDelete = (path, body) => api('DELETE', path, body)
