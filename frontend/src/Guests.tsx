import { useState } from 'react'
import type { Api } from './api'
import { ActionForm, DescribedField, field, Notice, useRecords } from './components'
import type { Guest, Stay } from './types'

export function Guests({ api, path }: { api: Api; path: string }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [guest, setGuest] = useState<Guest>()
  const profiles = useRecords<Guest>(api, `${path}/guests?search=${encodeURIComponent(query)}`)
  const history = useRecords<Stay>(api, guest ? `${path}/guests/${guest.id}/stays` : null)
  async function openGuest(id: string, edit: boolean) {
    setDetailsError('')
    try {
      const profile = await api<Guest>(`${path}/guests/${id}`)
      setGuest(profile)
      setEditing(edit)
    } catch (failure) { setDetailsError((failure as Error).message) }
  }

  return <>
    <div className="section-title"><h1>Guests</h1><button onClick={() => { setGuest(undefined); setEditing(true) }}>Add guest</button></div>
    <label className="search">Find a guest<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    <Notice text={profiles.error || detailsError || (guest ? history.error : '')} />
    {editing && <section className="panel"><h2>{guest ? 'Edit guest' : 'Add guest'}</h2>
      <ActionForm key={guest?.id ?? 'new'} label="Save guest" action={async data => {
        await api(`${path}/guests${guest ? `/${guest.id}` : ''}`, guest ? 'PUT' : 'POST', {
          name: field(data, 'name'), idNumber: field(data, 'idNumber') || null, email: field(data, 'email') || null, phone: field(data, 'phone') || null,
          preferences: field(data, 'preferences') || null, marketingOptIn: data.has('marketing'),
        })
        setEditing(false); setGuest(undefined); profiles.reload()
      }}><div className="fields">
        <label>Name<input name="name" required defaultValue={guest?.name} /></label>
        <DescribedField label="ID number" description="Optional. Enter the number on the guest’s ID document, such as a Ghana Card or passport."><input name="idNumber" maxLength={64} defaultValue={guest?.idNumber ?? ''} /></DescribedField>
        <label>Email<input name="email" type="email" defaultValue={guest?.email ?? ''} /></label>
        <label>Phone<input name="phone" type="tel" defaultValue={guest?.phone ?? ''} /></label>
        <DescribedField label="Preferences" description="Optional. Note requests that may help with future stays, such as a quiet room."><input name="preferences" maxLength={500} defaultValue={guest?.preferences ?? ''} /></DescribedField>
      </div><DescribedField label="Agreed to marketing communications" description="Select only if the guest agreed to receive promotional messages." checkbox><input name="marketing" type="checkbox" defaultChecked={guest?.marketingOptIn} /></DescribedField></ActionForm>
      <button className="text-button" onClick={() => setEditing(false)}>Cancel</button>
    </section>}
    {guest && !editing && <section className="panel"><h2>Guest details · {guest.name}</h2>
      <p>ID number {guest.idNumber ?? 'Not recorded'}</p>
      {guest.email && <p>Email {guest.email}</p>}
      {guest.phone && <p>Phone {guest.phone}</p>}
      {guest.preferences && <p>Preferences {guest.preferences}</p>}
      <h3>Stay history</h3>
      {history.rows.length ? <ul>{history.rows.map(stay => <li key={stay.id}>{stay.arrival} to {stay.departure} · {stay.status}</li>)}</ul> : <p>No linked stays.</p>}
      <button className="text-button" onClick={() => setGuest(undefined)}>Close</button>
    </section>}
    <div className="record-list">{profiles.rows.map(row => <article className="panel record" key={row.id}>
      <div><h2>{row.name}</h2><p>{row.email || row.phone}</p></div>
      <div className="actions"><button className="secondary" onClick={() => void openGuest(row.id, false)}>View details</button>
        <button className="secondary" onClick={() => void openGuest(row.id, true)}>Edit</button></div>
    </article>)}</div>
    {!profiles.rows.length && <p className="empty">No matching guests.</p>}
  </>
}
