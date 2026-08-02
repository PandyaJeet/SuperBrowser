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
 .catch(err => console.error(err))