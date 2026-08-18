"use client";

import { useActionState, useState } from "react";
import { completeDelivery } from "@/app/driver/actions";
import { localDateTimeValue } from "@/lib/dates/future";

type Item = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  remaining_quantity?: number;
};

export function CompleteDeliveryForm({
  id,
  items,
}: {
  id: string;
  items: Item[];
}) {
  const [state, action, pending] = useActionState(completeDelivery, null);
  const [outcome, setOutcome] = useState("delivered");
  const [resolution, setResolution] = useState("reschedule");
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <form
      action={action}
      className="mt-4 grid gap-3"
      encType="multipart/form-data"
    >
      <input type="hidden" name="delivery" value={id} />
      <input type="hidden" name="requestKey" value={requestKey} />
      <input
        type="hidden"
        name="itemIds"
        value={items.map((item) => item.id).join(",")}
      />
      <label>
        <span className="label">Outcome</span>
        <select
          className="input"
          name="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
        >
          <option value="delivered">Delivered in full</option>
          <option value="partial">Partially delivered</option>
          <option value="failed">Failed delivery</option>
        </select>
      </label>
      {items.map((item) => {
        const remaining = item.remaining_quantity ?? item.quantity;
        return (
          <label key={item.id}>
            <span className="label">
              {item.product_name_snapshot} delivered this attempt ({remaining}{" "}
              outstanding)
            </span>
            <input
              key={`${outcome}-${item.id}`}
              className="input"
              name={`quantity_${item.id}`}
              type="number"
              min="0"
              max={remaining}
              step="0.01"
              defaultValue={outcome === "delivered" ? remaining : 0}
              required
            />
          </label>
        );
      })}
      {outcome !== "delivered" && (
        <label>
          <span className="label">Reason</span>
          <textarea className="input" name="reason" minLength={5} required />
        </label>
      )}
      {outcome === "failed" && (
        <>
          <label>
            <span className="label">Next action</span>
            <select
              className="input"
              name="resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              required
            >
              <option value="reschedule">Reschedule</option>
              <option value="return_to_origin">Return to origin</option>
            </select>
          </label>
          {resolution === "reschedule" && (
            <label>
              <span className="label">Reschedule date and time</span>
              <input
                className="input"
                name="rescheduledFor"
                type="datetime-local"
                min={localDateTimeValue()}
                required
              />
            </label>
          )}
        </>
      )}
      {outcome !== "failed" && (
        <input
          className="input"
          name="otp"
          inputMode="numeric"
          maxLength={6}
          placeholder="Customer OTP"
          required
        />
      )}
      <input
        className="input"
        name="proof"
        type="file"
        accept="image/*"
        required
      />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Recording…" : "Record delivery outcome"}
      </button>
      {(state?.error || state?.message) && (
        <p className="text-sm" role="status">
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
