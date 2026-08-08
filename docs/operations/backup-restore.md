# Backup and restore procedure

Supabase production backups are the system of record. Confirm scheduled backups and point-in-time recovery in the Supabase dashboard before every release that changes durable data.

Quarterly restore drill:

1. Create an isolated, access-restricted recovery project; never restore over production.
2. Restore the latest backup, record recovery-point and recovery-time measurements, and apply any later migrations from `supabase/migrations`.
3. Run `supabase db lint --linked --level error`, tenant-isolation acceptance tests, and sampled order/payment reconciliation.
4. Confirm private storage metadata and signed-document access, then destroy the recovery project according to the retention policy.
5. Record the operator, timestamps, results, exceptions, and remediation owner in the incident register.

Target objectives: RPO 24 hours (or the enabled PITR interval) and RTO 4 hours. A production claim requires evidence from an executed restore drill, not configuration alone.
