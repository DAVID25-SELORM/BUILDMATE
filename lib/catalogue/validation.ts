import { z } from "zod";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null);

export const productSchema = z.object({
  id: optionalUuid.optional(),
  name: z.string().trim().min(2, "Product name is required").max(160),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase URL slug"),
  categoryId: z.string().uuid("Choose a category"),
  brandId: optionalUuid,
  description: z.string().trim().max(3000).default(""),
  baseUnit: z.string().trim().min(1, "Unit is required").max(40),
  isActive: z.boolean().default(true)
});

export const listingSchema = z.object({
  id: optionalUuid.optional(),
  productId: z.string().uuid("Choose a product"),
  sku: z.string().trim().max(80).default(""),
  price: z.coerce.number().nonnegative("Price cannot be negative"),
  wholesalePrice: z.union([z.coerce.number().nonnegative(), z.literal("")]).transform((value) => value === "" ? null : value),
  wholesaleMinimum: z.union([z.coerce.number().positive(), z.literal("")]).transform((value) => value === "" ? null : value),
  stockQuantity: z.union([z.coerce.number().nonnegative(), z.literal("")]).transform((value) => value === "" ? null : value),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "confirmation_required", "available_on_order"]),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  minimumOrderQuantity: z.union([z.coerce.number().positive(), z.literal("")]).default("").transform((value) => value === "" ? null : value),
  deliveryAvailable: z.boolean().default(false),
  pickupAvailable: z.boolean().default(false),
  supplierNotes: z.string().trim().max(2000).default(""),
  listingStatus: z.enum(["draft", "published", "out_of_stock", "seasonal", "discontinued"]).default("draft"),
  isActive: z.boolean().default(false)
}).superRefine((value, context) => {
  if (value.listingStatus === "published" && !value.deliveryAvailable && !value.pickupAvailable) {
    context.addIssue({ code: "custom", path: ["deliveryAvailable"], message: "Choose delivery or pickup before publishing" });
  }
  if (value.listingStatus === "published" && value.stockStatus === "out_of_stock") {
    context.addIssue({ code: "custom", path: ["stockStatus"], message: "An out-of-stock listing cannot be published" });
  }
});
