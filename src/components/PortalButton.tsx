import { ExternalLink } from 'lucide-react'

export function PortalButton({ applicationId, onOpen }: { applicationId?: string; onOpen: () => void }) {
  return <button type="button" data-testid="application-portal-button" className={`portal-button ${applicationId ? 'is-active' : ''}`} title="Open Application Portal manually" aria-label="Open Application Portal manually" onClick={onOpen}>
    <span>Manually</span><ExternalLink size={12} />
  </button>
}
