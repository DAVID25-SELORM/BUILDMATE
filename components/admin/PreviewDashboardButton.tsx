"use client";

import { useRef } from "react";
import { organisationRoleOptions } from "@/lib/permissions/organisation";

export function PreviewDashboardButton({
  targetLabel,
  portalLabel,
  action,
  branches = [], warehouses = [], projects = [],
}: {
  targetLabel: string;
  portalLabel: "Customer" | "Supplier" | "Customer Organisation";
  action: (formData: FormData) => void | Promise<void>;
  branches?:{id:string;name:string}[];warehouses?:{id:string;name:string}[];projects?:{id:string;name:string}[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="font-semibold text-brand-700" type="button" onClick={() => dialog.current?.showModal()}>
        Preview Dashboard
      </button>
      <dialog ref={dialog} className="w-[min(92vw,32rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/50">
        <form action={action} className="p-6">
          <h2 className="text-xl font-black">Preview {portalLabel} Portal</h2>
          <p className="mt-2 text-sm text-slate-600">Selected: <b>{targetLabel}</b></p>
          {portalLabel !== "Customer" && <label className="mt-5 block"><span className="label">Preview as role</span><select className="input" name="previewRole" defaultValue={portalLabel==="Supplier"?"owner":"organisation_owner"}>{organisationRoleOptions(portalLabel==="Supplier"?"supplier":"customer").map(role=><option key={role.key} value={role.key}>{role.label}</option>)}</select></label>}
          {!!branches.length&&<label className="mt-4 block"><span className="label">Branch (optional)</span><select className="input" name="previewBranch"><option value="">All assigned branches</option>{branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
          {!!warehouses.length&&<label className="mt-4 block"><span className="label">Warehouse (optional)</span><select className="input" name="previewWarehouse"><option value="">All assigned warehouses</option>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
          {!!projects.length&&<label className="mt-4 block"><span className="label">Project (optional)</span><select className="input" name="previewProject"><option value="">All assigned projects</option>{projects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
          <label className="mt-5 block">
            <span className="label">Support or review reason</span>
            <textarea className="input min-h-24" name="reason" minLength={5} required />
          </label>
          <label className="mt-4 block">
            <span className="label">Ticket/reference number (optional)</span>
            <input className="input" name="referenceNumber" maxLength={120} />
          </label>
          <p className="mt-4 text-xs text-slate-500">The admin session remains active. This preview is read-only, expires automatically, and is audited.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn-primary">Start read-only preview</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
