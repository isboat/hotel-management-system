import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import type { Api } from './api'
import { Notice, PageHeading } from './components'

type PlatformUser = { id: string; name: string; email: string; isSystemAdmin: boolean }
type UsersPage = { items: PlatformUser[]; hasMore: boolean }

export function PlatformUsers({ api }: { api: Api }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ url: string; page?: UsersPage; error?: string }>()
  const [recovery, setRecovery] = useState<{ user: PlatformUser; code: string }>()
  const [resetError, setResetError] = useState('')
  const [pending, setPending] = useState<string>()
  const pageSize = 50
  const url = '/platform/users?' + new URLSearchParams({ search, offset: String(offset) })
  const current = result?.url === url ? result : undefined

  useEffect(() => {
    let active = true
    api<UsersPage>(url).then(
      page => { if (active) setResult({ url, page }) },
      (error: Error) => { if (active) setResult({ url, error: error.message }) },
    )
    return () => { active = false }
  }, [api, url])

  async function resetPassword(user: PlatformUser) {
    setRecovery(undefined)
    setResetError('')
    setPending(user.id)
    try {
      const { code } = await api<{ code: string }>(`/platform/users/${user.id}/reset`, 'POST')
      setRecovery({ user, code })
    } catch (error) {
      setResetError((error as Error).message)
    } finally {
      setPending(undefined)
    }
  }

  return <>
    <PageHeading title="Users" icon={Users} subtitle="View accounts across all hotels and issue password reset codes." />
    <label className="search">Find a user<input value={search} onChange={event => {
      setSearch(event.target.value)
      setOffset(0)
    }} placeholder="Name or email" /></label>
    <Notice text={current?.error || resetError} />
    {recovery && <section className="panel" aria-labelledby="reset-code-title">
      <h2 id="reset-code-title">Password reset for {recovery.user.name}</h2>
      <p role="status">Share this single-use code privately with {recovery.user.email.toLowerCase()}. It expires in 30 minutes. On the sign-in page, they select “I have a reset code” to choose a new password.</p>
      <p className="break-anywhere"><code>{recovery.code}</code></p>
      <button className="secondary" onClick={() => setRecovery(undefined)}>Dismiss</button>
    </section>}
    {!current && <p role="status">Loading users…</p>}
    {current?.page?.items.length === 0 && <p className="empty">No matching users.</p>}
    <div className="record-list">{current?.page?.items.map(user => <article className="panel record" key={user.id}>
      <div className="break-anywhere"><h2>{user.name}</h2><p>{user.email.toLowerCase()}</p></div>
      {user.isSystemAdmin && <span className="status">System Administrator</span>}
      <button className="secondary" disabled={pending !== undefined} onClick={() => void resetPassword(user)}>
        {pending === user.id ? 'Issuing code…' : 'Reset password'}
      </button>
    </article>)}</div>
    {(offset > 0 || current?.page?.hasMore) && <nav aria-label="User pages" className="actions">
      <button className="secondary" disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>Previous</button>
      <span>Page {offset / pageSize + 1}</span>
      <button className="secondary" disabled={!current?.page?.hasMore} onClick={() => setOffset(offset + pageSize)}>Next</button>
    </nav>}
  </>
}
