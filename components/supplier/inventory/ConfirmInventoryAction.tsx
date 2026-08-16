"use client";
import { useRef, useState } from "react";
export function ConfirmInventoryAction({
  kind,
  disabled,
  label,
}: {
  kind: "receipt" | "adjustment" | "transfer";
  disabled: boolean;
  label: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    formRef = useRef<HTMLFormElement | null>(null),
    [lines, setLines] = useState<string[]>([]);
  function open(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    formRef.current = form;
    const data = new FormData(form),
      get = (name: string) => String(data.get(name) ?? ""),
      select = (name: string) =>
        form.elements.namedItem(name) as HTMLSelectElement | null,
      selected = (name: string) =>
        select(name)?.selectedOptions[0]?.textContent ?? "Not selected";
    if (kind === "receipt") {
      const option = select("listingId")?.selectedOptions[0],
        current = Number(option?.dataset.onHand ?? 0),
        existingCost = Number(option?.dataset.averageCost ?? 0),
        quantity = Number(get("quantity")),
        unitCost = Number(get("unitCost")),
        projected = current + quantity,
        weighted =
          projected > 0
            ? (current * existingCost + quantity * unitCost) / projected
            : 0;
      setLines([
        `Product and location: ${selected("listingId")}`,
        `Current: ${current} units`,
        `Receiving: +${quantity || 0}`,
        `New on-hand: ${projected || 0}`,
        `Existing average cost: GHS ${existingCost.toFixed(2)}`,
        `Projected weighted average: GHS ${weighted.toFixed(2)}`,
      ]);
    } else if (kind === "adjustment") {
      const physical = get("physicalQuantity"),
        current = Number(
          select("listingId")?.selectedOptions[0]?.dataset.onHand ?? 0,
        );
      setLines(
        physical
          ? [
              `Product and location: ${selected("listingId")}`,
              `System quantity: ${current}`,
              `Physical count: ${physical}`,
              `Difference: ${Number(physical) - current}`,
              `Reason: ${get("reason") || "Missing"}`,
            ]
          : [
              `Product and location: ${selected("listingId")}`,
              `Movement: ${get("movementType")}`,
              `Adjustment quantity: ${get("quantity")}`,
              `Reason: ${get("reason") || "Missing"}`,
              "The resulting balance will be validated by the ledger.",
            ],
      );
    } else
      setLines([
        `Source: ${selected("sourceListing")}`,
        `Destination: ${selected("destinationListing")}`,
        `Product quantity: ${get("quantity")}`,
        `Reason: ${get("reason") || "Missing"}`,
        "Available and projected balances will be validated atomically by the ledger.",
      ]);
    dialog.current?.showModal();
  }
  return (
    <>
      <button
        type="button"
        className="btn-primary mt-4"
        disabled={disabled}
        onClick={open}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-slate-950/40"
      >
        <div className="p-6">
          <h3 className="text-xl font-black">Confirm {kind}</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((line) => (
              <li className="rounded-lg bg-slate-50 p-2" key={line}>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                dialog.current?.close();
                formRef.current?.requestSubmit();
              }}
            >
              Confirm and submit
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
