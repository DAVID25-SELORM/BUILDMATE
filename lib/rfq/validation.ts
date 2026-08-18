import { z } from "zod";
import { isTodayOrLater } from "@/lib/dates/future";

const futureDate = z
  .string()
  .date()
  .refine(isTodayOrLater, "Date cannot be in the past");

export const rfqSchema = z.object({
  title: z.string().trim().min(3, "Project name is required").max(180),
  deliveryLocation: z
    .string()
    .trim()
    .min(3, "Delivery location is required")
    .max(500),
  requiredDate: futureDate,
  materialList: z
    .string()
    .trim()
    .min(3, "Add at least one material")
    .max(10000),
  notes: z.string().trim().max(3000).default(""),
});

export function parseMaterialLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((description) => ({ description, quantity: 1, unit: "item" }));
}

export const supplierQuoteSchema = z.object({
  quoteRequestId: z.string().uuid(),
  subtotal: z.coerce.number().nonnegative(),
  deliveryFee: z.coerce.number().nonnegative(),
  validUntil: z
    .union([futureDate, z.literal("")])
    .transform((value) => value || null),
  deliveryDays: z.coerce.number().int().positive().max(365),
  notes: z.string().trim().max(3000).default(""),
});
