import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import type { Api } from './api'
import { ConfirmationOverlay, type ConfirmationReview } from './ConfirmationOverlay'
import { Notice, PageHeading } from './components'

type HotelAccess = { id: string; name: string; role: string; active: boolean }
type PlatformUser = { id: string; name: string; email: string; isSystemAdmin: boolean; hotels?: HotelAccess[] }
type UsersPage = { items: PlatformUser[]; hasMore: boolean }

export function PlatformUsers({ api, currentUserId }: { api: Api; currentUserId: string }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ url: string; page?: UsersPage; error?: string }>()
  const [recovery, setRecovery] = useState<{ user: PlatformUser; code: string }>()
  const [resetError, setResetError] = useState('')
  const [pending, setPending] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [confirmation, setConfirmation] = useState<{ user: PlatformUser; hotel?: HotelAccess; review: ConfirmationReview }>()
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
  }, [api, url, revision])

  async function resetPassword(user: PlatformUser) {
    setRecovery(undefined)
    setFeedback('')
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

  function reviewRemoval(user: PlatformUser, hotel?: HotelAccess) {
    setConfirmation({ user, hotel, review: {
      title: hotel ? 'Revoke hotel access?' : 'Delete user account?',
      subtitle: hotel ? 'This removes access to the selected hotel. The account and other hotel access remain available.' : 'This permanently removes the account and its access to all hotels.',
      confirmLabel: hotel ? 'Revoke access' : 'Delete account',
      details: [{ label: 'User', value: user.email.toLowerCase() }, ...(hotel ? [{ label: 'Hotel', value: hotel.name }] : [])],
    } })
  }

  async function removeUserAccess() {
    if (!confirmation) return
    const { user, hotel } = confirmation
    setConfirmation(undefined)
    setRecovery(undefined)
    setFeedback('')
    setResetError('')
    setPending(user.id)
    try {
      const path = `/platform/users/${user.id}`
      await api(hotel ? `${path}/properties/${hotel.id}` : path, 'DELETE')
      setFeedback(hotel ? `Access to ${hotel.name} revoked for ${user.name}.` : `Account deleted for ${user.name}.`)
      if (!hotel && offset && current?.page?.items.length === 1) setOffset(offset - pageSize)
      setRevision(value => value + 1)
    } catch (error) {
      setResetError((error as Error).message)
    } finally {
      setPending(undefined)
    }
  }

  return <>
    {confirmation && <ConfirmationOverlay review={confirmation.review} onDecision={confirmed => {
      if (confirmed) void removeUserAccess()
      else setConfirmation(undefined)
    }} />}
    {feedback && <p role="status">{feedback}</p>}
    <PageHeading title="Users" icon={Users} subtitle="Manage user accounts, hotel access, and password recovery." />
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
      <div className="actions">
        <button className="secondary" disabled={pending !== undefined} onClick={() => void resetPassword(user)}>Reset password</button>
        {user.id !== currentUserId && <button className="secondary danger" disabled={pending !== undefined}
          onClick={() => reviewRemoval(user)}>Delete account</button>}
      </div>
      {!!user.hotels?.length && <details>
        <summary>Hotel access ({user.hotels.length})</summary>
        <ul>{user.hotels.map(hotel => <li key={hotel.id}>
          <span>{hotel.name} · {hotel.role}{hotel.active ? '' : ' · Suspended'}</span>{' '}
          <button className="secondary" disabled={pending !== undefined}
            onClick={() => reviewRemoval(user, hotel)}>Revoke access</button>
        </li>)}</ul>
      </details>}
    </article>)}</div>
    {(offset > 0 || current?.page?.hasMore) && <nav aria-label="User pages" className="actions">
      <button className="secondary" disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>Previous</button>
      <span>Page {offset / pageSize + 1}</span>
      <button className="secondary" disabled={!current?.page?.hasMore} onClick={() => setOffset(offset + pageSize)}>Next</button>
    </nav>}
  </>
}
