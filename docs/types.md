# Defining types

JsonML.ts works with generic `XmlElement` trees or ordinary TypeScript tuple aliases for a particular vocabulary. No
runtime registration is required. See the [API](api.md) for operations and the [model](model.md) for their rationale.

## Define attributes and elements

Start with attribute object type aliases, then describe each element as a tuple. The attrs slot is required even when
every attribute is optional.

```ts
import {
  ATTR, appendChild, elements, type PartOf, type XmlNumber,
} from "@alexdrel/jsonml-ts";

type CatalogAttrs = PartOf<CatalogElements> & { id?: string };
type ItemAttrs = CatalogAttrs & {
  id: string;
  price: XmlNumber;
  stock: XmlNumber;
  availability?: "listed" | "hidden";
};
type NoteAttrs = CatalogAttrs & { lang?: string };

type Item = ["item", ItemAttrs];
type Note = ["note", NoteAttrs, ...string[]];
type Section = ["section", CatalogAttrs & { title: string }, ...(Section | Item | Note)[]];
type Catalog = ["catalog", CatalogAttrs & { title: string }, ...(Section | Item | Note)[]];
type CatalogElements = Catalog | Section | Item | Note;

const catalog: Catalog = ["catalog", { title: "Tea shop" },
  ["section", { title: "Tea" },
    ["item", { id: "green-tea", price: 12, stock: 8 }],
  ],
  ["note", { lang: "en" }, "Prices are per tin."],
];
```

Use object **type aliases** for attrs. They compose through intersections and satisfy the core `Attrs` constraint
without an index signature. TypeScript interfaces do not have the same implicit index-signature compatibility.

Required fields stay required; the tuple does not implicitly apply `Partial`. A variable annotation checks nested
literals and gives later edits the declared attribute types. `satisfies` also checks a literal but may infer individual
fields more narrowly than desired for mutation.

## Associate the vocabulary

`PartOf<CatalogElements>` on shared attrs associates every participating element with the same vocabulary. The recursive
reference is type-only; no symbol or other marker is added to actual attribute objects.

```ts
function restock(root: Catalog, id: string, amount: number): void {
  const item = elements(root, "item", true).find(([, attrs]) => attrs.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  item[ATTR].stock = Number(item[ATTR].stock) + amount;
}

restock(catalog, "green-tea", 4);
```

## How `elements` uses the types

`elements` infers the vocabulary from the **parent's type**, through `PartOf` on its attrs. The tag argument selects the
matching tuple from that union. No type arguments are needed at the call site:

```ts
const items: Item[] = elements(catalog, "item", true).toArray();
const prices: number[] = elements(catalog, "item", true)
  .map(([, attrs]) => Number(attrs.price)).toArray();

for (const [item, parent, index] of elements(catalog, "item", true).entries()) {
  item[ATTR].availability = "listed";
  // item is Item; parent is XmlElement; index is its actual tuple position.
}
```

Both the returned node and native iterator callbacks retain `ItemAttrs`. The `availability` assignment accepts
`"listed"` or `"hidden"`; unknown fields and other values are rejected. The entry's parent is generic because an item
can occur under different containing elements.

| Query                             | Yielded node type |
| --------------------------------- | ----------------- |
| `elements(catalog, "item")`       | `Item`            |
| `elements(catalog, "item", true)` | `Item`            |
| `elements(catalog)`               | `CatalogElements` |
| `elements(catalog, true)`         | `CatalogElements` |

The recursive flag changes where traversal looks, not vocabulary membership. For example, the catalog above has no
direct items, so the first query yields nothing despite its `Item` result type. Unknown vocabulary tags are rejected.
Tagless queries yield the union and support ordinary tag-based narrowing:

```ts
for (const node of elements(catalog, true)) {
  if (node[0] === "item") {
    const stock: XmlNumber = node[ATTR].stock;
    node[ATTR].stock = Number(stock) + 1;
  }
}
```

Every returned vocabulary element carries its own `PartOf` association, so further queries retain the vocabulary. Child
restrictions still control construction independently: membership does not make every vocabulary element a permitted
child.

### Without vocabulary membership

Without `PartOf`, direct queries infer immediate child types. Tag searches reuse known immediate child declarations and
otherwise return a generic tagged tuple. Tagless recursive queries return `XmlElement`; inference does not recursively
expand the child graph.

```ts
type PlainItem = ["item", { sku: string }];
type PlainCatalog = ["catalog", {}, ...PlainItem[]];
const plain: PlainCatalog = ["catalog", {}, ["item", { sku: "tea" }]];
const directItems: PlainItem[] = elements(plain, "item").toArray();
```

A generic `XmlElement` parent has unrestricted tags and generic attrs in its query results. To deliberately leave a
vocabulary's tag restrictions, use `elements<XmlElement>(catalog, "foreign", true)` with `XmlElement` imported from
core.

## Describe child content

The slots after attrs describe physical children. They can be absent, fixed, variadic, or recursive:

```ts
type Label = ["label", { id?: string }, string];
type Pair = ["pair", {}, Item, Item];
type Paragraph = ["p", {}, ...(string | Label)[]];
```

`Item` has no child slots. `Note` allows any number of strings. `Section` allows nested sections. For open foreign
markup, use `XMLChild[]` for text and arbitrary elements, or `XmlElement[]` for elements only.

Typed insertion helpers check the parent's declared content without widening it from the supplied child. For example:

```ts
const herbalTea: Item = ["item", { id: "herbal-tea", price: 9, stock: 6 }];
appendChild(catalog, herbalTea);
```

`replaceChildren` checks the complete replacement tuple, including fixed slots. Ordinary array `push` and `splice`
include header types in their accepted values; they do not enforce the same child constraints. Arbitrary removal also
cannot preserve fixed child cardinality automatically.

A fixed string slot describes a physical text fragment, not necessarily one logical XML text node. A parser may provide
multiple fragments.

## Stored attribute values

Core `Attrs` permits string, number, boolean, and undefined values. Use narrower fields in your vocabulary:

| Type                   | Stored values                                               |
| ---------------------- | ----------------------------------------------------------- |
| `string`               | Text                                                        |
| `XmlNumber`            | `number` or a numeric string matching `` `${number}` ``     |
| `XmlBoolean`           | `boolean`, `"true"`, `"false"`, `"0"`, or `"1"`             |
| `"listed" \| "hidden"` | A restricted string value                                   |
| `number \| string`     | Numbers or unrestricted text, useful for lengths with units |

Imported XML attributes remain strings. `Number(value)` can interpret a numeric field for arithmetic. Serialization
converts defined primitive values to text and omits undefined fields; it does not encode JavaScript primitive types in
XML.

## Read XML with the same types

Supply your root tuple type to `domToJsonMl`. It describes the descendants too; there is no separate vocabulary argument
or root-tag parameter.

This complete example uses `@xmldom/xmldom`; another XML parser can supply the DOM:

```ts
import { DOMParser } from "@xmldom/xmldom";
import { domToJsonMl } from "@alexdrel/jsonml-ts/serialize";

const source = '<catalog title="Tea shop"><item id="green-tea" price="12" stock="8"/></catalog>';
const document = new DOMParser().parseFromString(source, "application/xml");
const imported = domToJsonMl<Catalog>(document.documentElement!);
restock(imported, "green-tea", 4);
```

The requested type is trusted. Import does not validate required attrs, enum values, or child content, and does not
decode lexical values. Without a type argument, the result is generic `XmlElement`. A union root type can be narrowed by
checking its tag.

## Reuse the SVG vocabulary

`@alexdrel/jsonml-ts/types/svg` exports aliases such as `Svg`, `G`, `Circle`, and `Rect`, their attribute types, and the
`SvgElements` union. These types include `PartOf<SvgElements>`. Metadata and foreign-object content can contain open
XML. The declarations provide a practical SVG content model rather than a full schema.

`svgEl(tag, attrs = {}, ...children)` infers attributes and children from the tag. It accepts partial attrs for
incremental construction; its declared result is not proof that every required field has already been filled. Annotated
tuple literals check required fields directly. `svgRoot(width, height, attrs = {}, ...children)` adds dimensions and the
SVG namespace.

## Core type utilities

| Type                         | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `XmlElement<A = Attrs>`      | Generic tuple with attrs of type `A`                           |
| `XMLChild`                   | `XmlElement \| string`                                         |
| `Children<E>`                | The tuple of child slots after tag and attrs                   |
| `Content<E>`                 | A member of those child slots                                  |
| `ElementOf<V, T, F = never>` | Select tag `T` from union `V`, with optional open fallback `F` |
| `DomainOf<E>`                | Recover vocabulary membership from attrs                       |

`ElementOf` prefers explicit tag declarations over open XML shapes. It distributes over union tag arguments, preserving
known declarations alongside generic foreign content. These utilities support custom helpers without introducing runtime
types.
