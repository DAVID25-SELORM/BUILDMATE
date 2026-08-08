# Data retention and tenant lifecycle

Tenant export and closure requests are recorded in `tenant_data_requests` and visible to authorised platform staff. A closure request immediately blocks organisation permissions while preserving memberships and audit integrity. Financial, settlement, order and security records remain subject to statutory retention; the default closure retention marker is seven years.

Operational rate-limit counters are retained for seven days and analytics events for 24 months by the authenticated maintenance cron. Audit, payment, order and settlement records are not automatically purged.

Exports must be generated server-side, encrypted in transit and at rest, shared by an expiring authenticated link, and recorded as completed by an authorised administrator. Anonymisation or deletion after retention expiry requires legal approval, a reviewed forward migration or controlled job, and an audit entry.
