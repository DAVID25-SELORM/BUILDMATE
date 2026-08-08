# Tenant security and incident runbook

The Admin **Security & Operations** page reports permission denials, rate-limit events, suspended tenants and incidents. Alerts should be connected to the production monitoring provider for repeated denials, webhook failures, notification backlog, elevated 5xx rates and health-check failures.

For suspected cross-tenant access: preserve audit records, suspend the affected organisation, revoke active sessions, rotate exposed credentials, identify the affected rows and time window, and notify the security owner. Do not delete evidence. Validate the fix against two distinct customer tenants and two distinct supplier tenants before reactivation.

For degraded service: check `/api/health`, Vercel function logs, Supabase status and the notification outbox. Roll back application code when safe; database migrations must be corrected with a forward migration.

Every incident record needs severity, tenant impact, timeline, containment, root cause, remediation and an owner. Conduct a post-incident review for any confirmed data exposure or payment inconsistency.
