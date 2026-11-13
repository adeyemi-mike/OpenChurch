/**
 * Legacy alias — the health probe lives at /api/health.
 * Kept so existing monitoring that calls /api keeps working.
 */
export { GET } from './health/route'
