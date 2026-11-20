import { ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, CalendarDays, ClipboardCheck, UserRound } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import { today } from './api'
import type { Api } from './api'
import { Notice, useRecords } from './components'
import type { Room, Stay } from './types'

export function Overview({ api, path, property, frontDesk, navigate }: {
  api: Api; path: string; property: string; frontDesk: boolean; navigate: (page: string) => void
}) {
  const rooms = useRecords<Room>(api, `${path}/rooms`)
  const date = today()
  const arrivals = useRecords<Stay>(api, frontDesk ? `${path}/reservations?status=Confirmed&arrival=${date}` : null)
  const departures = useRecords<Stay>(api, frontDesk ? `${path}/reservations?status=CheckedIn&departure=${date}` : null)
  const reducedMotion = useReducedMotion()
  const openRooms = rooms.rows.filter(room => !room.outOfService)
  const readyRooms = openRooms.filter(room => room.status !== 'Dirty').length
  const stats = [
    { title: 'Rooms ready', value: readyRooms, icon: BedDouble, tone: 'mint' },
    ...(frontDesk ? [
      { title: 'Arrivals today', value: arrivals.rows.length, icon: ArrowDownLeft, tone: 'violet' },
      { title: 'Departures today', value: departures.rows.length, icon: ArrowUpRight, tone: 'blue' },
    ] : []),
  ]
  const readiness = [
    { label: 'Ready', total: readyRooms, tone: 'mint' },
    { label: 'Awaiting cleaning', total: openRooms.length - readyRooms, tone: 'amber' },
    { label: 'Out of service', total: rooms.rows.length - openRooms.length, tone: '' },
  ]

  return <>
    <m.section className="workspace-hero overview-hero" initial={reducedMotion ? false : { opacity: .75, y: 8 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, ease: 'easeOut' }}>
      <div className="hero-body">
        <p className="hero-date"><CalendarDays size={15} aria-hidden="true" />
          {new Intl.DateTimeFormat('en-GH', { dateStyle: 'long', timeZone: 'Africa/Accra' }).format(new Date())}
        </p>
        <h1 className="overview-hotel-name">{property}</h1>
        <div className="actions hero-actions">
          <button type="button" onClick={() => navigate('Rooms')}><BedDouble size={17} aria-hidden="true" /> Room inventory</button>
          {frontDesk && <button type="button" className="secondary" onClick={() => navigate('Reservations')}>
            Manage reservations <ArrowRight size={16} aria-hidden="true" />
          </button>}
        </div>
      </div>
    </m.section>
    <Notice text={rooms.error || arrivals.error || departures.error} />
    <div className="card-grid overview-stats">
      {stats.map(({ title, value, icon: Icon, tone }, index) => <m.article key={title} className="panel metric overview-stat"
        initial={reducedMotion ? false : { opacity: .65, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reducedMotion ? 0 : index * .055, duration: .26, ease: 'easeOut' }}>
        <div className="overview-statline"><span className={`metric-icon ${tone}`}><Icon size={19} aria-hidden="true" /></span><p>{title}</p></div>
        <strong>{value}</strong>
      </m.article>)}
    </div>
    <div className="overview-lower">
      {frontDesk && <section className="panel">
        <div className="section-title"><h2><UserRound size={18} aria-hidden="true" /> Expected arrivals</h2>
          <button className="secondary" onClick={() => navigate('Reservations')}>View reservations <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
        {arrivals.rows.length ? <ul className="arrivals">{arrivals.rows.map(row => <li key={row.id}>
          <span className="arrival-avatar" aria-hidden="true">{row.guest.trim().slice(0, 1).toUpperCase()}</span>{row.guest}
        </li>)}</ul> : <p className="empty">No pending arrivals today.</p>}
      </section>}
      <section className="panel">
        <h2><ClipboardCheck size={18} aria-hidden="true" /> Room readiness</h2>
        <div className="readiness">{readiness.map(({ label, total, tone }) => <div key={label}>
          <div className="readiness-label"><span>{label}</span><strong>{total}</strong></div>
          <div className="readiness-track" aria-hidden="true">
            <m.span className={tone} initial={reducedMotion ? false : { width: 0 }}
              animate={{ width: `${rooms.rows.length ? total * 100 / rooms.rows.length : 0}%` }}
              transition={{ duration: reducedMotion ? 0 : .36, ease: 'easeOut' }} />
          </div>
        </div>)}</div>
      </section>
    </div>
  </>
}
