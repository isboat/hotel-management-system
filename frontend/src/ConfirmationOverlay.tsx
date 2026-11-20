import { useId, useLayoutEffect, useRef } from 'react'
import { ReceiptText } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'

export type ConfirmationReview = {
  title: string
  subtitle: string
  confirmLabel: string
  details: { label: string; value: string }[]
}

export function ConfirmationOverlay({ review, onDecision }: {
  review: ConfirmationReview
  onDecision: (confirmed: boolean) => void
}) {
  const reducedMotion = useReducedMotion()
  const modal = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const subtitleId = useId()

  useLayoutEffect(() => {
    const dialog = modal.current!
    dialog.showModal()
    return () => { dialog.close() }
  }, [])

  return <dialog ref={modal} className="confirmation-overlay" aria-labelledby={headingId} aria-describedby={subtitleId}
    onCancel={event => { event.preventDefault(); onDecision(false) }}>
    <m.div className="confirmation-content" initial={reducedMotion ? false : { opacity: .6, y: 8 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: .2, ease: 'easeOut' }}>
      <span className="confirmation-icon" aria-hidden="true"><ReceiptText size={24} /></span>
      <h2 id={headingId}>{review.title}</h2>
      <p id={subtitleId} className="confirmation-subtitle">{review.subtitle}</p>
      <dl className="confirmation-details">{review.details.map(({ label, value }) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      )}</dl>
      <div className="actions confirmation-actions">
        <button type="button" className="secondary" autoFocus onClick={() => onDecision(false)}>Cancel</button>
        <button type="button" onClick={() => onDecision(true)}>{review.confirmLabel}</button>
      </div>
    </m.div>
  </dialog>
}
