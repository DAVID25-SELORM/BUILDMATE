"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { BRANCH_TYPES, BRANCH_TYPE_LABELS, GHANA_REGIONS } from "@/lib/supplier/constants";
import { branchSchema, type BranchInput } from "@/lib/supplier/validation";
import { wouldCreateDuplicateMainBranch } from "@/lib/supplier/branches";
import { completeBranchesStep, deleteBranch, saveBranch } from "@/app/supplier/onboarding/actions";
import type { SupplierBranchRow } from "@/lib/supplier/types";

const emptyBranch: BranchInput = {
  name: "",
  branchType: "branch",
  phone: "",
  address: "",
  region: "",
  city: "",
  area: "",
  ghanaPostGps: "",
  latitude: null,
  longitude: null,
  operatingHours: "",
  contactPerson: "",
  isMainBranch: false,
  supportsPickup: false
};

function toBranchInput(row: SupplierBranchRow): BranchInput {
  return {
    id: row.id,
    name: row.name,
    branchType: row.branch_type,
    phone: row.phone ?? "",
    address: row.address,
    region: row.region,
    city: row.city,
    area: row.area ?? "",
    ghanaPostGps: row.ghanapost_gps ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    operatingHours: row.operating_hours ?? "",
    contactPerson: row.contact_person ?? "",
    isMainBranch: row.is_main_branch,
    supportsPickup: row.supports_pickup
  };
}

export function BranchesStep({
  organisationId,
  initialBranches,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  initialBranches: SupplierBranchRow[];
  completedSteps: string[];
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [branches, setBranches] = useState(initialBranches);
  const [editing, setEditing] = useState<BranchInput | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || formLoading) return;
    setFormError(null);
    setFieldErrors({});

    const parsed = branchSchema.safeParse(editing);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setFormError("Fix the highlighted fields");
      return;
    }

    if (parsed.data.isMainBranch && wouldCreateDuplicateMainBranch(
      branches.map((b) => ({ id: b.id, isMainBranch: b.is_main_branch })),
      parsed.data.id ?? null
    )) {
      setFormError("Another branch is already set as the main branch. Unset it first.");
      return;
    }

    setFormLoading(true);
    const result = await saveBranch(organisationId, parsed.data);
    setFormLoading(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    if (parsed.data.id) {
      setBranches((prev) => prev.map((b) => (b.id === parsed.data.id ? { ...b, ...rowFromInput(parsed.data, b.id!) } : b)));
    } else {
      setBranches((prev) => [...prev, rowFromInput(parsed.data, crypto.randomUUID())]);
    }
    setEditing(null);
  }

  function rowFromInput(input: BranchInput, id: string): SupplierBranchRow {
    return {
      id,
      organisation_id: organisationId,
      name: input.name,
      branch_type: input.branchType,
      phone: input.phone || null,
      address: input.address,
      region: input.region,
      city: input.city,
      area: input.area || null,
      ghanapost_gps: input.ghanaPostGps || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      operating_hours: input.operatingHours || null,
      contact_person: input.contactPerson || null,
      is_main_branch: input.isMainBranch,
      supports_pickup: input.supportsPickup
    };
  }

  async function handleDelete(id: string) {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    await deleteBranch(organisationId, id);
  }

  async function handleContinue(advance: boolean) {
    setContinueError(null);
    if (!advance) {
      onSaved(false);
      return;
    }
    setContinueLoading(true);
    const result = await completeBranchesStep(organisationId, completedSteps);
    setContinueLoading(false);
    if (!result.success) {
      setContinueError(result.error);
      return;
    }
    onSaved(true);
  }

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-bold">Branches and warehouses</h2>
        <p className="mt-1 text-sm text-slate-600">Add every location customers can be served from. Only one can be the main branch.</p>
      </div>

      <div className="space-y-3">
        {branches.map((branch) => (
          <div key={branch.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <p className="font-semibold">
                {branch.name} {branch.is_main_branch && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Main branch</span>}
              </p>
              <p className="text-sm text-slate-600">{BRANCH_TYPE_LABELS[branch.branch_type]} • {branch.city}, {branch.region}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary py-2 text-sm" onClick={() => setEditing(toBranchInput(branch))}>Edit</button>
              <button type="button" className="btn-secondary py-2 text-sm" onClick={() => handleDelete(branch.id)}>Delete</button>
            </div>
          </div>
        ))}
        {branches.length === 0 && <p className="text-sm text-slate-500">No branches added yet.</p>}
      </div>

      {editing ? (
        <form onSubmit={handleFormSubmit} noValidate className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch or warehouse name" htmlFor="branchName" error={fieldErrors.name}>
              <input id="branchName" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Type" htmlFor="branchType" error={fieldErrors.branchType}>
              <select id="branchType" className="input" value={editing.branchType} onChange={(e) => setEditing({ ...editing, branchType: e.target.value as typeof editing.branchType })}>
                {BRANCH_TYPES.map((type) => <option key={type} value={type}>{BRANCH_TYPE_LABELS[type]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Address" htmlFor="branchAddress" error={fieldErrors.address}>
            <input id="branchAddress" className="input" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Region" htmlFor="branchRegion" error={fieldErrors.region}>
              <select id="branchRegion" className="input" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })}>
                <option value="">Select a region</option>
                {GHANA_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </Field>
            <Field label="City" htmlFor="branchCity" error={fieldErrors.city}>
              <input id="branchCity" className="input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </Field>
            <Field label="Area" htmlFor="branchArea" error={fieldErrors.area}>
              <input id="branchArea" className="input" value={editing.area} onChange={(e) => setEditing({ ...editing, area: e.target.value })} />
            </Field>
            <Field label="GhanaPost GPS" htmlFor="branchGps" error={fieldErrors.ghanaPostGps}>
              <input id="branchGps" className="input" value={editing.ghanaPostGps} onChange={(e) => setEditing({ ...editing, ghanaPostGps: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Latitude" htmlFor="branchLat" error={fieldErrors.latitude}>
              <input id="branchLat" className="input" type="number" step="any" value={editing.latitude ?? ""} onChange={(e) => setEditing({ ...editing, latitude: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Longitude" htmlFor="branchLng" error={fieldErrors.longitude}>
              <input id="branchLng" className="input" type="number" step="any" value={editing.longitude ?? ""} onChange={(e) => setEditing({ ...editing, longitude: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Phone" htmlFor="branchPhone" error={fieldErrors.phone}>
              <input id="branchPhone" className="input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
            <Field label="Contact person" htmlFor="branchContact" error={fieldErrors.contactPerson}>
              <input id="branchContact" className="input" value={editing.contactPerson} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
            </Field>
          </div>
          <Field label="Operating hours" htmlFor="branchHours" error={fieldErrors.operatingHours} hint="e.g. Mon-Sat 8am-6pm">
            <input id="branchHours" className="input" value={editing.operatingHours} onChange={(e) => setEditing({ ...editing, operatingHours: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isMainBranch} onChange={(e) => setEditing({ ...editing, isMainBranch: e.target.checked })} /> This is the main branch</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.supportsPickup} onChange={(e) => setEditing({ ...editing, supportsPickup: e.target.checked })} /> Customers can pick up orders here</label>
          </div>
          {formError && <p className="text-sm font-medium text-red-600" role="alert">{formError}</p>}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={formLoading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={formLoading}>{formLoading ? "Saving..." : "Save branch"}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setEditing(emptyBranch)}>Add branch or warehouse</button>
      )}

      {continueError && <p className="text-sm font-medium text-red-600" role="alert">{continueError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={continueLoading}>Back</button>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" onClick={() => handleContinue(false)} disabled={continueLoading}>Save as draft</button>
          <button type="button" className="btn-primary" onClick={() => handleContinue(true)} disabled={continueLoading}>{continueLoading ? "Saving..." : "Save & continue"}</button>
        </div>
      </div>
    </div>
  );
}
