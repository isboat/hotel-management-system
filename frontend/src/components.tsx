import { cloneElement, useEffect, useId, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import { Brand } from './WorkspaceNavigation'
import { createApi } from './api'
import type { Api } from './api'
import type { Session } from './types'

export function PageHeading({ title, icon: Icon, subtitle, children }: {
  title: string; icon: LucideIcon; subtitle?: string; children?: ReactNode
}) {
  return <header className="page-heading">
    <div className="page-heading-title">
      <span className="page-icon"><Icon size={22} aria-hidden="true" /></span>
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    </div>
    {children && <div className="actions page-heading-actions">{children}</div>}
  </header>
}

export function DescribedField({ label, description, children, checkbox = false }: {
  label: string
  description: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>
  checkbox?: boolean
}) {
  const id = useId()
  const descriptionId = `${id}-help`
  const control = cloneElement(children, { id, 'aria-describedby': descriptionId })
  return <div className="described-field">
    <label htmlFor={id} className={checkbox ? 'check' : undefined}>{checkbox && control}{label}</label>
    <span className="field-help" id={descriptionId}>{description}</span>
    {!checkbox && control}
  </div>
}

export function useRecords<T>(api: Api, path: string | null) {
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let current = true
    if (!path) return
    api<T[]>(path).then(data => { if (current) { setRows(data); setError('') } },
      failure => { if (current) { setRows([]); setError(failure.message) } })
    return () => { current = false }
  }, [api, path, revision])
  return { rows, error, reload: () => setRevision(value => value + 1) }
}

export function Notice({ text }: { text: string }) {
  return text ? <p className="notice" role="alert"><CircleAlert size={17} />{text}</p> : null
}

export function ActionForm({ children, action, label }: {
  children: ReactNode; action: (data: FormData) => Promise<void>; label: string
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setBusy(true)
    try { await action(new FormData(form)) }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit}><fieldset disabled={busy}>{children}<button type="submit">{busy ? 'Saving…' : label}</button></fieldset><Notice text={error} /></form>
}

export const field = (data: FormData, key: string) => String(data.get(key) ?? '')

export function SignIn({ onSession }: { onSession: (session: Session) => void }) {
  const reducedMotion = useReducedMotion()
  const [reset, setReset] = useState(false)
  const [success, setSuccess] = useState(false)
  return <main className="sign-in">
    <section className="welcome">
      <Brand />
      <m.div initial={reducedMotion ? false : { opacity: .6, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .4, ease: 'easeOut' }}>
        <h1>One workspace for your hotel.</h1>
        <p>Manage stays, room readiness and cash payments across your property.</p>
      </m.div>
    </section>
    <m.section className="sign-in-form" initial={reducedMotion ? false : { opacity: .6, y: 10 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, ease: 'easeOut' }}>
      <h2>{reset ? 'Reset password' : 'Sign in'}</h2>
      {success && <p role="status">Password updated. Sign in with your new password.</p>}
      <ActionForm key={String(reset)} label={reset ? 'Update password' : 'Sign in'} action={async data => {
        const api = createApi()
        if (reset) {
          await api('/auth/reset', 'POST', { code: field(data, 'code'), password: field(data, 'password') })
          setReset(false)
          setSuccess(true)
        } else onSession(await api<Session>('/auth/login', 'POST', { email: field(data, 'email'), password: field(data, 'password') }))
      }}>
        {reset ? <DescribedField label="Reset code" description="Enter the single-use code your administrator shared with you."><input name="code" required autoComplete="one-time-code" /></DescribedField> :
          <label>Email address<input name="email" type="email" required autoComplete="username" /></label>}
        {reset ? <DescribedField label="Password" description="Choose a new password with at least 12 characters.">
          <input name="password" type="password" required minLength={12} autoComplete="new-password" />
        </DescribedField> : <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>}
      </ActionForm>
      <button className="text-button" onClick={() => setReset(value => !value)}>{reset ? 'Back to sign in' : 'I have a reset code'}</button>
    </m.section>
  </main>
}
