import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { domToJsonMl, serializeXml, stringifyJsonMl } from "../../src/serialize.ts";
import type { Svg } from "../../types/svg.ts";

// Import SVG, then save its plain tuples as readable JSON.
const source = readFileSync(new URL("./logo-sq-base.svg", import.meta.url), "utf8");
const document = new DOMParser().parseFromString(source, "image/svg+xml");
const original = domToJsonMl<Svg>(document.documentElement!);
const jsonOutput = new URL("./output/logo-sq-base.json", import.meta.url);
mkdirSync(new URL("./output/", import.meta.url), { recursive: true });
writeFileSync(jsonOutput, stringifyJsonMl(original) + "\n");

// Load the saved file. There is no codec, initialization, or runtime vocabulary.
const loaded = JSON.parse(readFileSync(jsonOutput, "utf8")) as Svg;
deepStrictEqual(loaded, original);
strictEqual(stringifyJsonMl(loaded) + "\n", readFileSync(jsonOutput, "utf8"));

// This fixture is already formatted by our serializer: require an exact match.
strictEqual(serializeXml(loaded) + "\n", source);

console.log(`Wrote ${jsonOutput.pathname}`);
console.log("JSON preserves the tuples exactly; serialized SVG matches the base file.");
