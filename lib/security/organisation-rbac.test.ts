import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const root=process.cwd();
const foundation=readFileSync(join(root,"supabase/migrations/202608060034_organisation_rbac.sql"),"utf8").toLowerCase();
const runtime=readFileSync(join(root,"supabase/migrations/202608060035_organisation_staff_runtime.sql"),"utf8").toLowerCase();
const preview=readFileSync(join(root,"supabase/migrations/202608060036_preview_role_context.sql"),"utf8").toLowerCase();
describe("organisation RBAC migrations",()=>{
 it("models memberships, roles, permissions and assignments separately",()=>{for(const name of["organisation_roles","organisation_permissions","organisation_role_permissions","membership_permission_overrides","branch_memberships","warehouse_memberships","project_memberships"])expect(foundation).toContain(`table public.${name}`)});
 it("denies suspended membership access centrally",()=>expect(foundation.replaceAll("\n"," ")).toMatch(/m\.status='active'.*m\.is_active/));
 it("protects the final active owner",()=>{expect(foundation).toContain("prevent_final_organisation_owner");expect(foundation).toContain("final active owner cannot be removed")});
 it("supports audited ownership transfer",()=>{expect(runtime).toContain("transfer_organisation_ownership");expect(runtime).toContain("ownership_transfer_history")});
 it("supports secure supplier and customer invitation acceptance",()=>{expect(runtime).toContain("invite_organisation_staff");expect(runtime).toContain("inv.scope='platform'");expect(runtime).toContain("inv.extra_permissions")});
 it("limits overrides to the manager's own permissions",()=>expect(runtime).toContain("you cannot grant a permission you do not hold yourself"));
 it("records preview role and assignment context without impersonation",()=>{expect(preview).toContain("preview_role_key");expect(preview).toContain("preview_role_has_permission");expect(preview).toContain("preview_role_selected")});
});
