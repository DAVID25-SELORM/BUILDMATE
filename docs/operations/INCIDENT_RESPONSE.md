# Incident response

1. Declare severity and incident lead; record start time and affected workflows.
2. Contain: disable the affected provider route or feature, preserve logs, and rotate exposed credentials.
3. Diagnose using request IDs, Supabase Auth/API/Postgres logs, payment events, audit logs and provider dashboards.
4. Recover with the smallest reversible change. Reconcile every payment and settlement affected during the window.
5. Notify affected users and regulators when required by the approved privacy and incident policy.
6. Within five working days, publish an internal post-incident review with timeline, root cause, corrective actions and owners.

SEV1: financial/security breach or total outage. SEV2: major workflow unavailable. SEV3: limited degradation with workaround.
