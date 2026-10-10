import { read, utils } from "xlsx";
export type CatalogInput = { code: string; name: string; totalQty: number };
export function parseCatalog(buffer: ArrayBuffer): CatalogInput[] {
  const workbook = read(buffer, {
    type: "array",
    sheetRows: 1002,
    cellFormula: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook contains no worksheet.");
  const data = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  if (data.length > 1001) throw new Error("Import is limited to 1,000 tools.");
  const headers = data[0] || [];
  const column = (...labels: string[]) =>
    headers.findIndex((value) => labels.includes(String(value)));
  const code = column("Tool Code / ID", "ID"),
    name = column("Tool / Equipment Name", "Name"),
    quantity = column("Total Stock Quantity", "Quantity");
  if (Math.min(code, name, quantity) < 0)
    throw new Error("Use the exported catalog column headers.");
  return data.slice(1).map((row) => ({
    code: String(row[code] ?? "").trim(),
    name: String(row[name] ?? "").trim(),
    totalQty: row[quantity] === "" ? NaN : Number(row[quantity]),
  }));
}
