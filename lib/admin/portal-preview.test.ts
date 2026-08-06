import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase", "migrations", "202608060029_admin_portal_preview_sessions.sql"), "utf8").toLowerCase();
const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
const customerPage = readFileSync(join(root, "app", "dashboard", "page.tsx"), "utf8");
const customerPreview = readFileSync(join(root, "app", "admin", "preview", "customer", "[id]", "[[...section]]", "page.tsx"), "utf8");
const supplierPage = readFileSync(join(root, "app", "supplier", "page.tsx"), "utf8");
const supplierPreview = readFileSync(join(root, "app", "admin", "preview", "supplier", "[id]", "[[...section]]", "page.tsx"), "utf8");

describe("admin portal preview security", () => {
  it("keeps the authenticated admin as the preview initiator", () => expect(migration).toContain("admin_user_id=auth.uid()"));
  it("requires exactly one target matching the portal type", () => expect(migration).toContain("constraint preview_target_matches_portal"));
  it("expires preview sessions", () => expect(migration).toContain("expires_at timestamptz not null"));
  it("prevents customers and suppliers from reading preview sessions", () => expect(migration).toContain("revoke all on table public.admin_portal_preview_sessions"));
  it("audits preview start, access, exit and blocked writes", () => {
    for (const action of ["portal_preview_started", "preview_page_opened", "portal_preview_exited", "preview_write_blocked"]) expect(`${migration}\n${proxy}`).toContain(action);
  });
  it("blocks non-exit writes while preview cookie is active", () => {
    expect(proxy).toContain('path !== "/admin/preview/exit"');
    expect(proxy).toContain("This action is unavailable in Admin Preview Mode.");
  });
  it("shares the customer overview between self and preview", () => {
    expect(customerPage).toContain("CustomerOverview");
    expect(customerPreview).toContain("CustomerOverview");
  });
  it("shares the supplier overview between self and preview", () => {
    expect(supplierPage).toContain("SupplierOverview");
    expect(supplierPreview).toContain("SupplierOverview");
  });
  it("scopes customer previews to the selected user", () => expect(customerPreview).toContain('requirePortalPreview("customer", id'));
  it("scopes supplier previews to the selected organisation", () => expect(supplierPreview).toContain('requirePortalPreview("supplier", id'));
});
