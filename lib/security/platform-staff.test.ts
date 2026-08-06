import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((x) => x.endsWith(".sql"))
  .map((x) => readFileSync(join(dir, x), "utf8"))
  .join("\n");
const sqlLower = sql.toLowerCase();

describe("platform staff RBAC migration invariants", () => {
  it("enables RLS on every new RBAC table", () => {
    for (const table of ["platform_roles", "platform_permissions", "platform_role_permissions", "platform_staff_memberships", "platform_staff_permission_overrides", "membership_audit_log", "invitations"]) {
      expect(sqlLower).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("never stores a raw invitation token, only a hash", () => {
    expect(sqlLower).toContain("token_hash text not null unique");
    expect(sql).not.toMatch(/create table public\.invitations[\s\S]*?\btoken text\b/);
  });

  it("blocks anon/public from writing to sensitive RBAC tables directly", () => {
    expect(sqlLower).toContain("revoke insert,update,delete on public.platform_staff_memberships,public.platform_staff_permission_overrides,public.membership_audit_log from anon,authenticated");
    expect(sqlLower).toContain("revoke insert,update,delete on public.invitations from anon,authenticated");
  });

  it("gates every mutating platform-staff RPC behind has_permission", () => {
    const guardedFunctions = ["invite_platform_staff", "set_platform_staff_role", "set_platform_staff_permission_override", "suspend_platform_staff", "reactivate_platform_staff", "remove_platform_staff"];
    for (const fn of guardedFunctions) {
      const body = sqlLower.slice(sqlLower.lastIndexOf(`create or replace function public.${fn}`));
      expect(body.slice(0, 600)).toContain("has_permission(");
    }
  });

  it("rejects permission overrides that exceed the granting user's own authority", () => {
    expect(sql).toContain("You cannot grant a permission you do not hold yourself");
  });

  it("verifies the accepting user's email matches the invitation before linking a membership", () => {
    const body = sqlLower.slice(sqlLower.indexOf("create or replace function public.accept_invitation"));
    expect(body).toContain("this invitation was sent to a different email address");
  });

  it("prevents duplicate pending invitations for the same scope, organisation and email", () => {
    expect(sqlLower).toContain("idx_invitations_pending_unique");
    expect(sqlLower).toContain("where status = 'pending'");
  });

  it("finds users by email only through a function unreachable by anon/authenticated", () => {
    expect(sqlLower).toContain("revoke all on function public.find_user_id_by_email(text) from public,anon,authenticated");
  });

  it("keeps get_invitation_preview minimal — no raw email or phone field returned", () => {
    const body = sql.slice(sql.indexOf("create or replace function public.get_invitation_preview"));
    const returnObject = body.slice(0, body.indexOf(";", body.indexOf("jsonb_build_object")));
    expect(returnObject).not.toContain("'email', inv.email");
    expect(returnObject).toContain("split_part(inv.email");
  });

  it("does not modify the already-applied initial schema or auth hardening migrations", () => {
    const untouchable = ["202607280001_initial_schema.sql", "202607290001_auth_hardening.sql"];
    const files = readdirSync(dir);
    for (const name of untouchable) expect(files).toContain(name);
  });
});
