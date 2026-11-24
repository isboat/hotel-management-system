import { KeyRound } from 'lucide-react'
import type { Api } from './api'
import { ActionForm, DescribedField, field, PageHeading } from './components'

export function ChangePassword({ api, onPasswordChanged }: { api: Api; onPasswordChanged: () => void }) {
  return <>
    <PageHeading title="Change password" icon={KeyRound} subtitle="Changing your password signs you out on all devices." />
    <section className="panel">
      <ActionForm label="Update password" busyLabel="Updating password…" action={async data => {
        const currentPassword = field(data, 'currentPassword')
        const newPassword = field(data, 'newPassword')
        if (newPassword !== field(data, 'confirmPassword')) throw new Error('The new passwords do not match.')
        if (newPassword === currentPassword) throw new Error('Choose a password different from your current password.')
        await api('/auth/change-password', 'POST', { currentPassword, newPassword })
        onPasswordChanged()
      }}>
        <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <DescribedField label="New password" description="Use at least 12 characters.">
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
        </DescribedField>
        <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
      </ActionForm>
    </section>
  </>
}
