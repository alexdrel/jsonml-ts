import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { type Svg, svgEl } from "../../types/svg.ts";
import { hasClass } from "../html.ts";
import * as j from "../jsonml.ts";
import { domToJsonMl, serializeXml } from "../serialize.ts";

test("JsonML attributes can be read, updated, added, and removed", () => {
  const circle = j.xmlElement("circle", { r: 10, fill: "blue" });
  const circleAttrs = circle[j.ATTR];
  deepStrictEqual(circleAttrs.r, 10);
  deepStrictEqual(circleAttrs.stroke, undefined);

  circleAttrs.r = 20;
  j.addAttrs(circle, { stroke: "black" });
  delete circleAttrs.fill;

  deepStrictEqual(circleAttrs, { r: 20, stroke: "black" });
  deepStrictEqual(circle[j.ATTR] === circleAttrs, true);
});

test("JsonML children can be read, inserted, replaced, and removed", () => {
  const circle = j.xmlElement("circle", { r: 10 });
  const svg = j.xmlElement("svg", { id: "diagram" }, circle);
  deepStrictEqual(j.elements(svg).next().value === circle, true);

  const title = j.xmlElement("title", {}, "Diagram");
  j.append(svg, "caption");
  j.prepend(svg, title);
  deepStrictEqual(svg.slice(j.CHILD), [title, circle, "caption"]);

  const replacement = j.xmlElement("circle", { r: 30 });
  const entry = j.elements(svg, "circle").entries().next().value!;
  entry[1][entry[2]] = replacement;
  deepStrictEqual(svg[entry[2]] === replacement, true);
  deepStrictEqual(j.removeAt(svg, j.CHILD, -1), 2);
  deepStrictEqual(svg.slice(j.CHILD), [replacement]);

  j.replaceChildren(svg);
  deepStrictEqual(svg.slice(j.CHILD), []);
  deepStrictEqual(svg[j.TAG], "svg");
  deepStrictEqual(svg[j.ATTR], { id: "diagram" });
});

test("JsonML construction and accessors", () => {
  deepStrictEqual(j.xmlElement("br"), ["br", {}]);
  deepStrictEqual(j.xmlElement("br", {}), ["br", {}]);
  deepStrictEqual(j.xmlElement("p", undefined, "text"), ["p", {}, "text"]);
  const catalog = j.xmlElement("catalog", { id: "books" }, j.xmlElement("book", { id: "one" }, "One"));
  deepStrictEqual(j.tag(catalog), "catalog");
  deepStrictEqual(j.attrs(catalog), { id: "books" });
  deepStrictEqual(j.tag(j.elements(catalog).next().value!), "book");
  deepStrictEqual(j.textContent(catalog), "One");
});

test("textContent excludes nested comments but retains CDATA and direct comment payloads", () => {
  const comment = j.xmlComment("editor note");
  const cdata = j.xmlCdata("literal <text>");
  const root = j.xmlElement(
    "p",
    {},
    "Hello ",
    comment,
    j.xmlElement("em", {}, "world", j.xmlComment("nested note")),
    " ",
    cdata,
  );
  strictEqual(j.textContent(root), "Hello world literal <text>");
  strictEqual(j.textContent(comment), "editor note");
  strictEqual(j.textContent(cdata), "literal <text>");
});

test("removeAt resolves positions before editing and validates before mutation", () => {
  const same = j.xmlElement("circle");
  const root = j.xmlElement("svg", { id: "diagram" }, same, "same", same, "same", "keep");
  deepStrictEqual(j.removeAt(root, 4, 2, 4, -3), 2);
  deepStrictEqual(root.slice(j.CHILD), ["same", "same", "keep"]);
  deepStrictEqual(j.removeAt(root, -1, j.CHILD), 2);
  deepStrictEqual(root.slice(j.CHILD), ["same"]);
  for (const index of [0, 1, 3, -2, 0.5, NaN, Infinity]) {
    throws(() => j.removeAt(root, j.CHILD, index), RangeError);
    deepStrictEqual(root.slice(j.CHILD), ["same"]);
  }
  deepStrictEqual(j.removeAt(root), 0);
  deepStrictEqual(root[j.TAG], "svg");
  deepStrictEqual(root[j.ATTR], { id: "diagram" });
});

test("removeChildren removes all equal occurrences, without touching the header", () => {
  const same = j.xmlElement("circle");
  const other = j.xmlElement("circle");
  const root = j.xmlElement("g", {}, same, "same", same, other, "same", "keep");
  deepStrictEqual(j.removeChildren(root, same, same, "same", "absent"), 4);
  deepStrictEqual(root.slice(j.CHILD), [other, "keep"]);
  deepStrictEqual(j.removeChildren(root, "g"), 0);
  deepStrictEqual(root[j.TAG], "g");
});

test("replaceChildren preserves the tuple header and replaces all content", () => {
  const old = svgEl("circle", { r: 1 });
  const replacement = svgEl("circle", { r: 2 });
  const group = svgEl("g", { id: "eyes" }, "before", old, "after");
  const original = group;
  const groupAttrs = group[j.ATTR];

  j.replaceChildren(group, replacement, "caption", replacement);
  strictEqual(group, original);
  strictEqual(group[j.TAG], "g");
  strictEqual(group[j.ATTR], groupAttrs);
  deepStrictEqual(group.slice(j.CHILD), [replacement, "caption", replacement]);
  strictEqual(group[j.CHILD], replacement);

  j.replaceChildren(group);
  deepStrictEqual([...group], ["g", groupAttrs]);
  j.replaceChildren(group, "new content");
  deepStrictEqual([...group], ["g", groupAttrs, "new content"]);
});

test("append and prepend preserve child order and the tuple header", () => {
  const circle = svgEl("circle", { r: 10 });
  const group = svgEl("g", { id: "face" }, "middle");
  const groupAttrs = group[j.ATTR];

  j.append(group, circle, "last");
  j.prepend(group, "first", circle);
  deepStrictEqual(group.slice(j.CHILD), ["first", circle, "middle", circle, "last"]);
  strictEqual(group[j.TAG], "g");
  strictEqual(group[j.ATTR], groupAttrs);
  j.append(group);
  j.prepend(group);
  strictEqual(group.length, 7);

  strictEqual(j.appendChild(group, circle), circle);
  strictEqual(group.at(-1), circle);
  const typing = () => {
    // @ts-expect-error appendChild accepts one child; append accepts many.
    appendChild(group, circle, "extra");
  };
  void typing;
});

test("plain imported tuples support typed queries and direct edits", () => {
  const document = new DOMParser().parseFromString(
    '<svg width="100"><g class="eyes"><rect width="12"/><circle r="4"/></g></svg>',
    "image/svg+xml",
  );
  const svg = domToJsonMl<Svg>(document.documentElement!);
  const group = j
    .elements(svg, "g")
    .filter((node) => hasClass(node, "eyes"))
    .next().value!;
  const frame = j.elements(group, "rect").next().value!;

  strictEqual(Object.getPrototypeOf(svg), Array.prototype);
  strictEqual(Object.getPrototypeOf(group), Array.prototype);
  strictEqual(Object.getPrototypeOf(frame), Array.prototype);
  strictEqual(frame[j.TAG], "rect");
  const stored: string | number | undefined = frame[j.ATTR].width;
  strictEqual(stored, "12");
  strictEqual(Number(frame[j.ATTR].width), 12);
  strictEqual(frame[j.ATTR].width, "12");
  frame[j.ATTR].width = 20;
  group.splice(2, 0, svgEl("rect", { width: 30, height: 10 }));
  deepStrictEqual(
    j
      .elements(group, "rect")
      .map((node) => Number(node[j.ATTR].width))
      .toArray(),
    [30, 20],
  );
  strictEqual(j.elements(svg, "circle").next().value, undefined);
  strictEqual(
    j.elements(svg, "circle", true).find((node) => Number(node[j.ATTR].r) === 4),
    group[4],
  );
});

test("selection entries expose tuple positions and share a single native cursor", () => {
  const first = svgEl("circle", { r: 1 });
  const second = svgEl("circle", { r: 2 });
  const group = svgEl("g", {}, "before", first, "between", second);
  const svg = svgEl("svg", {}, group);
  const selection = j.elements(svg, "circle", true);

  strictEqual(selection.next().value, first);
  deepStrictEqual(selection.entries().toArray(), [[second, group, 5]]);
  strictEqual(selection.next().done, true);

  const matches = j
    .elements(svg, "circle", true)
    .entries()
    .filter(([node]) => Number(node[j.ATTR].r) === 2);
  for (const [, parent, index] of matches) parent[index] = svgEl("rect", { width: 10, height: 10 });
  strictEqual(group[3], first);
  strictEqual((group[5] as typeof second)[0], "rect");

  const radii = j.elements(svg, "circle", true).map((node) => Number(node[j.ATTR].r));
  deepStrictEqual([...radii], [1]);
  deepStrictEqual([...radii], []);
});

test("tag-selected tuple attributes reject unknown names and wrong value types", () => {
  const document = new DOMParser().parseFromString('<svg><g><use width="10"/></g></svg>', "image/svg+xml");
  const svg = domToJsonMl<Svg>(document.documentElement!);
  const face = j.elements(svg, "g").next().value!;
  const nose = j.elements(face, "use").next().value!;
  const width: string | number | undefined = nose[j.ATTR].width;
  strictEqual(width, "10");
  nose[j.ATTR].width = 40;
  nose[j.ATTR]["data-part"] = "nose";
  strictEqual(nose[j.ATTR].width, 40);

  const typing = () => {
    // @ts-expect-error Misspelled attributes must not inherit the generic Attrs index signature.
    nose[j.ATTR].widht = 40;
    // @ts-expect-error Path data is not an attribute of use.
    nose[j.ATTR].d = "M0,0";
    // @ts-expect-error Width accepts strings or numbers, not booleans.
    nose[j.ATTR].width = true;
    // @ts-expect-error Constructed tuples must reject unknown names too.
    svgEl("use", {})[j.ATTR].widht = 40;
  };
  void typing;
});

test("native find returns the first match with tag narrowing", () => {
  const small = svgEl("circle", { r: 1 });
  const large = svgEl("circle", { r: 10 });
  const group = svgEl("g", {}, "caption", small, large);
  const svg = svgEl("svg", {}, group);

  strictEqual(
    j.elements(svg, "g").find(() => true),
    group,
  );
  strictEqual(
    j.elements(svg, "circle").find(() => true),
    undefined,
  );
  strictEqual(
    j.elements(group, "circle").find(() => true),
    small,
  );
  strictEqual(
    j.elements(group, "circle").find((node) => Number(node[j.ATTR].r) > 5),
    large,
  );
  strictEqual(
    j.elements(svg, "circle", true).find(() => true),
    small,
  );
  strictEqual(
    j.elements(svg, "circle", true).find((node) => Number(node[j.ATTR].r) > 5),
    large,
  );
  strictEqual(
    j.elements(svg, "svg", true).find(() => true),
    undefined,
  );
  strictEqual(
    j.elements(svg, "rect", true).find(() => true),
    undefined,
  );

  let visited = 0;
  j.elements(group, "circle").find(() => {
    visited++;
    return true;
  });
  strictEqual(visited, 1);
  const radius: j.XmlNumber | undefined = j.elements(group, "circle").find(() => true)?.[j.ATTR].r;
  strictEqual(radius, 1);
});

test("all-node traversal preserves context when filtering strings", () => {
  const circle = svgEl("circle", { r: 1 });
  const group = svgEl("g", {}, "nested", circle);
  const svg = svgEl("svg", {}, "before", group, "after");

  deepStrictEqual(j.nodes(svg).toArray(), ["before", group, "after"]);
  deepStrictEqual(j.nodes(svg, true).toArray(), ["before", group, "nested", circle, "after"]);
  const texts = j
    .nodes(svg, true)
    .entries()
    .filter(([node]) => typeof node === "string");
  deepStrictEqual(
    texts
      .map(([node, parent, index], counter) => {
        const text = node as string;
        return { text, parent, index, counter };
      })
      .toArray(),
    [
      { text: "before", parent: svg, index: 2, counter: 0 },
      { text: "nested", parent: group, index: 2, counter: 1 },
      { text: "after", parent: svg, index: 4, counter: 2 },
    ],
  );
});

test("text replacement changes mixed-content and CDATA text but preserves markup and comments", () => {
  const document = new DOMParser().parseFromString(
    '<notice project="Topos"><!--Topos note--><p>Topos <em>Topos</em> &amp; Topos</p>' +
      '<link href="/Topos">Topos docs</link><sample><![CDATA[Topos <literal>\nTopos again]]></sample>' +
      "<tags><tag>Topos</tag><tag>Topos</tag></tags></notice>",
    "application/xml",
  );
  const xml = domToJsonMl(document.documentElement!);
  const paragraph = j.elements(xml, "p").find(() => true)!;
  const emphasis = j.elements(paragraph, "em").find(() => true)!;
  const link = j.elements(xml, "link").find(() => true)!;
  const sample = j.elements(xml, "sample").find(() => true)!;
  const comment = j.nodes(xml).find((node) => Array.isArray(node) && node[j.TAG] === j.COMMENT_TAG) as j.XmlComment;
  const originalComment = j.textContent(comment);
  const originalAttrs = xml[j.ATTR];
  const tags = [...j.elements(xml, "tag", true)];
  const originalStructure = j
    .nodes(xml, true)
    .entries()
    .filter(([node]) => typeof node !== "string")
    .map(([node, parent, index]) => [node, parent, index])
    .toArray();

  const texts = j
    .nodes(xml, true)
    .entries()
    .filter(([node, parent]) => typeof node === "string" && parent[j.TAG] !== j.COMMENT_TAG);
  for (const [node, parent, index] of texts) {
    parent[index] = (node as string).replaceAll("Topos", "JsonML.ts");
  }

  strictEqual(j.textContent(paragraph), "JsonML.ts JsonML.ts & JsonML.ts");
  strictEqual(
    j.elements(paragraph, "em").find(() => true),
    emphasis,
  );
  strictEqual(j.textContent(link), "JsonML.ts docs");
  strictEqual(link[j.ATTR].href, "/Topos");
  strictEqual(j.textContent(sample), "JsonML.ts <literal>\nJsonML.ts again");
  strictEqual(j.textContent(comment), originalComment);
  strictEqual(xml[j.ATTR], originalAttrs);
  strictEqual(xml[j.ATTR].project, "Topos");
  deepStrictEqual(tags.map(j.textContent), ["JsonML.ts", "JsonML.ts"]);
  deepStrictEqual(
    j
      .nodes(xml, true)
      .entries()
      .filter(([node]) => typeof node !== "string")
      .toArray(),
    originalStructure,
  );
});

test("loaded JSON supports traversal and edits without prototype initialization", () => {
  const root = JSON.parse('["root",{},["item",{"id":"loaded"},"text"]]') as j.XmlElement;
  const item = j.elements(root, "item").find(() => true)!;
  strictEqual(item, root[j.CHILD]);
  item[j.ATTR].id = "edited";
  strictEqual(Object.getPrototypeOf(item), Array.prototype);
  strictEqual(JSON.stringify(root), '["root",{},["item",{"id":"edited"},"text"]]');
});

test("native query helpers are lazy, short-circuitable, and single-use", () => {
  const first = svgEl("circle", { r: 10 });
  const second = svgEl("circle", { r: 20 });
  const svg = svgEl("svg", {}, first, second);
  let checks = 0;
  let transforms = 0;
  const traversal = j.elements(svg, "circle", true);
  const selected = traversal.filter(() => {
    checks++;
    return true;
  });
  const radii = selected.map((node) => {
    transforms++;
    return Number(node[j.ATTR].r);
  });
  strictEqual(checks, 0);
  strictEqual(transforms, 0);
  for (const radius of radii) {
    strictEqual(radius, 10);
    break;
  }
  strictEqual(checks, 1);
  strictEqual(transforms, 1);
  deepStrictEqual([...radii], []);
  deepStrictEqual([...traversal.entries()], []);
  deepStrictEqual(
    j
      .elements(svg, "circle", true)
      .map((node) => Number(node[j.ATTR].r))
      .toArray(),
    [10, 20],
  );
});

test("native entry filters compose lazily before map", () => {
  const label = svgEl("text", {}, "Draft: Title", "keep", "Draft: Subtitle");
  const other = svgEl("g", {}, "Draft: Other");
  const svg = svgEl("svg", {}, label, other);
  let mapped = 0;
  const titles = j
    .nodes(svg, true)
    .entries()
    .filter(([node]) => typeof node === "string")
    .filter(([, parent]) => parent === label)
    .filter(([node]) => typeof node === "string" && node.startsWith("Draft: "))
    .map(([node, parent, index]) => {
      const text = node as string;
      strictEqual(parent, label);
      mapped++;
      return { title: text.slice("Draft: ".length), index };
    });
  strictEqual(mapped, 0);
  deepStrictEqual(
    [...titles],
    [
      { title: "Title", index: 2 },
      { title: "Subtitle", index: 4 },
    ],
  );
  strictEqual(mapped, 2);
  deepStrictEqual(label.slice(j.CHILD), ["Draft: Title", "keep", "Draft: Subtitle"]);
});

test("entry removal collects first and removes only selected repeated occurrences", () => {
  const circle = svgEl("circle", { r: 1 });
  const first = svgEl("g", { id: "first" }, "same", circle, "same", circle, "same");
  const second = svgEl("g", { id: "second" }, circle, "same", circle, "same");
  const svg = svgEl("svg", {}, first, second);
  let visited = 0;
  const selected = j
    .nodes(svg, true)
    .entries()
    .filter(([, parent, index]) => {
      strictEqual(first.length, 7);
      strictEqual(second.length, 6);
      visited++;
      return (parent === first && [3, 4, 6].includes(index)) || (parent === second && index === 2);
    });
  strictEqual(visited, 0);
  strictEqual(j.removeEntries(selected), 4);
  strictEqual(visited > 0, true);
  deepStrictEqual(first.slice(j.CHILD), ["same", circle]);
  deepStrictEqual(second.slice(j.CHILD), ["same", circle, "same"]);
  deepStrictEqual(svg.slice(j.CHILD), [first, second]);
  strictEqual(j.removeEntries(selected), 0);
});

test("entry removal deduplicates shared parent positions", () => {
  const circle = svgEl("circle", { r: 1 });
  const group = svgEl("g", {}, circle, "keep");
  const svg = svgEl("svg", {}, group, group);
  strictEqual(j.removeEntries(j.elements(svg, "circle", true).entries()), 1);
  deepStrictEqual(group.slice(j.CHILD), ["keep"]);
  deepStrictEqual(svg.slice(j.CHILD), [group, group]);
});

test("two traversal functions support direct and recursive values and triplets", () => {
  const circle = svgEl("circle", { r: 4 });
  const group = svgEl("g", {}, "nested", circle);
  const root = svgEl("svg", {}, "before", group, "after");
  deepStrictEqual(j.elements(root).toArray(), [group]);
  deepStrictEqual(j.elements(root, true).toArray(), [group, circle]);
  deepStrictEqual(j.elements(root, false).toArray(), [group]);
  deepStrictEqual(j.elements(root, "circle").toArray(), []);
  deepStrictEqual(j.elements(root, "circle", true).entries().toArray(), [[circle, group, 3]]);
  deepStrictEqual(j.nodes(root).entries().toArray(), [
    ["before", root, 2],
    [group, root, 3],
    ["after", root, 4],
  ]);
  const texts: string[] = j
    .nodes(root, true)
    .filter((node) => typeof node === "string")
    .toArray();
  deepStrictEqual(texts, ["before", "nested", "after"]);

  const firstTraversal = j.elements(root, true);
  const [first] = firstTraversal;
  strictEqual(first, group);
  strictEqual(firstTraversal.next().done, true);
  deepStrictEqual(firstTraversal.entries().toArray(), []);

  const entryTraversal = j.nodes(root, true);
  for (const [node, parent, index] of entryTraversal.entries()) {
    strictEqual(node, "before");
    strictEqual(parent, root);
    strictEqual(index, 2);
    break;
  }
  strictEqual(entryTraversal.next().done, true);
});

test("replacement skips the detached subtree and the replacement's content", () => {
  const oldCircle = svgEl("circle", { r: 1 });
  const oldGroup = svgEl("g", {}, oldCircle);
  const sibling = svgEl("circle", { r: 2 });
  const replacement = svgEl("g", {}, svgEl("rect", { width: 10, height: 10 }));
  const root = svgEl("svg", {}, oldGroup, sibling);
  const visited = [];
  for (const [node, parent, index] of j.elements(root, true).entries()) {
    visited.push(node);
    if (node === oldGroup) parent[index] = replacement;
  }
  deepStrictEqual(visited, [oldGroup, sibling]);
  strictEqual(root[j.CHILD], replacement);
});

test("stale removal entries throw before any collected locations are removed", () => {
  const circle = svgEl("circle", { r: 1 });
  const group = svgEl("g", {}, circle, "old");
  const saved = j.nodes(group).entries().toArray();
  group[3] = "new";
  // The circle entry is valid and collected before the stale text entry.
  throws(() => j.removeEntries(saved), /Removal entry no longer matches tuple index 3/);
  deepStrictEqual(group.slice(j.CHILD), [circle, "new"]);
  group[2] = svgEl("rect", { width: 10, height: 10 });
  throws(() => j.removeEntries([saved[0]]), /Removal entry no longer matches tuple index 2/);
});

test("entry removal checks identity as each entry is collected", () => {
  const circle = svgEl("circle", { r: 1 });
  const replacement = svgEl("rect", { width: 10, height: 10 });
  const group = svgEl("g", {}, circle);
  let resumed = false;
  function* entries(): Generator<readonly [typeof circle, typeof group, number]> {
    group[j.CHILD] = replacement;
    yield [circle, group, j.CHILD];
    resumed = true;
  }
  throws(() => j.removeEntries(entries()), /Removal entry no longer matches tuple index 2/);
  strictEqual(resumed, false);
  strictEqual(group[j.CHILD], replacement);
});

test("elements excludes comments and CDATA while nodes retains them and their text", () => {
  const comment = j.xmlComment("note");
  const cdata = j.xmlCdata("literal <text>");
  const nested: ["nested", {}, j.XmlComment] = ["nested", {}, j.xmlComment("inside")];
  const root: ["root", {}, j.XmlComment, j.XmlCdata, typeof nested] = ["root", {}, comment, cdata, nested];
  const direct: (typeof nested)[] = j.elements(root).toArray();
  deepStrictEqual(direct, [nested]);
  deepStrictEqual(j.elements(root, true).toArray(), [nested]);
  deepStrictEqual(j.elements(root, "$comment", true).toArray(), []);
  deepStrictEqual(j.elements(root, "$cdata", true).toArray(), []);
  deepStrictEqual(j.elements(root).entries().toArray(), [[nested, root, 4]]);
  deepStrictEqual(j.nodes(root).toArray(), [comment, cdata, nested]);
  deepStrictEqual(j.nodes(root, true).toArray(), [
    comment,
    "note",
    cdata,
    "literal <text>",
    nested,
    nested[2],
    "inside",
  ]);
  const typing = () => {
    const [node] = j.elements(root);
    // @ts-expect-error Pseudo-tuples are excluded from inferred element types.
    const special: j.XmlComment | j.XmlCdata = node;
    void special;
  };
  void typing;
});

type DomainAttrs = j.PartOf<Domain>;
type Rect = ["rect", DomainAttrs & { width: j.XmlNumber; visibility?: "visible" | "hidden" }];
type Span = ["span", DomainAttrs & { lang?: string }, ...string[]];
type Text = ["text", DomainAttrs & { id?: string }, ...(string | Span)[]];
type Group = ["g", DomainAttrs & { id?: string }, ...(Group | Rect | Text)[]];
type Root = ["root", DomainAttrs, ...(Group | Rect)[]];
type Domain = Root | Group | Rect | Text | Span;

test("tuple literals carry child types through direct and recursive traversal", () => {
  const root: Root = [
    "root",
    {},
    [
      "g",
      { id: "face" },
      ["rect", { width: "12" }],
      ["g", {}, ["text", {}, "hello ", ["span", { lang: "en" }, "world"]]],
    ],
  ];
  const [group] = j.elements(root, "g");
  const direct: Domain[] = j.elements(group).toArray();
  const recursive: Domain[] = j.elements(group, true).toArray();
  deepStrictEqual(
    direct.map((node) => node[j.TAG]),
    ["rect", "g"],
  );
  deepStrictEqual(
    recursive.map((node) => node[j.TAG]),
    ["rect", "g", "text", "span"],
  );

  const [span] = j.elements(root, "span", true);
  const typedSpan: Span = span;
  strictEqual(typedSpan[j.ATTR].lang, "en");
  const recursiveFlag = true as boolean;
  const maybeRecursive: Domain[] = j.elements(root, recursiveFlag).toArray();
  strictEqual(maybeRecursive.length, 5);
  const texts: string[] = j
    .nodes(root, true)
    .filter((node) => typeof node === "string")
    .toArray();
  deepStrictEqual(texts, ["hello ", "world"]);

  function selectUnion(tag: "rect" | "span"): (Rect | Span)[] {
    return j.elements(root, tag, true).toArray();
  }
  strictEqual(selectUnion("span")[0], span);
  const entries = j.elements(root, "span", true).entries().toArray();
  const entryNode: Span = entries[0][0];
  strictEqual(entryNode, span);
  strictEqual(entries[0][1][entries[0][2]], span);

  const typing = () => {
    j.elements(root, "span"); // Membership and direct-child restrictions are independent.
    // @ts-expect-error This closed domain cannot contain unknown tags.
    elements(root, "unknown", true);
    // @ts-expect-error A span does not have rect attributes.
    void span[j.ATTR].width;
    // @ts-expect-error A span is not an allowed root child.
    const wrong: Root = ["root", {}, ["span", {}, "wrong"]];
    void wrong;
  };
  void typing;
});

test("tuple unions narrow attributes by tag and insertion helpers check child types", () => {
  const rect: Rect = ["rect", { width: 12 }];
  const group: Group = ["g", {}];
  strictEqual(j.appendChild(group, rect), rect);
  j.append(group, ["text", {}, "label"]);
  j.prepend(group, ["g", { id: "first" }]);
  j.addAttrs(rect, { visibility: "hidden" });
  j.replaceChildren(group, rect);
  deepStrictEqual(group, ["g", {}, rect]);
  const domain: Domain[] = j.elements(group).toArray();
  for (const node of domain) {
    if (node[j.TAG] === "rect") {
      const width: j.XmlNumber = node[j.ATTR].width;
      strictEqual(width, 12);
    }
  }
  const selected: j.ElementOf<Domain, "rect" | "span"> = rect;
  strictEqual(selected, rect);

  const typing = () => {
    // @ts-expect-error A leaf has no permitted children.
    append(rect, ["span", {}]);
    // @ts-expect-error A leaf has no child slot at index 2.
    rect[2] = "text";
    // @ts-expect-error A group cannot contain a span directly.
    appendChild(group, ["span", {}]);
    // @ts-expect-error prepend uses the same child constraints.
    prepend(group, ["span", {}]);
    // @ts-expect-error Replacement cannot introduce an invalid child.
    replaceChildren(group, ["span", {}]);
    // @ts-expect-error Required attributes are preserved by a plain tuple definition.
    const missing: Rect = ["rect", {}];
    // @ts-expect-error Enum values are not widened to arbitrary strings.
    rect[j.ATTR].visibility = "oops";
    // @ts-expect-error XmlNumber rejects nonnumeric strings.
    rect[j.ATTR].width = "wide";
    // @ts-expect-error Attribute merging retains the enum constraint.
    addAttrs(rect, { visibility: "oops" });
    void missing;
  };
  void typing;
});

test("fixed and numeric text content is preserved by tuple-aware replacement", () => {
  type NumericText = ["amount", {}, `${number}`];
  const amount: NumericText = ["amount", {}, "12.5"];
  j.replaceChildren(amount, "20");
  strictEqual(serializeXml(amount, false), "<amount>20</amount>");
  const typing = () => {
    // @ts-expect-error Exactly one text slot is required.
    replaceChildren(amount);
    // @ts-expect-error This element requires numeric text.
    replaceChildren(amount, "twenty");
    // @ts-expect-error This element has only one text slot.
    replaceChildren(amount, "1", "2");
  };
  void typing;
});

test("mutually recursive tuple definitions terminate type inference", () => {
  type BranchAttrs = j.PartOf<Branch | Fork | Leaf>;
  type Branch = ["branch", BranchAttrs, ...(Leaf | Fork)[]];
  type Fork = ["fork", BranchAttrs, ...Branch[]];
  type Leaf = ["leaf", BranchAttrs & { count: j.XmlNumber }];
  const branch: Branch = ["branch", {}, ["fork", {}, ["branch", {}, ["leaf", { count: "3" }]]]];
  const leaves: Leaf[] = j.elements(branch, "leaf", true).toArray();
  deepStrictEqual(leaves, [["leaf", { count: "3" }]]);
  const reachable: (Branch | Fork | Leaf)[] = j.elements(branch, true).toArray();
  deepStrictEqual(
    reachable.map((node) => node[j.TAG]),
    ["fork", "branch", "leaf"],
  );
});

test("trusted XML uses the requested root tuple without widening enum or numeric types", () => {
  type Setting = ["setting", { enabled: j.XmlBoolean; size: j.XmlNumber; mode: "compact" | "full" }];
  const document = new DOMParser().parseFromString(
    '<setting enabled="1" size="12" mode="compact"/>',
    "application/xml",
  );
  const setting = domToJsonMl<Setting>(document.documentElement!);
  const size: j.XmlNumber = setting[j.ATTR].size;
  const mode: "compact" | "full" = setting[j.ATTR].mode;
  strictEqual(size, "12");
  strictEqual(mode, "compact");
  strictEqual(setting[j.ATTR].enabled, "1");
  setting[j.ATTR].enabled = false;
  setting[j.ATTR].size = 20;
  const typing = () => {
    // @ts-expect-error Import retains enum restrictions.
    setting[j.ATTR].mode = "oops";
    // @ts-expect-error Import does not make arbitrary text numeric.
    setting[j.ATTR].size = "oops";
    // @ts-expect-error Boolean lexical values are restricted too.
    setting[j.ATTR].enabled = "yes";
  };
  void typing;
});

test("importing an element union supports ordinary root-tag narrowing", () => {
  const document = new DOMParser().parseFromString('<rect width="12"/>', "application/xml");
  const root = domToJsonMl<Domain>(document.documentElement!);
  if (root[j.TAG] === "rect") {
    const width: j.XmlNumber = root[j.ATTR].width;
    strictEqual(width, "12");
    const typing = () => {
      // @ts-expect-error A narrowed rect does not acquire text attributes.
      void root[j.ATTR].id;
    };
    void typing;
  } else {
    throw new Error("Expected the fixture's rect root");
  }
});

test("vocabulary-less import retains unrestricted tags and attribute names", () => {
  const document = new DOMParser().parseFromString('<root><anything id="one"/></root>', "application/xml");
  const root = domToJsonMl(document.documentElement!);
  const [child] = j.elements(root);
  strictEqual(child[j.ATTR].id, "one");
  const [selected] = j.elements(root, "anything", true);
  selected[j.ATTR].other = 12;
  strictEqual(selected[j.ATTR].other, 12);
});

test("union tag selection retains unknown content alongside declared elements", () => {
  type OpenRoot = ["open", {}, ...(Rect | j.XmlElement)[]];
  const root: OpenRoot = ["open", {}, ["rect", { width: 12 }], ["other", { custom: "value" }]];
  function select(tag: "rect" | "other") {
    return j.elements(root, tag).toArray();
  }
  const [other] = select("other");
  if (other[j.TAG] === "other") {
    strictEqual(other[j.ATTR].custom, "value");
  } else {
    throw new Error("Expected the requested unknown tag");
  }
});

test("XmlElement uses primitive attribute aliases without widening their keys", () => {
  type ItemAttrs = { id: string; count?: j.XmlNumber };
  type Item = ["item", ItemAttrs];
  const item: Item = ["item", { id: "one" }];
  const generic: j.XmlElement = item;
  strictEqual(generic[j.ATTR].id, "one");
  type RootAttrs = { title: string };
  const root: j.XmlElement<RootAttrs> = ["root", { title: "Items" }, item];
  strictEqual(serializeXml(root, false), '<root title="Items">\n  <item id="one"/>\n</root>');
  const typing = () => {
    // @ts-expect-error Generic elements reject nonprimitive attribute types.
    type Invalid = j.XmlElement<{ payload: { nested: string } }>;
    // @ts-expect-error Primitive constraints apply to inline generic nodes too.
    serializeXml(["invalid", { payload: { nested: "value" } }]);
    // @ts-expect-error Nested elements must also have primitive attributes.
    const invalidChild: j.XmlElement = ["root", {}, ["invalid", { payload: {} }]];
    // @ts-expect-error Alias compatibility does not add a string index to ItemAttrs.
    item[j.ATTR].unknown = "value";
    void (null as unknown as Invalid);
    void invalidChild;
  };
  void typing;
});

test("PartOf supplies query types independently of child declarations", () => {
  type ShapeAttrs = j.PartOf<Shapes>;
  type LooseGroup = ["group", ShapeAttrs & { id?: string }, ...j.XMLChild[]];
  type Circle = ["circle", ShapeAttrs & { r: j.XmlNumber }];
  type Shapes = LooseGroup | Circle;
  const circle: Circle = ["circle", { r: "12" }];
  const group: LooseGroup = ["group", {}, ["group", {}, circle]];
  const [found] = j.elements(group, "circle", true);
  const precise: Circle = found;
  strictEqual(precise, circle);
  const entries = j.elements(group, "circle", true).entries().toArray();
  const entryNode: Circle = entries[0][0];
  strictEqual(entryNode, circle);
  strictEqual(entries[0][1][entries[0][2]], circle);
  const all: Shapes[] = j.elements(group, true).toArray();
  strictEqual(all.length, 2);
  // Plain literals need no runtime marker, including after trusted XML import.
  deepStrictEqual(Object.getOwnPropertySymbols(circle[j.ATTR]), []);
  strictEqual(serializeXml(circle, false), '<circle r="12"/>');
  const document = new DOMParser().parseFromString('<group><circle r="4"/></group>', "application/xml");
  const imported = domToJsonMl<LooseGroup>(document.documentElement!);
  const [importedCircle] = j.elements(imported, "circle");
  const importedRadius: j.XmlNumber = importedCircle[j.ATTR].r;
  strictEqual(importedRadius, "4");
  const typing = () => {
    const again: Circle[] = j.elements(found, "circle", true).toArray();
    // @ts-expect-error A known domain rejects undeclared tags.
    elements(group, "foreign", true);
    // @ts-expect-error Returned elements retain the domain.
    elements(found, "foreign");
    // @ts-expect-error Required primitive attributes remain required.
    const missing: Circle = ["circle", {}];
    // @ts-expect-error Attribute names remain closed.
    found[j.ATTR].width = 2;
    // @ts-expect-error Nonprimitive attribute values remain rejected.
    const invalid: Circle = ["circle", { r: {} }];
    void [again, missing, invalid];
  };
  void typing;
  // Explicit generic XML opts out of domain restrictions and domain result types.
  const open: j.XmlElement[] = j.elements<j.XmlElement>(group, "foreign", true).toArray();
  deepStrictEqual(open, []);
});

test("unassociated tuples infer immediate children without expanding descendant types", () => {
  type Leaf = ["leaf", { count: j.XmlNumber }];
  type Nested = ["nested", {}, ...Leaf[]];
  type Parent = ["parent", {}, ...Nested[]];
  const parent: Parent = ["parent", {}, ["nested", {}, ["leaf", { count: 3 }]]];
  const direct: Nested[] = j.elements(parent).toArray();
  strictEqual(direct.length, 1);
  const known: Nested[] = j.elements(parent, "nested", true).toArray();
  strictEqual(known[0], parent[2]);
  const deep: j.XmlElement[] = j.elements(parent, "leaf", true).toArray();
  strictEqual(deep[0][j.ATTR].count, 3);
  const recursive: j.XmlElement[] = j.elements(parent, true).toArray();
  strictEqual(recursive.length, 2);
  deepStrictEqual(j.elements(parent, "arbitrary", true).toArray(), []);
  const typing = () => {
    // @ts-expect-error No deep type expansion without domain membership.
    const notInferred: Leaf[] = j.elements(parent, "leaf", true).toArray();
    void notInferred;
  };
  void typing;
});

test("tag selection shares fallback rules without widening declared or open attributes", () => {
  type Known = ["known", { count: j.XmlNumber }];
  type Open = j.XmlElement<{ custom: string }>;
  const known: j.ElementOf<Known, "known", j.XmlElement> = ["known", { count: 3 }];
  const open: j.ElementOf<Known | Open, "other", j.XmlElement> = ["other", { custom: "kept" }];
  const custom: string = open[j.ATTR].custom;
  strictEqual(custom, "kept");
  strictEqual(known[j.ATTR].count, 3);
  const fallback: j.ElementOf<never, "other", j.XmlElement> = ["other", { arbitrary: true }];
  strictEqual(fallback[j.TAG], "other");
  function select(tag: "known" | "other") {
    const parent: ["parent", {}, ...Known[]] = ["parent", {}, known];
    return j.elements(parent, tag).toArray();
  }
  const selected: (Known | ["other", j.Attrs, ...j.XMLChild[]])[] = select("known");
  strictEqual(selected[0], known);
  const typing = () => {
    // @ts-expect-error The fallback does not widen declared attribute keys.
    void known[j.ATTR].custom;
    // @ts-expect-error An existing open shape takes precedence over fallback attrs.
    void open[j.ATTR].arbitrary;
    // @ts-expect-error No fallback is supplied by default.
    const absent: j.ElementOf<Known, "other"> = ["other", {}];
    void absent;
  };
  void typing;
});

test("XmlElement requires attrs and exposes them directly", () => {
  const node = j.xmlElement("br");
  node[j.ATTR].id = "break";
  deepStrictEqual(node, ["br", { id: "break" }]);
  const typing = () => {
    // @ts-expect-error External short forms must be normalized before use.
    const short: j.XmlElement = ["br"];
    // @ts-expect-error In-memory attrs must be an object.
    const missing: j.XmlElement = ["p", undefined, "text"];
    // @ts-expect-error JSON null must be normalized too.
    const nullable: j.XmlElement = ["br", null];
    void [short, missing, nullable];
  };
  void typing;
});
