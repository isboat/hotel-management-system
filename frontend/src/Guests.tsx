import { useState } from 'react'
import type { Api } from './api'
import { ActionForm, field, Notice, useRecords } from './components'
import type { Guest, Stay } from './types'

export function Guests({ api, path }: { api: Api; path: string }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [guest, setGuest] = useState<Guest>()
  const profiles = useRecords<Guest>(api, `${path}/guests?search=${encodeURIComponent(query)}`)
  const history = useRecords<Stay>(api, guest ? `${path}/guests/${guest.id}/stays` : null)
  return <>
    <div className="section-title"><h1>Guests</h1><button onClick={() => { setGuest(undefined); setEditing(true) }}>Add guest</button></div>
    <label className="search">Find a guest<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    <Notice text={profiles.error || (guest ? history.error : '')} />
    {editing && <section className="panel"><h2>{guest ? 'Edit guest' : 'Add guest'}</h2>
      <ActionForm key={guest?.id ?? 'new'} label="Save guest" action={async data => {
        await api(`${path}/guests${guest ? `/${guest.id}` : ''}`, guest ? 'PUT' : 'POST', {
          name: field(data, 'name'), email: field(data, 'email') || null, phone: field(data, 'phone') || null,
          preferences: field(data, 'preferences') || null, marketingOptIn: data.has('marketing'),
        })
        setEditing(false); setGuest(undefined); profiles.reload()
      }}><div className="fields">
        <label>Name<input name="name" required defaultValue={guest?.name} /></label>
        <label>Email<input name="email" type="email" defaultValue={guest?.email ?? ''} /></label>
        <label>Phone<input name="phone" type="tel" defaultValue={guest?.phone ?? ''} /></label>
        <label>Preferences<input name="preferences" maxLength={500} defaultValue={guest?.preferences ?? ''} /></label>
      </div><label className="check"><input name="marketing" type="checkbox" defaultChecked={guest?.marketingOptIn} /> Agreed to marketing communications</label></ActionForm>
      <button className="text-button" onClick={() => setEditing(false)}>Cancel</button>
    </section>}
    {guest && !editing && <section className="panel"><h2>Stay history · {guest.name}</h2>
      {history.rows.length ? <ul>{history.rows.map(stay => <li key={stay.id}>{stay.arrival} to {stay.departure} · {stay.status}</li>)}</ul> : <p>No linked stays.</p>}
      <button className="text-button" onClick={() => setGuest(undefined)}>Close</button>
    </section>}
    <div className="record-list">{profiles.rows.map(row => <article className="panel record" key={row.id}>
      <div><h2>{row.name}</h2><p>{row.email || row.phone}</p></div>
      <div className="actions"><button className="secondary" onClick={() => { setGuest(row); setEditing(false) }}>Stay history</button>
        <button className="secondary" onClick={() => { setGuest(row); setEditing(true) }}>Edit</button></div>
    </article>)}</div>
    {!profiles.rows.length && <p className="empty">No matching guests.</p>}
  </>
}
