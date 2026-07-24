const PORTAL_ORIGIN = import.meta.env.VITE_PORTAL_URL || 'https://hyna-ai-lending-platform.hugosentinal1993.chatgpt.site'

export function getPortalUrl(applicationId?: string) {
  if (!applicationId) return `${PORTAL_ORIGIN}/broker/dashboard`
  const query = new URLSearchParams({ applicationId, mode: 'prototype-handoff' })
  return `${PORTAL_ORIGIN}/#/handoff?${query.toString()}`
}

export function openPortal(applicationId?: string) {
  window.location.assign(getPortalUrl(applicationId))
}
