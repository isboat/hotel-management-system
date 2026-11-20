import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { currency, toPesewas, today } from './api'
import type { Api } from './api'
import { ActionForm, DescribedField, field, Notice, PageHeading, useRecords } from './components'
import { ConfirmationOverlay } from './ConfirmationOverlay'
import type { ConfirmationReview } from './ConfirmationOverlay'
import type { Folio, Guest, Receipt, Room, Stay } from './types'

export function Reservations({ api, path, canRefund, property }: { api: Api; path: string; canRefund: boolean; property: string }) {
  const [availability, setAvailability] = useState<Room[]>()
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
  const [guestSearch, setGuestSearch] = useState('')
  const [bookingGuest, setBookingGuest] = useState<Guest>()
  const guests = useRecords<Guest>(api, booking ? `${path}/guests?search=${encodeURIComponent(guestSearch)}` : null)
  const guestOptions = bookingGuest && !guests.rows.some(guest => guest.id === bookingGuest.id)
    ? [bookingGuest, ...guests.rows] : guests.rows

  const [confirmation, setConfirmation] = useState<{ review: ConfirmationReview; decide: (confirmed: boolean) => void }>()

  function requestConfirmation(review: ConfirmationReview) {
    const trigger = document.activeElement
    return new Promise<boolean>(resolve => {
      setConfirmation({ review, decide: confirmed => {
        setConfirmation(undefined)
        resolve(confirmed)
        if (!confirmed && trigger instanceof HTMLElement) requestAnimationFrame(() => trigger.focus())
      } })
    })
  }

  return <>
    {confirmation && <ConfirmationOverlay review={confirmation.review} onDecision={confirmation.decide} />}
    <PageHeading title="Reservations" icon={CalendarDays} subtitle="Arrivals, departures and guest folios"><button onClick={() => { setAvailability(undefined); setBookingGuest(undefined); setGuestSearch(''); setBooking(value => !value) }}><Plus size={17} aria-hidden="true" /> New reservation</button></PageHeading>
    <Notice text={error || errorText} />
    {booking && <section className="panel"><h2>Find availability</h2>
      <ActionForm label="Find rooms" action={async () => {
        setAvailability(undefined)
        setAvailability(await api<Room[]>(`${path}/availability?arrival=${arrival}&departure=${departure}`))
      }}>
        <div className="fields"><label>Arrival<input type="date" required value={arrival} onChange={event => { setArrival(event.target.value); setAvailability(undefined) }} /></label>
          <DescribedField label="Departure" description="Choose the checkout date. The final booked night is the night before."><input type="date" required value={departure} onChange={event => { setDeparture(event.target.value); setAvailability(undefined) }} /></DescribedField></div>
      </ActionForm>
      {availability?.length === 0 && <p className="empty" role="status">No rooms are available for the selected dates. Try a different arrival or departure date.</p>}
      {!!availability?.length && <ActionForm label="Confirm reservation" action={async data => {
        const guest = (bookingGuest?.name ?? field(data, 'guest')).trim()
        const room = availability.find(room => room.id === field(data, 'room'))
        if (!guest || !room) throw new Error('Enter a guest name and select an available room.')
        if (!await requestConfirmation({
          title: 'Review reservation', subtitle: guest, confirmLabel: 'Confirm reservation',
          details: [
            { label: 'Room', value: `Room ${room.number}` },
            { label: 'Arrival', value: arrival },
            { label: 'Departure', value: departure },
            { label: 'Nightly rate', value: currency(room.rate) },
          ],
        })) return
        await api(`${path}/reservations`, 'POST', { guest, guestId: bookingGuest?.id ?? null, roomId: room.id, arrival, departure })
        reload(); setAvailability(undefined); setBooking(false)
      }}><Notice text={guests.error} /><div className="fields">
        <label>Search guest profiles<input value={guestSearch} onChange={event => setGuestSearch(event.target.value)} placeholder="Guest name" /></label>
        <DescribedField label="Guest profile" description="Select an existing guest or enter a name to create a new guest profile."><select value={bookingGuest?.id ?? ''} onChange={event => setBookingGuest(guestOptions.find(guest => guest.id === event.target.value))}>
        <option value="">Add a new guest</option>{guestOptions.map(guest => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
      </select></DescribedField>{!bookingGuest && <label>Guest name<input name="guest" required /></label>}<label>Available room<select name="room">
        {availability.map(room => <option value={room.id} key={room.id}>Room {room.number} · {currency(room.rate)} / night</option>)}
      </select></label></div></ActionForm>}
    </section>}
    {selected && <GuestFolio key={selected.id} api={api} path={path} stay={rows.find(row => row.id === selected.id) ?? selected} canRefund={canRefund} property={property} requestConfirmation={requestConfirmation} close={() => setSelected(undefined)} />}
    <div className="fields">
      <label>Find a reservation<input value={search} onChange={event => { setSearch(event.target.value); setOffset(0) }} placeholder="Guest name" /></label>
      <label>Reservation status<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}>
        <option value="">All statuses</option><option value="Confirmed">Confirmed</option>
        <option value="CheckedIn">Checked in</option><option value="CheckedOut">Checked out</option><option value="Cancelled">Cancelled</option>
      </select></label>
    </div>
    <div className="record-list">
      {rows.map(row => <article className="panel record" key={row.id}>
        <div><h2>{row.guest}</h2><p>{row.arrival} to {row.departure}</p></div><span className={`status ${row.status === 'CheckedIn' ? 'is-positive' : row.status === 'Cancelled' ? 'is-danger' : ''}`}>{row.status.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
        <div className="actions"><button className="secondary" onClick={() => setSelected(row)}>Folio</button>
          {(row.status === 'Confirmed' || row.status === 'CheckedIn') && <button onClick={async () => {
            setErrorText('')
            try { await api(`${path}/reservations/${row.id}`, 'PATCH', { status: row.status === 'Confirmed' ? 'CheckedIn' : 'CheckedOut' }); reload() }
            catch (failure) { setErrorText((failure as Error).message) }
          }}>{row.status === 'Confirmed' ? 'Check in' : 'Check out'}</button>}
          {row.status === 'Confirmed' && <button className="secondary danger" onClick={async () => {
            if (!await requestConfirmation({
              title: 'Cancel booking?', subtitle: row.guest, confirmLabel: 'Yes, cancel booking',
              details: [
                { label: 'Arrival', value: row.arrival },
                { label: 'Departure', value: row.departure },
              ],
            })) return
            setErrorText('')
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

function GuestFolio({ api, path, stay, close, canRefund, property, requestConfirmation }: {
  api: Api; path: string; stay: Stay; close: () => void; canRefund: boolean; property: string
  requestConfirmation: (review: ConfirmationReview) => Promise<boolean>
}) {
  const [folio, setFolio] = useState<Folio>()
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Receipt>()
  const reference = useRef(crypto.randomUUID())
  const refundReference = useRef(crypto.randomUUID())
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
        const amount = toPesewas(field(data, 'amount'))
        const tendered = toPesewas(field(data, 'tendered'))
        if (amount <= 0 || amount > folio.balance) throw new Error('Enter a payment greater than zero and within the outstanding balance.')
        if (tendered < amount) throw new Error('Cash tendered must cover the amount applied.')
        if (!await requestConfirmation({
          title: 'Review cash payment', subtitle: `${stay.guest}’s folio`, confirmLabel: 'Confirm payment',
          details: [
            { label: 'Amount applied', value: currency(amount) },
            { label: 'Cash tendered', value: currency(tendered) },
            { label: 'Change to give', value: currency(tendered - amount) },
          ],
        })) return
        const payment = await api<Receipt>(`${endpoint}/payments`, 'POST', {
          reference: reference.current, amount, tendered,
        })
        setFolio(await api<Folio>(endpoint))
        setReceipt(payment)
        reference.current = crypto.randomUUID()
      }}><div className="fields"><DescribedField label="Amount applied (GHS)" description="Enter how much of this payment should go toward the guest’s outstanding balance.">
          <FolioAmountInput name="amount" />
        </DescribedField>
        <DescribedField label="Cash tendered (GHS)" description="Enter the total cash the guest handed you, before giving any change.">
          <FolioAmountInput name="tendered" />
        </DescribedField></div></ActionForm>}
      {!['Cancelled', 'CheckedOut'].includes(stay.status) && <ActionForm label="Post charge" action={async data => {
        const description = field(data, 'description').trim()
        const amount = toPesewas(field(data, 'charge'))
        if (!description || amount <= 0) throw new Error('Enter a charge description and an amount greater than zero.')
        if (!await requestConfirmation({
          title: 'Review charge', subtitle: `${stay.guest}’s folio`, confirmLabel: 'Confirm charge',
          details: [
            { label: 'Description', value: description },
            { label: 'Charge amount', value: currency(amount) },
          ],
        })) return
        await api(`${endpoint}/charges`, 'POST', { description, amount })
        setFolio(await api<Folio>(endpoint))
      }}><div className="fields"><DescribedField label="Charge description" description="Describe what the guest is being charged for, such as laundry or room service.">
          <input name="description" required />
        </DescribedField>
        <DescribedField label="Charge amount (GHS)" description="Enter the price of the item or service to add to the guest’s balance.">
          <FolioAmountInput name="charge" />
        </DescribedField></div></ActionForm>}
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
      }}><div className="fields"><DescribedField label="Refund amount (GHS)" description="Enter the cash to return. It cannot exceed the amount still refundable on this receipt."><input name="refund" required inputMode="decimal" /></DescribedField>
        <DescribedField label="Refund reason" description="Explain why the guest is receiving a refund."><input name="reason" required /></DescribedField></div></ActionForm>}
    </>}
  </section>
}

function FolioAmountInput({ name, id, 'aria-describedby': descriptionId }: {
  name: string
  id?: string
  'aria-describedby'?: string
}) {
  const [value, setValue] = useState('')
  return <input id={id} name={name} aria-describedby={descriptionId} value={value}
    inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required
    onChange={event => {
      const next = event.currentTarget.value
      if (/^\d*(?:\.\d{0,2})?$/.test(next)) setValue(next)
    }} />
}
