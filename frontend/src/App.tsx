import { useCallback, useMemo, useRef, useState } from 'react'
import { BedDouble, Building2, CalendarDays, ChartNoAxesCombined, ClipboardList, ContactRound, LayoutDashboard, LogOut, Menu, Users, Wallet } from 'lucide-react'
import { domAnimation, LazyMotion, MotionConfig, m, useReducedMotion } from 'framer-motion'
import { createApi } from './api'
import { AuditLog, HotelDetails, Reports, StaffDirectory, Tenants } from './Administration'
import { CashDesk } from './CashDesk'
import { Guests } from './Guests'
import { Notice, PageHeading, SignIn, useRecords } from './components'
import { Reservations } from './Reservations'
import { Rooms } from './Rooms'
import { readSession, saveSession } from './session'
import { Overview } from './Overview'
import { NavigationDrawer, WorkspaceNavigation } from './WorkspaceNavigation'
import type { Hotel, Session } from './types'

export default function App() {
  const [session, setSession] = useState(readSession)
  const activeSession = useRef(session)

  const changeSession = useCallback((next?: Session) => {
    activeSession.current = next
    saveSession(next)
    setSession(next)
  }, [])

  const rotateSession = useCallback((previous: Session, tokens: Pick<Session, 'token' | 'refreshToken'>) => {
    if (activeSession.current === previous) saveSession({ ...previous, ...tokens })
  }, [])

  const endSession = useCallback((previous: Session) => {
    if (activeSession.current === previous) changeSession()
  }, [changeSession])

  return <MotionConfig reducedMotion="user">
    <LazyMotion features={domAnimation} strict>
      {session ? <Workspace session={session} onRotate={rotateSession} onLogout={endSession} />
      : <SignIn onSession={changeSession} />}
    </LazyMotion>
  </MotionConfig>
}

function Workspace({ session, onRotate, onLogout }: {
  session: Session
  onRotate: (session: Session, tokens: Pick<Session, 'token' | 'refreshToken'>) => void
  onLogout: (session: Session) => void
}) {
  const api = useMemo(() => createApi(session.token, session.refreshToken, tokens => onRotate(session, tokens),
    () => onLogout(session)), [session, onRotate, onLogout])
  const { rows: hotels, error, reload: reloadHotels } = useRecords<Hotel>(api, session.isSystemAdmin ? null : '/auth/properties')
  const [hotelId, setHotelId] = useState('')
  const [page, setPage] = useState(session.isSystemAdmin ? 'Tenants' : 'Overview')
  const [signingOut, setSigningOut] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reducedMotion = useReducedMotion()
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const hotel = hotels.find(row => row.id === hotelId) ?? hotels[0]
  const path = hotel ? `/properties/${hotel.id}` : ''
  const role = hotel?.role ?? ''
  const manager = ['Manager', 'Administrator'].includes(role)
  const frontDesk = manager || role === 'FrontDesk'
  const items = session.isSystemAdmin
    ? [{ name: 'Tenants', icon: Building2 }, { name: 'Audit log', icon: ClipboardList }]
    : [
      { name: 'Overview', icon: LayoutDashboard }, { name: 'Rooms', icon: BedDouble },
      ...(frontDesk ? [{ name: 'Reservations', icon: CalendarDays }, { name: 'Guests', icon: ContactRound }, { name: 'Cash desk', icon: Wallet }] : []),
      ...(manager ? [{ name: 'Staff', icon: Users }, { name: 'Reports', icon: ChartNoAxesCombined }] : []),
      ...(role === 'Administrator' ? [{ name: 'Hotel details', icon: Building2 }, { name: 'Audit log', icon: ClipboardList }] : []),
    ]
  const navigation = {
    hotels, hotel, page, items,
    onNavigate: (next: string) => { setPage(next); closeDrawer() },
    onPropertyChange: (id: string) => { setHotelId(id); setPage('Overview'); closeDrawer() },
  }
  const accountInitials = session.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return <div className="shell">
    <aside className="sidebar"><WorkspaceNavigation {...navigation} /></aside>
    {drawerOpen && <NavigationDrawer {...navigation} onClose={closeDrawer} />}
    <div className="workspace">
      <header className="workspace-header">
        <div className="header-location">
          <button className="secondary menu-toggle" type="button" aria-label="Open navigation" aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
          <Building2 size={17} aria-hidden="true" />
          <strong>{session.isSystemAdmin ? 'Platform administration' : hotel?.name ?? 'Properties'}</strong>
        </div>
        <div className="header-account">
          <span className="account-avatar" aria-hidden="true">{accountInitials}</span>
          <span className="staff-name">{session.name}</span>
          <button className="secondary" disabled={signingOut} onClick={async () => {
            setSigningOut(true)
            try { await api('/auth/logout', 'POST') }
            catch { /* The local session is cleared even if server invalidation fails. */ }
            finally { onLogout(session) }
          }}><LogOut size={16} aria-hidden="true" /> Sign out</button>
        </div>
      </header>
      <m.main key={`${hotel?.id ?? 'platform'}:${page}`}
        initial={reducedMotion ? false : { opacity: .7, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .22, ease: 'easeOut' }}>
        <Notice text={error} />
        {session.isSystemAdmin ? (page === 'Tenants' ? <Tenants api={api} /> : <AuditLog api={api} path="/platform" />)
          : !hotel ? <><PageHeading title="Properties" image="/heroes/properties.webp" icon={Building2} /><p className="empty">No active property available.</p></>
          : page === 'Rooms' ? <Rooms api={api} path={path} role={role} />
          : page === 'Reservations' && frontDesk ? <Reservations api={api} path={path} canRefund={manager} property={hotel.name} />
          : page === 'Cash desk' && frontDesk ? <CashDesk api={api} path={path} staffId={session.id} />
          : page === 'Guests' && frontDesk ? <Guests api={api} path={path} />
          : page === 'Staff' && manager ? <StaffDirectory api={api} path={path} role={role} />
          : page === 'Reports' && manager ? <Reports api={api} path={path} />
          : page === 'Hotel details' && role === 'Administrator' ? <HotelDetails api={api} path={path} onSaved={reloadHotels} />
          : page === 'Audit log' && role === 'Administrator' ? <AuditLog api={api} path={path} />
          : <Overview api={api} path={path} property={hotel.name} frontDesk={frontDesk} navigate={setPage} />}
      </m.main>
    </div>
  </div>
}
