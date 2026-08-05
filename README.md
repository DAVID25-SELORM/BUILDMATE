# BuildMate Ghana

Production-oriented managed building-material marketplace built with Next.js 16, React 19, Supabase, TypeScript and Tailwind CSS.

## Implemented workflows

- Email/password authentication, verification, recovery, safe redirects and role workspaces
- Supplier onboarding, private compliance documents, admin verification and audit history
- Admin master catalogue plus approved-supplier pricing and inventory listings
- Public database-backed shop, local cart and server-priced multi-supplier checkout
- Customer RFQs, supplier responses, comparison and atomic quote acceptance
- Immutable order snapshots and guarded order status lifecycle
- Hubtel server-only checkout adapter and provider-reverified, amount-checked, idempotent callbacks
- Supplier receivable ledger, payout recording and provider reconciliation
- Driver assignment, guarded delivery transitions, private proof images and OTP completion
- Durable email/SMS/WhatsApp notification outbox with preferences and retries
- Organisation-aware RLS, forced RLS on sensitive tables and executable policy assertions
- Unit/security tests, Playwright desktop/mobile E2E and GitHub Actions CI
- Deep health check, privacy-conscious analytics, redacted logging and operations runbooks
- Versioned signup consent and draft legal-policy pages requiring counsel approval

## Local setup

1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local` and set the public Supabase values.
3. Apply every SQL file in `supabase/migrations` in filename order.
4. Run `supabase/tests/rls_assertions.sql` against the target database.
5. Install and verify:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

## Production configuration

Set server-only values only in the deployment platform: `SUPABASE_SERVICE_ROLE_KEY`, Hubtel credentials and endpoint overrides, transactional SMTP values, `CRON_SECRET`, and optional SMS/WhatsApp provider values. Never expose these with a `NEXT_PUBLIC_` prefix.

Supabase Auth must allow:

- `http://localhost:3000/auth/callback`
- `https://buildmate-six.vercel.app/auth/callback`

Configure the Vercel cron authorization secret; Vercel supplies it as `Authorization: Bearer <CRON_SECRET>`. The included Hobby-compatible cron runs daily. Upgrade Vercel or use an authenticated external scheduler for near-real-time notifications. Confirm Hubtel callback and status URLs against the merchant's current approved API product before enabling real charges.

## Operational gates before public launch

- Have qualified Ghanaian counsel approve Terms, Privacy, Refund and Acceptable Use documents.
- Run a real provider sandbox payment through callback, ledger and reconciliation.
- Run a complete RFQ-to-delivery acceptance test with separate customer, supplier, admin and driver accounts.
- Configure backups and complete the restore drill in [BACKUP_RESTORE.md](docs/operations/BACKUP_RESTORE.md).
- Review [INCIDENT_RESPONSE.md](docs/operations/INCIDENT_RESPONSE.md), contacts and escalation ownership.
- Rotate any credentials ever pasted into chat or terminals and update deployment secrets.

## Security invariants

The browser never receives the service-role key. Payment redirects do not mark orders paid. Provider callbacks are revalidated server-to-server and processed idempotently. Sensitive tables force RLS. Roles cannot be self-promoted. Supplier and delivery files remain private and are accessed through policy-controlled paths.
