export const DRIVER_VIEWS = [
  "overview",
  "available",
  "assigned",
  "current",
  "completed",
  "availability",
  "vehicle",
  "profile",
] as const;

export type DriverView = (typeof DRIVER_VIEWS)[number];

export const DRIVER_NAV = [
  { label: "Overview", href: "/driver" },
  { label: "Available jobs", href: "/driver?view=available" },
  { label: "Assigned deliveries", href: "/driver?view=assigned" },
  { label: "Current delivery", href: "/driver?view=current" },
  { label: "Completed deliveries", href: "/driver?view=completed" },
  { label: "Availability", href: "/driver?view=availability" },
  { label: "Vehicle", href: "/driver?view=vehicle" },
  { label: "Profile / Settings", href: "/driver?view=profile" },
  { label: "Support", href: "/support" },
] as const;

export function parseDriverView(value?: string): DriverView {
  return DRIVER_VIEWS.includes(value as DriverView)
    ? (value as DriverView)
    : "overview";
}
