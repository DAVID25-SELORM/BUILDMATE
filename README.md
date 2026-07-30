# BuildMate Ghana Web App

A production-oriented starter for a managed building-material marketplace serving customers, contractors, suppliers, drivers and administrators.

## Included

- Next.js App Router, TypeScript and Tailwind CSS
- Public marketplace website
- Shop, quotation request, calculators, about and contact pages
- Login and registration screens
- Customer, supplier and administrator dashboard starters
- Supabase browser/server clients
- PostgreSQL schema for profiles, organisations, products, supplier listings, projects, quotes, orders, payments, deliveries, reviews and audit logs
- Starter Row-Level Security policies
- Environment template and sample seed data

## Important scope note

This repository is a substantial foundation, not a finished production marketplace. Real authentication actions, product CRUD, payment initiation/webhooks, file uploads, delivery maps, messaging, notifications, advanced RLS, admin workflows and testing must be completed before launch.

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project.
4. Add the Supabase URL and anonymous key to `.env.local`.
5. Run `supabase/migrations/202607280001_initial_schema.sql` in the Supabase SQL editor or through Supabase CLI migrations.
6. Optionally run `supabase/seed.sql`.
7. Install and start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Authentication setup

Real email/password auth is implemented (registration, login, logout, password reset, email verification, role-based redirects, and server-side route protection via `middleware.ts` plus per-route `layout.tsx` checks).

1. Apply migrations in order, via the Supabase SQL editor or `supabase db push`:
   - `supabase/migrations/202607280001_initial_schema.sql`
   - `supabase/migrations/202607290001_auth_hardening.sql` (hardens the signup trigger so a client cannot self-assign `admin`/`super_admin`, blocks non-service-role edits to `profiles.role`, and auto-creates a pending supplier organisation on supplier signup)

   Both files are idempotent-safe to re-run individually, but **do not assume either has already been applied to your project** — confirm in the Supabase dashboard's Table Editor / SQL editor before relying on auth.

2. In the Supabase dashboard, go to **Authentication → Providers** and make sure **Email** is enabled. Toggle **Confirm email** on if you want new users to verify their email before they can sign in (the app already handles both cases — with confirmation on, users land on `/verify-email`; with it off, they're signed in and redirected immediately).

3. In **Authentication → URL Configuration**, add these to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`

4. Role-based redirects after login/registration:
   - `customer` → `/dashboard`
   - `supplier` → `/supplier`
   - `admin` / `super_admin` → `/admin`
   - `contractor` / `driver` / `professional` → `/dashboard` (no dedicated workspace yet)

   Users cannot self-register as `admin` or `super_admin` — the register form only offers the roles above, and the database trigger rejects any other role value even if sent directly to the API.

## Routes

- `/` public homepage
- `/shop` marketplace
- `/request-quote` RFQ/BOQ form
- `/calculators` estimation tools
- `/login` and `/register`
- `/dashboard/customer`
- `/dashboard/supplier`
- `/dashboard/admin`
- `/api/health`

## Next engineering priorities

1. Implement Supabase sign-up, sign-in, sign-out and role redirects.
2. Add middleware that protects dashboard routes.
3. Build admin-controlled supplier verification.
4. Build master catalogue and supplier-listing CRUD.
5. Build RFQ item entry, supplier responses and quotation comparison.
6. Build cart, checkout and immutable order snapshots.
7. Integrate a Ghana-compatible payment provider through server-only API routes.
8. Verify signed webhooks and make handlers idempotent.
9. Add supplier settlement ledger and daily reconciliation.
10. Add delivery assignment, OTP and proof-of-delivery.
11. Add storage buckets with file type/size restrictions.
12. Complete organisation-aware RLS and automated security tests.
13. Add email, SMS and consented WhatsApp notifications.
14. Add unit, integration and end-to-end tests.
15. Add error monitoring, analytics, backups and incident response.

## Suggested deployment

- Frontend/server functions: Vercel
- Database/auth/storage: Supabase
- DNS and web security: Cloudflare
- Transaction email: Resend or Postmark
- SMS: approved Ghana provider
- Maps: Google Maps or Mapbox
- Payments: evaluate Hubtel, Paystack and Flutterwave based on current commercial and marketplace requirements

## Security warnings

- Do not place the Supabase service-role key in public code.
- Do not mark an order paid from a browser redirect alone.
- Verify payment webhooks server-side.
- Use audit logs for financial and status changes.
- Do not let users edit their own role.
- Complete supplier/admin RLS before enabling real data.
- Obtain legal review for marketplace terms, refunds, privacy and settlement handling.
