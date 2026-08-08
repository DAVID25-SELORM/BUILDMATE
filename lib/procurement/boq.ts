import ExcelJS from "exceljs";

export type ExtractedBoqItem = { sourceRow: number; sourceSheet: string; description: string; quantity: number; unit: string };
export type CatalogueProduct = { id: string; name: string };
const descriptionHeaders = ["description", "item", "material", "product", "work item", "particulars"];
const quantityHeaders = ["quantity", "qty", "estimated quantity", "amount"];
const unitHeaders = ["unit", "uom", "unit of measure"];
const normalise = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const cellText = (value: ExcelJS.CellValue | undefined) => typeof value === "object" && value && "text" in value ? String(value.text) : String(value ?? "").trim();

function findHeader(rows: string[][]) {
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const row = rows[index].map(normalise);
    const description = row.findIndex(value => descriptionHeaders.includes(value));
    const quantity = row.findIndex(value => quantityHeaders.includes(value));
    const unit = row.findIndex(value => unitHeaders.includes(value));
    if (description >= 0 && quantity >= 0 && unit >= 0) return { index, description, quantity, unit };
  }
  throw new Error("No supported header row found. Include Description/Item, Quantity/Qty and Unit/UOM columns.");
}

export function extractRows(rows: string[][], sheet = "CSV"): ExtractedBoqItem[] {
  const header = findHeader(rows);
  const result: ExtractedBoqItem[] = [];
  for (let index = header.index + 1; index < rows.length && result.length < 500; index++) {
    const description = String(rows[index]?.[header.description] ?? "").trim();
    const quantity = Number(String(rows[index]?.[header.quantity] ?? "").replaceAll(",", ""));
    const unit = String(rows[index]?.[header.unit] ?? "").trim();
    if (!description && !unit && !quantity) continue;
    if (description.length < 2 || !Number.isFinite(quantity) || quantity <= 0 || !unit) continue;
    result.push({ sourceRow: index + 1, sourceSheet: sheet, description: description.slice(0, 500), quantity, unit: unit.slice(0, 80) });
  }
  if (!result.length) throw new Error("No valid BOQ rows were found beneath the header.");
  return result;
}

export function parseCsv(text: string): ExtractedBoqItem[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field); if (row.some(Boolean)) rows.push(row);
  return extractRows(rows);
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ExtractedBoqItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const extracted: ExtractedBoqItem[] = [];
  for (const sheet of workbook.worksheets) {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, current => rows.push(current.values instanceof Array ? current.values.slice(1).map(cellText) : []));
    try { extracted.push(...extractRows(rows, sheet.name)); } catch { /* A workbook may contain title or notes sheets. */ }
    if (extracted.length >= 500) break;
  }
  if (!extracted.length) throw new Error("No worksheet contains Description/Item, Quantity/Qty and Unit/UOM columns.");
  return extracted.slice(0, 500);
}

export function matchCatalogue(description: string, products: CatalogueProduct[]) {
  const source = new Set(normalise(description).replace(/[^a-z0-9. ]/g, " ").split(/\s+/).filter(word => word.length > 1));
  let best: { productId: string; confidence: number } | null = null;
  for (const product of products) {
    const target = new Set(normalise(product.name).replace(/[^a-z0-9. ]/g, " ").split(/\s+/).filter(word => word.length > 1));
    const overlap = [...target].filter(word => source.has(word)).length;
    const confidence = target.size ? overlap / Math.max(source.size, target.size) : 0;
    if (!best || confidence > best.confidence) best = { productId: product.id, confidence };
  }
  return best && best.confidence >= 0.34 ? { ...best, confidence: Number(best.confidence.toFixed(3)) } : null;
}
