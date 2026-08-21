"use client";

export const inventoryOperationEvent = "buildmate:inventory-operation";

export function OpenInventoryOperationButton({
  operation,
  listingId,
  className,
  children,
}: {
  operation: "receive" | "adjust" | "count" | "transfer";
  listingId?: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(inventoryOperationEvent, {
            detail: { operation, listingId },
          }),
        )
      }
    >
      {children}
    </button>
  );
}
