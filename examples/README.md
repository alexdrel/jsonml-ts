# JsonML.ts examples

Small examples of the API in context:

| Example                                   | What to learn                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Progress ring](svg/progress.ts)          | Construct typed SVG from parameters; keep the builder separate from serialization.                                  |
| [Catalog](catalog/catalog.ts)             | Define a vocabulary with tuple unions and `PartOf`; use the same typed operation on constructed and imported trees. |
| [Text replacement](text/replace.ts)       | Traverse arbitrary XML with parent/index entries and edit text in place while preserving attributes and comments.   |
| [Board export](board/export.ts)           | Replace nodes lazily, collect selections before removal, and prune empty ancestors from the bottom up.              |
| [Topos logo](logo/create.ts)              | Refine an existing SVG through typed queries, direct attribute edits, and a little construction.                    |
| [JSON roundtrip](logo/roundtrip.ts)       | Save readable plain JSON, load it without initialization, and serialize back to matching SVG.                       |
| [Logo assertions](logo/structure.test.ts) | Combine traversal with attribute, class, and child-count expectations to validate a real tree.                      |
