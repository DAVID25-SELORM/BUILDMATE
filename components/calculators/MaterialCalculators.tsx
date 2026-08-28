"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { calculateMaterial, type CalculatorKind, type Estimate } from "@/lib/calculators/materials";

const tools: { kind: CalculatorKind; name: string; length: string; width: string; height?: string }[] = [
  { kind: "blocks", name: "Block wall estimator", length: "Total wall length (m)", width: "Not used", height: "Wall height (m)" },
  { kind: "concrete", name: "Concrete estimator", length: "Length (m)", width: "Width (m)", height: "Thickness/depth (m)" },
  { kind: "cement_sand", name: "Cement and sand estimator", length: "Required wet mortar volume (m³)", width: "Sand ratio (parts per 1 cement)" },
  { kind: "paint", name: "Paint coverage estimator", length: "Wall length (m)", width: "Wall height (m)" },
  { kind: "tiles", name: "Tile estimator", length: "Area length (m)", width: "Area width (m)" },
  { kind: "roofing", name: "Roofing estimator", length: "Building length (m)", width: "Building width (m)" },
  { kind: "plaster", name: "Plastering estimator", length: "Total wall length (m)", width: "Not used", height: "Wall height (m)" },
];
const images: Record<CalculatorKind, string> = {
  blocks: "/images/categories/blocks-and-masonry-v3.webp", concrete: "/images/categories/cement-and-concrete-v3.webp",
  cement_sand: "/images/categories/cement-and-sand-calculator-v3.webp",
  paint: "/images/categories/paint-finishes.webp", tiles: "/images/categories/tiles-and-flooring-v3.webp",
  roofing: "/images/categories/roofing-v3.webp", plaster: "/images/categories/ceilings-and-drywall-v2.webp",
};

export function MaterialCalculators() {
  const [selected, setSelected] = useState<(typeof tools)[number] | null>(null);
  const [values, setValues] = useState({ length: "", width: "", height: "", openings: "0", waste: "10", unitPrice: "" });
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const update = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  function open(tool: (typeof tools)[number]) { setSelected(tool); setEstimate(null); setError(""); setTimeout(() => document.getElementById("calculator-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }
  function calculate() {
    if (!selected) return;
    try {
      setEstimate(calculateMaterial(selected.kind, { length: Number(values.length), width: selected.kind === "blocks" || selected.kind === "plaster" ? 1 : Number(values.width), height: Number(values.height), openings: Number(values.openings), waste: Number(values.waste), unitPrice: Number(values.unitPrice) }));
      setError("");
    } catch (cause) { setEstimate(null); setError(cause instanceof Error ? cause.message : "Check the dimensions."); }
  }
  const materialList = estimate ? [`${estimate.label}: ${estimate.quantity} ${estimate.unit}`,...(estimate.related??[]).map(item=>`${item.label}: ${item.quantity} ${item.unit}`)].join("\n")+"\n(preliminary calculator estimate — verify before purchase)" : "";
  return <>
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{tools.map((tool,index) => <article className="card overflow-hidden" key={tool.kind}>
      <div className="relative aspect-[16/8]"><Image src={images[tool.kind]} alt={`${tool.name} material`} fill loading={index===0?"eager":"lazy"} sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover" /></div>
      <div className="p-6"><h2 className="text-xl font-bold">{tool.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">Enter measured dimensions, openings and a waste allowance for a preliminary estimate.</p><button className="btn-secondary mt-5 w-full" type="button" onClick={() => open(tool)}>Open calculator</button></div>
    </article>)}</div>
    {selected && <section id="calculator-form" className="card mt-8 scroll-mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-brand-700">ACTIVE CALCULATOR</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2></div><button type="button" className="text-sm font-semibold text-slate-600" onClick={() => { setSelected(null); setEstimate(null); }}>Close</button></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NumberField label={selected.length} value={values.length} onChange={value => update("length", value)} />
        {!(["blocks", "plaster"] as CalculatorKind[]).includes(selected.kind) && <NumberField label={selected.width} value={values.width} onChange={value => update("width", value)} min={selected.kind === "cement_sand" ? 2 : 0} max={selected.kind === "cement_sand" ? 8 : undefined} step={selected.kind === "cement_sand" ? "1" : "0.01"} />}
        {selected.height && <NumberField label={selected.height} value={values.height} onChange={value => update("height", value)} />}
        {["blocks", "paint", "plaster"].includes(selected.kind) && <NumberField label="Openings to subtract (m²)" value={values.openings} onChange={value => update("openings", value)} />}
        <NumberField label="Waste allowance (%)" value={values.waste} onChange={value => update("waste", value)} max={50} step="1" />
        <NumberField label={`Optional unit price (GHS/${selected.kind === "blocks" ? "block" : selected.kind === "paint" ? "litre" : selected.kind === "cement_sand" ? "50 kg cement bag" : "m² or m³"})`} value={values.unitPrice} onChange={value => update("unitPrice", value)} />
      </div>
      <button className="btn-primary mt-5" type="button" onClick={calculate}>Calculate estimate</button>
      {error && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      {estimate && <div className="mt-6 rounded-2xl bg-brand-50 p-5" role="status"><p className="text-sm font-semibold text-brand-700">PRELIMINARY REQUIREMENT</p><p className="mt-1 text-3xl font-black">{estimate.quantity} {estimate.unit} {estimate.label}</p>{estimate.related?.map(item=><p className="mt-1 text-xl font-bold" key={item.label}>{item.quantity} {item.unit} {item.label}</p>)}{Number(values.unitPrice) > 0 && <p className="mt-2 text-lg font-bold">Estimated primary-material cost: GHS {estimate.cost.toFixed(2)}</p>}<ul className="mt-3 list-disc pl-5 text-sm text-slate-600">{estimate.details.map(detail => <li key={detail}>{detail}</li>)}</ul><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><b>Planning estimate only.</b> Actual requirements vary with the approved design, material specifications, mix method, site conditions and workmanship. Confirm quantities with a qualified construction professional before purchasing or building.</p><div className="mt-5 flex flex-wrap gap-3"><a className="btn-primary" data-navigation="document" href={`/request-quote?materials=${encodeURIComponent(materialList)}&title=${encodeURIComponent(selected.name)}`}>Request supplier quotes</a><Link className="btn-secondary" href={`/shop?q=${encodeURIComponent(estimate.label)}`}>Find this material</Link></div></div>}
    </section>}
  </>;
}

function NumberField({ label, value, onChange, min = 0, max, step = "0.01" }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; step?: string }) {
  return <label><span className="label">{label}</span><input className="input" type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
