import { useEffect, useState } from 'react'
import { BedDouble, Building2, CalendarCheck, ChartNoAxesCombined, ClipboardList, Coins, Percent, Settings2, TrendingUp, Users } from 'lucide-react'
import { currency, today } from './api'
import type { Api } from './api'
import { ActionForm, DescribedField, field, Notice, PageHeading, useRecords } from './components'
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
    <PageHeading title="Staff" image="/heroes/staff.webp" icon={Users} />
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
        <DescribedField label="Role" description="The role controls what this staff member can view or change at the property."><select name="role" defaultValue={selectedStaff.role}>
          {roles.map(option => <option key={option}>{option}</option>)}
        </select></DescribedField></div>
      </ActionForm><button className="text-button" onClick={() => setSelectedStaff(undefined)}>Cancel</button>
    </section>}
    <div className="record-list">{rows.map(member => <article className="panel record" key={member.id}>
      <div><h2>{member.name}</h2><p>{member.email}</p></div><span className={`status ${member.active ? '' : 'is-warning'}`}>{member.active ? member.role : 'Suspended'}</span>
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
    <DescribedField label="Role" description="The role controls what this staff member can view or change at the property."><select name="role">{roles.map(role => <option key={role}>{role}</option>)}</select></DescribedField>
    <DescribedField label="Initial password" description="Use at least 12 characters. The staff member uses this password to sign in."><input name="password" type="password" minLength={12} required autoComplete="new-password" /></DescribedField>
  </div></ActionForm>
}

function hotelDetails(data: FormData) {
  return {
    name: field(data, 'name'),
    telephone: field(data, 'telephone'),
    description: field(data, 'description'),
    address: field(data, 'address'),
  }
}

function HotelDetailsFields({ hotel }: { hotel?: Hotel }) {
  return <>
    <div className="fields">
      <label>Hotel name<input name="name" required maxLength={150} defaultValue={hotel?.name} /></label>
      <label>Telephone<input name="telephone" type="tel" maxLength={40} defaultValue={hotel?.telephone ?? ''} /></label>
    </div>
    <DescribedField label="Description" description="Optional. Add a short summary to help administrators identify this property."><textarea name="description" rows={3} maxLength={1000} defaultValue={hotel?.description ?? ''} /></DescribedField>
    <DescribedField label="Address" description="Optional. Include the street address, neighbourhood, and town or city."><textarea name="address" rows={3} maxLength={500} defaultValue={hotel?.address ?? ''} /></DescribedField>
  </>
}

export function HotelDetails({ api, path, onSaved }: { api: Api; path: string; onSaved: () => void }) {
  const [hotel, setHotel] = useState<Hotel>()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const endpoint = `${path}/details`

  useEffect(() => {
    let current = true
    api<Hotel>(endpoint).then(
      details => { if (current) setHotel(details) },
      failure => { if (current) setError(failure.message) },
    )
    return () => { current = false }
  }, [api, endpoint])

  return <><PageHeading title="Hotel details" image="/heroes/hotel-details.webp" icon={Settings2} /><Notice text={error} />
    {saved && <p role="status">Hotel details saved.</p>}
    {!hotel && !error && <p role="status">Loading hotel details…</p>}
    {hotel && <section className="panel">
      <ActionForm label="Save hotel details" action={async data => {
        setSaved(false)
        setHotel(await api<Hotel>(endpoint, 'PUT', hotelDetails(data)))
        setSaved(true)
        onSaved()
      }}><HotelDetailsFields hotel={hotel} /></ActionForm>
    </section>}
  </>
}

export function Tenants({ api }: { api: Api }) {
  const { rows, error, reload } = useRecords<Hotel>(api, '/platform/properties')
  const [selected, setSelected] = useState<Hotel>()
  const [editingHotel, setEditingHotel] = useState<Hotel>()
  const [feedback, setFeedback] = useState('')
  return <><PageHeading title="Hotel tenants" image="/heroes/tenants.webp" icon={Building2} /><Notice text={error || feedback} />
    <section className="panel"><h2>Create a tenant</h2><ActionForm label="Create tenant" action={async data => {
      const hotel = await api<Hotel>('/platform/properties', 'POST', hotelDetails(data))
      setSelected(hotel); reload()
    }}><HotelDetailsFields /></ActionForm></section>
    {editingHotel && <section className="panel"><h2>Edit tenant</h2>
      <ActionForm key={editingHotel.id} label="Save tenant" action={async data => {
        await api(`/platform/properties/${editingHotel.id}`, 'PUT', hotelDetails(data))
        setEditingHotel(undefined); reload()
      }}><HotelDetailsFields hotel={editingHotel} /></ActionForm>
      <button className="text-button" onClick={() => setEditingHotel(undefined)}>Cancel</button>
    </section>}
    {selected && <section className="panel"><h2>Assign administrator · {selected.name}</h2>
      <StaffForm roles={['Administrator']} submit={async data => {
        await api(`/platform/properties/${selected.id}/administrator`, 'POST', data); setSelected(undefined)
      }} /><button className="text-button" onClick={() => setSelected(undefined)}>Close</button></section>}
    <div className="record-list">{rows.map(hotel => <article className="panel record" key={hotel.id}>
      <div><h2>{hotel.name}</h2><p>{hotel.archived ? 'Archived' : hotel.suspended ? 'Suspended' : 'Active'}</p>
        {hotel.telephone && <p>Telephone {hotel.telephone}</p>}
        {hotel.address && <p className="multiline-text">{hotel.address}</p>}
        {hotel.description && <p className="multiline-text">{hotel.description}</p>}
      </div>
      <div className="actions"><button className="secondary" onClick={() => setEditingHotel(hotel)}>Edit</button><button className="secondary" disabled={hotel.archived || hotel.suspended} onClick={() => setSelected(hotel)}>Assign administrator</button>
        <DescribedField label="Tenant status" description="Only active tenants are available to staff. Changes save immediately."><select value={hotel.archived ? 'Archived' : hotel.suspended ? 'Suspended' : 'Active'} onChange={async event => {
          const status = event.target.value
          if (status === 'Archived' && !confirm(`Archive ${hotel.name}?`)) return
          try { await api(`/platform/properties/${hotel.id}`, 'PATCH', { status }); reload() }
          catch (failure) { setFeedback((failure as Error).message) }
        }}><option>Active</option><option>Suspended</option><option>Archived</option></select></DescribedField>
      </div></article>)}</div>
  </>
}

type AuditPage = { items: Audit[]; hasMore: boolean; snapshotUtc: string }

export function AuditLog({ api, path }: { api: Api; path: string }) {
  const [outcome, setOutcome] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<{ number: number; snapshot?: string }>({ number: 1 })
  const [data, setData] = useState<AuditPage & { url: string }>()
  const [error, setError] = useState<{ url: string; message: string }>()
  const pageSize = 25
  const params = new URLSearchParams({ search: query, result: outcome, offset: String((page.number - 1) * pageSize), pageSize: String(pageSize) })
  if (page.snapshot) params.set('snapshot', page.snapshot)
  const url = `${path}/audit?${params}`

  useEffect(() => {
    let active = true
    api<AuditPage>(url).then(
      response => { if (active) { setData({ ...response, url }); setError(undefined) } },
      failure => { if (active) { setData(undefined); setError({ url, message: failure.message }) } },
    )
    return () => { active = false }
  }, [api, url])

  const result = data?.url === url ? data : undefined
  const failure = error?.url === url ? error.message : ''
  return <><PageHeading title="Audit log" image="/heroes/audit-log.webp" icon={ClipboardList} /><Notice text={failure} />
    <div className="fields"><label>Filter activity<input value={query} onChange={event => { setQuery(event.target.value); setPage({ number: 1 }) }} placeholder="Name, email or action" /></label>
      <label>Outcome<select value={outcome} onChange={event => { setOutcome(event.target.value); setPage({ number: 1 }) }}><option value="">All outcomes</option><option value="success">Successful</option><option value="failure">Failed or denied</option></select></label></div>
    <div className="record-list">{result?.items.map(row => {
      const actor = row.staffName ? `${row.staffName}${row.staffEmail ? ` (${row.staffEmail.toLowerCase()})` : ''}` : 'Unknown user'
      const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(row.utc) ? row.utc : `${row.utc}Z`
      const date = new Date(timestamp)
      const day = date.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' })
      const time = date.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Accra' })
      const action = /^[A-Z]+$/.test(row.action) ? `made a ${row.action} request` : row.action
      return <article className="panel record" key={row.id}><div>
        <p className="break-anywhere"><strong>{actor}</strong> {action} on <time dateTime={timestamp}>{day} at {time}</time></p>
        {row.outcome >= 400 && <span className="status is-danger">Failed ({row.outcome})</span>}
      </div></article>
    })}</div>
    {!result && !failure && <p role="status">Loading activity…</p>}
    {result?.items.length === 0 && <p className="empty">No matching activity.</p>}
    {(page.number > 1 || result?.hasMore) && <nav className="actions" aria-label="Audit log pages">
      <button className="secondary" disabled={page.number === 1} onClick={() =>
        setPage({ number: page.number - 1, snapshot: page.snapshot })}>Previous</button>
      <span role="status">Page {page.number}</span>
      <button className="secondary" disabled={!result?.hasMore} onClick={() =>
        setPage({ number: page.number + 1, snapshot: result?.snapshotUtc })}>Next</button>
    </nav>}
  </>
}

type Occupancy = { sold: number; available: number; revenue: number; occupancy: number; adr: number; revPar: number }

export function Reports({ api, path }: { api: Api; path: string }) {
  const [report, setReport] = useState<Occupancy>()
  return <><PageHeading title="Reports" image="/heroes/reports.webp" icon={ChartNoAxesCombined} /><section className="panel"><h2>Booking occupancy</h2>
    <ActionForm label="Run report" action={async data => setReport(await api<Occupancy>(
      `${path}/reports/occupancy?arrival=${field(data, 'arrival')}&departure=${field(data, 'departure')}`))}>
      <div className="fields"><label>From<input type="date" name="arrival" required defaultValue={today()} /></label>
        <DescribedField label="Until (exclusive)" description="Choose the first date to exclude from the report."><input type="date" name="departure" required /></DescribedField></div>
    </ActionForm></section>
    {report && <div className="card-grid">
      <article className="panel metric">
        <div className="report-stat-label"><span className="metric-icon"><CalendarCheck size={18} aria-hidden="true" /></span><p>Room nights booked</p></div><strong>{report.sold} / {report.available}</strong>
        <p>Booked nights out of all available room nights in the selected period. One room booked for two nights counts as two.</p>
      </article>
      <article className="panel metric">
        <div className="report-stat-label"><span className="metric-icon"><Percent size={18} aria-hidden="true" /></span><p>Occupancy</p></div><strong>{report.occupancy.toFixed(1)}%</strong>
        <p>The percentage of available room nights that were booked.</p>
      </article>
      <article className="panel metric">
        <div className="report-stat-label"><span className="metric-icon"><Coins size={18} aria-hidden="true" /></span><p>Room revenue</p></div><strong>{currency(report.revenue)}</strong>
        <p>The value of room nights booked in the selected period, based on reservation rates. Extras and cash receipts are tracked separately.</p>
      </article>
      <article className="panel metric">
        <div className="report-stat-label"><span className="metric-icon"><TrendingUp size={18} aria-hidden="true" /></span><p>Average daily rate</p></div><strong>{currency(report.adr)}</strong>
        <p>Room revenue divided by the number of booked room nights.</p>
      </article>
      <article className="panel metric">
        <div className="report-stat-label"><span className="metric-icon"><BedDouble size={18} aria-hidden="true" /></span><p>Revenue per available room</p></div><strong>{currency(report.revPar)}</strong>
        <p>Room revenue divided by all available room nights, including nights that went unbooked.</p>
      </article>
    </div>}
  </>
}
