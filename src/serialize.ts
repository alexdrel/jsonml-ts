import { CDATA_TAG, COMMENT_TAG, textContent, xmlElement } from "./jsonml.ts";
import type { Attrs, XMLChild, XmlElement } from "./jsonml.ts";

// ─── DOM import ───────────────────────────────────────────────────────────────

interface XmlDomNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  readonly childNodes: { readonly length: number; item(index: number): XmlDomNode | null };
  readonly attributes?: {
    readonly length: number;
    item(index: number): { readonly name: string; readonly value: string } | null;
  };
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;

function textLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function domChildToJsonMl(node: XmlDomNode): XMLChild | undefined {
  if (node.nodeType === ELEMENT_NODE) return domToJsonMl(node);
  if (node.nodeType === COMMENT_NODE || node.nodeType === CDATA_SECTION_NODE) {
    const result = xmlElement(node.nodeType === COMMENT_NODE ? "$comment" : "$cdata", {});
    result.push(...textLines(node.nodeValue ?? ""));
    return result;
  }
  if (node.nodeType !== TEXT_NODE) return undefined;

  const text = node.nodeValue ?? "";
  if (text.trim()) return text;

  // Ignore structural indentation, but retain an authored blank separator.
  return (text.match(/\n/g)?.length ?? 0) > 1 ? "\n" : undefined;
}

/** Convert an XML DOM subtree to plain typed JsonML tuples.
 * The caller supplies a trusted root element type, including its children.
 * Import does not validate, decode, or widen its declared stored-value types.
 */
export function domToJsonMl<E extends XmlElement = XmlElement>(node: XmlDomNode): E {
  const attrs: Attrs = {};
  const attributes = node.nodeType === ELEMENT_NODE ? node.attributes : undefined;
  if (attributes) {
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes.item(i);
      if (attribute) attrs[attribute.name] = attribute.value;
    }
  }

  const children: XMLChild[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i);
    if (!child) continue;
    const converted = domChildToJsonMl(child);
    if (converted !== undefined) children.push(converted);
  }

  return xmlElement(node.nodeName, attrs, ...children) as E;
}

// ─── JsonML normalization ─────────────────────────────────────────────────────

/** Normalize external JsonML in place and return the same root tuple.
 * Supply missing attrs, preserving existing attribute objects.
 * This checks tuple structure, not XML names or vocabulary conformance.
 */
export function normalize(node: unknown[]): XmlElement {
  if (typeof node[0] !== "string") throw new TypeError("Expected a JsonML tag string");

  const second = node[1];
  if (typeof second === "string" || Array.isArray(second)) node.splice(1, 0, {});
  else if (second != null && typeof second !== "object") {
    throw new TypeError("Expected attributes, text, or a JsonML element at index 1");
  }

  node[1] ??= {};
  for (let index = 2; index < node.length; index++) {
    const child = node[index];
    if (Array.isArray(child)) normalize(child);
    else if (typeof child !== "string") {
      throw new TypeError(`Expected text or a JsonML element at index ${index}`);
    }
  }
  return node as XmlElement;
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Escape XML attribute data enclosed in double quotes.
 */
function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;") // must be first
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

/**
 * Escape XML character data. A plain `>` is valid; only the `]]>` sequence
 * must be broken because it would close a CDATA section.
 */
function escapeText(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/]]>/g, "]]&gt;");
}

function serializeAttrs(attrs: object | null | undefined): string {
  if (attrs == null) return "";
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join("");
}

/**
 * Serialize a JsonML element as a fragment (no XML declaration).
 */
export function serialize(node: XmlElement, indent = 0): string {
  const [t, a, ...ch] = node;
  const pad = "  ".repeat(indent);

  if (t === COMMENT_TAG) {
    const commentText = textContent(node).replace(/--/g, "- -").replace(/-$/, "- ");
    return `${pad}<!--${commentText}-->`;
  }

  if (t === CDATA_TAG) {
    const cdataText = textContent(node).replace(/]]>/g, "]]]]><![CDATA[>");
    return `${pad}<![CDATA[${cdataText}]]>`;
  }

  const open = `<${t}${serializeAttrs(a)}>`;

  if (ch.length === 0) {
    return `${pad}${open.replace(/>$/, "/>")}`;
  }
  // Inline single text child
  if (ch.length === 1 && typeof ch[0] === "string") {
    return `${pad}${open}${escapeText(ch[0])}</${t}>`;
  }

  // Mixed text and element content is whitespace-sensitive. Keep it inline so
  // pretty-print indentation does not alter phrases split by nested elements.
  if (ch.some((child) => typeof child === "string" && child.trim() !== "")) {
    const inlineBody = ch
      .map((child) => {
        if (typeof child === "string") return escapeText(child);
        return serialize(child as XmlElement, 0);
      })
      .join("");
    return `${pad}${open}${inlineBody}</${t}>`;
  }

  const body = ch
    .map((c) => {
      if (typeof c === "string") return c.trim() ? "  ".repeat(indent + 1) + escapeText(c) : "";
      return serialize(c as XmlElement, indent + 1);
    })
    .join("\n");

  return `${pad}${open}\n${body}\n${pad}</${t}>`;
}

/**
 * Serialize a JsonML element as a full XML document with declaration.
 */
export function serializeXml(node: XmlElement, declaration = true): string {
  const xml = serialize(node, 0);
  return declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' + xml : xml;
}

// ─── JSON formatting ──────────────────────────────────────────────────────────

export type StringifyOptions = {
  /** Omit empty attribute objects; normalize after parsing this output. */
  short?: boolean;
  /** Add spaces after commas and colons, keeping attribute objects inline. */
  spaces?: boolean;
};

/** Format JsonML as readable JSON. Short output omits empty attrs; normalize it after parsing. */
export function stringifyJsonMl(node: XmlElement, { short = false, spaces = false }: StringifyOptions = {}): string {
  return formatJsonMl(node, short, spaces, 0);
}

function stringifyAttrs(attrs: Attrs, spaces: boolean): string {
  const json = JSON.stringify(attrs, null, spaces ? 1 : undefined);
  return spaces ? json.replace(/\n */g, " ") : json;
}

function formatJsonMl(node: XmlElement, short: boolean, spaces: boolean, indent: number): string {
  const pad = "  ".repeat(indent);
  const [nodeTag, nodeAttrs, ...nodeChildren] = node;
  let head = `${pad}[${JSON.stringify(nodeTag)}`;
  const comma = spaces ? ", " : ",";
  const attributes = stringifyAttrs(nodeAttrs, spaces);
  if (!short || attributes !== "{}") head += comma + attributes;
  if (nodeChildren.length === 0) return `${head}]`;
  if (nodeChildren.length === 1 && typeof nodeChildren[0] === "string") {
    return `${head}${comma}${JSON.stringify(nodeChildren[0])}]`;
  }

  const bodyParts: string[] = [];
  const payload = nodeTag === COMMENT_TAG || nodeTag === CDATA_TAG;
  for (const child of nodeChildren) {
    // Attach structural separators, but keep comment/CDATA payload lines distinct.
    if (!payload && typeof child === "string" && child.trim() === "" && bodyParts.length > 0) {
      bodyParts[bodyParts.length - 1] += comma + JSON.stringify(child);
    } else if (typeof child === "string") {
      bodyParts.push(`${"  ".repeat(indent + 1)}${JSON.stringify(child)}`);
    } else {
      bodyParts.push(formatJsonMl(child, short, spaces, indent + 1));
    }
  }
  const body = bodyParts.join(",\n");
  return `${head},\n${body}\n${pad}]`;
}
