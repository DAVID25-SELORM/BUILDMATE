"use client";

import Link from "next/link";

export type InventoryToolbarOperation =
  | "receive"
  | "adjust"
  | "transfer"
  | "count"
  | "settings";

type InventoryActionToolbarProps = {
  canReceive: boolean;
  canAdjust: boolean;
  canTransfer: boolean;
  canConfigure: boolean;
  operationsEnabled?: boolean;
  onOpen: (operation: InventoryToolbarOperation) => void;
};

export const inventoryActionLabels = [
  "+ Add Product",
  "Receive Stock",
  "Adjust Stock",
  "Transfer Stock",
  "Stock Count",
  "Inventory Settings",
  "Export",
] as const;

export function InventoryActionToolbar({
  canReceive,
  canAdjust,
  canTransfer,
  canConfigure,
  operationsEnabled = true,
  onOpen,
}: InventoryActionToolbarProps) {
  const closeMobileMenu = (target: HTMLElement) =>
    target.closest("details")?.removeAttribute("open");
  const open = (
    operation: InventoryToolbarOperation,
    target: HTMLElement,
  ) => {
    closeMobileMenu(target);
    onOpen(operation);
  };

  return (
    <nav
      aria-label="Inventory actions"
      className="mt-5 flex items-center gap-2 overflow-visible"
    >
      <Link className="btn-primary shrink-0" href="/supplier/products#add-product">
        + Add Product
      </Link>
      {canReceive && (
        <button
          className="btn-secondary shrink-0"
          type="button"
          disabled={!operationsEnabled}
          title={operationsEnabled ? undefined : "Configure a branch first"}
          onClick={(event) => open("receive", event.currentTarget)}
        >
          Receive Stock
        </button>
      )}
      <details className="relative md:contents">
        <summary className="btn-secondary cursor-pointer list-none md:hidden">
          More
        </summary>
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid min-w-56 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl md:static md:flex md:min-w-0 md:items-center md:gap-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {canAdjust && (
            <button
              className="btn-secondary whitespace-nowrap"
              type="button"
              disabled={!operationsEnabled}
              title={operationsEnabled ? undefined : "Configure a branch first"}
              onClick={(event) => open("adjust", event.currentTarget)}
            >
              Adjust Stock
            </button>
          )}
          {canTransfer && (
            <button
              className="btn-secondary whitespace-nowrap"
              type="button"
              disabled={!operationsEnabled}
              title={operationsEnabled ? undefined : "Configure a branch first"}
              onClick={(event) => open("transfer", event.currentTarget)}
            >
              Transfer Stock
            </button>
          )}
          {canAdjust && (
            <button
              className="btn-secondary whitespace-nowrap"
              type="button"
              disabled={!operationsEnabled}
              title={operationsEnabled ? undefined : "Configure a branch first"}
              onClick={(event) => open("count", event.currentTarget)}
            >
              Stock Count
            </button>
          )}
          {canConfigure && (
            <button
              className="btn-secondary whitespace-nowrap"
              type="button"
              disabled={!operationsEnabled}
              title={operationsEnabled ? undefined : "Configure a branch first"}
              onClick={(event) => open("settings", event.currentTarget)}
            >
              Inventory Settings
            </button>
          )}
          <a
            className="btn-secondary whitespace-nowrap"
            href="/api/supplier/inventory/export?report=current_stock"
            onClick={(event) => closeMobileMenu(event.currentTarget)}
          >
            Export
          </a>
        </div>
      </details>
    </nav>
  );
}
