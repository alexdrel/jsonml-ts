# Data model

JsonML.ts uses ordinary mutable arrays to represent markup. The [API](api.md) operates on that data directly;
[types](types.md) add vocabulary information without changing its runtime shape.

## One working layout

```ts
[tag, attrs, ...children]
```

Every working element has an attribute object, even when empty. Constructors and XML import follow the same rule. This
makes attribute access predictable and keeps tuple declarations straightforward: a tag selects its attrs and child
types.

An empty object costs memory, but optional attrs would spread absence checks through generic code and vocabulary
declarations. JsonML.ts chooses a uniform working representation; short forms remain available at the serialization
boundary.

External JsonML may omit attrs. In-place normalization inserts missing objects, including for leaf tuples and
null/undefined slots. It preserves existing objects. It is an adaptation of layout, not a schema-validation step.

## Plain data and identity

Trees need no wrappers, prototypes, registration, or initialization after loading our default JSON output. Direct
indexing and array methods remain usable. Small free functions provide common operations without imposing DOM ownership
rules.

A tuple may appear in multiple slots or parents. Appending it does not detach it from another parent. Editing its attrs
affects every reference to that same tuple; replacing a slot affects only that occurrence.

Traversal therefore offers `[node, parent, index]` entries when context is needed. Indices identify occurrences,
including repeated strings, without allocating full ancestor paths. Removal collects those locations before shifting any
slots.

## Types describe the stored values

Vocabularies are unions of tuple aliases. Each tuple independently describes its attributes and child content. `PartOf`
associates an element with its vocabulary through a type-only marker on shared attrs; no runtime schema is shipped.

Vocabulary membership makes query typing independent of a fully specified child graph. Without membership, inference
examines immediate children rather than recursively expanding potentially recursive types.

XML imports and programmatically constructed nodes share the same types. Imported attributes remain strings; lexical
aliases such as `XmlNumber` describe both numeric text and JavaScript numbers. There is no provenance tracking or
automatic attribute decoder. Consumers establish schema conformance externally.

## Traversal stays programmatic

`elements` and `nodes` provide scope and optional tag selection. Native iterator helpers supply predicates and
transformations. There is no selector-string language or custom selection pipeline.

Traversal is lazy and single-use, observing the current tree. Contextual triplets are allocated only when entries are
consumed. Structural mutation requires care: collecting locations before removal is an explicit operation rather than an
implicit snapshot on every query.

## XML and JSON roundtrips

Default JSON output retains the working layout. Both the standard JSON serializer and the JsonML formatter can save
these arrays; `JSON.parse` restores usable data. Normal JSON rules apply to primitive values, including omission of
undefined object properties. Explicit short output omits empty attrs and requires normalization on read. Formatting
itself never edits the tree.

XML cannot preserve JavaScript value types: numbers and booleans become text. It also cannot distinguish an original
short leaf from a leaf with an empty attrs object. Import consistently produces the working layout instead.

XML formatting aims at convergence. If `R` means import followed by serialization, then `R(R(source)) === R(source)`
after the first formatting pass. Attribute quoting, indentation, and empty-element syntax may normalize. Mixed text and
element content stays inline so inserted indentation does not change phrases. Structural indentation is discarded on
import, while authored blank separators are retained. This whitespace policy does not implement `xml:space="preserve"`.

## Comments and CDATA

Comments and CDATA use the same tuple layout with `$comment` and `$cdata` tags. Their children are strings. XML import
splits payloads into newline-preserving fragments so saved JSON shows readable lines instead of long escaped strings.
Joining those fragments recovers the payload; JSON formatting never introduces new fragments.

`elements` excludes these pseudo-elements. `nodes` visits them and their content. `textContent` includes CDATA but
excludes nested comments. Whole-payload edits can join the content and replace it with a newly constructed comment or
CDATA tuple.

These details keep comments and CDATA usable in ordinary JsonML while preserving their distinct XML syntax through
serialization.
