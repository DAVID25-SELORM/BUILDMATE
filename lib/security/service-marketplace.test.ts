import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202608220067_service_marketplace_and_branch_controls.sql",
  "utf8",
);
const hardening = readFileSync(
  "supabase/migrations/202608220068_service_marketplace_security_hardening.sql",
  "utf8",
);
const shell = readFileSync("components/dashboard/DashboardShell.tsx", "utf8");

describe("service marketplace and safe previews", () => {
  it("protects service requests with participant-scoped RLS", () => {
    expect(migration).toContain("service request participants read");
    expect(migration).toContain(
      "customer_id=auth.uid() or provider_can_manage(provider_id)",
    );
    expect(migration).toContain("can_read_service_request(request_id)");
    expect(migration).toContain("service request provider update");
    expect(migration).toContain("customer_progress_service_request");
  });

  it("allows reviews only after a completed request", () => {
    expect(migration).toContain("r.status='completed'");
    expect(migration).toContain("Only completed services can be reviewed");
  });

  it("keeps availability separate from online presence", () => {
    expect(migration).toContain("availability_status");
    expect(migration).not.toContain("user_presence");
  });

  it("uses generic admin previews instead of selecting a real account", () => {
    expect(shell).toContain('href="/admin/preview/customer"');
    expect(shell).toContain('href="/admin/preview/supplier"');
    expect(shell).not.toContain('action="/admin/preview/quick-start"');
  });

  it("creates branch-specific drafts without changing stock", () => {
    expect(migration).toContain("create_supplier_listing_drafts_at_location");
    expect(migration).toContain(
      "'confirmation_required','confirmation_required',false,'draft',target_branch,target_warehouse",
    );
    expect(migration).toContain("LISTINGS_BRANCH_ASSIGNED");
  });

  it("blocks direct lifecycle and verification writes", () => {
    expect(hardening).toContain(
      'drop policy if exists "provider profile owner update"',
    );
    expect(hardening).toContain(
      'drop policy if exists "service request provider update"',
    );
    expect(hardening).toContain("admin_review_service_provider");
    expect(hardening).toContain("SERVICE_PROVIDER_REVIEWED");
  });

  it("keeps provider document decisions admin-controlled", () => {
    expect(hardening).toContain('create policy "provider documents submit"');
    expect(hardening).toContain("status='pending'");
    expect(hardening).toContain("admin_review_service_provider_document");
  });
});
