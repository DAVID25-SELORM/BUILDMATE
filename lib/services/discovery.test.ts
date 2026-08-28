import { describe, expect, it } from "vitest";
import { providerMatchesLocation, providerMatchesSearch, type DiscoverableProvider } from "./discovery";

const provider: DiscoverableProvider = {
  display_name: "Reliable Haulage",
  bio: "Building-material transport",
  region: "Greater Accra",
  city: "Kwashieman",
  service_provider_categories: [{ service_categories: { name: "Transport & Delivery", slug: "transport-delivery" } }],
  service_provider_skills: [{ name: "Tipper truck driving" }],
  service_provider_areas: [{ region: "Greater Accra", city: "Accra", area: "Ablekuma" }],
};

describe("public professional discovery", () => {
  it.each(["driver", "transporter", "haulage", "tipper truck"])("finds transport providers for %s", (query) => {
    expect(providerMatchesSearch(provider, query)).toBe(true);
  });
  it("treats artisan as the inclusive professional directory", () => {
    expect(providerMatchesSearch(provider, "artisan")).toBe(true);
  });
  it("matches profile and declared service areas case-insensitively", () => {
    expect(providerMatchesLocation(provider, "ablekuma")).toBe(true);
    expect(providerMatchesLocation(provider, "GREATER ACCRA")).toBe(true);
    expect(providerMatchesLocation(provider, "Kumasi")).toBe(false);
  });
});
