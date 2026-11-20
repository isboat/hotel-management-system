import { useState } from 'react'
import { currency, today } from './api'
import type { Api } from './api'
import { ActionForm, field, Notice, useRecords } from './components'
import type { Audit, Hotel, Staff } from './types'

export function StaffDirectory({ api, path, role }: { api: Api; path: string; role: string }) {
  const { rows, error, reload } = useRecords<Staff>(api, `${path}/staff`)
  const [feedback, setFeedback] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<Staff>()
  const roles = role === 'Administrator' ? ['FrontDesk', 'Housekeeping', 'Manager', 'Supervisor'] : ['FrontDesk', 'Housekeeping']
  async function update(suffix: string, method: string, data?: unknown) {
    setFeedback('')
    setResetCode('')
    try {
      const result = await api<{ code: string } | undefined>(`${path}/staff/${suffix}`, method, data)
      if (result?.code) setResetCode(result.code)
      reload()
    } catch (failure) { setFeedback((failure as Error).message) }
  }
  return <>
    <h1>Staff</h1>
    <Notice text={error || feedback} />
    {resetCode && <div className="panel" role="status"><p>Share this single-use code privately with the staff member. It expires in 30 minutes.</p><code>{resetCode}</code>
      <button className="secondary" onClick={() => setResetCode('')}>Dismiss</button></div>}
    <section className="panel"><h2>Add staff member</h2><StaffForm roles={roles} submit={async data => {
      await api(`${path}/staff`, 'POST', data); reload()
    }} /></section>
    {selectedStaff && <section className="panel"><h2>Edit staff member</h2>
      <ActionForm key={selectedStaff.id} label="Save changes" action={async data => {
        await api(`${path}/staff/${selectedStaff.id}`, 'PUT', { name: field(data, 'name'), role: field(data, 'role') })
        setSelectedStaff(undefined); reload()
      }}><div className="fields"><label>Name<input name="name" required defaultValue={selectedStaff.name} /></label>
        <label>Role<select name="role" defaultValue={selectedStaff.role}>
          {roles.map(option => <option key={option}>{option}</option>)}
        </select></label></div>
      </ActionForm><button className="text-button" onClick={() => setSelectedStaff(undefined)}>Cancel</button>
    </section>}
    <div className="record-list">{rows.map(member => <article className="panel record" key={member.id}>
      <div><h2>{member.name}</h2><p>{member.email}</p></div><span className="status">{member.active ? member.role : 'Suspended'}</span>
      {roles.includes(member.role) && <div className="actions">
        <button className="secondary" onClick={() => setSelectedStaff(member)}>Edit</button>
        <button className="secondary" onClick={() => void update(`${member.id}/status`, 'PATCH', { status: member.active ? 'Suspended' : 'Active' })}>{member.active ? 'Suspend' : 'Reactivate'}</button>
        <button className="secondary" onClick={() => void update(`${member.id}/reset`, 'POST')}>Reset password</button>
        <button className="secondary danger" onClick={() => { if (confirm(`Remove ${member.name}'s property access?`)) void update(member.id, 'DELETE') }}>Remove</button>
      </div>}
    </article>)}</div>
  </>
}

function StaffForm({ roles, submit }: { roles: string[]; submit: (data: unknown) => Promise<void> }) {
  return <ActionForm label="Add staff member" action={data => submit({
    email: field(data, 'email'), name: field(data, 'name'), role: field(data, 'role'), password: field(data, 'password'),
  })}><div className="fields">
    <label>Name<input name="name" required /></label><label>Email address<input name="email" type="email" required /></label>
    <label>Role<select name="role">{roles.map(role => <option key={role}>{role}</option>)}</select></label>
    <label>Initial password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label>
  </div></ActionForm>
}

export function Tenants({ api }: { api: Api }) {
  const { rows, error, reload } = useRecords<Hotel>(api, '/platform/properties')
  const [selected, setSelected] = useState<Hotel>()
  const [renaming, setRenaming] = useState<Hotel>()
  const [feedback, setFeedback] = useState('')
  return <><h1>Hotel tenants</h1><Notice text={error || feedback} />
    <section className="panel"><h2>Create a tenant</h2><ActionForm label="Create tenant" action={async data => {
      const hotel = await api<Hotel>('/platform/properties', 'POST', { name: field(data, 'name') })
      setSelected(hotel); reload()
    }}><label>Hotel name<input name="name" required /></label></ActionForm></section>
    {renaming && <section className="panel"><h2>Edit tenant</h2>
      <ActionForm key={renaming.id} label="Save tenant" action={async data => {
        await api(`/platform/properties/${renaming.id}`, 'PUT', { name: field(data, 'name') })
        setRenaming(undefined); reload()
      }}><label>Hotel name<input name="name" defaultValue={renaming.name} required /></label></ActionForm>
      <button className="text-button" onClick={() => setRenaming(undefined)}>Cancel</button>
    </section>}
    {selected && <section className="panel"><h2>Assign administrator · {selected.name}</h2>
      <StaffForm roles={['Administrator']} submit={async data => {
        await api(`/platform/properties/${selected.id}/administrator`, 'POST', data); setSelected(undefined)
      }} /><button className="text-button" onClick={() => setSelected(undefined)}>Close</button></section>}
    <div className="record-list">{rows.map(hotel => <article className="panel record" key={hotel.id}>
      <div><h2>{hotel.name}</h2><p>{hotel.archived ? 'Archived' : hotel.suspended ? 'Suspended' : 'Active'}</p></div>
      <div className="actions"><button className="secondary" onClick={() => setRenaming(hotel)}>Edit</button><button className="secondary" disabled={hotel.archived || hotel.suspended} onClick={() => setSelected(hotel)}>Assign administrator</button>
        <label>Tenant status<select value={hotel.archived ? 'Archived' : hotel.suspended ? 'Suspended' : 'Active'} onChange={async event => {
          const status = event.target.value
          if (status === 'Archived' && !confirm(`Archive ${hotel.name}?`)) return
          try { await api(`/platform/properties/${hotel.id}`, 'PATCH', { status }); reload() }
          catch (failure) { setFeedback((failure as Error).message) }
        }}><option>Active</option><option>Suspended</option><option>Archived</option></select></label>
      </div></article>)}</div>
  </>
}

export function AuditLog({ api, path }: { api: Api; path: string }) {
  const [outcome, setOutcome] = useState('')
  const [query, setQuery] = useState('')
  const { rows, error } = useRecords<Audit>(api, `${path}/audit`)
  return <><h1>Audit log</h1><Notice text={error} />
    <div className="fields"><label>Filter activity<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Action, path or user ID" /></label>
      <label>Outcome<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="success">Successful</option><option value="failure">Failed or denied</option></select></label></div>
    <div className="record-list">{rows.filter(row =>
      (!outcome || (outcome === 'success' ? row.outcome < 400 : row.outcome >= 400)) &&
      `${row.action} ${row.target} ${row.staffId ?? ''}`.toLowerCase().includes(query.toLowerCase())
    ).map(row => <article className="panel record" key={row.id}><div><h2>{row.action} · {row.outcome}</h2>
      <p className="break-anywhere">{row.target}</p><p>User {row.staffId ?? 'unknown'}</p></div><time dateTime={row.utc}>{new Date(row.utc).toLocaleString()}</time></article>)}</div>
    {!rows.length && <p className="empty">No recorded activity yet.</p>}
  </>
}

type Occupancy = { sold: number; available: number; revenue: number; occupancy: number; adr: number; revPar: number }

export function Reports({ api, path }: { api: Api; path: string }) {
  const [report, setReport] = useState<Occupancy>()
  return <><h1>Reports</h1><section className="panel"><h2>Booking occupancy</h2>
    <ActionForm label="Run report" action={async data => setReport(await api<Occupancy>(
      `${path}/reports/occupancy?arrival=${field(data, 'arrival')}&departure=${field(data, 'departure')}`))}>
      <div className="fields"><label>From<input type="date" name="arrival" required defaultValue={today()} /></label>
        <label>Until (exclusive)<input type="date" name="departure" required /></label></div>
    </ActionForm></section>
    {report && <div className="card-grid">
      <article className="panel metric"><p>Room nights booked</p><strong>{report.sold} / {report.available}</strong></article>
      <article className="panel metric"><p>Occupancy</p><strong>{report.occupancy.toFixed(1)}%</strong></article>
      <article className="panel metric"><p>Room revenue</p><strong>{currency(report.revenue)}</strong></article>
      <article className="panel metric"><p>Average daily rate</p><strong>{currency(report.adr)}</strong></article>
      <article className="panel metric"><p>Revenue per available room</p><strong>{currency(report.revPar)}</strong></article>
    </div>}
  </>
}
