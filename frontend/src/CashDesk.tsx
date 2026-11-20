import { Wallet } from 'lucide-react'
import { currency, toPesewas } from './api'
import type { Api } from './api'
import { ActionForm, DescribedField, field, Notice, PageHeading, useRecords } from './components'

type Shift = { id: string; cashierId: string; cashierName?: string | null; cashierEmail?: string | null; openedUtc: string; float: number; closedUtc?: string; counted?: number; expected?: number }

export function CashDesk({ api, path, staffId }: { api: Api; path: string; staffId: string }) {
  const endpoint = `${path}/cash-shifts`
  const { rows, error, reload } = useRecords<Shift>(api, endpoint)
  const ownShift = rows.find(shift => shift.cashierId === staffId && !shift.closedUtc)
  return <><PageHeading title="Cash desk" image="/heroes/cash-desk.webp" icon={Wallet} /><Notice text={error} />
    {!ownShift && <section className="panel"><h2>Open a cash shift</h2>
      <ActionForm label="Open shift" action={async data => {
        await api(endpoint, 'POST', { amount: toPesewas(field(data, 'amount')) }); reload()
      }}><DescribedField label="Opening float (GHS)" description="Enter the cash already in the till at the start of the shift, including money set aside for change."><input name="amount" inputMode="decimal" required /></DescribedField></ActionForm></section>}
    <div className="record-list">{rows.map(shift => <article className="panel" key={shift.id}>
      <div className="section-title"><h2>{new Date(shift.openedUtc).toLocaleString()}</h2><span className={`status ${shift.closedUtc ? '' : 'is-positive'}`}>{shift.closedUtc ? 'Closed' : 'Open'}</span></div>
      <p>Cashier: {shift.cashierName || 'Unknown cashier'}{shift.cashierEmail && ` (${shift.cashierEmail.toLowerCase()})`} opening float {currency(shift.float)}</p>
      {shift.closedUtc ? <p>Counted {currency(shift.counted ?? 0)} · Expected {currency(shift.expected ?? 0)} · Variance {currency((shift.counted ?? 0) - (shift.expected ?? 0))}</p> :
        <ActionForm label="Close shift" action={async data => {
          await api(`${endpoint}/${shift.id}/close`, 'POST', { amount: toPesewas(field(data, 'amount')) }); reload()
        }}><DescribedField label="Cash counted (GHS)" description="Enter the total cash physically in the till at closing, including the opening float."><input name="amount" inputMode="decimal" required /></DescribedField></ActionForm>}
    </article>)}</div></>
}
