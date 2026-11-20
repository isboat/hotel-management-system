import { useState } from 'react'
import { Check, Wrench } from 'lucide-react'
import type { Api } from './api'
import { ActionForm, DescribedField, Notice, field, useRecords } from './components'
import type { Room } from './types'

type MaintenanceIssue = {
  id: string
  roomNumber: string
  description: string
  resolved: boolean
  reportedUtc?: string | null
  fixedUtc?: string | null
}

const issueDate = new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' })

function IssueDate({ value }: { value?: string | null }) {
  if (!value) return <>Date not recorded</>
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`
  return <time dateTime={utc}>{issueDate.format(new Date(utc))}</time>
}

export function RoomMaintenance({ api, path, rooms }: { api: Api; path: string; rooms: Room[] }) {
  const endpoint = `${path}/maintenance`
  const { rows, error, reload } = useRecords<MaintenanceIssue>(api, endpoint)
  const [filter, setFilter] = useState('all')
  const [description, setDescription] = useState('')
  const [pendingIssue, setPendingIssue] = useState<string>()
  const [feedback, setFeedback] = useState('')
  const [failure, setFailure] = useState('')
  const issues = rows.filter(issue => filter === 'all' || issue.resolved === (filter === 'fixed'))

  async function markFixed(issue: MaintenanceIssue) {
    setPendingIssue(issue.id)
    setFeedback('')
    setFailure('')
    try {
      await api(`${endpoint}/${issue.id}/resolve`, 'PATCH')
      reload()
      setFeedback(`Maintenance issue for Room ${issue.roomNumber} marked fixed.`)
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setPendingIssue(undefined)
    }
  }

  return <div className="maintenance-layout">
    {rooms.length > 0 && <section className="panel maintenance-report">
      <h2><Wrench size={18} aria-hidden="true" /> Report maintenance</h2>
      <ActionForm label="Report issue" action={async data => {
        setFeedback('')
        setFailure('')
        await api(endpoint, 'POST', { roomId: field(data, 'room'), description: field(data, 'description') })
        setDescription('')
        setFilter('all')
        reload()
        setFeedback('Maintenance issue reported.')
      }}>
        <label>Room<select name="room">{rooms.map(room => <option key={room.id} value={room.id}>Room {room.number}</option>)}</select></label>
        <DescribedField label="Issue" description="Include where the problem is, such as a leak under the bathroom sink.">
          <textarea name="description" required maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} />
        </DescribedField>
      </ActionForm>
    </section>}
    <section className="panel maintenance-history">
      <div className="section-title">
        <div><h2>Maintenance history</h2><p>Review open and fixed room issues.</p></div>
        <label>Issue status<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All issues</option><option value="open">Open</option><option value="fixed">Fixed</option>
        </select></label>
      </div>
      <Notice text={error || failure} />
      {feedback && <p role="status">{feedback}</p>}
      <div className="maintenance-list">{issues.map(issue => <article className="maintenance-issue" key={issue.id}>
        <div className="section-title"><h3>Room {issue.roomNumber}</h3>
          <span className={issue.resolved ? 'status' : 'status maintenance-open'}>{issue.resolved ? 'Fixed' : 'Open'}</span>
        </div>
        <p className="multiline-text">{issue.description}</p>
        <dl className="issue-dates">
          <div><dt>Reported</dt><dd><IssueDate value={issue.reportedUtc} /></dd></div>
          {issue.resolved && <div><dt>Fixed</dt><dd><IssueDate value={issue.fixedUtc} /></dd></div>}
        </dl>
        {!issue.resolved && <button className="secondary" type="button" disabled={pendingIssue !== undefined}
          onClick={() => void markFixed(issue)}><Check size={16} />{pendingIssue === issue.id ? 'Saving…' : 'Mark fixed'}</button>}
      </article>)}</div>
      {!issues.length && !error && <p className="empty">{filter === 'all' ? 'No maintenance issues have been reported.' : `No ${filter} issues.`}</p>}
    </section>

  </div>
}
