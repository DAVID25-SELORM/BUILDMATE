import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  FileSpreadsheet,
  MapPin,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { getFeaturedProducts } from "@/lib/catalogue/featured-products";
const categories = [
  { name: "Cement & Concrete", image: "cement-and-concrete.webp" },
  { name: "Blocks & Bricks", image: "blocks-and-bricks.webp" },
  { name: "Steel & Reinforcement", image: "steel-reinforcement.webp" },
  { name: "Roofing", image: "roofing-installation.webp" },
  { name: "Plumbing", image: "plumbing-materials.webp" },
  { name: "Electrical", image: "electrical-materials.webp" },
  { name: "Tiles & Flooring", image: "tiles-flooring.webp" },
  { name: "Paint & Finishes", image: "paint-finishes.webp" },
  { name: "Tools & Equipment", image: "tools-equipment.webp" },
];
export default async function HomePage() {
  const products = await getFeaturedProducts();
  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-950 text-white">
        <Image
          src="/images/home/construction-site-hero.webp"
          alt="Construction worker placing concrete blocks on an active building site"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-900/90 to-brand-900/30" />
        <div className="container-shell grid gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="mb-4 font-semibold text-brand-100">
              GHANA&apos;S CONSTRUCTION PROCUREMENT PLATFORM
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">
              Build with confidence, from plan to delivery.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-brand-50">
              Compare verified suppliers, turn BOQs into accountable
              procurement, buy materials and coordinate delivery to your site.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="rounded-xl bg-white px-6 py-3 font-bold text-brand-800"
              >
                Shop materials
              </Link>
              <Link
                href="/dashboard/plan-to-procurement"
                className="rounded-xl border border-white/60 px-6 py-3 font-bold"
              >
                Upload BOQ or plan
              </Link>
            </div>
          </div>
          <div className="card self-center p-6 text-slate-900">
            <h2 className="text-xl font-bold">
              Find materials near your project
            </h2>
            <form action="/shop" className="mt-5 grid gap-3">
              <input
                className="input"
                name="q"
                placeholder="Search cement, roofing, tiles..."
              />
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  className="input pl-11"
                  name="location"
                  placeholder="Enter site location"
                />
              </div>
              <button className="btn-primary">Search suppliers</button>
            </form>
          </div>
        </div>
      </section>
      <section className="container-shell py-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-semibold text-brand-700">SHOP BY CATEGORY</p>
            <h2 className="mt-2 text-3xl font-black">
              Materials for every construction stage
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-2 font-semibold text-brand-700 sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {categories.map((c) => (
            <Link
              href={`/shop?q=${encodeURIComponent(c.name.split(" & ")[0])}`}
              key={c.name}
              className="card group overflow-hidden"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={`/images/categories/${c.image}`}
                  alt={`${c.name} construction materials`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="p-4 font-bold">{c.name}</h3>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Category photographs are licensed illustrations, not supplier
          inventory.
        </p>
      </section>
      <section className="bg-white py-16">
        <div className="container-shell">
          <div className="text-center">
            <p className="font-semibold text-brand-700">WHY BUILDMATE</p>
            <h2 className="mt-2 text-3xl font-black">
              More than an online hardware shop
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(
              [
                [
                  ShieldCheck,
                  "Verified suppliers",
                  "Buy from checked businesses with transparent profiles and performance records.",
                ],
                [
                  FileSpreadsheet,
                  "Plan-to-procurement",
                  "Upload a BOQ or plan, organise requirements by stage and prepare supplier comparisons.",
                ],
                [
                  Truck,
                  "Coordinated delivery",
                  "Track preparation, dispatch and proof of delivery to your construction site.",
                ],
              ] as [LucideIcon, string, string][]
            ).map(([Icon, title, desc]) => (
              <div key={title} className="card p-7">
                <Icon className="h-9 w-9 text-brand-700" />
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container-shell py-16">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src="/images/construction/architects-reviewing-plans.webp"
              alt="Construction professionals reviewing architectural plans at a project site"
              fill
              sizes="(max-width:1024px) 100vw,50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-semibold text-brand-700">PLAN TO PROCUREMENT</p>
            <h2 className="mt-2 text-3xl font-black">
              A practical path from drawing to delivery
            </h2>
            <ol className="mt-6 grid gap-3">
              {[
                "Upload an existing BOQ, plan or scan",
                "Organise requirements by construction stage",
                "Review preliminary material needs",
                "Match verified suppliers",
                "Compare prices and availability",
                "Plan accountable deliveries",
              ].map((x, i) => (
                <li className="flex gap-3" key={x}>
                  <b className="text-brand-700">{i + 1}.</b>
                  <span>{x}</span>
                </li>
              ))}
            </ol>
            <Link
              className="btn-primary mt-7 inline-flex"
              href="/dashboard/plan-to-procurement"
            >
              Start assisted procurement
            </Link>
            <p className="mt-3 text-xs text-slate-500">
              Version 1 uses assisted review. It does not claim automated
              architectural certification.
            </p>
          </div>
        </div>
      </section>
      <section className="container-shell py-16">
        <p className="font-semibold text-brand-700">POPULAR MATERIALS</p>
        <h2 className="mt-2 text-3xl font-black">
          Compare total delivered value
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.name} product={p} />
          ))}
        </div>
        {!products.length && (
          <div className="card mt-8 p-8 text-center text-slate-500">
            No approved supplier listings are published yet. New live listings will appear here automatically.
          </div>
        )}
      </section>
      <section className="container-shell pb-16">
        <div className="overflow-hidden rounded-3xl bg-slate-950 p-8 text-white md:p-12">
          <Calculator className="h-10 w-10 text-sand-500" />
          <h2 className="mt-5 text-3xl font-black">
            Estimate before you request quotes
          </h2>
          <p className="mt-4 max-w-2xl text-slate-300">
            Calculate blocks, concrete, paint, tiles, roofing and plastering,
            then carry the estimate into an RFQ.
          </p>
          <Link
            href="/calculators"
            className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-bold text-slate-950"
          >
            Open calculators
          </Link>
        </div>
      </section>
    </>
  );
}
