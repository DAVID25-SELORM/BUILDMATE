import { z } from "zod";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  BUSINESS_TYPES,
  BRANCH_TYPES,
  DELIVERY_HANDLERS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  SETTLEMENT_METHODS,
} from "@/lib/supplier/constants";

export const businessInformationSchema = z.object({
  registeredName: z
    .string()
    .trim()
    .min(2, "Enter the registered business name"),
  tradingName: z.string().trim().optional().default(""),
  businessType: z.enum(BUSINESS_TYPES, { message: "Select a business type" }),
  businessDescription: z
    .string()
    .trim()
    .min(10, "Add a short description of the business"),
  yearEstablished: z.coerce
    .number()
    .int()
    .min(1900, "Enter a valid year")
    .max(new Date().getFullYear(), "Year cannot be in the future"),
  website: z.string().trim().optional().default(""),
  primaryCategories: z
    .array(z.string())
    .min(1, "Select at least one product category"),
  numberOfBranches: z.coerce.number().int().min(1, "Enter at least 1"),
  numberOfEmployees: z.coerce.number().int().min(1, "Enter at least 1"),
});
export type BusinessInformationInput = z.infer<
  typeof businessInformationSchema
>;

export const contactInformationSchema = z.object({
  primaryContactName: z
    .string()
    .trim()
    .min(2, "Enter the primary contact name"),
  primaryPhone: z.string().trim().min(7, "Enter a valid phone number"),
  alternativePhone: z.string().trim().optional().default(""),
  businessEmail: z
    .string()
    .trim()
    .min(1, "Business email is required")
    .email("Enter a valid email address"),
  whatsappNumber: z.string().trim().optional().default(""),
  physicalAddress: z.string().trim().min(5, "Enter the physical address"),
  region: z.string().trim().min(1, "Select a region"),
  city: z.string().trim().min(1, "Enter a city or town"),
  area: z.string().trim().optional().default(""),
  ghanaPostGps: z.string().trim().optional().default(""),
});
export type ContactInformationInput = z.infer<typeof contactInformationSchema>;

export const registrationComplianceSchema = z
  .object({
    registrationNumber: z
      .string()
      .trim()
      .min(2, "Enter the business registration number"),
    tin: z.string().trim().min(2, "Enter the Tax Identification Number"),
    vatRegistered: z.boolean(),
    vatNumber: z.string().trim().optional().default(""),
    gsaRegistrationNumber: z.string().trim().optional().default(""),
    distributorAuthorisationNumber: z.string().trim().optional().default(""),
    registrationDocumentExpiry: z.string().trim().optional().default(""),
    vatCertificateExpiry: z.string().trim().optional().default(""),
    distributorAuthorisationExpiry: z.string().trim().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.vatRegistered && !data.vatNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["vatNumber"],
        message: "Enter the VAT registration number",
      });
    }
  });
export type RegistrationComplianceInput = z.infer<
  typeof registrationComplianceSchema
>;

export const branchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a branch or warehouse name"),
  branchType: z.enum(BRANCH_TYPES),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().min(5, "Enter the address"),
  region: z.string().trim().min(1, "Select a region"),
  city: z.string().trim().min(1, "Enter a city"),
  area: z.string().trim().optional().default(""),
  ghanaPostGps: z.string().trim().optional().default(""),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  operatingHours: z.string().trim().optional().default(""),
  contactPerson: z.string().trim().optional().default(""),
  isMainBranch: z.boolean(),
  supportsPickup: z.boolean(),
  supportsDelivery: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type BranchInput = z.infer<typeof branchSchema>;

export const deliveryCoverageSchema = z.object({
  regionsServed: z.array(z.string()).min(1, "Select at least one region"),
  citiesServed: z.array(z.string()).default([]),
  maxDeliveryRadiusKm: z.coerce.number().min(0).optional().nullable(),
  minimumOrderValue: z.coerce.number().min(0).optional().nullable(),
  sameDayDelivery: z.boolean(),
  standardLeadTimeDays: z.coerce
    .number()
    .int()
    .min(0, "Enter the standard lead time"),
  customerPickupAvailable: z.boolean(),
  deliveryHandledBy: z.enum(DELIVERY_HANDLERS),
});
export type DeliveryCoverageInput = z.infer<typeof deliveryCoverageSchema>;

export const settlementSchema = z
  .object({
    settlementMethod: z.enum(SETTLEMENT_METHODS),
    bankName: z.string().trim().optional().default(""),
    accountName: z.string().trim().optional().default(""),
    accountNumber: z.string().trim().optional().default(""),
    momoNetwork: z.string().trim().optional().default(""),
    momoNumber: z.string().trim().optional().default(""),
    momoAccountName: z.string().trim().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.settlementMethod === "bank") {
      if (!data.bankName)
        ctx.addIssue({
          code: "custom",
          path: ["bankName"],
          message: "Enter the bank name",
        });
      if (!data.accountName)
        ctx.addIssue({
          code: "custom",
          path: ["accountName"],
          message: "Enter the account name",
        });
      if (!data.accountNumber || data.accountNumber.length < 6) {
        ctx.addIssue({
          code: "custom",
          path: ["accountNumber"],
          message: "Enter a valid account number",
        });
      }
    } else {
      if (!data.momoNetwork)
        ctx.addIssue({
          code: "custom",
          path: ["momoNetwork"],
          message: "Select a mobile money network",
        });
      if (!data.momoNumber || data.momoNumber.length < 7) {
        ctx.addIssue({
          code: "custom",
          path: ["momoNumber"],
          message: "Enter a valid mobile money number",
        });
      }
      if (!data.momoAccountName)
        ctx.addIssue({
          code: "custom",
          path: ["momoAccountName"],
          message: "Enter the registered mobile money name",
        });
    }
  });
export type SettlementInput = z.infer<typeof settlementSchema>;

export const documentUploadSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  storagePath: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES, {
    message: "Only PDF, JPG and PNG files are allowed",
  }),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_DOCUMENT_SIZE_BYTES, "File must be 10MB or smaller"),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
