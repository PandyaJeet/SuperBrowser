/**
 * Shared API client for the SuperBrowser backend.
 *
 * Two jobs:
 *
 *  1. Attach the session token. The backend gates /api/search/* and
 *     /api/context/* behind verify_token, which requires an X-Session-Token
 *     header. Centralising it here keeps the header off ~23 individual call
 *     sites, so a route can't silently ship unauthenticated.
 *
 *  2. Turn failed responses into thrown errors. fetch() only rejects on
 *     network failure — it resolves normally for 401/500. Call sites that do
 *     `.then(r => r.json())` therefore treat an error body as a successful
 *     payload, which is how an auth failure could reach the UI disguised as
 *     an empty result set. apiFetch throws an ApiError instead, and marks
 *     auth failures so callers can distinguish "you are not authenticated"
 *     from "the upstream search provider is down".
 *
 * Desktop (Electron) traffic does not use this module: main.cjs proxies those
 * requests over IPC and injects the token there, so the renderer never sees it.
 */
import { getApiBase } from '../config/apiBase'

const API_BASE = getApiBase()

/** Session token for web builds. Empty in Electron, which uses the IPC bridge. */
export function getSessionToken() {
  return import.meta.env.VITE_SUPERBROWSER_SESSION_TOKEN || ''
}

export class ApiError extends Error {
  constructor(message, { status = 0, isAuthError = false, body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isAuthError = isAuthError
    this.body = body
  }
}

/**
 * An auth failure can reach us two ways:
 *   401/403 — token missing, empty, or wrong.
 *   500     — the backend itself has no SUPERBROWSER_SESSION_TOKEN configured,
 *             so verify_token raises "Server authentication not configured".
 *             That is a deployment mistake, not an upstream outage, so it must
 *             not be masked by the instant-results fallback.
 */
function classifyAuthFailure(status, detail) {
  if (status === 401 || status === 403) return true
  if (status === 500 && /authentication/i.test(detail || '')) return true
  return false
}

function authMessage(status) {
  if (status === 500) {
    return 'Backend authentication is not configured. Set SUPERBROWSER_SESSION_TOKEN on the server (see README).'
  }
  return 'Not authorised. Check that VITE_SUPERBROWSER_SESSION_TOKEN matches the backend\'s SUPERBROWSER_SESSION_TOKEN (see README).'
}

/**
 * fetch() with the session token attached, throwing ApiError on any non-2xx.
 * AbortError is re-thrown untouched so existing cancellation logic still works.
 *
 * @param {string} path  Path such as '/api/search/seo?q=x', or a full URL.
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`

  const headers = { ...(options.headers || {}), 'X-Session-Token': getSessionToken() }

  const response = await fetch(url, { ...options, headers })
  if (response.ok) return response

  // Pull `detail` out of FastAPI's error body when there is one.
  let detail = ''
  let body = null
  try {
    body = await response.clone().json()
    detail = typeof body?.detail === 'string' ? body.detail : ''
  } catch {
    // Non-JSON error body; the status alone is enough to classify.
  }

  const isAuthError = classifyAuthFailure(response.status, detail)
  const message = isAuthError
    ? authMessage(response.status)
    : detail || `Request failed (HTTP ${response.status})`

  throw new ApiError(message, { status: response.status, isAuthError, body })
}

/** apiFetch + JSON parsing. */
export async function apiFetchJson(path, options = {}) {
  const response = await apiFetch(path, options)
  return response.json()
}

/** JSON POST/DELETE helper — sets Content-Type and serialises the body. */
export function apiFetchJsonBody(path, method, payload, options = {}) {
  return apiFetchJson(path, {
    ...options,
    method,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify(payload),
  })
}
