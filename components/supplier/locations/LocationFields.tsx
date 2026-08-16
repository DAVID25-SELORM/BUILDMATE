"use client";

import { useMemo, useState } from "react";

export type SupplierBranchOption = {
  id: string;
  name: string;
  is_main_branch?: boolean | null;
};
export type SupplierWarehouseOption = {
  id: string;
  name: string;
  branch_id?: string | null;
};

export function LocationFields({
  branches,
  warehouses,
  initialBranchId,
  initialWarehouseId,
}: {
  branches: SupplierBranchOption[];
  warehouses: SupplierWarehouseOption[];
  initialBranchId?: string | null;
  initialWarehouseId?: string | null;
}) {
  const automaticBranch = branches.length === 1 ? branches[0] : null;
  const [branchId, setBranchId] = useState(
    initialBranchId ?? automaticBranch?.id ?? "",
  );
  const availableWarehouses = useMemo(
    () =>
      warehouses.filter(
        (item) => !item.branch_id || !branchId || item.branch_id === branchId,
      ),
    [warehouses, branchId],
  );
  if (!branches.length)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 md:col-span-2">
        No branch is configured. Create a branch in Supplier Settings before
        using location-based inventory.
      </div>
    );
  return (
    <>
      {automaticBranch ? (
        <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <span className="block text-xs font-bold uppercase tracking-wide text-brand-700">
            Branch
          </span>
          <b>{automaticBranch.name}</b>
          {automaticBranch.is_main_branch && <span> · Main Branch</span>}
          <input type="hidden" name="branchId" value={automaticBranch.id} />
        </div>
      ) : (
        <label>
          <span className="label">Branch</span>
          <select
            className="input"
            name="branchId"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            required
          >
            <option value="">Choose branch</option>
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_main_branch ? " · Main Branch" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {!warehouses.length ? (
        <input type="hidden" name="warehouseId" value="" />
      ) : (
        <label>
          <span className="label">
            Warehouse{" "}
            <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <select
            className="input"
            name="warehouseId"
            defaultValue={initialWarehouseId ?? ""}
          >
            <option value="">No warehouse</option>
            {availableWarehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
