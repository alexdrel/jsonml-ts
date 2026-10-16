import { deepStrictEqual as assertEquals, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import type { Svg } from "../../types/svg.ts";
import { ATTR, elements, textContent, xmlElement } from "../jsonml.ts";
import * as j from "../jsonml.ts";
import { domToJsonMl, normalize, serialize, serializeXml, stringifyJsonMl } from "../serialize.ts";

test("SVG import types string attributes without decoding numeric values", () => {
  const svg = domToJsonMl<Svg>(
    parseElement(
      '<svg viewBox="0 0 100 100" style="fill: red"><path d="M 0,0 L 10,10"/><circle r="20" stroke-linecap="round"/></svg>',
    ),
  );
  const path = elements(svg, "path").find(() => true)!;
  const circle = elements(svg, "circle").find(() => true)!;

  const viewBox: string | undefined = svg[ATTR].viewBox;
  const style: string | undefined = svg[ATTR].style;
  const data: string | undefined = path[ATTR].d;
  const radius: string | number | undefined = circle[ATTR].r;
  const linecap: "butt" | "round" | "square" | undefined = circle[ATTR]["stroke-linecap"];
  assertEquals(viewBox, "0 0 100 100");
  assertEquals(style, "fill: red");
  assertEquals(data, "M 0,0 L 10,10");
  assertEquals(radius, "20");
  assertEquals(linecap, "round");
  assertEquals(Number(circle[ATTR].r), 20);
  assertEquals(circle[ATTR].r, "20");

  path[ATTR].d = path[ATTR].d?.replace("10,10", "20,20");
  circle[ATTR].r = 30;
  assertEquals(path[ATTR].d, "M 0,0 L 20,20");
  assertEquals(circle[ATTR].r, 30);
  const typing = () => {
    // @ts-expect-error Trusted import retains the declared enum.
    circle[ATTR]["stroke-linecap"] = "custom";
    // @ts-expect-error A path's string-only data cannot be numeric.
    path[ATTR].d = 42;
    // @ts-expect-error Circle attributes do not include path data.
    void circle[ATTR].d;
    // @ts-expect-error Imported radii remain strings or numbers, not decoded numbers.
    const numericRadius: number | undefined = radius;
    void numericRadius;
  };
  void typing;
});

function parseElement(xml: string) {
  const root = new DOMParser().parseFromString(xml, "application/xml").documentElement!;
  return root;
}

test("domToJsonMl converts only the supplied subtree", () => {
  assertEquals(domToJsonMl(parseElement("<br/>")), ["br", {}]);
  assertEquals(domToJsonMl(parseElement("<p>hello</p>")), ["p", {}, "hello"]);
  const document = new DOMParser().parseFromString(
    '<root><before/><defs id="library"><item>text</item></defs><after/></root>',
    "application/xml",
  );
  const defs = document.getElementsByTagName("defs").item(0);
  if (!defs) throw new Error("Missing test defs");

  assertEquals(domToJsonMl(defs), ["defs", { id: "library" }, ["item", {}, "text"]]);
});

test("domToJsonMl preserves comment and CDATA payloads", () => {
  const commentText = "\n  first line\n  second line\n";
  const cdataText = "\n  a > b {\n    color: red;\n  }\n";
  const source = `<root><!--${commentText}--><![CDATA[${cdataText}]]></root>`;
  const jsonml = domToJsonMl(parseElement(source));

  assertEquals(textContent(jsonml[2] as typeof jsonml), commentText);
  assertEquals(textContent(jsonml[3] as typeof jsonml), cdataText);

  const reparsed = parseElement(serialize(jsonml));
  const payloads = Array.from({ length: reparsed.childNodes.length }, (_, i) => reparsed.childNodes.item(i))
    .filter((node) => node?.nodeType === 8 || node?.nodeType === 4)
    .map((node) => node?.nodeValue);
  assertEquals(payloads, [commentText, cdataText]);
});

test("domToJsonMl ignores indentation and retains blank separators", () => {
  const jsonml = domToJsonMl(parseElement("<root>\n  <one/>\n\n  <two/>\n</root>"));
  assertEquals(jsonml, ["root", {}, ["one", {}], "\n", ["two", {}]]);
});

test("SVG roundtripping reaches stable formatting and preserves content, comments, and CDATA", () => {
  const comment = "\n  Keep this comment and its spacing.\n";
  const stylesheet = "\n  text { fill: red; }\n  /* a > b & c */\n";
  const source = `<svg xmlns="http://www.w3.org/2000/svg" data-label='A &amp; B'>
<!--${comment}-->
<style><![CDATA[${stylesheet}]]></style>
<text>Hello <tspan>world</tspan> &amp; friends</text>
<text><tspan>left</tspan> <tspan>right</tspan></text>
<g><rect width='10' height='20'></rect></g>
</svg>`;
  const roundtrip = (xml: string) => serialize(domToJsonMl(parseElement(xml)));

  // The first pass may normalize formatting; later passes must leave it alone.
  const normalized = roundtrip(source);
  assertEquals(roundtrip(normalized), normalized);
  assertEquals(roundtrip(roundtrip(normalized)), normalized);

  // Stability alone could hide content loss. Check the reparsed content too.
  const svg = parseElement(normalized);
  assertEquals(svg.getAttribute("data-label"), "A & B");
  const comments = Array.from({ length: svg.childNodes.length }, (_, i) => svg.childNodes.item(i)).filter(
    (node) => node?.nodeType === 8,
  );
  assertEquals(
    comments.map((node) => node?.nodeValue),
    [comment],
  );
  const style = svg.getElementsByTagName("style").item(0)!;
  const cdata = Array.from({ length: style.childNodes.length }, (_, i) => style.childNodes.item(i)).filter(
    (node) => node?.nodeType === 4,
  );
  assertEquals(
    cdata.map((node) => node?.nodeValue),
    [stylesheet],
  );
  const rect = svg.getElementsByTagName("rect").item(0)!;
  assertEquals([rect.getAttribute("width"), rect.getAttribute("height")], ["10", "20"]);
  const texts = svg.getElementsByTagName("text");
  // Default SVG whitespace handling permits formatting to normalize spacing.
  // xml:space="preserve" is outside the scope of this test.
  const collapsedText = (text: string | null) => text!.replace(/[\t\n\r ]+/g, " ").trim();
  assertEquals(collapsedText(texts.item(0)!.textContent), "Hello world & friends");
  assertEquals(collapsedText(texts.item(1)!.textContent), "left right");
});

for (const filename of ["logo/logo-sq-base.svg", "logo/output/logo-sq.svg"]) {
  test(`${filename} roundtrips to a fixed point without changing imported content`, () => {
    const source = readFileSync(new URL(`../../examples/${filename}`, import.meta.url), "utf8");
    const original = domToJsonMl(parseElement(source));
    const json = stringifyJsonMl(original);
    const loaded = JSON.parse(json) as typeof original;
    assertEquals(loaded, original);
    assertEquals(stringifyJsonMl(loaded), json);
    const normalized = serialize(loaded);
    const reparsed = domToJsonMl(parseElement(normalized));
    // Includes all attributes and text, plus comment/CDATA tags and payloads.
    assertEquals(reparsed, original);
    assertEquals(serialize(reparsed), normalized);
    assertEquals(serialize(domToJsonMl(parseElement(serialize(reparsed)))), normalized);
  });
}

test("serialize: empty and text elements", () => {
  assertEquals(serialize(j.xmlElement("item", { id: 1 })), '<item id="1"/>');
  assertEquals(serialize(j.xmlElement("item", {}, "One")), "<item>One</item>");
});

test("serialize: boolean attributes retain true and false, omitting only undefined", () => {
  assertEquals(
    serialize(j.xmlElement("item", { enabled: true, hidden: false, missing: undefined })),
    '<item enabled="true" hidden="false"/>',
  );
});

test("serialize: nested elements are indented", () => {
  const list = j.xmlElement("list", {}, j.xmlElement("item", {}, "One"), j.xmlElement("item", {}, "Two"));
  assertEquals(serialize(list), "<list>\n  <item>One</item>\n  <item>Two</item>\n</list>");
});

test("serialize: whitespace children create visual separation", () => {
  const list = j.xmlElement("list", {}, j.xmlElement("item", {}, "One"), "\n", j.xmlElement("item", {}, "Two"));
  assertEquals(serialize(list), "<list>\n  <item>One</item>\n\n  <item>Two</item>\n</list>");
});

test("serialize: mixed character and element content stays inline", () => {
  const paragraph = j.xmlElement("p", {}, "Hello ", j.xmlElement("em", {}, "world"), ".");
  assertEquals(serialize(paragraph), "<p>Hello <em>world</em>.</p>");
});

test("serialize: comments", () => {
  assertEquals(serialize(j.xmlComment(" section ")), "<!-- section -->");
});

test("serialize: comments may be split into diff-friendly lines", () => {
  const comment = j.xmlElement("$comment", {}, "first line\n", "second line");
  assertEquals(serialize(comment), "<!--first line\nsecond line-->");
});

test("serialize: CDATA", () => {
  const style = j.xmlElement("style", {}, j.xmlCdata("a > b { color: red; }"));
  assertEquals(serialize(style), "<style>\n  <![CDATA[a > b { color: red; }]]>\n</style>");
});

test("serialize: CDATA may be split into diff-friendly lines", () => {
  const style = j.xmlElement("style", {}, ["$cdata", {}, "a {\n", "  color: red;\n", "}"]);
  assertEquals(serialize(style), "<style>\n  <![CDATA[a {\n  color: red;\n}]]>\n</style>");
});

test("serialize: comment and CDATA payloads round-trip exactly", () => {
  const commentText = "\n  first line\n  second line\n";
  const cdataText = "\n  a > b {\n    color: red;\n  }\n";
  const xml = serialize(j.xmlElement("root", {}, j.xmlComment(commentText), j.xmlCdata(cdataText)));
  const root = new DOMParser().parseFromString(xml, "application/xml").documentElement!;
  const payloads = Array.from({ length: root.childNodes.length }, (_, i) => root.childNodes.item(i))
    .filter((node) => node?.nodeType === 8 || node?.nodeType === 4)
    .map((node) => node?.nodeValue);

  assertEquals(payloads, [commentText, cdataText]);
});

test("serialize escapes only XML attribute delimiters", () => {
  assertEquals(
    serialize(j.xmlElement("item", { label: `a & b < "c" > d` })),
    '<item label="a &amp; b &lt; &quot;c&quot; > d"/>',
  );
});

test("serialize preserves attribute tabs, newlines, and carriage returns through XML parsing", () => {
  const label = "one\ttwo\nthree\rfour & &#10;";
  const node = xmlElement("item", { label });
  const xml = serialize(node);
  assertEquals(xml, '<item label="one&#9;two&#10;three&#13;four &amp; &amp;#10;"/>');
  const restored = domToJsonMl(parseElement(xml));
  assertEquals(restored[ATTR].label, label);
  assertEquals(serialize(restored), xml);
});

test("serialize escapes character data without rewriting plain greater-than signs", () => {
  assertEquals(serialize(j.xmlElement("item", {}, "a & b < c > d")), "<item>a &amp; b &lt; c > d</item>");
  assertEquals(serialize(j.xmlElement("item", {}, "a ]]> b")), "<item>a ]]&gt; b</item>");
});

test("serializeXml optionally adds the XML declaration", () => {
  const root = j.xmlElement("root");
  assertEquals(serializeXml(root), '<?xml version="1.0" encoding="UTF-8"?>\n<root/>');
  assertEquals(serializeXml(root, false), "<root/>");
});

test("stringifyJsonMl formats nested elements", () => {
  const jsonml = xmlElement("root", { id: "one" }, xmlElement("child", {}, "text"));
  assertEquals(stringifyJsonMl(jsonml), '["root",{"id":"one"},\n  ["child",{},"text"]\n]');
});

test("stringifyJsonMl keeps whitespace on the preceding line", () => {
  const jsonml = xmlElement("root", {}, xmlElement("one"), "\n", xmlElement("two"));
  assertEquals(stringifyJsonMl(jsonml), '["root",{},\n  ["one",{}],"\\n",\n  ["two",{}]\n]');
});

test("stringifyJsonMl keeps multiline payloads diff-friendly", () => {
  const jsonml = xmlElement("style", {}, xmlElement("$cdata", {}, "first\n", "second"));
  assertEquals(stringifyJsonMl(jsonml), '["style",{},\n  ["$cdata",{},\n    "first\\n",\n    "second"\n  ]\n]');
});

for (const tag of ["$cdata", "$comment"]) {
  test(`stringifyJsonMl gives blank ${tag} fragments their own lines`, () => {
    const node = xmlElement(tag, {}, "first\n", "\n", "  \n", "last\n");
    const json = stringifyJsonMl(node);
    assertEquals(json, `["${tag}",{},\n  "first\\n",\n  "\\n",\n  "  \\n",\n  "last\\n"\n]`);
    assertEquals(JSON.parse(json), node);
  });
}

test("normalize restores omitted attrs in place and preserves tuple identity", () => {
  const source = ["p", "Hello ", ["strong", "world"], ["br", {}], ["hr"], ["span", null, "!"]];
  const strong = source[2];
  const br = source[3];
  const normalized = normalize(source);
  assertEquals(normalized, ["p", {}, "Hello ", ["strong", {}, "world"], ["br", {}], ["hr", {}], ["span", {}, "!"]]);
  strictEqual(normalized, source);
  strictEqual(normalized[3], strong);
  strictEqual(normalized[4], br);
  strictEqual(normalize(normalized), normalized);
  assertEquals(serialize(normalized), "<p>Hello <strong>world</strong><br/><hr/><span>!</span></p>");
});

test("default JSON preserves attrs while explicit short JSON normalizes back", () => {
  const original = domToJsonMl(parseElement('<root><br/><p>Hello <strong>world</strong></p><item id="one"/></root>'));
  const json = stringifyJsonMl(original);
  assertEquals(JSON.parse(json), original);
  assertEquals(stringifyJsonMl(normalize(JSON.parse(json))), json);

  const short = stringifyJsonMl(original, { short: true });
  const loaded = JSON.parse(short);
  assertEquals(loaded, ["root", ["br"], ["p", "Hello ", ["strong", "world"]], ["item", { id: "one" }]]);
  const normalized = normalize(loaded);
  strictEqual(normalized, loaded);
  assertEquals(normalized, original);
  assertEquals(serialize(normalized), serialize(original));
  assertEquals(domToJsonMl(parseElement(serialize(normalized))), original);
  assertEquals(JSON.parse(json), original);
});

test("normalize retains existing empty attribute objects", () => {
  const attrs = {};
  const source = ["br", attrs];
  const result = normalize(source);
  strictEqual(result, source);
  strictEqual(result[1], attrs);
  assertEquals(normalize(["br"]), ["br", {}]);
  assertEquals(normalize(["br", undefined]), ["br", {}]);
  assertEquals(normalize(["br", null]), ["br", {}]);
});

test("spaced JSON keeps attribute objects inline and applies spacing throughout the tree", () => {
  const node = xmlElement(
    "svg",
    { width: 100, height: 40 },
    xmlElement("text", { x: 50, y: 25 }, "Hello!"),
    "\n",
    xmlElement("g"),
  );
  const json = stringifyJsonMl(node, { spaces: true });
  assertEquals(
    json,
    '["svg", { "width": 100, "height": 40 },\n  ["text", { "x": 50, "y": 25 }, "Hello!"], "\\n",\n  ["g", {}]\n]',
  );
  assertEquals(JSON.parse(json), node);
  const short = stringifyJsonMl(node, { spaces: true, short: true });
  assertEquals(normalize(JSON.parse(short)), node);
});

test("JSON spacing preserves punctuation and escapes inside attribute names and text", () => {
  const node = xmlElement(
    "text",
    { 'label:,"': 'comma, colon: quote" slash\\ newline\n', missing: undefined },
    'Text, with: punctuation " and \\',
  );
  assertEquals(JSON.parse(stringifyJsonMl(node, { spaces: true })), JSON.parse(JSON.stringify(node)));
});
