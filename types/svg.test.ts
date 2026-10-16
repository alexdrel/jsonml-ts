import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { test } from "node:test";
import { addAttrs, append, ATTR, attrs, elements, nodes, tag, TAG, textContent } from "../src/jsonml.ts";
import type { XmlNumber } from "../src/jsonml.ts";
import { serializeXml } from "../src/serialize.ts";
import { type Circle, type G, type Rect, type Svg, svgEl, svgRoot, type Tspan } from "./svg.ts";

test("tag-selected native mapping preserves narrowed attributes and context", () => {
  const small = svgEl("circle", { r: 10 });
  const nested = svgEl("circle", { r: 20 });
  const large = svgEl("circle", { r: 30 });
  const svg = svgEl("svg", {}, small, svgEl("g", {}, nested), "caption", large);

  const direct: number[] = elements(svg, "circle")
    .map((circle) => Number(circle[ATTR].r))
    .toArray();
  const all: number[] = elements(svg, "circle", true)
    .map((circle) => Number(circle[ATTR].r))
    .toArray();
  const entries = elements(svg, "circle", true)
    .entries()
    .filter(([circle]) => Number(circle[ATTR].r) >= 20)
    .toArray();
  assertEquals(
    entries.map((entry) => Number(entry[0][ATTR].r)),
    [20, 30],
  );
  assertEquals(direct, [10, 30]);
  assertEquals(all, [10, 20, 30]);
  assertEquals(
    elements(svg, "circle", true)
      .entries()
      .map(([node, parent, index]) => ({
        radius: Number(node[ATTR].r),
        parent: parent[TAG],
        index,
      }))
      .toArray(),
    [
      { radius: 10, parent: "svg", index: 2 },
      { radius: 20, parent: "g", index: 2 },
      { radius: 30, parent: "svg", index: 5 },
    ],
  );
  assertEquals(
    nodes(svg)
      .map((node) => (typeof node === "string" ? node : node[TAG]))
      .toArray(),
    ["circle", "g", "caption", "circle"],
  );
  assertEquals(
    elements(svg, "rect", true)
      .map((rect) => rect[ATTR].width)
      .toArray(),
    [],
  );

  const typing = () => {
    // @ts-expect-error Entry nodes retain circle attributes, not path attributes.
    void entries[0][0][ATTR].d;
    elements(svg, "circle").map((circle) => {
      // @ts-expect-error Native transforms receive narrowed circle attributes.
      void circle[ATTR].d;
      return circle[ATTR].r;
    });
  };
  void typing;
});

test("tag searches narrow SVG attributes and preserve scope and order", () => {
  const small = svgEl("circle", { r: 10 });
  const nested = svgEl("circle", { r: 20 });
  const large = svgEl("circle", { r: 30 });
  const svg = svgEl("svg", {}, small, svgEl("g", {}, nested), "text", large);

  assertEquals(
    elements(svg, "circle").find(() => true),
    small,
  );
  assertEquals(
    elements(svg, "circle").find((circle) => circle[ATTR].r === 30),
    large,
  );
  assertEquals(elements(svg, "circle").toArray(), [small, large]);
  assertEquals(elements(svg, "circle", true).toArray(), [small, nested, large]);
  assertEquals(
    elements(svg, "circle", true)
      .filter((circle) => Number(circle[ATTR].r) >= 20)
      .toArray(),
    [nested, large],
  );
  assertEquals(
    elements(svg, "circle", true).find((circle) => circle[ATTR].r === 20),
    nested,
  );
  assertEquals(
    elements(svg, "rect", true).find(() => true),
    undefined,
  );
  const found = elements(svg, "circle", true).find(() => true);
  const radius: XmlNumber | undefined = found?.[ATTR].r;
  const name: "circle" | undefined = found?.[TAG];
  assertEquals(radius, 10);
  assertEquals(name, "circle");

  const typing = () => {
    // @ts-expect-error Unknown SVG tags cannot select a vocabulary element.
    elements(svg, "not-an-svg-tag").find(() => true);
    elements(svg, "circle").find((circle) => {
      // @ts-expect-error Predicates retain circle attributes, not rect attributes.
      void circle[ATTR].width;
      return true;
    });
  };
  void typing;
});

test("svgEl supports progressive construction with ordinary tuple edits", () => {
  const svg = svgEl("svg");
  svg[ATTR].id = "diagram";
  const circle = svgEl("circle", { r: 10 });
  assertEquals(circle[ATTR].cx, undefined);
  circle[ATTR].cx = 5;
  append(svg, circle, "caption");
  circle[ATTR].r = 20;
  assertEquals(
    elements(svg, "circle").find(() => true),
    circle,
  );
  assertEquals(serializeXml(svg, false), '<svg id="diagram"><circle r="20" cx="5"/>caption</svg>');
});

test("svgEl provides typed SVG construction", () => {
  const group = svgEl(
    "g",
    { id: "shapes" },
    svgEl("rect", { x: 10, y: 20, width: 80, height: 40, rx: 4 }),
    svgEl("circle", { cx: 50, cy: 50, r: 20 }),
  );
  assertEquals(tag(group), "g");
  assertEquals(elements(group).toArray().length, 2);
  assertEquals(attrs(elements(group, "rect").find(() => true)!).width, 80);
  const typing = () => {
    // @ts-expect-error A circle constructor must reject path attributes.
    svgEl("circle", { d: "M0,0" });
    // @ts-expect-error A circle's radius cannot be a boolean.
    svgEl("circle", { r: true });
  };
  void typing;
});

test("svgEl supports text and marker attributes", () => {
  const text = svgEl("text", { x: 50, y: 25, "text-anchor": "middle" }, "Hello");
  const line = svgEl("line", { x1: 0, y1: 0, x2: 100, y2: 0, "marker-end": "url(#arrow)" });
  assertEquals(textContent(text), "Hello");
  assertEquals(attrs(line)["marker-end"], "url(#arrow)");
});

test("svgRoot supplies the SVG namespace", () => {
  const root = svgRoot(200, 100);
  assertEquals(attrs(root).xmlns, "http://www.w3.org/2000/svg");
  assertEquals(serializeXml(root).includes('xmlns="http://www.w3.org/2000/svg"'), true);
});

test("attribute helpers preserve vocabulary types and the stored object", () => {
  const circle = svgEl("circle", { r: 10 });
  const circleAttrs = attrs(circle);
  addAttrs(circle, { r: 20, fill: "blue" });
  assertEquals(circle[ATTR] === circleAttrs, true);
  assertEquals(circleAttrs.r, 20);
  const typing = () => {
    // @ts-expect-error Typed attribute access rejects unknown names.
    void circleAttrs.widht;
    // @ts-expect-error Typed merges reject unknown names.
    addAttrs(circle, { d: "M0,0" });
    // @ts-expect-error Typed merges reject invalid values.
    addAttrs(circle, { r: true });
  };
  void typing;
});

test("SVG tuple aliases support construction without a factory and reject invalid children", () => {
  const svg: Svg = [
    "svg",
    { width: "100", height: 100 },
    ["g", { id: "shapes" }, ["rect", { width: 10, height: 20 }]],
    ["text", {}, "Hello ", ["tspan", {}, "world"]],
  ];
  const groups: G[] = elements(svg, "g").toArray();
  const rects: Rect[] = elements(svg, "rect", true).toArray();
  const spans: Tspan[] = elements(svg, "tspan", true).toArray();
  assertEquals(groups.length, 1);
  assertEquals(rects[0][ATTR].width, 10);
  assertEquals(spans[0][2], "world");
  const typing = () => {
    // @ts-expect-error Shape children cannot be other shapes.
    svgEl("rect", { width: 10, height: 10 }, svgEl("circle", { r: 1 }));
    // @ts-expect-error Gradient children cannot be arbitrary groups.
    svgEl("linearGradient", {}, svgEl("g"));
    // Domain membership permits querying a tag regardless of child constraints.
    elements(svg, "tspan");
    // @ts-expect-error SVG container insertion checks child kinds.
    append(svg, svgEl("tspan"));
    // @ts-expect-error Numeric lexical types reject arbitrary text.
    svgEl("circle", { r: "large" });
    // @ts-expect-error Literal enum restrictions survive the tuple migration.
    svgEl("circle", { r: 1, visibility: "oops" });
    // @ts-expect-error Annotated tuples still enforce required attribute declarations.
    const incomplete: Rect = ["rect", {}];
    void incomplete;
    const circle: Circle = ["circle", { r: "20" }];
    // @ts-expect-error A plain tuple's attributes have the same numeric restriction.
    circle[ATTR].r = "large";
  };
  void typing;
});

test("SVG construction allows attributes to be filled incrementally", () => {
  const circle = svgEl("circle");
  assertEquals(circle, ["circle", {}]);
  circle[ATTR].r = 10;
  const rect = svgEl("rect", { width: 20 });
  rect[ATTR].height = 30;
  assertEquals(circle[ATTR].r, 10);
  assertEquals(rect[ATTR].height, 30);
});
