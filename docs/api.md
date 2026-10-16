# API

The [model](model.md) explains the representation and design choices. [Types](types.md) shows how to define a
vocabulary.

## Construction and attributes

Core functions and types are exported from `@alexdrel/jsonml-ts`.

```ts
import {
  ATTR, append, elements, nodes, removeEntries, replaceChildren, xmlElement,
} from "@alexdrel/jsonml-ts";

const tree = xmlElement("article", { id: "intro" },
  ["h1", { class: "title" }, "Draft title"],
  xmlElement("p", {}, "Hello, world!"),
);

const articleAttrs = tree[ATTR];
articleAttrs.lang = "en";
append(tree, ["p", { class: "draft" }, "Notes"]);
```

`xmlElement(tag, attrs = {}, ...children)` returns a plain `XmlElement` tuple. `TAG = 0`, `ATTR = 1`, and `CHILD = 2`
identify its tag, attributes, and first child. `tag(node)` and `attrs(node)` provide equivalent typed access.
`addAttrs(node, extra)` merges fields into the existing attribute object.

`xmlComment(text)` and `xmlCdata(text)` construct comment and CDATA tuples. `textContent(node)` joins descendant text
and CDATA, excluding nested comments. When called on a comment itself, it returns that comment's payload.

## Traversal

| Call                          | Visits                        |
| ----------------------------- | ----------------------------- |
| `elements(parent)`            | Direct child elements         |
| `elements(parent, "p")`       | Direct children with that tag |
| `elements(parent, true)`      | All descendant elements       |
| `elements(parent, "p", true)` | Descendants with that tag     |
| `nodes(parent)`               | All direct child content      |
| `nodes(parent, true)`         | All descendant content        |

Traversal is depth-first, excludes the root, and returns original nodes. `elements` excludes comment and CDATA tuples;
`nodes` includes them and, during recursion, their text fragments.

Results are lazy, single-use iterators. Native `find`, `filter`, `map`, `take`, and `toArray` work normally. Call the
traversal function again for a fresh iterator. Destructuring the first result or breaking a loop closes that iterator.

```ts
const [heading] = elements(tree, "h1");
replaceChildren(heading, "Getting started");
const draft = elements(tree, "p").find(([, attrs]) => attrs.class === "draft");
const ids = elements(tree, true).map(([, attrs]) => attrs.id).toArray();
```

The `[, attrs]` callback pattern destructures the node itself, skipping its tag. It differs from contextual entries:

```ts
for (const [node, parent, index] of nodes(tree, true).entries()) {
  if (typeof node === "string") parent[index] = node.replaceAll("world", "reader");
}
```

`.entries()` yields readonly `[node, parent, index]` triplets. The exported `NodeEntry<N>` names this type. Its index is
the actual tuple position, including the header slots. Values and entries share one consuming cursor; call `.entries()`
before native helpers, whose results do not have that method.

### Editing during traversal

Attribute editing works directly during traversal:

```ts
for (const paragraph of elements(tree, "p", true)) {
  paragraph[ATTR].lang = "en";
}
```

Replacing text or a node at its existing index also leaves sibling positions unchanged. When replacing an element during
recursive traversal, neither its old subtree nor the replacement's subtree is visited.

Inserting or removing child slots shifts indices. Collect before those edits; for removals, process positions in
descending order per parent.

For removal, `removeEntries` collects the selection before editing:

```ts
removeEntries(elements(tree, "p").entries()
  .filter(([node]) => node[ATTR].class === "draft"));
```

It removes selected occurrences, including when the same node appears repeatedly. Duplicate parent/index pairs are
removed once. Collection checks that each node still occupies its recorded slot; a mismatch throws before removal
begins. Positions are then removed in descending order per parent. The return value is the number of removed slots.
Stored indices can become stale after other edits.

## Child mutation

These operations edit the existing tuple and retain its attribute object:

| Function                               | Behavior                                              |
| -------------------------------------- | ----------------------------------------------------- |
| `appendChild(parent, child)`           | Append one child and return it                        |
| `append(parent, ...children)`          | Append children                                       |
| `prepend(parent, ...children)`         | Insert children before existing content               |
| `replaceChildren(parent, ...children)` | Replace all content; no replacements clears it        |
| `removeChildren(parent, ...children)`  | Remove **all** matching occurrences; return the count |
| `removeAt(parent, ...indices)`         | Remove actual tuple positions; return the count       |

`removeChildren` compares tuples by identity and strings by exact value. Selecting one string value therefore removes
every equal text slot in that parent. Use `removeAt` or `removeEntries` for particular occurrences.

`removeAt` accepts negative indices relative to the original tuple length. It validates all indices before editing,
rejects header positions, and deduplicates repeated positions. Ordinary array edits remain available, such as
`parent[index] = replacement` and `parent.splice(index, 1)`.

## XML and JSON

Serialization functions are exported from `@alexdrel/jsonml-ts/serialize`.

| Function                                 | Behavior                                             |
| ---------------------------------------- | ---------------------------------------------------- |
| `domToJsonMl<E>(domElement)`             | Import a DOM subtree; default result is `XmlElement` |
| `serialize(node, indent = 0)`            | Write an XML fragment                                |
| `serializeXml(node, declaration = true)` | Write XML, optionally with its declaration           |
| `stringifyJsonMl(node, options = {})`    | Write readable JSON                                  |
| `normalize(node)`                        | Adapt external JsonML in place; return the same root |

The caller supplies the XML parser. Import keeps attributes as strings and trusts an explicit root type without
validating or decoding it. XML output converts primitive attribute values to text, including `false`; only `undefined`
fields are omitted. Escaping preserves attribute tabs, newlines, and carriage returns through XML parsing.

Plain `JSON.stringify` and `JSON.parse` also work. `stringifyJsonMl` keeps attrs inline, indents nested elements, and
gives comment/CDATA fragments separate lines. Its exported `StringifyOptions` has two independent flags, both defaulting
to false:

| Option   | Effect                                                  |
| -------- | ------------------------------------------------------- |
| `spaces` | Add spaces after commas and colons                      |
| `short`  | Omit empty attribute objects, including before children |

Default JSON output loads directly into working tuples. After parsing short output or external JsonML with omitted
attrs, call `normalize`. It inserts missing objects recursively, accepts null/undefined slots as missing, and preserves
existing attribute objects. It checks tuple structure rather than vocabulary conformance; invalid structure throws and
may leave an earlier portion normalized.

## Classes and IDs

`@alexdrel/jsonml-ts/html` provides conventions shared by SVG and HTML:

| Function                          | Behavior                                               |
| --------------------------------- | ------------------------------------------------------ |
| `hasClass(node, name)`            | Test one class token                                   |
| `addClass(node, ...names)`        | Add tokens without duplicates                          |
| `removeClass(node, ...names)`     | Remove tokens; delete an empty class attribute         |
| `toggleClass(node, name, force?)` | Toggle or force membership; return its resulting state |
| `getElementById(root, id)`        | Find the first matching descendant                     |
| `indexElementsById(root)`         | Build a `Map<string, XmlElement>` of descendants       |

Class mutations accept individual nonempty tokens without whitespace. Changes normalize whitespace; checks and no-op
edits preserve the stored value. Both ID operations exclude the root and let the first depth-first occurrence win.

## Test assertions

`@alexdrel/jsonml-ts/assert` uses Node's assertions. It consumes traversal results instead of providing a separate
search API:

```ts
import { assertMatches, elementMatches } from "@alexdrel/jsonml-ts/assert";

const [title] = assertMatches(elements(tree, "h1"), { $class: "title", $text: "Getting started" });
const paragraphs = elements(tree, "p").filter(node => elementMatches(node, { $children: 0 }));
```

`elementMatches(node, expected)` returns a boolean. `assertMatches(candidates, expected = {}, count = 1)` selects
matches, checks their count, and returns an array preserving the candidate type. Failed assertions report the expected
pattern and available candidates; a sole candidate is shown directly.

Patterns use ordinary attribute names plus `$class` (required class tokens), `$text` (exact `textContent`), and
`$children` (direct element count). Numeric expectations also match equivalent numeric XML strings. Other attribute
values compare exactly; `class` compares the whole value, unlike `$class`.
