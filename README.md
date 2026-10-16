# JsonML.ts

[**JsonML**](https://www.jsonml.org/) represents XML and HTML as JSON with striking simplicity: a tag, an attribute
object, and children—all in an ordinary array. It preserves order and mixed content while remaining easy to read, edit,
and serialize. It’s an elegant idea that deserves to be much better known.

```xml
<p class="greeting">Hello, <strong>world</strong>!</p>
```

```json
["p", {"class": "greeting"}, "Hello, ", ["strong", {}, "world"], "!"]
```

Some places JsonML fits naturally:

- Build and transform SVG and HTML using native JavaScript arrays and objects, without DOM overhead or API constraints.
- Store markup as JSON or JavaScript alongside application data—load it with `JSON.parse` or import it directly, without
  a DOM parser.
- Transform XML documents: replace text, adjust attributes, or remove selected elements.
- Build readable test fixtures for markup generation and document transformations.

JsonML.ts adds typed traversal, editing helpers, and XML/JSON serialization to this representation. Define your own
TypeScript vocabulary or use the included SVG types.

The package is ESM, has no runtime dependencies, and includes an SVG vocabulary.

It grew out of [Topos](https://github.com/alexdrel/topos), which uses JsonML extensively to build and transform SVG and
HTML.

## Getting started

```sh
npm install @alexdrel/jsonml-ts
```

Requires Node 26 or later. Traversal uses native iterator helpers; the core, serialization, and HTML helpers also work
in browsers that support them.

```ts
import { ATTR, append, elements, replaceChildren, xmlElement } from "@alexdrel/jsonml-ts";
import { serializeXml } from "@alexdrel/jsonml-ts/serialize";

const article = xmlElement("article", { id: "intro" },
  ["h1", { class: "title" }, "Draft title"],
  xmlElement("p", { class: "intro" }, "Hello, world!"),
);

article[ATTR].lang = "en";
const [heading] = elements(article, "h1");
replaceChildren(heading, "Getting started");
append(article, ["p", { class: "note" }, "More to come."]);

console.log(serializeXml(article));
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<article id="intro" lang="en">
  <h1 class="title">Getting started</h1>
  <p class="intro">Hello, world!</p>
  <p class="note">More to come.</p>
</article>
```

Tuple literals and constructor calls can be mixed freely, as above.

The working layout is `[tag, attrs, ...children]`. Constructors always supply an attribute object, including `{}` when
empty. `TAG`, `ATTR`, and `CHILD` name the three positions; ordinary array and object operations remain available.

`elements(parent, tag?)` visits direct child elements. Pass `true` as the last argument for all descendants:
`elements(article, "p", true)` or `elements(article, true)`. Results are lazy, single-use iterators supporting native
`find`, `filter`, `map`, and other iterator helpers.

`nodes(parent, recursive?)` also visits text, comments, and CDATA. Call `.entries()` when an edit needs the containing
tuple and actual tuple index:

```ts
import { nodes } from "@alexdrel/jsonml-ts";

for (const [node, parent, index] of nodes(article, true).entries()) {
  if (typeof node === "string") parent[index] = node.replaceAll("world", "reader");
}
```

Inserting or removing slots during traversal can shift indices. For removals, pass selected entries to `removeEntries`:
it collects the selection before editing. `append`, `prepend`, and `replaceChildren` cover common child edits.

## Adding types

Define a vocabulary as a union of ordinary TypeScript tuple aliases. Each alias specifies a tag, its attributes, and
allowed children:

```ts
import { ATTR, elements, type PartOf, type XmlNumber } from "@alexdrel/jsonml-ts";

type CatalogAttrs = PartOf<CatalogElements>;
type Item = ["item", CatalogAttrs & { id: string; stock: XmlNumber }];
type Catalog = ["catalog", CatalogAttrs & { title: string }, ...Item[]];
type CatalogElements = Catalog | Item;

const catalog: Catalog = ["catalog", { title: "Tea shop" },
  ["item", { id: "green-tea", stock: 8 }],
];

const tea = elements(catalog, "item").find(([, attrs]) => attrs.id === "green-tea")!;
tea[ATTR].stock = Number(tea[ATTR].stock) + 4;
```

Selecting `"item"` returns `Item`, with its declared attribute types. `PartOf` associates elements with their vocabulary
for queries at any depth; it adds no runtime data. Without that association, queries infer immediate child types. Use
object type aliases for attributes, as above.

`XmlNumber` accepts numbers and numeric strings; `XmlBoolean` accepts booleans and their XML text forms. String
attributes can use literal unions. These types allow the same operations on constructed trees and trusted XML input,
whose attribute values remain strings.

For SVG, import tuple types and constructors from `@alexdrel/jsonml-ts/types/svg`:

```ts
import { svgRoot, svgEl } from "@alexdrel/jsonml-ts/types/svg";

const svg = svgRoot(100, 100,
  {}, svgEl("circle", { cx: 50, cy: 50, r: 20, fill: "steelblue" }),
);
```

The SVG vocabulary covers a practical subset of SVG; schema completeness is still in progress. Constructor attributes
may be filled incrementally.

## XML and JSON

XML parsing is supplied by the caller. Import a DOM element from a browser or XML library with `domToJsonMl`; optionally
provide its trusted root type:

```ts
import { domToJsonMl } from "@alexdrel/jsonml-ts/serialize";

// domRoot comes from your XML parser.
const imported = domToJsonMl<Catalog>(domRoot);
```

Import does not validate the vocabulary or convert string attributes to numbers or booleans. `serializeXml` writes XML,
retaining comments and CDATA. Formatting normalizes to a stable form; arbitrary source formatting is not preserved byte
for byte.

Plain `JSON.stringify` and `JSON.parse` work: the tree is ordinary data. `stringifyJsonMl` offers a layout suited to
markup, keeping attributes inline and putting nested elements on separate lines. Both preserve attribute objects and
load directly into usable tuples:

```ts
import { stringifyJsonMl } from "@alexdrel/jsonml-ts/serialize";

const json = JSON.stringify(catalog);
const loaded: Catalog = JSON.parse(json);
const readable = stringifyJsonMl(catalog, { spaces: true });
```

Use `{ spaces: true }` to add spaces after commas and colons while keeping attribute objects on one line. For example, a
small SVG label is saved as:

```json
["svg", { "width": 100, "height": 40, "xmlns": "http://www.w3.org/2000/svg" },
  ["rect", { "x": 1, "y": 1, "width": 98, "height": 38, "rx": 8, "fill": "#f3f4f6" }],
  ["text", { "x": 50, "y": 25, "text-anchor": "middle" }, "Hello!"]
]
```

The [original JsonML syntax](https://www.jsonml.org/syntax/) also allows omitted attribute objects. `normalize` adapts
that layout in place, adding missing attrs while preserving existing node and attribute-object identity. Use it for
external JsonML or after reading explicitly short output:

```ts
import { normalize } from "@alexdrel/jsonml-ts/serialize";

const short = stringifyJsonMl(catalog, { short: true });
const restored = normalize(JSON.parse(short));
```

The `spaces` and `short` options are independent and default to `false`. Short output omits empty attribute objects.
Normalization repairs the tuple layout; it does not validate XML names or vocabulary conformance.

## Modules and examples

| Import                          | Provides                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| `@alexdrel/jsonml-ts`           | Tuple types, construction, traversal, and mutation              |
| `@alexdrel/jsonml-ts/serialize` | DOM import, normalization, XML serialization, and readable JSON |
| `@alexdrel/jsonml-ts/html`      | Class operations and ID lookup, also useful for SVG             |
| `@alexdrel/jsonml-ts/assert`    | Pattern matching and Node test assertions                       |
| `@alexdrel/jsonml-ts/types/svg` | SVG tuple types and constructors                                |

See the [examples README](examples/README.md) for complete programs and what each one demonstrates.

## Development

Requires Node 26 or later.

```sh
npm ci
npm test
npm run build
```

Tests run directly from TypeScript source. `npm test` checks formatting, runs Oxlint, performs strict type checking, and
runs tests. `npm run fmt` formats TypeScript, JSON, and Markdown with Oxfmt; `npm run lint` runs the linter on its own.
The build uses `tsc` to emit ESM JavaScript and declarations into `dist/`. `npm pack --dry-run` builds and lists the
package contents without publishing.

The [documentation](docs/) covers the API, data model, and defining types. The examples use `@xmldom/xmldom` for XML
parsing and keep generated files in their `output/` folders.
