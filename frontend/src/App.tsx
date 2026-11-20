import { useMemo, useState } from 'react'
import { BedDouble, Building2, CalendarDays, ChartNoAxesCombined, ClipboardList, LayoutDashboard, LogOut, Users, Wallet } from 'lucide-react'
import { createApi, today } from './api'
import type { Api } from './api'
import { AuditLog, Reports, StaffDirectory, Tenants } from './Administration'
import { CashDesk } from './CashDesk'
import { Guests } from './Guests'
import { Notice, SignIn, useRecords } from './components'
import { Reservations } from './Reservations'
import { Rooms } from './Rooms'
import type { Hotel, Room, Session, Stay } from './types'

export default function App() {
  const [session, setSession] = useState<Session>()
  return session ? <Workspace session={session} onLogout={() => setSession(undefined)} /> : <SignIn onSession={setSession} />
}

function Workspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const api = useMemo(() => createApi(session.token, session.refreshToken), [session.token, session.refreshToken])
  const { rows: hotels, error } = useRecords<Hotel>(api, session.isSystemAdmin ? null : '/auth/properties')
  const [hotelId, setHotelId] = useState('')
  const [page, setPage] = useState(session.isSystemAdmin ? 'Tenants' : 'Overview')
  const [signingOut, setSigningOut] = useState(false)
  const hotel = hotels.find(row => row.id === hotelId) ?? hotels[0]
  const path = hotel ? `/properties/${hotel.id}` : ''
  const role = hotel?.role ?? ''
  const manager = ['Manager', 'Administrator'].includes(role)
  const frontDesk = manager || role === 'FrontDesk'
  const items = session.isSystemAdmin
    ? [{ name: 'Tenants', icon: Building2 }, { name: 'Audit log', icon: ClipboardList }]
    : [
      { name: 'Overview', icon: LayoutDashboard }, { name: 'Rooms', icon: BedDouble },
      ...(frontDesk ? [{ name: 'Reservations', icon: CalendarDays }, { name: 'Guests', icon: Users }, { name: 'Cash desk', icon: Wallet }] : []),
      ...(manager ? [{ name: 'Staff', icon: Users }, { name: 'Reports', icon: ChartNoAxesCombined }] : []),
      ...(role === 'Administrator' ? [{ name: 'Audit log', icon: ClipboardList }] : []),
    ]
  return <div className="shell">
    <aside className="sidebar">
      <span className="brand"><Building2 size={21} /> Hotel Management</span>
      {hotel && <label className="property">Property<select value={hotel.id} onChange={event => { setHotelId(event.target.value); setPage('Overview') }}>
        {hotels.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>}
      <nav aria-label="Main navigation">{items.map(({ name, icon: Icon }) =>
        <button key={name} onClick={() => setPage(name)} aria-current={page === name ? 'page' : undefined}><Icon size={17} />{name}</button>)}</nav>
    </aside>
    <div className="workspace">
      <header><span>{session.isSystemAdmin ? 'Platform administration' : hotel?.name}</span>
        <div><span className="staff-name">{session.name}</span><button className="secondary" disabled={signingOut} onClick={async () => {
          setSigningOut(true)
          try { await api('/auth/logout', 'POST') }
          catch { /* The local session is cleared even if server invalidation fails. */ }
          finally { onLogout() }
        }}><LogOut size={16} /> Sign out</button></div></header>
      <main key={hotel?.id ?? 'platform'}>
        <Notice text={error} />
        {session.isSystemAdmin ? (page === 'Tenants' ? <Tenants api={api} /> : <AuditLog api={api} path="/platform" />)
          : !hotel ? <p className="empty">No active property available.</p>
          : page === 'Rooms' ? <Rooms api={api} path={path} role={role} />
          : page === 'Reservations' && frontDesk ? <Reservations api={api} path={path} canRefund={manager} property={hotel.name} />
          : page === 'Cash desk' && frontDesk ? <CashDesk api={api} path={path} staffId={session.id} />
          : page === 'Guests' && frontDesk ? <Guests api={api} path={path} />
          : page === 'Staff' && manager ? <StaffDirectory api={api} path={path} role={role} />
          : page === 'Reports' && manager ? <Reports api={api} path={path} />
          : page === 'Audit log' && role === 'Administrator' ? <AuditLog api={api} path={path} />
          : <Overview api={api} path={path} property={hotel.name} frontDesk={frontDesk} navigate={setPage} />}
      </main>
    </div>
  </div>
}

function Overview({ api, path, property, frontDesk, navigate }: {
  api: Api; path: string; property: string; frontDesk: boolean; navigate: (page: string) => void
}) {
  const rooms = useRecords<Room>(api, `${path}/rooms`)
  const date = today()
  const arrivals = useRecords<Stay>(api, frontDesk ? `${path}/reservations?status=Confirmed&arrival=${date}` : null)
  const departures = useRecords<Stay>(api, frontDesk ? `${path}/reservations?status=CheckedIn&departure=${date}` : null)
  return <>
    <h1>Overview</h1><p className="subtitle">{property} · {new Intl.DateTimeFormat('en-GH', { dateStyle: 'long', timeZone: 'Africa/Accra' }).format(new Date())}</p>
    <Notice text={rooms.error || arrivals.error || departures.error} />
    <div className="card-grid">
      <article className="panel metric"><BedDouble size={20} /><p>Rooms ready</p><strong>{rooms.rows.filter(room => !room.outOfService && room.status !== 'Dirty').length}</strong></article>
      {frontDesk && <><article className="panel metric"><CalendarDays size={20} /><p>Arrivals today</p><strong>{arrivals.rows.length}</strong></article>
        <article className="panel metric"><CalendarDays size={20} /><p>Departures today</p><strong>{departures.rows.length}</strong></article></>}
    </div>
    {frontDesk && <section className="panel"><div className="section-title"><h2>Expected arrivals</h2><button className="secondary" onClick={() => navigate('Reservations')}>View reservations</button></div>
      {arrivals.rows.length ? <ul className="arrivals">{arrivals.rows.map(row => <li key={row.id}>{row.guest}</li>)}</ul> : <p>No pending arrivals today.</p>}
    </section>}
  </>
}
