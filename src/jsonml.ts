// jsonml.ts
// Generic JsonML implementation for XML generation and testing.
// Convention: [tagName, attributes, ...children]
// Children can be nested XmlElement arrays or plain text strings.
// For the TypeScript SVG vocabulary and constructor, see ../types/svg.ts.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Stored lexical forms accepted without decoding XML during import. */
export type XmlNumber = number | `${number}`;
export type XmlBoolean = boolean | `${boolean}` | "0" | "1";
export type Attrs = Record<string, string | number | boolean | undefined>;
declare const domain: unique symbol;
/** Type-only membership, shared through a domain's common attribute type. */
export type PartOf<D> = { [domain]?: D };
/** Recover membership without requiring a marker on generic XML. */
export type DomainOf<E extends XmlElement> = typeof domain extends keyof E[1]
  ? Extract<NonNullable<E[1][typeof domain]>, XmlElement>
  : never;
export type XMLChild = XmlElement | string;
/** Broad tuple shape. Domain element types use ordinary, more specific tuples. */
export type XmlElement<A extends Attrs = Attrs> = [tag: string, attrs: A, ...children: XMLChild[]];
export type XmlComment = ["$comment", {}, ...string[]];
export type XmlCdata = ["$cdata", {}, ...string[]];
/** The actual child slots, preserving fixed or variadic tuple content. */
export type Children<E> = E extends [string, Attrs, ...infer C extends XMLChild[]] ? C : never;
export type Content<E> = Children<E>[number];
type OpenElementOf<E, T extends string> = E extends [infer Tag extends string, ...infer Tail]
  ? string extends Tag
    ? [T, ...Tail]
    : never
  : never;
/** Select declared tags, then open XML shapes; F supplies an optional fallback. */
export type ElementOf<E, T extends string, F = never> = T extends unknown
  ? [Extract<E, readonly [T, ...unknown[]]>] extends [never]
    ? [OpenElementOf<E, T>] extends [never]
      ? OpenElementOf<F, T>
      : OpenElementOf<E, T>
    : Extract<E, readonly [T, ...unknown[]]>
  : never;
export const TAG = 0;
export const ATTR = 1;
/** First child position; the preceding slots hold tag and attributes. */
export const CHILD = 2;
export const COMMENT_TAG = "$comment";
export const CDATA_TAG = "$cdata";

// ─── Construction ─────────────────────────────────────────────────────────────

/**
 * Create a JsonML element.
 * xmlElement("g", { id: "boxes" }, xmlElement("rect", { x: 0 }))
 */
export function xmlElement(tag: string, attrs: Attrs = {}, ...children: XMLChild[]): XmlElement {
  return [tag, attrs, ...children];
}

/** Create an XML comment node using the JsonML pseudo-tag convention. */
export function xmlComment(text: string): XmlComment {
  return [COMMENT_TAG, {}, text];
}

/** Create an XML CDATA section using the JsonML pseudo-tag convention. */
export function xmlCdata(text: string): XmlCdata {
  return [CDATA_TAG, {}, text];
}

/** Append one child and return it. */
export function appendChild<E extends XmlElement, C extends Content<NoInfer<E>>>(node: E, child: C): C {
  node.push(child);
  return child;
}

/** Append any number of elements or strings. */
export function append<E extends XmlElement>(node: E, ...children: Content<NoInfer<E>>[]): void {
  if (!children.length) return;
  node.push(...children);
}

/** Prepend any number of elements or strings, preserving their order. */
export function prepend<E extends XmlElement>(node: E, ...children: Content<NoInfer<E>>[]): void {
  if (!children.length) return;
  node.splice(CHILD, 0, ...children);
}

/** Replace all child nodes, preserving the tag, attributes, and tuple identity. */
export function replaceChildren<E extends XmlElement>(node: E, ...children: Children<NoInfer<E>>): void {
  if (!children.length) {
    if (node.length > CHILD) node.length = CHILD;
    return;
  }
  node.splice(CHILD, node.length - CHILD, ...children);
}

/** Remove all equal occurrences: tuple identity or exact string value. */
export function removeChildren<E extends XmlElement>(node: E, ...children: Content<NoInfer<E>>[]): number {
  const targets = new Set(children);
  let removed = 0;
  for (let index = node.length - 1; index >= CHILD; index--) {
    if (targets.has(node[index] as XMLChild)) {
      node.splice(index, 1);
      removed++;
    }
  }
  return removed;
}

/** Remove distinct tuple positions. Validate first; negative indices count from the end. */
export function removeAt(node: XmlElement, ...indices: number[]): number {
  const positions = new Set<number>();
  for (const index of indices) {
    const position = index < 0 ? node.length + index : index;
    if (!Number.isInteger(index) || position < CHILD || position >= node.length) {
      throw new RangeError(`XMLChild tuple index ${index} is out of range`);
    }
    positions.add(position);
  }
  for (const position of [...positions].sort((a, b) => b - a)) node.splice(position, 1);
  return positions.size;
}

/** Merge vocabulary-typed attributes into the existing object. */
export function addAttrs<E extends XmlElement>(node: E, extra: Partial<NoInfer<E[1]>>): void {
  Object.assign(node[ATTR], extra);
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export function tag<E extends XmlElement>(node: E): E[0] {
  return node[TAG];
}
export function attrs<E extends XmlElement>(node: E): E[1] {
  return node[ATTR];
}
/** Collect descendant text and CDATA, ignoring comments; a comment itself yields its payload. */
export function textContent(node: XmlElement): string {
  return node
    .slice(CHILD)
    .map((c) => {
      if (Array.isArray(c)) return c[TAG] === COMMENT_TAG ? "" : textContent(c as XmlElement);
      return typeof c === "string" ? c : "";
    })
    .join("");
}

// ─── Traversal ────────────────────────────────────────────────────────────────

type ElementOnly<N> = Exclude<Extract<N, XmlElement>, [typeof COMMENT_TAG | typeof CDATA_TAG, ...unknown[]]>;

// Membership is independent of child restrictions; fallback inspects one level only.
type AllowedTag<E extends XmlElement> = [DomainOf<E>] extends [never] ? string : DomainOf<E>[0];
type Elements<E extends XmlElement, R extends boolean> = [DomainOf<E>] extends [never]
  ? R extends true
    ? XmlElement
    : Extract<Content<E>, XmlElement>
  : DomainOf<E>;

/** Index is the actual tuple position, including tag and attributes slots. */
export type NodeEntry<N extends XMLChild = XMLChild> = readonly [node: N, parent: XmlElement, index: number];

/** Values and contextual entries share one single-use cursor. */
class Traversal<N extends XMLChild> extends Iterator<N, undefined, unknown> {
  #source: Generator<N, undefined, unknown>;
  #parent!: XmlElement;
  #index = CHILD;

  constructor(parent: XmlElement, recursive: boolean, elementsOnly: boolean, tag?: string) {
    super();
    this.#source = this.#visit(parent, recursive, elementsOnly, tag);
  }

  *#visit(
    parent: XmlElement,
    recursive: boolean,
    elementsOnly: boolean,
    tag?: string,
  ): Generator<N, undefined, unknown> {
    for (let index = CHILD; index < parent.length; index++) {
      const node = parent[index] as XMLChild;
      const element = Array.isArray(node);
      if (
        !elementsOnly ||
        (element && node[TAG] !== COMMENT_TAG && node[TAG] !== CDATA_TAG && (tag === undefined || node[TAG] === tag))
      ) {
        this.#parent = parent;
        this.#index = index;
        yield node as N;
      }
      if (recursive && element && node === parent[index]) yield* this.#visit(node, true, elementsOnly, tag);
    }
  }

  next(): IteratorResult<N, undefined> {
    return this.#source.next();
  }

  return(): IteratorResult<N, undefined> {
    return this.#source.return(undefined);
  }

  *entries(): Generator<NodeEntry<N>, undefined, unknown> {
    for (const node of this) yield [node, this.#parent, this.#index];
  }
}

/** Select child elements by tag. Pass true for depth-first descendants, excluding root.
 * Comment/CDATA pseudo-tuples are excluded; use nodes() to visit them.
 */
export function elements<E extends XmlElement, R extends boolean = false>(
  parent: E,
  recursive?: R,
): Traversal<ElementOnly<Elements<E, R>>>;
export function elements<E extends XmlElement, const T extends AllowedTag<NoInfer<E>> = AllowedTag<E>>(
  parent: E,
  tag: T,
  recursive?: boolean,
): Traversal<ElementOnly<ElementOf<Elements<E, false>, T, XmlElement>>>;
export function elements(
  parent: XmlElement,
  tagOrRecursive?: string | boolean,
  recursive = false,
): Traversal<XMLChild> {
  return new Traversal(
    parent,
    typeof tagOrRecursive === "boolean" ? tagOrRecursive : recursive,
    true,
    typeof tagOrRecursive === "string" ? tagOrRecursive : undefined,
  );
}

/** Iterate child content, including text. Pass true for depth-first descendants. */
export function nodes<E extends XmlElement, R extends boolean = false>(
  parent: E,
  recursive?: R,
): Traversal<Extract<R extends true ? XMLChild : Content<E>, XMLChild>> {
  return new Traversal(parent, recursive ?? false, false);
}

/** Collect matching locations before editing, then remove selected positions. */
export function removeEntries(entries: Iterable<NodeEntry>): number {
  const positions = new Map<XmlElement, number[]>();
  for (const [node, parent, index] of entries) {
    if (node !== parent[index]) {
      throw new Error(`Removal entry no longer matches tuple index ${index}`);
    }
    const indices = positions.get(parent);
    if (indices) indices.push(index);
    else positions.set(parent, [index]);
  }
  let removed = 0;
  for (const [parent, indices] of positions) removed += removeAt(parent, ...indices);
  return removed;
}
