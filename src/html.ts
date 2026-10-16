import { ATTR, elements, type XmlElement } from "./jsonml.ts";

// ─── Classes ──────────────────────────────────────────────────────────────────

type ClassAttrs = { class?: string };

function readClasses(node: XmlElement<ClassAttrs>): Set<string> {
  const value = node[ATTR].class;
  return new Set(typeof value === "string" ? value.split(/\s+/).filter(Boolean) : []);
}

function writeClasses(node: XmlElement<ClassAttrs>, names: Set<string>): void {
  if (names.size) node[ATTR].class = [...names].join(" ");
  else delete node[ATTR].class;
}

function checkNames(names: string[]): void {
  for (const name of names) {
    if (!name || /\s/.test(name)) throw new Error(`Expected a single class token: ${JSON.stringify(name)}`);
  }
}

/** Test the SVG/HTML whitespace-separated class convention without changing storage. */
export function hasClass(node: XmlElement<ClassAttrs>, name: string): boolean {
  return readClasses(node).has(name);
}

/** Add individual class tokens, preserving their order and avoiding duplicates. */
export function addClass(node: XmlElement<ClassAttrs>, ...names: string[]): void {
  checkNames(names);
  const classes = readClasses(node);
  const size = classes.size;
  for (const name of names) classes.add(name);
  if (classes.size !== size) writeClasses(node, classes);
}

/** Remove individual class tokens; delete the attribute when none remain. */
export function removeClass(node: XmlElement<ClassAttrs>, ...names: string[]): void {
  checkNames(names);
  const classes = readClasses(node);
  const size = classes.size;
  for (const name of names) classes.delete(name);
  if (classes.size !== size) writeClasses(node, classes);
}

/** Invert membership, or force it explicitly. Return the resulting membership. */
export function toggleClass(node: XmlElement<ClassAttrs>, name: string, force?: boolean): boolean {
  checkNames([name]);
  const classes = readClasses(node);
  const present = classes.has(name);
  const include = force ?? !present;
  if (include !== present) {
    if (include) classes.add(name);
    else classes.delete(name);
    writeClasses(node, classes);
  }
  return include;
}

// ─── IDs ──────────────────────────────────────────────────────────────────────

/** Find the first descendant element with this id in depth-first order. */
export function getElementById(root: XmlElement, id: string): XmlElement | undefined {
  return elements(root, true).find((node) => node[ATTR].id === id);
}

/** Index descendant elements by string id; first duplicates win. */
export function indexElementsById(root: XmlElement): Map<string, XmlElement> {
  const index = new Map<string, XmlElement>();
  for (const node of elements(root, true)) {
    const id = node[ATTR].id;
    if (typeof id === "string" && !index.has(id)) index.set(id, node);
  }
  return index;
}
