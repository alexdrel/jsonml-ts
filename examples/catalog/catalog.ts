import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { ATTR, elements, type PartOf, type XmlNumber } from "../../src/jsonml.ts";
import { domToJsonMl, serializeXml } from "../../src/serialize.ts";

// A vocabulary is a union of ordinary tuples. Shared attributes carry membership;
// each tuple independently describes its required attributes and allowed children.
type CatalogAttrs = PartOf<CatalogElements>;
type Item = ["item", CatalogAttrs & { id: string; price: XmlNumber; stock: XmlNumber }];
type Note = ["note", CatalogAttrs & { lang?: string }, ...string[]];
type Catalog = ["catalog", CatalogAttrs & { title: string }, ...(Item | Note)[]];
type CatalogElements = Catalog | Item | Note;

// The tag narrows item attributes. XmlNumber supports both constructed numbers
// and imported numeric strings; arithmetic interprets the stored representation.
function restock(catalog: Catalog, id: string, quantity: number): void {
  const item = elements(catalog, "item").find(([, attrs]) => attrs.id === id);
  if (!item) throw new Error(`Unknown catalog item: ${id}`);
  const attrs = item[ATTR];
  attrs.stock = Number(attrs.stock) + quantity;
}

const created: Catalog = [
  "catalog",
  { title: "Tea shop" },
  ["item", { id: "green-tea", price: 12, stock: 8 }],
  ["item", { id: "black-tea", price: 10, stock: 5 }],
  ["note", { lang: "en" }, "Prices are per tin."],
];

// Import trusts this root type; it does not validate or decode XML attributes.
const source = readFileSync(new URL("./catalog.xml", import.meta.url), "utf8");
const document = new DOMParser().parseFromString(source, "application/xml");
const imported = domToJsonMl<Catalog>(document.documentElement!);

// The same typed operation works on either tree, with no origin-specific API.
restock(created, "green-tea", 4);
restock(imported, "green-tea", 4);

console.log("Created and restocked:");
console.log(serializeXml(created));
console.log("Imported and restocked:");
console.log(serializeXml(imported));
