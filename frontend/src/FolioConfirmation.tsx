import { useId, useLayoutEffect, useRef } from 'react'
import { ReceiptText } from 'lucide-react'

export type FolioReview = {
  title: string
  guest: string
  confirmLabel: string
  details: { label: string; value: string }[]
}

export function FolioConfirmation({ review, onDecision }: {
  review: FolioReview
  onDecision: (confirmed: boolean) => void
}) {
  const modal = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const guestId = useId()

  useLayoutEffect(() => {
    const dialog = modal.current!
    dialog.showModal()
    return () => { dialog.close() }
  }, [])

  return <dialog ref={modal} className="folio-confirmation" aria-labelledby={headingId} aria-describedby={guestId}
    onCancel={event => { event.preventDefault(); onDecision(false) }}>
    <div className="confirmation-content">
      <span className="confirmation-icon" aria-hidden="true"><ReceiptText size={24} /></span>
      <h2 id={headingId}>{review.title}</h2>
      <p id={guestId} className="confirmation-guest">{review.guest}’s folio</p>
      <dl className="confirmation-details">{review.details.map(({ label, value }) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      )}</dl>
      <div className="actions confirmation-actions">
        <button type="button" className="secondary" autoFocus onClick={() => onDecision(false)}>Cancel</button>
        <button type="button" onClick={() => onDecision(true)}>{review.confirmLabel}</button>
      </div>
    </div>
  </dialog>
}
