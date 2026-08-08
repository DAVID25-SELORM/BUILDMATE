# Production acceptance gates

Before declaring the service fully production-ready:

- Run login and tenant-isolation journeys with two real customer organisations and two real supplier organisations in staging.
- Verify branch, warehouse and project assignments with owner, manager, approver and viewer roles.
- Exercise invitation expiry/revocation, ownership transfer, suspension/reactivation, tenant export and closure.
- Verify payment webhook replay/idempotency, reconciliation, notification retries and backup restoration.
- Commission an independent penetration test covering RLS bypass, IDOR, preview-mode escape, session fixation, webhook forgery and privilege escalation; remediate all critical/high findings.
- Capture evidence and sign-off from product, operations, security and finance owners.

Automated tests and database lint are necessary but cannot replace an independent penetration test or a real disaster-recovery drill.
