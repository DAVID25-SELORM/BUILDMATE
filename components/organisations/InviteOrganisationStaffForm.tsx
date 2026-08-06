"use client";
import {useActionState} from "react";
import {inviteOrganisationStaff,type OrganisationStaffState} from "@/app/organisation-staff-actions";
import {organisationRoleOptions,ORGANISATION_PERMISSIONS,type OrganisationScope} from "@/lib/permissions/organisation";

export function InviteOrganisationStaffForm({scope,branches=[],warehouses=[],projects=[]}:{scope:OrganisationScope;branches?:{id:string;name:string}[];warehouses?:{id:string;name:string}[];projects?:{id:string;name:string}[]}){
 const action=inviteOrganisationStaff.bind(null,scope);const[state,formAction,pending]=useActionState<OrganisationStaffState,FormData>(action,null);
 return <form action={formAction} className="card mt-6 grid gap-4 p-6">
  <label>Full name<input className="input mt-1" name="fullName" required/></label><label>Email<input className="input mt-1" name="email" type="email" required/></label><label>Phone<input className="input mt-1" name="phone"/></label>
  <label>Role<select className="input mt-1" name="roleKey" required><option value="">Choose role</option>{organisationRoleOptions(scope).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
  {!!branches.length&&<fieldset><legend className="font-semibold">Branch assignments</legend>{branches.map(x=><label className="mr-4 block text-sm" key={x.id}><input name="branchIds" type="checkbox" value={x.id}/> {x.name}</label>)}</fieldset>}
  {!!warehouses.length&&<fieldset><legend className="font-semibold">Warehouse assignments</legend>{warehouses.map(x=><label className="mr-4 block text-sm" key={x.id}><input name="warehouseIds" type="checkbox" value={x.id}/> {x.name}</label>)}</fieldset>}
  {!!projects.length&&<fieldset><legend className="font-semibold">Project assignments</legend>{projects.map(x=><label className="mr-4 block text-sm" key={x.id}><input name="projectIds" type="checkbox" value={x.id}/> {x.name}</label>)}<input className="input mt-2" name="approvalLimit" type="number" min="0" step="0.01" placeholder="Purchase approval limit (GHS)"/></fieldset>}
  <details><summary className="cursor-pointer font-semibold">Additional permissions</summary><div className="mt-2 grid md:grid-cols-2">{ORGANISATION_PERMISSIONS[scope].map(p=><label className="text-sm" key={p}><input name="extraPermissions" type="checkbox" value={p}/> {p}</label>)}</div></details>
  <label>Audit reason<textarea className="input mt-1" name="reason" minLength={5} required/></label>{state?.error&&<p className="text-sm text-red-700">{state.error}</p>}<button className="btn-primary" disabled={pending}>{pending?"Sending…":"Send secure invitation"}</button>
 </form>;
}
