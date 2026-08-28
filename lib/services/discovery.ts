export type DiscoverableProvider = {
  display_name: string;
  bio: string | null;
  region: string | null;
  city: string | null;
  service_provider_categories: {
    service_categories: { name: string; slug: string } | null;
  }[] | null;
  service_provider_skills: { name: string }[] | null;
  service_provider_areas?: { region: string; city: string | null; area: string | null }[] | null;
};

const generalTerms = new Set(["artisan", "artisans", "professional", "professionals", "tradesperson", "tradespeople", "service provider", "service providers"]);
const aliases: Record<string, string[]> = {
  driver: ["transport delivery"],
  drivers: ["transport delivery"],
  transporter: ["transport delivery"],
  transporters: ["transport delivery"],
  mason: ["masonry construction"],
  masons: ["masonry construction"],
  electrician: ["electrical"],
  electricians: ["electrical"],
  plumber: ["plumbing"],
  plumbers: ["plumbing"],
  carpenter: ["carpentry"],
  carpenters: ["carpentry"],
  painter: ["painting"],
  painters: ["painting"],
  tiler: ["tiling"],
  tilers: ["tiling"],
};

const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export function providerMatchesSearch(provider: DiscoverableProvider, query: string) {
  const target = normalized(query);
  if (!target || generalTerms.has(target)) return true;
  const expanded = [target, ...(aliases[target] ?? [])];
  const searchable = [
    provider.display_name,
    provider.bio,
    provider.region,
    provider.city,
    ...(provider.service_provider_categories ?? []).flatMap((item) =>
      item.service_categories ? [item.service_categories.name, item.service_categories.slug.replaceAll("-", " ")] : [],
    ),
    ...(provider.service_provider_skills ?? []).map((item) => item.name),
  ].map(normalized).join(" ");
  return expanded.some((term) => searchable.includes(term));
}

export function providerMatchesLocation(provider: DiscoverableProvider, location: string) {
  const target = normalized(location);
  if (!target) return true;
  return [
    provider.region,
    provider.city,
    ...(provider.service_provider_areas ?? []).flatMap((area) => [area.region, area.city, area.area]),
  ].some((place) => {
    const value = normalized(place);
    return value && (value.includes(target) || target.includes(value));
  });
}
