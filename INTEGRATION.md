# Concierge → Broker Portal Integration

## Implemented local pilot

```text
React Concierge
  → /api/chat
  → governed AI provider (explicit Demo or OpenAI Responses API)
  → /api/documents
  → validated local pilot storage + SHA-256 metadata
  → /api/applications
  → SQLite application + message + audit records
  → generated applicationId
  → Broker Portal prototype handoff
```

The browser never receives the OpenAI API key. AI runtime mode is reported by `/api/health` and displayed in the conversation header. If a configured AI request fails, the API returns an error and does not substitute a fake answer.

The public GitHub Pages deployment has no server runtime, so it intentionally remains a labelled Browser Demo. Only fictional information should be entered there.

## Current handoff

The Concierge passes only `applicationId` and `mode=prototype-handoff` to the existing Broker Portal bootstrap route. Applicant names, income, addresses, documents, and application JSON are not placed in the URL.

This remains a prototype handoff: the separate Broker Portal cannot yet retrieve the new SQLite application because it is not connected to the same authenticated cloud service.

## Production target

```text
Applicant / Broker
  → identity provider + MFA
  → API gateway and tenant-aware authorisation
  → application workflow service
  → PostgreSQL (structured data)
  → encrypted object storage (documents)
  → malware scan + OCR/extraction queue
  → governed LLM orchestration + source citations
  → one-time handoff token service
  → Broker and Lender portals
  → immutable audit / monitoring / retention controls
```

## Required production work

### Identity and permissions

- Select an identity provider and implement MFA, session expiry, account recovery, and broker/lender/admin roles.
- Enforce server-side tenant and case-level authorisation on every request.
- Replace the prototype ID link with a short-lived, single-use token bound to application, portal, user/session, and expiry.

### Data and documents

- Migrate SQLite to managed PostgreSQL with migrations, backup, restore, and regional hosting decisions.
- Move files to private encrypted object storage using short-lived signed upload/download URLs.
- Add malware scanning, real MIME inspection, document retention, legal hold, consent, deletion, and version controls.
- Select OCR/document intelligence, define extraction schemas, and store field-level source page/bounding-box citations.

### AI governance

- Confirm model/provider, data-processing terms, retention settings, approved use cases, and human-review policy.
- Add prompt and policy versioning, evaluation datasets, regression tests, hallucination monitoring, and cost/latency controls.
- Ground answers in approved product policy and uploaded evidence; preserve citations and model/runtime metadata.
- Keep all material credit decisions with authorised humans. The AI must not autonomously approve or decline.

### Platform integrations

- Provide CRM/application API documentation, sandbox credentials, webhooks, canonical IDs, and field mappings.
- Provide lender/funding-partner product and policy sources with owners, versions, effective dates, and update process.
- Define e-signature provider, templates, signer workflow, evidence requirements, and callback events.
- Define notification channels, settlement/servicing interfaces, error handling, reconciliation, and support ownership.

### Operations and assurance

- Add HTTPS, WAF/rate limiting, central secrets, monitoring, alerting, trace correlation, and incident response.
- Complete privacy impact, threat-model, penetration, access-review, business-continuity, and Australian regulatory/legal reviews appropriate to the final operating model.
- Do not claim a certification until it has actually been obtained and its scope verified.
