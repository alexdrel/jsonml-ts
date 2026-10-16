import { AssertionError, strictEqual } from "node:assert/strict";
import { ATTR, type Attrs, elements, TAG, textContent, type XmlElement } from "./jsonml.ts";

/** Open attribute expectations; $class is a token subset, $children counts direct elements. */
export type MatchPattern = Attrs & {
  $class?: string;
  $text?: string;
  $children?: number;
};

/** Test a pattern without allocating diagnostics; stop at the first mismatch. */
export function elementMatches(node: XmlElement, expected: MatchPattern): boolean {
  const { $class, $text, $children, ...attributes } = expected;
  for (const [name, value] of Object.entries(attributes)) {
    const actual = node[ATTR][name];
    // Numeric expectations also match numeric XML text; other values are exact.
    const matches =
      typeof value === "number" && typeof actual === "string" && actual.trim() !== ""
        ? Number(actual) === value
        : actual === value;
    if (!matches) return false;
  }
  if ($class !== undefined) {
    const actual = node[ATTR].class;
    const classes = new Set(typeof actual === "string" ? actual.split(/\s+/) : []);
    for (const token of $class.split(/\s+/).filter(Boolean)) {
      if (!classes.has(token)) return false;
    }
  }
  if ($text !== undefined && textContent(node) !== $text) return false;
  if ($children !== undefined && elements(node).reduce((count) => count + 1, 0) !== $children) return false;
  return true;
}

/** Select and assert exactly count matches from traversal results; default count is one. */
export function assertMatches<N extends XmlElement>(
  candidates: Iterable<N>,
  expected: MatchPattern = {},
  count = 1,
): N[] {
  const available = [...candidates];
  if (available.length === 0) {
    strictEqual(0, count, `No candidates for ${JSON.stringify(expected)}`);
    return available;
  }
  const matches = available.filter((node) => elementMatches(node, expected));
  if (matches.length !== count) {
    if (count === 1 && available.length === 1) {
      const node = available[0];
      const actual: Attrs = { ...node[ATTR] };
      if (expected.$text !== undefined) actual.$text = textContent(node);
      if (expected.$children !== undefined) actual.$children = elements(node).reduce((count) => count + 1, 0);
      throw new AssertionError({
        actual,
        expected,
        operator: "matches",
        message: `Found one <${node[TAG]}>, but it does not match.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
        stackStartFn: assertMatches,
      });
    }
    strictEqual(
      matches.length,
      count,
      `Expected ${count} matches for ${JSON.stringify(expected)}, got ${matches.length} among ${available.length} candidates.\n` +
        available.map((node) => `<${node[TAG]}> ${JSON.stringify(node[ATTR])}`).join("\n"),
    );
  }
  return matches;
}
