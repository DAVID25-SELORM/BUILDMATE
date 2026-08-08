import { describe, expect, it } from "vitest";
import { extractRows, matchCatalogue, parseCsv } from "./boq";

describe("BOQ extraction", () => {
  it("detects aliased headers and preserves source rows", () => expect(extractRows([["Project BOQ"], ["Item", "Qty", "UOM"], ["Cement 42.5", "120", "bags"]], "Sheet 1")).toEqual([{ sourceRow: 3, sourceSheet: "Sheet 1", description: "Cement 42.5", quantity: 120, unit: "bags" }]));
  it("parses quoted CSV values", () => expect(parseCsv('Description,Quantity,Unit\n"Blocks, 6 inch","1,200",pieces')).toMatchObject([{ description: "Blocks, 6 inch", quantity: 1200, unit: "pieces" }]));
  it("rejects files without required columns", () => expect(() => extractRows([["Name", "Price"]])).toThrow(/header row/i));
  it("skips invalid and blank rows", () => expect(extractRows([["Material", "Quantity", "Unit"], ["", "", ""], ["Paint", "-2", "buckets"], ["Tiles", "45", "m2"]])).toHaveLength(1));
  it("matches catalogue products without inventing low-confidence links", () => { const products=[{id:"cement",name:"Ghacem 42.5 Cement"},{id:"paint",name:"Interior Paint"}];expect(matchCatalogue("Ghacem cement 42.5",products)?.productId).toBe("cement");expect(matchCatalogue("Hardcore",products)).toBeNull(); });
});
