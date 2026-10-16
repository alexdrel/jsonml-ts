import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import { addClass, getElementById, hasClass, indexElementsById, removeClass, toggleClass } from "../html.ts";
import { ATTR, xmlElement, type XmlElement } from "../jsonml.ts";

test("class checks read whole tokens without rewriting the attribute", () => {
  const node = xmlElement("g", { class: " tp\t tp-box\n tp " });
  strictEqual(hasClass(node, "tp-box"), true);
  strictEqual(hasClass(node, "box"), false);
  strictEqual(hasClass(node, "tp tp-box"), false);
  strictEqual(hasClass(node, ""), false);
  strictEqual(node[ATTR].class, " tp\t tp-box\n tp ");
  node[ATTR].class = "new";
  strictEqual(hasClass(node, "tp"), false);
  strictEqual(hasClass(node, "new"), true);
});

test("class additions and removals update the backing attribute", () => {
  const node = xmlElement("g", { class: " tp\t tp " });
  addClass(node, "active", "selected", "active");
  strictEqual(node[ATTR].class, "tp active selected");
  removeClass(node, "tp", "missing", "tp");
  strictEqual(node[ATTR].class, "active selected");
  removeClass(node, "active", "selected");
  strictEqual(Object.hasOwn(node[ATTR], "class"), false);
  addClass(node);
  removeClass(node, "missing");
  strictEqual(JSON.stringify(node), '["g",{}]');
});

test("class toggles return the resulting membership and support forced membership", () => {
  const node = xmlElement("g");
  strictEqual(toggleClass(node, "active"), true);
  strictEqual(node[ATTR].class, "active");
  strictEqual(toggleClass(node, "active"), false);
  strictEqual(Object.hasOwn(node[ATTR], "class"), false);
  strictEqual(toggleClass(node, "active", false), false);
  strictEqual(toggleClass(node, "active", true), true);
  strictEqual(toggleClass(node, "active", true), true);
  strictEqual(node[ATTR].class, "active");
  strictEqual(toggleClass(node, "active", false), false);
  strictEqual(Object.hasOwn(node[ATTR], "class"), false);
});

test("invalid class tokens fail before mutation", () => {
  const node = xmlElement("g", { class: "original" });
  throws(() => addClass(node, "valid", "two tokens"));
  throws(() => removeClass(node, "original", ""));
  throws(() => toggleClass(node, "a\tb"));
  strictEqual(node[ATTR].class, "original");
});

test("class helpers accept optional string class attributes and untyped elements", () => {
  type Group = ["g", { class?: string }];
  const group: Group = ["g", {}];
  strictEqual(hasClass(group, "active"), false);
  addClass(group, "active");
  strictEqual(group[ATTR].class, "active");
  strictEqual(toggleClass(group, "selected"), true);
  removeClass(group, "active");
  strictEqual(group[ATTR].class, "selected");

  const untyped: XmlElement = ["anything", {}];
  addClass(untyped, "allowed");
  strictEqual(hasClass(untyped, "allowed"), true);

  const empty: ["item", {}] = ["item", {}];
  strictEqual(hasClass(empty, "active"), false);
  addClass(empty, "active");
  strictEqual(hasClass(empty, "active"), true);

  const typing = () => {
    const item: ["item", { id?: string }] = ["item", {}];
    // @ts-expect-error The domain does not permit a class attribute.
    addClass(item, "active");
    // @ts-expect-error Removal requires the same declared attribute.
    removeClass(item, "active");
    // @ts-expect-error Toggle requires the same declared attribute.
    toggleClass(item, "active");
    const numeric: ["item", { class: number }] = ["item", { class: 1 }];
    // @ts-expect-error Edits must not write strings to a numeric attribute.
    addClass(numeric, "active");
    const union = null as unknown as Group | typeof item;
    // @ts-expect-error Every possible element must support class.
    addClass(union, "active");
  };
  void typing;
});

test("indexElementsById indexes descendants, with first duplicate ids winning", () => {
  const first = xmlElement("book", { id: "one" });
  const last = xmlElement("book", { id: "one" });
  const nested = xmlElement("section", { id: "section" }, last, xmlElement("book", { id: 123 }));
  const root = xmlElement("catalog", { id: "root" }, first, nested);
  const index = indexElementsById(root);
  deepStrictEqual([...index.keys()], ["one", "section"]);
  strictEqual(index.has("root"), false);
  strictEqual(index.get("one"), first);
  strictEqual(index.get("section"), nested);
  for (const [id, node] of index) strictEqual(getElementById(root, id), node);
  strictEqual(index.has("123"), false);
  deepStrictEqual([...indexElementsById(xmlElement("empty"))], []);
});

test("getElementById skips the root and returns the first descendant match", () => {
  const first = xmlElement("book", { id: "same" });
  const last = xmlElement("book", { id: "same" });
  const section = xmlElement("section", {}, first);
  const root = xmlElement("catalog", { id: "root" }, section, last, xmlElement("book", { id: 123 }));
  strictEqual(getElementById(root, "root"), undefined);
  strictEqual(getElementById(root, "same"), first);
  strictEqual(getElementById(root, "missing"), undefined);
  strictEqual(getElementById(root, "123"), undefined);
  strictEqual(getElementById(xmlElement("empty"), "missing"), undefined);
  const repeatedRoot = xmlElement("catalog", { id: "same" }, first);
  strictEqual(getElementById(repeatedRoot, "same"), first);
});
