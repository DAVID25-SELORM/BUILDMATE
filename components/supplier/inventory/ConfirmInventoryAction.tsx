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
    if (!form.reportValidity()) return;
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
        reserved = Number(option?.dataset.reserved ?? 0),
        existingCost = Number(option?.dataset.averageCost ?? 0),
        quantity = Number(get("quantity")),
        unitCost = Number(get("unitCost")),
        price = Number(option?.dataset.price ?? 0),
        canViewCost = option?.dataset.canViewCost !== "false",
        projected = current + quantity,
        projectedAvailable = projected - reserved,
        weighted =
          projected > 0
            ? (current * existingCost + quantity * unitCost) / projected
            : 0,
        stockValue = projected * weighted,
        salesValue = projectedAvailable * price,
        margin = salesValue - projectedAvailable * weighted,
        before = option?.dataset.marketplace ?? "Hidden",
        after = before.includes("Draft")
          ? "Ready to publish (draft remains unpublished)"
          : before.includes("Stock") || before.includes("stock")
            ? "Visible after receipt"
            : before;
      setLines([
        `${option?.dataset.product ?? selected("listingId")} — ${option?.dataset.variant ?? "Standard"}`,
        `Location: ${option?.dataset.branch ?? "Selected location"}`,
        `Current on hand: ${current}`,
        `Quantity received: +${quantity}`,
        `Stock value received: ${canViewCost ? `GHS ${(quantity * unitCost).toFixed(2)}` : "Restricted"}`,
        `Vendor: ${get("vendor").trim() || "Not provided"}`,
        `Vendor invoice / delivery note: ${get("invoice").trim() || "Not provided"}`,
        `Received date: ${get("receivedDate")}`,
        "BuildMate receipt reference: Generated automatically after posting",
        `New on hand: ${projected}`,
        `Receipt unit cost: GHS ${unitCost.toFixed(2)}`,
        `Projected weighted average cost: ${canViewCost ? `GHS ${weighted.toFixed(2)}` : "Restricted"}`,
        `Projected stock cost value: ${canViewCost ? `GHS ${stockValue.toFixed(2)}` : "Restricted"}`,
        `Selling price: GHS ${price.toFixed(2)}`,
        `Potential sales value: GHS ${salesValue.toFixed(2)}`,
        `Potential gross margin: ${canViewCost ? `GHS ${margin.toFixed(2)}` : "Restricted"}`,
        `Marketplace before: ${before}`,
        `Marketplace after: ${after}`,
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
          <h3 className="text-xl font-black">
            {kind === "receipt" ? "Review Stock Receipt" : `Confirm ${kind}`}
          </h3>
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
              disabled={disabled}
              onClick={() => {
                dialog.current?.close();
                formRef.current?.requestSubmit();
              }}
            >
              {disabled
                ? "Saving stock…"
                : kind === "receipt"
                  ? "Confirm & Receive Stock"
                  : "Confirm and submit"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
