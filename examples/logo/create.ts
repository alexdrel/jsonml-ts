import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { hasClass } from "../../src/html.ts";
import { ATTR, elements, prepend, replaceChildren, textContent, xmlCdata } from "../../src/jsonml.ts";
import { domToJsonMl, serializeXml } from "../../src/serialize.ts";
import { type Svg, svgEl } from "../../types/svg.ts";

// Absolute design values; positions are derived from the base geometry.
const faceMargin = 16;
const faceRadius = 32;
const faceStroke = 10;
const shieldSize = 268.8;
const shieldRadius = 36;
const eyeSize = 28.8;
const eyeRadius = 20;
const eyeStroke = 8;
const noseSize = 40;
const noseShiftY = 5;
const smileStroke = 8;
const smileEndShiftY = 6;

// Refine the existing logo, retaining its elements and definitions.
const base = new DOMParser().parseFromString(
  readFileSync(new URL("./logo-sq-base.svg", import.meta.url), "utf8"),
  "image/svg+xml",
);
// Trust the input as an SVG tree; imported attribute values remain strings.
const svg = domToJsonMl<Svg>(base.documentElement!);
const svgAttrs = svg[ATTR];
const [defs] = elements(svg, "defs");
const [css] = elements(defs, "style", true);
// Topos's importer splits CDATA into newline-preserving strings for readable
// JSON diffs. Join those fragments for editing; below we replace them with
// a single CDATA node, retaining CDATA syntax inside the style element.
const stylesheet = textContent(css)
  .replace(
    "stroke-width: 1.8; }",
    `stroke-width: ${faceStroke}; }\n  #face > .tpc-shape { --tp-entity-fill: #f6eae3; }\n  #face > .tp-box > .tpc-shape { stroke-width: ${eyeStroke}; }`,
  )
  .replace("stroke-width: 1.8;\n      stroke-linecap", `stroke-width: ${smileStroke};\n      stroke-linecap`)
  .replace(
    "&.tp-double > .tpc-shape { stroke-width: 2.8; }",
    `&.tp-double > .tpc-shape {stroke-width: ${smileStroke};}`,
  )
  .replace(
    "  .d-pattern-parts {",
    "  #face > .tp-box .tp-hub { --tp-entity-stroke: #35623d; }\n\n  .d-pattern-parts {",
  );
replaceChildren(css, xmlCdata(stylesheet));
const [marker] = elements(defs, "marker");
const [[, arrowAttrs]] = elements(marker, "polygon");
arrowAttrs.points = "5.3,3.6 8.8,5 5.3,6.4";

const face = elements(svg, "g", true).find(([, attrs]) => attrs.id === "face")!;
const [[, frameAttrs]] = elements(face, "rect");
const round = (value: number) => Number(value.toFixed(1));
const centerX = Number(frameAttrs.x) + Number(frameAttrs.width) / 2;
const centerY = Number(frameAttrs.y) + Number(frameAttrs.height) / 2;

// Narrow the face without moving its center.
const faceWidth = Number(svgAttrs.width) - faceMargin * 2;
frameAttrs.x = round(centerX - faceWidth / 2);
frameAttrs.width = faceWidth;
frameAttrs.rx = frameAttrs.ry = faceRadius;

// Center the square shield on the face.
prepend(
  face,
  svgEl("rect", {
    x: round(centerX - shieldSize / 2),
    y: round(centerY - shieldSize / 2),
    width: shieldSize,
    height: shieldSize,
    rx: shieldRadius,
    ry: shieldRadius,
    fill: "#f3f1ea",
    stroke: "none",
  }),
);

// Round the existing eye frames and resize each pupil around its center.
for (const eye of elements(face, "g").filter((node) => hasClass(node, "tp-box"))) {
  const [[, frameAttrs]] = elements(eye, "rect");
  frameAttrs.rx = frameAttrs.ry = eyeRadius;
  const [[, pupilAttrs]] = elements(eye, "use", true);
  // Numeric access converts imported strings without changing the attribute.
  const originalSize = Number(pupilAttrs.width);
  const offset = (eyeSize - originalSize) / 2;
  pupilAttrs.x = round(Number(pupilAttrs.x) - offset);
  pupilAttrs.y = round(Number(pupilAttrs.y) - offset);
  pupilAttrs.width = pupilAttrs.height = eyeSize;
}

// Enlarge the existing diamond nose and shorten the smile's final segment.
for (const noseGroup of elements(face, "g").filter((node) => hasClass(node, "tp-hub"))) {
  const [[, noseAttrs]] = elements(noseGroup, "use");
  const offsetX = (noseSize - Number(noseAttrs.width)) / 2;
  const offsetY = (noseSize - Number(noseAttrs.height)) / 2;
  noseAttrs.x = round(Number(noseAttrs.x) - offsetX);
  noseAttrs.y = round(Number(noseAttrs.y) - offsetY + noseShiftY);
  noseAttrs.width = noseAttrs.height = noseSize;
}
const [[, smileAttrs]] = elements(face, "path", true);
smileAttrs.d = smileAttrs.d!.replace(
  /(L [\d.]+,)([\d.]+)$/,
  (_, prefix: string, y: string) => prefix + round(Number(y) + smileEndShiftY),
);

svgAttrs.height = svgAttrs.width;
svgAttrs.viewBox = svgAttrs
  .viewBox!.split(" ")
  .map((value) => round(Number(value)))
  .join(" ");
svgAttrs.style = (svgAttrs.style ?? "").replace(/;\s*background:[^;]*/g, "");

const output = new URL("./output/logo-sq.svg", import.meta.url);
mkdirSync(new URL("./output/", import.meta.url), { recursive: true });
writeFileSync(output, serializeXml(svg) + "\n");
console.log(`Wrote ${output.pathname}`);
