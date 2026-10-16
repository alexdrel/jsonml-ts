import { ok as assert, AssertionError, deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import { svgEl } from "../../types/svg.ts";
import { assertMatches, elementMatches } from "../assert.ts";
import { ATTR, elements, xmlCdata, xmlComment, xmlElement, type XmlNumber } from "../jsonml.ts";

test("class subset matching reads the class attribute once for all requested tokens", () => {
  let reads = 0;
  const node = xmlElement("g", {
    get class() {
      reads++;
      return "one\t two three";
    },
  });
  assert(elementMatches(node, { $class: "three one two" }));
  strictEqual(reads, 1);
});

test("attribute comparison accepts numeric XML text and keeps ordinary attributes exact", () => {
  const node = xmlElement("rect", { width: "72.0", class: "shape rounded", visible: false });
  assert(elementMatches(node, { width: 72, class: "shape rounded", visible: false }));
  assert(!elementMatches(node, { width: 70 }));
  assert(!elementMatches(node, { class: "shape" }));
  for (const width of ["", " ", "72px", undefined, true]) {
    assert(!elementMatches(xmlElement("rect", { width }), { width: 72 }));
  }
});

test("pseudo-attributes match class subsets, text, and direct element counts", () => {
  const node = xmlElement("text", { class: "label bold" }, "Hello ", xmlElement("tspan", {}, "world"));
  assert(elementMatches(node, { $class: "bold label", $text: "Hello world", $children: 1 }));
  assert(!elementMatches(node, { $class: "label missing" }));
  assert(!elementMatches(node, { $text: "Other" }));
  assert(!elementMatches(node, { $children: 2 }));
  const content = xmlElement("style", {}, xmlComment("comment"), xmlCdata("css"));
  assert(elementMatches(content, { $children: 0 }));
});

test("elementMatches short-circuits and can filter traversal results directly", () => {
  const node = xmlElement("rect", {
    width: 70,
    get later(): number {
      throw new Error("Should not read later");
    },
  });
  assert(!elementMatches(node, { width: 72, later: 1 }));
  const first = xmlElement("rect", { width: "72" });
  const other = xmlElement("rect", { width: 70 });
  const root = xmlElement("svg", {}, first, other);
  deepStrictEqual(
    elements(root, "rect")
      .filter((node) => elementMatches(node, { width: 72 }))
      .toArray(),
    [first],
  );
});

test("text and child-count expectations select candidates as well as assert them", () => {
  const plain = xmlElement("text", {}, "Topos");
  const nested = xmlElement("text", {}, xmlElement("tspan", {}, "Topos"));
  const other = xmlElement("text", {}, "Other");
  const root = xmlElement("svg", {}, plain, nested, other);
  const [label] = assertMatches(elements(root, "text"), { $text: "Topos", $children: 0 });
  strictEqual(label, plain);
  const [multiline] = assertMatches(elements(root, "text"), { $text: "Topos", $children: 1 });
  strictEqual(multiline, nested);
});

test("assertMatches reports a sole candidate's differences and cardinality failures", () => {
  const rect = xmlElement("rect", { width: "70" });
  throws(
    () => assertMatches([rect], { width: 72, $class: "shape" }),
    (error) => {
      if (!(error instanceof AssertionError)) return false;
      return (
        error.message.includes("Found one <rect>") &&
        error.message.includes('Expected: {"width":72,"$class":"shape"}') &&
        error.message.includes('Actual: {"width":"70"}')
      );
    },
  );
  throws(() => assertMatches([], { id: "missing" }), /No candidates for \{"id":"missing"\}/);
  deepStrictEqual(assertMatches([], {}, 0), []);
  throws(() => assertMatches([rect, rect]), /got 2 among 2 candidates/);
  deepStrictEqual(assertMatches([rect, rect], { width: 70 }, 2), [rect, rect]);
  deepStrictEqual(assertMatches([rect], { width: 72 }, 0), []);
});

test("assertMatches preserves traversal typing and accepts native filtered iterators", () => {
  const first = svgEl("circle", { r: 1 });
  const second = svgEl("circle", { r: 2 });
  const root = svgEl("svg", {}, first, second);
  const [circle] = assertMatches(
    elements(root, "circle").filter((node) => node !== first),
    { r: 2 },
  );
  const radius: XmlNumber = circle[ATTR].r;
  strictEqual(radius, 2);
  strictEqual(circle, second);
  const typing = () => {
    // @ts-expect-error Matching does not discard the traversal's tag narrowing.
    void circle[ATTR].width;
  };
  void typing;
});
