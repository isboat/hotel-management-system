import type { Session } from './types'

const sessionKey = 'hms.session'

export function readSession(): Session | undefined {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    if (session && typeof session.id === 'string' && typeof session.name === 'string' &&
        typeof session.isSystemAdmin === 'boolean' && typeof session.token === 'string' &&
        session.token && typeof session.refreshToken === 'string' && session.refreshToken) return session
  } catch {
    // Sign-in still works when storage is unavailable.
  }
}

export function saveSession(session?: Session) {
  try {
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session))
    else sessionStorage.removeItem(sessionKey)
  } catch {
    // Keep the current in-memory session if storage is unavailable.
  }
}
