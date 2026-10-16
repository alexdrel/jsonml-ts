import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { COMMENT_TAG, nodes, TAG, type XmlElement } from "../../src/jsonml.ts";
import { domToJsonMl, serializeXml } from "../../src/serialize.ts";

// Replace text, including CDATA, without changing XML names,
// attributes, or editorial comments. No vocabulary is needed.
function replaceText(root: XmlElement, search: string, replacement: string): void {
  for (const [node, parent, index] of nodes(root, true).entries()) {
    if (typeof node !== "string" || parent[TAG] === COMMENT_TAG) continue;
    // Replacing a string slot leaves traversal positions intact.
    parent[index] = node.replaceAll(search, replacement);
  }
}

const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error("Usage: node examples/text/replace.ts <input.xml> <search> <replacement>");
  process.exit(1);
}
const [input, search, replacement] = args;
const document = new DOMParser().parseFromString(readFileSync(input, "utf8"), "application/xml");
const xml = domToJsonMl(document.documentElement!);
replaceText(xml, search, replacement);
console.log(serializeXml(xml));
