import { ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { assertMatches } from "../../src/assert.ts";
import { elements, textContent } from "../../src/jsonml.ts";
import { domToJsonMl } from "../../src/serialize.ts";
import type { Svg } from "../../types/svg.ts";

test("base logo supplies the definitions and facial structure used by the logo example", () => {
  const source = readFileSync(new URL("./logo-sq-base.svg", import.meta.url), "utf8");
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = domToJsonMl<Svg>(document.documentElement!);

  const [defs] = assertMatches(elements(svg, "defs"));
  const [style] = assertMatches(elements(defs, "style"), { id: "tp-base" });
  assert(textContent(style).includes("stroke-width: 1.8;"));
  const [marker] = assertMatches(elements(defs, "marker"), { id: "tpc-arr-dart" });
  assertMatches(elements(marker, "polygon"), { $class: "d-marker-parts" });
  assertMatches(elements(defs, "symbol"), { id: "tpc-hub-dot" });
  assertMatches(elements(defs, "symbol"), { id: "tpc-hub-diamond" });

  const [root] = assertMatches(elements(svg, "g"), { $class: "tp-root" });
  const [face] = assertMatches(elements(root, "g"), {
    id: "face",
    $class: "tp-box tp-pill",
    $children: 5,
  });
  assertMatches(elements(face, "rect"), { $class: "tpc-shape", width: 244.8, height: 192 });

  const eyes = assertMatches(elements(face, "g"), { $class: "tp-box" }, 2);
  for (const eye of eyes) {
    assertMatches(elements(eye, "rect"), { $class: "tpc-shape", width: 72, height: 72 });
    const [pupil] = assertMatches(elements(eye, "g"), { $class: "tp-hub", $children: 1 });
    assertMatches(elements(pupil, "use"), { href: "#tpc-hub-dot", width: 14.4, height: 14.4 });
  }

  const [nose] = assertMatches(elements(face, "g"), { $class: "tp-hub" });
  assertMatches(elements(nose, "use"), { href: "#tpc-hub-diamond" });

  const [smile] = assertMatches(elements(face, "g"), { $class: "tp-edge tp-double", $children: 1 });
  assertMatches(elements(smile, "path"), { $class: "tpc-shape", "marker-end": "url(#tpc-arr-dart)" });
});
