import { useState } from 'react'
import { BedDouble } from 'lucide-react'
import { currency, toPesewas } from './api'
import type { Api } from './api'
import { ActionForm, DescribedField, field, Notice, useRecords } from './components'
import type { Room } from './types'

export function Rooms({ api, path, role }: { api: Api; path: string; role: string }) {
  const { rows, error, reload } = useRecords<Room>(api, `${path}/rooms`)
  const [selected, setSelected] = useState<Room>()
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState('')
  const [feedback, setFeedback] = useState('')
  const manager = ['Manager', 'Administrator'].includes(role)
  const canClean = role !== 'FrontDesk'

  async function update(suffix: string, method: string, data?: unknown) {
    setFeedback('')
    try { await api(`${path}${suffix}`, method, data); reload() }
    catch (failure) { setFeedback((failure as Error).message) }
  }

  return <>
    <div className="section-title"><div><h1>Rooms</h1><p>Inventory and housekeeping</p></div>
      {manager && <button onClick={() => { setSelected(undefined); setEditing(true) }}>Add room</button>}
    </div>
    <Notice text={error || feedback} />
    {editing && <section className="panel">
      <h2>{selected ? `Edit room ${selected.number}` : 'Add room'}</h2>
      <ActionForm key={selected?.id ?? 'new'} label="Save room" action={async data => {
        await api(`${path}/rooms${selected ? `/${selected.id}` : ''}`, selected ? 'PUT' : 'POST', {
          number: field(data, 'number'), type: field(data, 'type'), capacity: Number(field(data, 'capacity')),
          description: field(data, 'description'), rate: toPesewas(field(data, 'rate')), outOfService: data.has('closed'),
        })
        setEditing(false)
        reload()
      }}>
        <div className="fields">
          <label>Room number<input name="number" required defaultValue={selected?.number} /></label>
          <DescribedField label="Room type" description="Enter a category such as Single, Double, or Suite."><input name="type" required defaultValue={selected?.type} /></DescribedField>
          <DescribedField label="Capacity" description="Enter the maximum number of guests the room can accommodate."><input name="capacity" type="number" min="1" max="100" defaultValue={selected?.capacity ?? 2} required /></DescribedField>
          <DescribedField label="Nightly rate (GHS)" description="Enter the price for one night. This rate is used for new reservations."><input name="rate" inputMode="decimal" required defaultValue={selected ? selected.rate / 100 : ''} /></DescribedField>
        </div>
        <DescribedField label="Room description" description="Optional. Mention features staff may need when assigning the room, such as a balcony or step-free access."><textarea name="description" rows={3} maxLength={1000} defaultValue={selected?.description ?? ''} /></DescribedField>
        <DescribedField label="Out of service" description="Select to make the room unavailable for new bookings." checkbox><input name="closed" type="checkbox" defaultChecked={selected?.outOfService} /></DescribedField>
      </ActionForm>
      <button className="text-button" onClick={() => setEditing(false)}>Cancel</button>
    </section>}
    <label className="search">Find a room<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Room number or type" /></label>
    <div className="card-grid">{rows.filter(room => `${room.number} ${room.type}`.toLowerCase().includes(filter.toLowerCase())).map(room =>
      <article className="panel room-card" key={room.id}>
        <div className="section-title"><BedDouble size={22} /><span className="status">{room.outOfService ? 'Out of service' : room.status}</span></div>
        <h2>Room {room.number}</h2>
        <p>{room.type} · Sleeps {room.capacity}</p>
        {room.description && <p className="multiline-text">{room.description}</p>}
        <strong>{currency(room.rate)} / night</strong>
        {canClean && <DescribedField label="Housekeeping status" description="Use Dirty for rooms awaiting cleaning, Clean after cleaning, and Inspected after a supervisor’s check. Saving is automatic."><select value={room.status} onChange={event => void update(`/rooms/${room.id}/housekeeping`, 'PATCH', { status: event.target.value })}>
          <option>Dirty</option><option>Clean</option>{(role !== 'Housekeeping' || room.status === 'Inspected') && <option disabled={role === 'Housekeeping'}>Inspected</option>}
        </select></DescribedField>}
        {manager && <div className="actions"><button className="secondary" onClick={() => { setSelected(room); setEditing(true) }}>Edit</button>
          <button className="secondary danger" onClick={() => { if (confirm(`Remove room ${room.number} from inventory?`)) void update(`/rooms/${room.id}`, 'DELETE') }}>Remove</button></div>}
      </article>)}</div>
    {!rows.length && <p className="empty">No rooms in this property yet.</p>}
    {canClean && rows.length > 0 && <section className="panel"><h2>Report maintenance</h2>
      <ActionForm label="Report issue" action={async data => {
        await api(`${path}/maintenance`, 'POST', { roomId: field(data, 'room'), description: field(data, 'description') })
        setFeedback('Maintenance issue reported.')
      }}><div className="fields"><label>Room<select name="room">{rows.map(room => <option key={room.id} value={room.id}>{room.number}</option>)}</select></label>
        <DescribedField label="Issue" description="Describe the problem and where it is in the room, such as a leak under the bathroom sink."><input name="description" required maxLength={500} /></DescribedField></div>
      </ActionForm></section>}
  </>
}
