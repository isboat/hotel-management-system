export type Api = <T>(path: string, method?: string, data?: unknown) => Promise<T>

type Tokens = { token: string; refreshToken: string }

class SessionUnauthorized extends Error {}

export function createApi(token = '', refreshToken = '', onRotate?: (tokens: Tokens) => void,
  onExpired?: () => void): Api {
  let pendingRefresh: Promise<void> | undefined
  let tokenVersion = 0
  const origin = import.meta.env.VITE_API_URL || 'http://localhost:5080'
  async function send<T>(path: string, method: string, data: unknown, retry: boolean): Promise<T> {
    const version = tokenVersion
    return await request<T>(path, method, data, retry, version)
  }
  async function request<T>(path: string, method: string, data: unknown, retry: boolean, version: number): Promise<T> {
    const response = await fetch(`${origin}/api/v1${path}`, {
      method,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(data !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    if (response.status === 401 && retry && refreshToken) {
      if (tokenVersion === version) {
        pendingRefresh ??= send<Tokens>('/auth/refresh', 'POST', { refreshToken }, false)
          .then(value => {
            token = value.token
            refreshToken = value.refreshToken
            tokenVersion++
            onRotate?.(value)
          })
          .finally(() => { pendingRefresh = undefined })
        await pendingRefresh
      }
      return send<T>(path, method, data, false)
    }
    if (!response.ok) {
      const body = await response.text()
      if (response.status === 401) throw new SessionUnauthorized('Sign-in failed or your session expired.')
      if (response.status === 403) throw new Error('You do not have access to this action.')
      if (body && !body.startsWith('{') && !body.startsWith('<')) throw new Error(body)
      throw new Error(`The request could not be completed (${response.status}).`)
    }
    return response.status === 204 ? undefined as T : response.json()
  }
  return async (path, method = 'GET', data) => {
    try {
      return await send(path, method, data, true)
    } catch (error) {
      if (error instanceof SessionUnauthorized) onExpired?.()
      throw error
    }
  }
}

export const currency = (pesewas: number) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)

export function toPesewas(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) throw new Error('Enter a cash amount with up to two decimal places.')
  const [whole, fraction = ''] = input.split('.')
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(value)) throw new Error('Amount is too large.')
  return value
}

export const today = () => new Date().toISOString().slice(0, 10)
