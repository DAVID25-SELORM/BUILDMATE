import { describe, expect, it } from "vitest";
import { branchSchema, businessInformationSchema, registrationComplianceSchema, settlementSchema } from "./validation";

describe("businessInformationSchema", () => {
  const base = {
    registeredName: "Accra Building Depot",
    tradingName: "ABD",
    businessType: "wholesaler" as const,
    businessDescription: "We supply cement and steel across Accra.",
    yearEstablished: 2015,
    website: "",
    primaryCategories: ["Cement & Blocks"],
    numberOfBranches: 2,
    numberOfEmployees: 10
  };

  it("accepts a valid submission", () => {
    expect(businessInformationSchema.safeParse(base).success).toBe(true);
  });

  it("requires at least one product category", () => {
    const result = businessInformationSchema.safeParse({ ...base, primaryCategories: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a future year established", () => {
    const result = businessInformationSchema.safeParse({ ...base, yearEstablished: new Date().getFullYear() + 5 });
    expect(result.success).toBe(false);
  });
});

describe("registrationComplianceSchema", () => {
  const base = {
    registrationNumber: "BN-12345",
    tin: "TIN-98765",
    vatRegistered: false,
    vatNumber: "",
    gsaRegistrationNumber: "",
    distributorAuthorisationNumber: "",
    registrationDocumentExpiry: "",
    vatCertificateExpiry: "",
    distributorAuthorisationExpiry: ""
  };

  it("accepts a non-VAT-registered business without a VAT number", () => {
    expect(registrationComplianceSchema.safeParse(base).success).toBe(true);
  });

  it("requires a VAT number when VAT registered is true", () => {
    const result = registrationComplianceSchema.safeParse({ ...base, vatRegistered: true, vatNumber: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a VAT registered business with a VAT number", () => {
    const result = registrationComplianceSchema.safeParse({ ...base, vatRegistered: true, vatNumber: "VAT-1" });
    expect(result.success).toBe(true);
  });
});

describe("branchSchema", () => {
  const base = {
    name: "Spintex Warehouse",
    branchType: "warehouse" as const,
    phone: "",
    address: "Spintex Road",
    region: "Greater Accra",
    city: "Accra",
    area: "",
    ghanaPostGps: "",
    latitude: null,
    longitude: null,
    operatingHours: "",
    contactPerson: "",
    isMainBranch: false,
    supportsPickup: true
  };

  it("accepts a valid branch", () => {
    expect(branchSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a branch without a region", () => {
    const result = branchSchema.safeParse({ ...base, region: "" });
    expect(result.success).toBe(false);
  });
});

describe("settlementSchema", () => {
  it("requires bank fields when settlement method is bank", () => {
    const result = settlementSchema.safeParse({
      settlementMethod: "bank",
      bankName: "",
      accountName: "",
      accountNumber: "",
      momoNetwork: "",
      momoNumber: "",
      momoAccountName: ""
    });
    expect(result.success).toBe(false);
  });

  it("accepts complete bank details", () => {
    const result = settlementSchema.safeParse({
      settlementMethod: "bank",
      bankName: "GCB Bank",
      accountName: "Accra Building Depot Ltd",
      accountNumber: "1234567890",
      momoNetwork: "",
      momoNumber: "",
      momoAccountName: ""
    });
    expect(result.success).toBe(true);
  });

  it("requires mobile money fields when settlement method is mobile_money", () => {
    const result = settlementSchema.safeParse({
      settlementMethod: "mobile_money",
      bankName: "",
      accountName: "",
      accountNumber: "",
      momoNetwork: "",
      momoNumber: "",
      momoAccountName: ""
    });
    expect(result.success).toBe(false);
  });

  it("accepts complete mobile money details", () => {
    const result = settlementSchema.safeParse({
      settlementMethod: "mobile_money",
      bankName: "",
      accountName: "",
      accountNumber: "",
      momoNetwork: "MTN",
      momoNumber: "0244000000",
      momoAccountName: "Accra Building Depot"
    });
    expect(result.success).toBe(true);
  });
});
