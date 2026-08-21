"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  adjustStock,
  configureInventory,
  receiveStock,
  recordStockCount,
  setStockSetupProgress,
  transferStock,
  type InventoryActionState,
} from "@/app/supplier/inventory/actions";
import { ConfirmInventoryAction } from "./ConfirmInventoryAction";
import { inventoryOperationEvent } from "./OpenInventoryOperationButton";

export type InventoryListingOption = {
  id: string;
  productId: string;
  variantId: string | null;
  label: string;
  product: string;
  variant: string | null;
  price: number | null;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  averageCost: number | null;
  inventoryMode: string;
  reorderPoint: number | null;
  imageUrl: string | null;
  branch: string | null;
  branchIsMain: boolean;
  marketplace: string;
  listingStatus: string;
  unit: string | null;
};
type DialogName =
  "receive" | "adjust" | "transfer" | "count" | "settings" | "setup";
const initial: InventoryActionState = {};

function Status({ state }: { state: InventoryActionState }) {
  return state.error ? (
    <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
  ) : state.message ? (
    <p className="mt-3 text-sm font-semibold text-emerald-700">
      {state.message}
    </p>
  ) : null;
}
function SummaryValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}
function ListingSelect({
  name,
  listings,
  defaultValue,
  onChange,
  locked = false,
  canViewCost = true,
}: {
  name: string;
  listings: InventoryListingOption[];
  defaultValue?: string;
  onChange?: (listingId: string) => void;
  locked?: boolean;
  canViewCost?: boolean;
}) {
  return (
    <select
      className="input"
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      disabled={locked}
      required
    >
      <option value="">Choose product</option>
      {listings.map((item) => (
        <option
          value={item.id}
          key={item.id}
          data-on-hand={item.onHand ?? 0}
          data-average-cost={item.averageCost ?? 0}
          data-can-view-cost={String(canViewCost)}
          data-reserved={item.reserved ?? 0}
          data-available={item.available ?? 0}
          data-price={item.price ?? ""}
          data-marketplace={item.marketplace}
          data-product={item.product}
          data-variant={item.variant ?? "Standard"}
          data-branch={item.branch ?? "Unassigned"}
          data-unit={item.unit ?? "units"}
        >
          {item.label}
        </option>
      ))}
    </select>
  );
}
function LocationContext({
  branchName,
  warehouseCount,
}: {
  branchName?: string;
  warehouseCount: number;
}) {
  return (
    <p className="mt-1 text-sm text-slate-600">
      Location:{" "}
      <b className="text-slate-900">
        {branchName ?? "Selected product location"}
      </b>
      {warehouseCount === 0 && " · No warehouse"}
    </p>
  );
}

export function InventoryOperationForms({
  listings,
  canReceive,
  canAdjust,
  canTransfer,
  canConfigure,
  canViewCost,
  branchName,
  branchCount,
  warehouseCount,
  setupProgress = [],
  setupLastSavedAt,
}: {
  listings: InventoryListingOption[];
  canReceive: boolean;
  canAdjust: boolean;
  canTransfer: boolean;
  canConfigure: boolean;
  canViewCost: boolean;
  branchName?: string;
  branchCount: number;
  warehouseCount: number;
  setupProgress?: { listing_id: string; status: string; updated_at: string }[];
  setupLastSavedAt?: string | null;
}) {
  const searchParams = useSearchParams();
  const receiveListing = searchParams.get("receive") ?? undefined;
  const requestedOperation = searchParams.get("operation") as DialogName | null;
  const dialogs = useRef<Record<DialogName, HTMLDialogElement | null>>({
    receive: null,
    adjust: null,
    transfer: null,
    count: null,
    settings: null,
    setup: null,
  });
  const [receiveState, receiveAction, receivePending] = useActionState(
    receiveStock,
    initial,
  );
  const [selectedReceiveId, setSelectedReceiveId] = useState(
    receiveListing ?? "",
  );
  const [rowLocked, setRowLocked] = useState(Boolean(receiveListing));
  const selectedReceive = useMemo(
    () => listings.find((item) => item.id === selectedReceiveId) ?? null,
    [listings, selectedReceiveId],
  );
  const [adjustState, adjustAction, adjustPending] = useActionState(
    adjustStock,
    initial,
  );
  const [transferState, transferAction, transferPending] = useActionState(
    transferStock,
    initial,
  );
  const [countState, countAction, countPending] = useActionState(
    recordStockCount,
    initial,
  );
  const [configState, configAction, configPending] = useActionState(
    configureInventory,
    initial,
  );
  const setupListings = listings.filter(
    (item) => item.inventoryMode === "confirmation_required",
  );
  const [handledSetupIds, setHandledSetupIds] = useState<string[]>(
    setupProgress
      .filter((progress) =>
        setupListings.some((listing) => listing.id === progress.listing_id),
      )
      .map((item) => item.listing_id),
  );
  const [setupProgressState, setSetupProgressState] =
    useState<InventoryActionState>({});
  const setupItem = setupListings.find(
    (item) => !handledSetupIds.includes(item.id),
  );
  const setupPosition = setupItem
    ? handledSetupIds.length + 1
    : setupListings.length;
  const [setupState, setupAction, setupPending] = useActionState(
    async (_: InventoryActionState, formData: FormData) => {
      const result = await receiveStock(initial, formData);
      const completedId = String(formData.get("listingId") ?? "");
      if (!result.error) {
        const configuration = new FormData();
        configuration.set("listingId", completedId);
        configuration.set("inventoryMode", "exact_quantity");
        configuration.set(
          "reorderPoint",
          String(formData.get("reorderPoint") ?? ""),
        );
        configuration.set("preferredReorder", "");
        const configurationResult = await configureInventory(
          initial,
          configuration,
        );
        if (configurationResult.error) return configurationResult;
        const progress = new FormData();
        progress.set("listingId", completedId);
        progress.set("status", "completed");
        const progressResult = await setStockSetupProgress(initial, progress);
        if (progressResult.error) return progressResult;
        setHandledSetupIds((ids) => [...ids, completedId]);
      }
      return result;
    },
    initial,
  );
  const open = (name: DialogName, listingId?: string) => {
    if (name === "receive") {
      setSelectedReceiveId(listingId ?? "");
      setRowLocked(Boolean(listingId));
    }
    dialogs.current[name]?.showModal();
  };
  const close = (name: DialogName) => dialogs.current[name]?.close();
  useEffect(() => {
    if (receiveListing && canReceive && dialogs.current.receive && !dialogs.current.receive.open) dialogs.current.receive.showModal();
  }, [receiveListing, canReceive]);
  useEffect(() => {
    const handleOperation = (event: Event) => {
      const detail = (event as CustomEvent<{
        operation?: DialogName;
        listingId?: string;
      }>).detail;
      if (detail?.operation) open(detail.operation, detail.listingId);
    };
    window.addEventListener(inventoryOperationEvent, handleOperation);
    if (requestedOperation && dialogs.current[requestedOperation]) {
      open(requestedOperation);
    }
    return () =>
      window.removeEventListener(inventoryOperationEvent, handleOperation);
    // URL parameters are compatibility entry points and only open once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (branchCount === 0)
    return (
      <section className="card mt-6 border-amber-200 bg-amber-50 p-5">
        <h2 className="text-xl font-bold text-amber-950">
          Inventory location required
        </h2>
        <p className="mt-2 text-sm text-amber-900">
          Create and configure a supplier branch before receiving, adjusting,
          counting or transferring stock.
        </p>
        <a className="btn-primary mt-4 inline-block" href="/supplier/settings">
          Configure branch
        </a>
      </section>
    );
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        {canReceive && (
          <button
            className="btn-primary"
            type="button"
            onClick={() => open("receive")}
          >
            Receive Stock
          </button>
        )}
        {canAdjust && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => open("adjust")}
          >
            Adjust Stock
          </button>
        )}
        {canTransfer && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => open("transfer")}
          >
            Transfer Stock
          </button>
        )}
        {canAdjust && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => open("count")}
          >
            Stock Count
          </button>
        )}
        {canConfigure && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => open("settings")}
          >
            Inventory Settings
          </button>
        )}
        <a
          className="btn-secondary"
          href="/api/supplier/inventory/export?report=current_stock"
        >
          Export
        </a>
      </div>
      {setupListings.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-lg font-black text-amber-950">
            {setupListings.length} product
            {setupListings.length === 1 ? "" : "s"} need stock setup
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Add current quantities and purchase costs to start tracking stock
            value, remaining quantities and sales automatically.
          </p>
          {canReceive && (
            <button
              className="btn-primary mt-4"
              type="button"
              onClick={() => open("setup")}
            >
              Set Up Stock
            </button>
          )}
        </section>
      )}

      <InventoryDialog
        title="Receive Stock"
        dialogRef={(node) => {
          dialogs.current.receive = node;
        }}
        onClose={() => close("receive")}
      >
        <form action={receiveAction}>
          {selectedReceive && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Product</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">
                    {selectedReceive.product}
                    {selectedReceive.variant ? ` — ${selectedReceive.variant}` : ""}
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedReceive.branch ?? "Unassigned"}
                    {selectedReceive.branchIsMain ? " · Main Branch" : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedReceive.marketplace === "Visible" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {selectedReceive.marketplace}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryValue label="Selling price" value={selectedReceive.price == null ? "Not set" : `GHS ${selectedReceive.price.toFixed(2)}${selectedReceive.unit ? ` / ${selectedReceive.unit}` : ""}`} />
                <SummaryValue label="On hand" value={selectedReceive.onHand ?? "—"} />
                <SummaryValue label="Reserved" value={selectedReceive.reserved ?? "—"} />
                <SummaryValue label="Available" value={selectedReceive.available ?? "—"} />
                <SummaryValue label="Average cost" value={!canViewCost ? "Restricted" : selectedReceive.averageCost == null ? "Not yet set" : `GHS ${selectedReceive.averageCost.toFixed(2)}`} />
                <SummaryValue label="Inventory" value={selectedReceive.onHand == null ? "Needs stock setup" : selectedReceive.inventoryMode.replaceAll("_", " ")} />
              </div>
              <a className="mt-3 inline-flex text-sm font-bold text-emerald-800 underline" href={`/supplier/products#listing-${selectedReceive.id}`}>
                Edit price
              </a>
            </section>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Product</span>
              <ListingSelect key={selectedReceiveId || "global-receive"} name="listingId" listings={listings} defaultValue={selectedReceiveId} onChange={setSelectedReceiveId} locked={rowLocked} canViewCost={canViewCost} />
              {rowLocked && selectedReceiveId && <input type="hidden" name="listingId" value={selectedReceiveId} />}
              {selectedReceive?.branch && (
                <input type="hidden" name="listingHasLocation" value="true" />
              )}
            </label>
            <label>
              <span className="label">Quantity</span>
              <input
                className="input"
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              <span className="label">Unit cost (GHS)</span>
              <input
                className="input"
                name="unitCost"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label>
              <span className="label">Vendor</span>
              <input className="input" name="vendor" />
            </label>
            <label>
              <span className="label">Invoice/reference</span>
              <input className="input" name="invoice" required />
            </label>
            <label>
              <span className="label">Received date</span>
              <input
                className="input"
                name="receivedDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              <span className="label">Notes</span>
              <input className="input" name="notes" />
            </label>
          </div>
          <ConfirmInventoryAction
            kind="receipt"
            disabled={receivePending}
            label={receivePending ? "Saving stock…" : "Review receipt"}
          />
          <Status state={receiveState} />
        </form>
      </InventoryDialog>

      <InventoryDialog
        title="Adjust Stock"
        dialogRef={(node) => {
          dialogs.current.adjust = node;
        }}
        onClose={() => close("adjust")}
      >
        <form action={adjustAction}>
          <LocationContext
            branchName={branchCount === 1 ? branchName : undefined}
            warehouseCount={warehouseCount}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Product</span>
              <ListingSelect name="listingId" listings={listings} />
            </label>
            <label>
              <span className="label">Increase/decrease</span>
              <select className="input" name="movementType">
                <option value="stock_adjustment_positive">Increase</option>
                <option value="stock_adjustment_negative">Decrease</option>
                <option value="damaged">Damaged</option>
                <option value="lost">Lost</option>
              </select>
            </label>
            <label>
              <span className="label">Quantity</span>
              <input
                className="input"
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              <span className="label">Reason</span>
              <input className="input" name="reason" minLength={5} required />
            </label>
            <label>
              <span className="label">Notes</span>
              <input className="input" name="notes" />
            </label>
          </div>
          <ConfirmInventoryAction
            kind="adjustment"
            disabled={adjustPending}
            label={adjustPending ? "Recording…" : "Review adjustment"}
          />
          <Status state={adjustState} />
        </form>
      </InventoryDialog>

      <InventoryDialog
        title="Transfer Stock"
        dialogRef={(node) => {
          dialogs.current.transfer = node;
        }}
        onClose={() => close("transfer")}
      >
        <form action={transferAction}>
          <p className="text-sm text-slate-600">
            Move the same product between two different configured locations.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">From</span>
              <ListingSelect name="sourceListing" listings={listings} />
            </label>
            <label>
              <span className="label">To</span>
              <ListingSelect name="destinationListing" listings={listings} />
            </label>
            <label>
              <span className="label">Quantity</span>
              <input
                className="input"
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              <span className="label">Reason</span>
              <input className="input" name="reason" minLength={5} required />
            </label>
          </div>
          <ConfirmInventoryAction
            kind="transfer"
            disabled={transferPending}
            label={transferPending ? "Transferring…" : "Review transfer"}
          />
          <Status state={transferState} />
        </form>
      </InventoryDialog>

      <InventoryDialog
        title="Physical Stock Count"
        dialogRef={(node) => {
          dialogs.current.count = node;
        }}
        onClose={() => close("count")}
      >
        <form action={countAction}>
          <LocationContext
            branchName={branchCount === 1 ? branchName : undefined}
            warehouseCount={warehouseCount}
          />
          <div className="mt-4 grid gap-3">
            <label>
              <span className="label">Product</span>
              <ListingSelect name="listingId" listings={listings} />
            </label>
            <label>
              <span className="label">Physical count</span>
              <input
                className="input"
                name="physicalQuantity"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label>
              <span className="label">Reason</span>
              <input
                className="input"
                name="reason"
                minLength={5}
                required
                placeholder="Reason for count/correction"
              />
            </label>
            <label>
              <span className="label">Notes</span>
              <textarea className="input" name="notes" rows={3} />
            </label>
          </div>
          <ConfirmInventoryAction
            kind="adjustment"
            disabled={countPending}
            label={countPending ? "Recording…" : "Review stock count"}
          />
          <Status state={countState} />
        </form>
      </InventoryDialog>

      <InventoryDialog
        title="Inventory Settings"
        dialogRef={(node) => {
          dialogs.current.settings = node;
        }}
        onClose={() => close("settings")}
      >
        <form action={configAction}>
          <LocationContext
            branchName={branchCount === 1 ? branchName : undefined}
            warehouseCount={warehouseCount}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Product</span>
              <ListingSelect name="listingId" listings={listings} />
            </label>
            <label>
              <span className="label">Mode</span>
              <select className="input" name="inventoryMode">
                <option value="confirmation_required">
                  Confirmation required
                </option>
                <option value="status_only">Status only</option>
                <option value="exact_quantity">Exact quantity</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-7">
              <input type="checkbox" name="showExact" />
              Show exact stock to customers
            </label>
            <label>
              <span className="label">Reorder point</span>
              <input
                className="input"
                name="reorderPoint"
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label>
              <span className="label">Preferred reorder quantity</span>
              <input
                className="input"
                name="preferredReorder"
                type="number"
                min="0.01"
                step="0.01"
              />
            </label>
          </div>
          <button className="btn-primary mt-4" disabled={configPending}>
            {configPending ? "Saving…" : "Save settings"}
          </button>
          <Status state={configState} />
        </form>
      </InventoryDialog>

      <InventoryDialog
        title="Stock Setup"
        dialogRef={(node) => {
          dialogs.current.setup = node;
        }}
        onClose={() => close("setup")}
      >
        {!setupItem ? (
          <div className="py-8 text-center">
            <p className="text-xl font-black">Stock setup complete</p>
            <p className="mt-2 text-sm text-slate-600">
              Every saved quantity was recorded through a stock receipt
              movement.
            </p>
          </div>
        ) : (
          <form action={setupAction}>
            <p className="text-sm font-bold text-brand-700">
              {setupPosition} of {setupListings.length} products
            </p>
            {setupLastSavedAt && (
              <p className="mt-1 text-xs text-slate-500">
                Progress last saved {new Date(setupLastSavedAt).toLocaleString("en-GH")}
              </p>
            )}
            <h3 className="mt-2 text-xl font-black">
              {setupItem.product}
              {setupItem.variant ? ` — ${setupItem.variant}` : ""}
            </h3>
            {setupItem.imageUrl && (
              <Image
                className="mt-4 h-32 w-32 rounded-xl object-cover"
                src={setupItem.imageUrl}
                alt={`${setupItem.product} inventory`}
                width={128}
                height={128}
                unoptimized
              />
            )}
            <p className="mt-1 text-sm text-slate-600">
              Selling price:{" "}
              {setupItem.price == null
                ? "Not set"
                : `GHS ${Number(setupItem.price).toFixed(2)}`}
            </p>
            <LocationContext
              branchName={branchName}
              warehouseCount={warehouseCount}
            />
            <input type="hidden" name="listingId" value={setupItem.id} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Current quantity</span>
                <input
                  className="input"
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                <span className="label">Unit cost (GHS)</span>
                <input
                  className="input"
                  name="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <label>
                <span className="label">Receipt date</span>
                <input
                  className="input"
                  name="receivedDate"
                  type="date"
                  required
                />
              </label>
              <label>
                <span className="label">Source/reference</span>
                <input className="input" name="invoice" required />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Vendor</span>
                <input className="input" name="vendor" />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Reorder level</span>
                <input
                  className="input"
                  name="reorderPoint"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={setupPending}>
                {setupPending
                  ? "Saving…"
                  : setupPosition === setupListings.length
                    ? "Save & Finish"
                    : "Save & Next"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={async () => {
                  const progress = new FormData();
                  progress.set("listingId", setupItem.id);
                  progress.set("status", "skipped");
                  const result = await setStockSetupProgress(initial, progress);
                  setSetupProgressState(result);
                  if (!result.error)
                    setHandledSetupIds((ids) => [...ids, setupItem.id]);
                }}
              >
                Skip
              </button>
            </div>
            <Status state={setupState} />
            <Status state={setupProgressState} />
          </form>
        )}
      </InventoryDialog>
    </>
  );
}

function InventoryDialog({
  title,
  dialogRef,
  onClose,
  children,
}: {
  title: string;
  dialogRef: (node: HTMLDialogElement | null) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-title`}
      className="m-auto w-[min(94vw,44rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="flex items-center justify-between border-b p-5">
        <h2
          id={`${title.replaceAll(" ", "-").toLowerCase()}-title`}
          className="text-xl font-black"
        >
          {title}
        </h2>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-slate-100"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          Close
        </button>
      </div>
      <div className="max-h-[78vh] overflow-y-auto p-6 pb-24 sm:pb-6">
        {children}
      </div>
    </dialog>
  );
}
