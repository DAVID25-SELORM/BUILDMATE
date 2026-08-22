const images: Record<string, string> = {
  "cement-concrete": "cement-and-concrete.webp",
  "blocks-masonry": "blocks-and-bricks.webp",
  "steel-reinforcement": "steel-reinforcement.webp",
  "timber-wood": "roofing-installation.webp",
  roofing: "roofing-installation.webp",
  "doors-windows": "blocks-and-bricks.webp",
  "plumbing-sanitary": "plumbing-materials.webp",
  electrical: "electrical-materials.webp",
  "tiles-flooring": "tiles-flooring.webp",
  "ceilings-drywall": "blocks-and-bricks.webp",
  "paint-finishes": "paint-finishes.webp",
  "kitchen-joinery": "roofing-installation.webp",
  "external-works": "cement-and-concrete.webp",
  "tools-equipment": "tools-equipment.webp",
  "hardware-fittings": "tools-equipment.webp",
};

export function categoryImage(slug: string) {
  return images[slug] ?? "cement-and-concrete.webp";
}
