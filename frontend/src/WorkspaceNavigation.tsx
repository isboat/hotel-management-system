import { useEffect, useLayoutEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, ChevronDown, X } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import type { Hotel } from './types'

export function Brand() {
  return <span className="brand">
    <span className="brand-mark"><Building2 size={20} aria-hidden="true" /></span>
    <span>PremaDesk<small>Hotel management</small></span>
  </span>
}

type NavigationProps = {
  hotels: Hotel[]
  hotel?: Hotel
  page: string
  items: { name: string; icon: LucideIcon }[]
  onNavigate: (page: string) => void
  onPropertyChange: (id: string) => void
}

export function WorkspaceNavigation({ hotels, hotel, page, items, onNavigate, onPropertyChange, onClose }: NavigationProps & {
  onClose?: () => void
}) {
  return <div className="sidebar-body">
    <div className="drawer-heading"><Brand />
      {onClose && <button className="drawer-close secondary" type="button" aria-label="Close navigation" onClick={onClose}>
        <X size={20} />
      </button>}
    </div>
    {hotel && <label className="property">
      <span className="property-label"><ChevronDown size={13} aria-hidden="true" /> Property</span>
      <select value={hotel.id} onChange={event => onPropertyChange(event.target.value)}>
        {hotels.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
    </label>}
    <nav className="workspace-nav" aria-label="Main navigation">
      {items.map(({ name, icon: Icon }) => <button key={name} type="button" onClick={() => onNavigate(name)}
        aria-current={page === name ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" />{name}{page === name && <span className="nav-marker" aria-hidden="true" />}
      </button>)}
    </nav>
  </div>
}

export function NavigationDrawer({ onClose, ...navigation }: NavigationProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => { element.close() }
  }, [])

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 901px)')
    if (wide.matches) onClose()
    wide.addEventListener('change', onClose)
    return () => wide.removeEventListener('change', onClose)
  }, [onClose])

  return <dialog ref={dialog} className="mobile-drawer" aria-label="Workspace navigation"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <m.div className="drawer-content" initial={reducedMotion ? false : { x: -24, opacity: 0.4 }}
      animate={{ x: 0, opacity: 1 }} transition={{ duration: .23, ease: 'easeOut' }}>
      <WorkspaceNavigation {...navigation} onClose={onClose} />
    </m.div>
  </dialog>
}
