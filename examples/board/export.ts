import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { hasClass } from "../../src/html.ts";
import { CHILD, elements, nodes, removeAt, removeEntries, TAG } from "../../src/jsonml.ts";
import { domToJsonMl, serializeXml } from "../../src/serialize.ts";
import { type Svg, svgEl } from "../../types/svg.ts";

// Prepare an editor board in place, without remote avatars or selection overlays.
function prepareForExport(svg: Svg): void {
  // Replace remote avatars lazily. Slots do not shift, and the original images
  // have no children for traversal to visit after each replacement.
  for (const [[, imageAttrs], parent, index] of elements(svg, "image", true).entries()) {
    if (!imageAttrs.href?.startsWith("https://")) continue;
    const x = Number(imageAttrs.x);
    const y = Number(imageAttrs.y);
    const width = Number(imageAttrs.width);
    const height = Number(imageAttrs.height);
    const initials = imageAttrs["data-initials"];
    parent[index] = svgEl(
      "g",
      { class: "avatar-placeholder" },
      svgEl("rect", { x, y, width, height, rx: 8, fill: "#dbeafe" }),
      svgEl(
        "text",
        {
          x: x + width / 2,
          y: y + height / 2,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": 14,
          fill: "#1e40af",
        },
        typeof initials === "string" ? initials : "?",
      ),
    );
  }

  // Replacing a text slot does not shift siblings or change descendant traversal.
  for (const [node, parent, index] of nodes(svg, true).entries()) {
    if (typeof node === "string" && parent[TAG] === "text" && node.startsWith("Draft: ")) {
      parent[index] = node.slice("Draft: ".length);
    }
  }

  // The filtered entry selection collects first, then removes the selected positions.
  removeEntries(
    elements(svg, "g", true)
      .entries()
      .filter(([node]) => hasClass(node, "editor-only")),
  );

  // Prune empty groups from the bottom up. Removing the selection layer leaves
  // its editor-overlays parent empty too, so descendants must be handled first.
  const groups = [...elements(svg, "g", true).entries()];
  for (const [node, parent, index] of groups.reverse()) {
    if (node.length === CHILD) removeAt(parent, index);
  }
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: node examples/board/export.ts <input.svg>");
  process.exit(1);
}
const [input] = args;
const document = new DOMParser().parseFromString(readFileSync(input, "utf8"), "image/svg+xml");
const svg = domToJsonMl<Svg>(document.documentElement!);
prepareForExport(svg);
console.log(serializeXml(svg));
