import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "./validation";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "secret" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    fullName: "Ama Mensah",
    phone: "0244000000",
    email: "ama@example.com",
    role: "customer" as const,
    businessName: "",
    password: "supersecret",
    confirmPassword: "supersecret"
    ,acceptedTerms: true
  };

  it("accepts a valid customer registration", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("requires a business name for supplier accounts", () => {
    const result = registerSchema.safeParse({ ...base, role: "supplier", businessName: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a supplier registration with a business name", () => {
    const result = registerSchema.safeParse({ ...base, role: "supplier", businessName: "Accra Building Depot" });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "supersecret", confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "supersecret", confirmPassword: "supersecret" });
    expect(result.success).toBe(true);
  });
});
