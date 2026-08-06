import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir).filter(file => file.endsWith(".sql")).map(file => readFileSync(join(dir, file), "utf8")).join("\n").toLowerCase();
const layout = readFileSync(join(process.cwd(), "app", "admin", "layout.tsx"), "utf8");

describe("admin security and audit guarantees", () => {
  it("protects every admin route in the shared layout", () => expect(layout).toContain("requirePlatformAccess()"));
  it("requires customer support permission and audits suspension", () => {
    const body = sql.slice(sql.lastIndexOf("create or replace function public.admin_manage_customer"));
    expect(body).toContain("admin_has_permission('customer_support')");
    expect(sql).toContain("'customer_'||target_action");
    expect(sql).toContain("insert into public.audit_logs");
  });
  it("requires supplier verification permission", () => {
    expect(sql).toContain("admin_has_permission('supplier_verification')");
    expect(sql).toContain("admin_set_supplier_status");
  });
  it("requires finance permission for settlement holds", () => expect(sql).toContain("admin_has_permission('finance')"));
  it("keeps internal notes private", () => {
    expect(sql).toContain("alter table public.admin_internal_notes enable row level security");
    expect(sql).toContain("revoke insert,update,delete on public.admin_internal_notes");
  });
  it("forces support sessions read-only and audits entry and exit", () => {
    expect(sql).toContain("read_only boolean not null default true check(read_only)");
    expect(sql).toContain("read_only_preview_started");
    expect(sql).toContain("read_only_preview_ended");
  });
  it("prevents direct performance overrides", () => expect(sql).toContain("revoke insert,update,delete on public.admin_internal_notes,public.admin_action_history,public.support_view_sessions,public.supplier_performance_metrics from anon,authenticated"));
  it("limits permission changes to super administrators and audits them", () => {
    expect(sql).toContain("role='super_admin'");
    expect(sql).toContain("admin_permission_granted");
    expect(sql).toContain("'permission_granted'");
  });
});
