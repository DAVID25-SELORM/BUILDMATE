import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CompleteDeliveryForm } from "@/components/delivery/CompleteDeliveryForm";
import { requireRole } from "@/lib/auth/session";
import { DRIVER_NAV, parseDriverView } from "@/lib/driver/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDelivery } from "./actions";

type Delivery = {
  id: string;
  status: string;
  delivery_location: string;
  pickup_location: string | null;
  vehicle_registration: string | null;
  orders: {
    order_number: string;
    order_items: {
      id: string;
      product_name_snapshot: string;
      quantity: number;
    }[];
  } | null;
  delivery_attempts: {
    delivery_attempt_items: {
      order_item_id: string;
      delivered_quantity: number;
    }[];
  }[];
};

const currentStatuses = [
  "picked_up",
  "in_transit",
  "partially_delivered",
  "failed_delivery",
];
const completedStatuses = ["delivered", "return_to_origin", "cancelled"];

export default async function DriverPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: requestedView } = await searchParams;
  const view = parseDriverView(requestedView);
  const { user } = await requireRole(["driver"]);
  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("deliveries")
      .select(
        "id,status,delivery_location,pickup_location,vehicle_registration,orders(order_number,order_items(id,product_name_snapshot,quantity)),delivery_attempts(delivery_attempt_items(order_item_id,delivered_quantity))",
      )
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name,phone,role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const deliveries = (data ?? []) as unknown as Delivery[];
  const assigned = deliveries.filter(
    (delivery) => !completedStatuses.includes(delivery.status),
  );
  const current = deliveries.filter((delivery) =>
    currentStatuses.includes(delivery.status),
  );
  const completed = deliveries.filter((delivery) =>
    completedStatuses.includes(delivery.status),
  );

  return (
    <DashboardShell title="Driver workspace" nav={[...DRIVER_NAV]}>
      {view === "overview" && (
        <>
          <SectionHeading
            title="Driver overview"
            description="Review assignments, active delivery work and completed jobs."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric label="Assigned" value={assigned.length} />
            <Metric label="In progress" value={current.length} />
            <Metric label="Completed" value={completed.length} />
          </div>
          <DeliveryList
            deliveries={assigned.slice(0, 5)}
            empty="No assigned deliveries."
          />
        </>
      )}
      {view === "available" && (
        <InformationSection
          title="Available jobs"
          description="BuildMate dispatch assigns deliveries after confirming the order, route and vehicle. Unassigned customer deliveries are not exposed to drivers."
        />
      )}
      {view === "assigned" && (
        <>
          <SectionHeading
            title="Assigned deliveries"
            description="All active deliveries assigned to your account."
          />
          <DeliveryList
            deliveries={assigned}
            empty="No deliveries are currently assigned."
          />
        </>
      )}
      {view === "current" && (
        <>
          <SectionHeading
            title="Current delivery"
            description="Deliveries that have been picked up or are being completed."
          />
          <DeliveryList
            deliveries={current}
            empty="You have no delivery in progress."
          />
        </>
      )}
      {view === "completed" && (
        <>
          <SectionHeading
            title="Completed deliveries"
            description="Delivered, returned and closed delivery assignments."
          />
          <DeliveryList
            deliveries={completed}
            empty="No completed deliveries yet."
          />
        </>
      )}
      {view === "availability" && (
        <InformationSection
          title="Availability"
          description={
            current.length
              ? "You are currently engaged on a delivery. Dispatch can review your workload before assigning another job."
              : "No delivery is currently in progress. Dispatch can consider you for a new assignment."
          }
        />
      )}
      {view === "vehicle" && (
        <VehicleSection deliveries={deliveries} />
      )}
      {view === "profile" && (
        <>
          <SectionHeading
            title="Profile / Settings"
            description="Your driver identity and account context."
          />
          <div className="card mt-6 max-w-2xl divide-y">
            <ProfileRow label="Name" value={profile?.full_name ?? "Not set"} />
            <ProfileRow label="Email" value={user.email ?? "Not set"} />
            <ProfileRow label="Phone" value={profile?.phone ?? "Not set"} />
            <ProfileRow
              label="Account type"
              value={profile?.role ?? "driver"}
            />
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function DeliveryList({
  deliveries,
  empty,
}: {
  deliveries: Delivery[];
  empty: string;
}) {
  return (
    <div className="mt-6 space-y-4">
      {deliveries.map((delivery) => {
        const items = (delivery.orders?.order_items ?? []).map((item) => ({
          ...item,
          remaining_quantity:
            item.quantity -
            (delivery.delivery_attempts ?? [])
              .flatMap((attempt) => attempt.delivery_attempt_items ?? [])
              .filter((line) => line.order_item_id === item.id)
              .reduce(
                (sum, line) => sum + Number(line.delivered_quantity),
                0,
              ),
        }));
        return (
          <article className="card p-5" key={delivery.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <b>
                  {delivery.orders?.order_number ?? "Delivery assignment"}
                </b>
                <p className="text-sm text-slate-600">
                  {delivery.delivery_location}
                </p>
                {delivery.pickup_location && (
                  <p className="text-xs text-slate-500">
                    Pickup: {delivery.pickup_location}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">
                {delivery.status.replaceAll("_", " ")}
              </span>
            </div>
            {delivery.status === "driver_assigned" && (
              <StatusForm
                deliveryId={delivery.id}
                status="picked_up"
                label="Confirm pickup"
              />
            )}
            {delivery.status === "picked_up" && (
              <StatusForm
                deliveryId={delivery.id}
                status="in_transit"
                label="Start delivery"
              />
            )}
            {[
              "in_transit",
              "partially_delivered",
              "failed_delivery",
            ].includes(delivery.status) && (
              <CompleteDeliveryForm id={delivery.id} items={items} />
            )}
          </article>
        );
      })}
      {!deliveries.length && (
        <div className="card p-8 text-center text-slate-500">{empty}</div>
      )}
    </div>
  );
}

function VehicleSection({ deliveries }: { deliveries: Delivery[] }) {
  const registrations = [
    ...new Set(
      deliveries
        .map((delivery) => delivery.vehicle_registration)
        .filter((registration): registration is string => Boolean(registration)),
    ),
  ];
  return (
    <>
      <SectionHeading
        title="Vehicle"
        description="Vehicle registrations recorded on your delivery assignments."
      />
      <div className="card mt-6 max-w-2xl divide-y">
        {registrations.map((registration) => (
          <p className="p-4 font-semibold" key={registration}>
            {registration}
          </p>
        ))}
        {!registrations.length && (
          <p className="p-5 text-slate-500">
            No vehicle has been recorded for your assignments.
          </p>
        )}
      </div>
    </>
  );
}

function StatusForm({
  deliveryId,
  status,
  label,
}: {
  deliveryId: string;
  status: string;
  label: string;
}) {
  return (
    <form className="mt-3" action={updateDelivery}>
      <input type="hidden" name="delivery" value={deliveryId} />
      <input type="hidden" name="status" value={status} />
      <button className="btn-primary">{label}</button>
    </form>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
    </>
  );
}

function InformationSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <SectionHeading title={title} description={description} />
      <div className="card mt-6 p-8 text-center text-slate-500">
        No action is required right now.
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <b className="mt-2 block text-3xl">{value}</b>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[160px_1fr]">
      <b>{label}</b>
      <span className="capitalize text-slate-600">{value}</span>
    </div>
  );
}
