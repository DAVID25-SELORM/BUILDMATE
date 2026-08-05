# Backup and restore

Supabase production must have Point-in-Time Recovery enabled where the plan permits it. Independently create a daily encrypted `pg_dump` in a restricted backup account and retain 30 daily, 12 monthly copies. Storage objects require a separate daily inventory and copy because database backups do not contain object bytes.

Quarterly restore drill: create an isolated project, restore the latest database backup, copy a sample of private objects, run all migrations and `supabase/tests/rls_assertions.sql`, then exercise registration, quote, payment-event, settlement and delivery paths. Record recovery-point and recovery-time results. Never restore over production during a drill.
