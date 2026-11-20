import { useEffect, useId, useRef, useState } from 'react'
import { currency, toPesewas, today } from './api'
import type { Api } from './api'
import { ActionForm, field, Notice, useRecords } from './components'
import type { Folio, Guest, Receipt, Room, Stay } from './types'

export function Reservations({ api, path, canRefund, property }: { api: Api; path: string; canRefund: boolean; property: string }) {
  const [availability, setAvailability] = useState<Room[]>([])
  const [arrival, setArrival] = useState(today)
  const [departure, setDeparture] = useState('')
  const [booking, setBooking] = useState(false)
  const [selected, setSelected] = useState<Stay>()
  const [errorText, setErrorText] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const query = new URLSearchParams({ offset: String(offset), search })
  if (status) query.set('status', status)
  const { rows, error, reload } = useRecords<Stay>(api, `${path}/reservations?${query}`)
  const [guestId, setGuestId] = useState('')
  const guests = useRecords<Guest>(api, booking ? `${path}/guests` : null)

  return <>
    <div className="section-title"><div><h1>Reservations</h1><p>Arrivals, departures and guest folios</p></div><button onClick={() => setBooking(value => !value)}>New reservation</button></div>
    <Notice text={error || errorText} />
    {booking && <section className="panel"><h2>Find availability</h2>
      <ActionForm label="Find rooms" action={async () => setAvailability(await api<Room[]>(`${path}/availability?arrival=${arrival}&departure=${departure}`))}>
        <div className="fields"><label>Arrival<input type="date" required value={arrival} onChange={event => { setArrival(event.target.value); setAvailability([]) }} /></label>
          <label>Departure<input type="date" required value={departure} onChange={event => { setDeparture(event.target.value); setAvailability([]) }} /></label></div>
      </ActionForm>
      {!!availability.length && <ActionForm label="Confirm reservation" action={async data => {
        await api(`${path}/reservations`, 'POST', { guest: guests.rows.find(guest => guest.id === guestId)?.name ?? field(data, 'guest'), guestId: guestId || null, roomId: field(data, 'room'), arrival, departure })
        reload(); setAvailability([]); setBooking(false)
      }}><div className="fields"><label>Guest profile<select value={guestId} onChange={event => setGuestId(event.target.value)}>
        <option value="">Enter a guest name</option>{guests.rows.map(guest => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
      </select></label>{!guestId && <label>Guest name<input name="guest" required /></label>}<label>Available room<select name="room">
        {availability.map(room => <option value={room.id} key={room.id}>Room {room.number} · {currency(room.rate)} / night</option>)}
      </select></label></div></ActionForm>}
    </section>}
    {selected && <GuestFolio key={selected.id} api={api} path={path} stay={rows.find(row => row.id === selected.id) ?? selected} canRefund={canRefund} property={property} close={() => setSelected(undefined)} />}
    <div className="fields">
      <label>Find a reservation<input value={search} onChange={event => { setSearch(event.target.value); setOffset(0) }} placeholder="Guest name" /></label>
      <label>Reservation status<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}>
        <option value="">All statuses</option><option value="Confirmed">Confirmed</option>
        <option value="CheckedIn">Checked in</option><option value="CheckedOut">Checked out</option><option value="Cancelled">Cancelled</option>
      </select></label>
    </div>
    <div className="record-list">
      {rows.map(row => <article className="panel record" key={row.id}>
        <div><h2>{row.guest}</h2><p>{row.arrival} to {row.departure}</p></div><span className="status">{row.status.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
        <div className="actions"><button className="secondary" onClick={() => setSelected(row)}>Folio</button>
          {(row.status === 'Confirmed' || row.status === 'CheckedIn') && <button onClick={async () => {
            setErrorText('')
            try { await api(`${path}/reservations/${row.id}`, 'PATCH', { status: row.status === 'Confirmed' ? 'CheckedIn' : 'CheckedOut' }); reload() }
            catch (failure) { setErrorText((failure as Error).message) }
          }}>{row.status === 'Confirmed' ? 'Check in' : 'Check out'}</button>}
          {row.status === 'Confirmed' && <button className="secondary danger" onClick={async () => {
            if (!confirm('Cancel this reservation?')) return
            try { await api(`${path}/reservations/${row.id}`, 'PATCH', { status: 'Cancelled' }); reload() }
            catch (failure) { setErrorText((failure as Error).message) }
          }}>Cancel booking</button>}
        </div></article>)}
    </div>
    {!rows.length && <p className="empty">No matching reservations.</p>}
    {(offset > 0 || rows.length === 250) && <nav aria-label="Reservation pages" className="actions">
      <button className="secondary" disabled={offset === 0} onClick={() => setOffset(offset - 250)}>Previous</button>
      <span>Page {offset / 250 + 1}</span>
      <button className="secondary" disabled={rows.length < 250} onClick={() => setOffset(offset + 250)}>Next</button>
    </nav>}
  </>
}

function GuestFolio({ api, path, stay, close, canRefund, property }: { api: Api; path: string; stay: Stay; close: () => void; canRefund: boolean; property: string }) {
  const [folio, setFolio] = useState<Folio>()
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Receipt>()
  const reference = useRef(crypto.randomUUID())
  const refundReference = useRef(crypto.randomUUID())
  const fieldId = useId()
  const endpoint = `${path}/folios/${stay.id}`

  useEffect(() => {
    let current = true
    api<Folio>(endpoint).then(value => { if (current) setFolio(value) }, failure => { if (current) setError(failure.message) })
    return () => { current = false }
  }, [api, endpoint])

  return <section className="panel folio">
    <div className="section-title"><h2>Folio · {stay.guest}</h2><button className="secondary" onClick={close}>Close</button></div>
    <Notice text={error} />
    {folio && <><ul>{folio.charges.map(charge => <li key={charge.id}>{charge.description} · {currency(charge.amount)}</li>)}</ul><p>Total {currency(folio.total)} · Balance <strong>{currency(folio.balance)}</strong></p>
      {folio.payments.map(payment => <button className="secondary" key={payment.id} onClick={() => setReceipt(payment)}>
        View receipt · {currency(payment.amount)}
      </button>)}
      {folio.balance > 0 && !['Cancelled', 'CheckedOut'].includes(stay.status) && <ActionForm label="Record cash payment" action={async data => {
        const payment = await api<Receipt>(`${endpoint}/payments`, 'POST', {
          reference: reference.current, amount: toPesewas(field(data, 'amount')), tendered: toPesewas(field(data, 'tendered')),
        })
        setFolio(await api<Folio>(endpoint))
        setReceipt(payment)
        reference.current = crypto.randomUUID()
      }}><div className="fields"><div className="folio-field">
          <label htmlFor={`${fieldId}-amount`}>Amount applied (GHS)</label>
          <span className="field-help" id={`${fieldId}-amount-help`}>Enter how much of this payment should go toward the guest’s outstanding balance.</span>
          <input id={`${fieldId}-amount`} name="amount" aria-describedby={`${fieldId}-amount-help`} required inputMode="decimal" />
        </div>
        <div className="folio-field">
          <label htmlFor={`${fieldId}-tendered`}>Cash tendered (GHS)</label>
          <span className="field-help" id={`${fieldId}-tendered-help`}>Enter the total cash the guest handed you, before giving any change.</span>
          <input id={`${fieldId}-tendered`} name="tendered" aria-describedby={`${fieldId}-tendered-help`} required inputMode="decimal" />
        </div></div></ActionForm>}
      {!['Cancelled', 'CheckedOut'].includes(stay.status) && <ActionForm label="Post charge" action={async data => {
        await api(`${endpoint}/charges`, 'POST', { description: field(data, 'description'), amount: toPesewas(field(data, 'charge')) })
        setFolio(await api<Folio>(endpoint))
      }}><div className="fields"><div className="folio-field">
          <label htmlFor={`${fieldId}-description`}>Charge description</label>
          <span className="field-help" id={`${fieldId}-description-help`}>Describe what the guest is being charged for, such as laundry or room service.</span>
          <input id={`${fieldId}-description`} name="description" aria-describedby={`${fieldId}-description-help`} required />
        </div>
        <div className="folio-field">
          <label htmlFor={`${fieldId}-charge`}>Charge amount (GHS)</label>
          <span className="field-help" id={`${fieldId}-charge-help`}>Enter the price of the item or service to add to the guest’s balance.</span>
          <input id={`${fieldId}-charge`} name="charge" aria-describedby={`${fieldId}-charge-help`} required inputMode="decimal" />
        </div></div></ActionForm>}
      {receipt && <div className="receipt"><h3>{receipt.amount < 0 ? 'Cash refund receipt' : 'Cash receipt'} · {property}</h3>
        <p>Receipt {receipt.id} · Folio {stay.id}</p><p>{new Date(receipt.utc).toLocaleString()} · Cashier {receipt.cashierId}</p>
        {receipt.amount < 0 ? <p>Refunded {currency(-receipt.amount)}</p> :
          <p>Received {currency(receipt.tendered)} · Applied {currency(receipt.amount)} · Change {currency(receipt.tendered - receipt.amount)}</p>}
        <p>Current folio balance {currency(folio.balance)}</p>
        <button className="secondary" onClick={() => window.print()}>Print receipt</button></div>}
      {receipt && receipt.amount > 0 && canRefund && <ActionForm label="Record cash refund" action={async data => {
        const refund = await api<Receipt>(`${endpoint}/refunds`, 'POST', {
          paymentId: receipt.id, reference: refundReference.current, amount: toPesewas(field(data, 'refund')),
          reason: field(data, 'reason'),
        })
        setFolio(await api<Folio>(endpoint))
        setReceipt(refund)
        refundReference.current = crypto.randomUUID()
      }}><div className="fields"><label>Refund amount (GHS)<input name="refund" required inputMode="decimal" /></label>
        <label>Refund reason<input name="reason" required /></label></div></ActionForm>}
    </>}
  </section>
}
