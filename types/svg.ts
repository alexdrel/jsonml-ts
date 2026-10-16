// dprint-ignore-file
// svg.ts
// SVG element tuple types and optional construction helpers.
// Provides compile-time validation of SVG tag names and per-tag attribute shapes.
// Tag list is stable — SVG spec has not added structural tags in 20+ years.

import type { Children, ElementOf, PartOf, XmlCdata, XMLChild, XmlComment, XmlNumber } from "../src/jsonml.ts";
export const SVG_NS = "http://www.w3.org/2000/svg";

// ─── Tag Union ────────────────────────────────────────────────────────────────

export type SvgTag = SvgElements[0];

// ─── Shared Presentation Attrs ────────────────────────────────────────────────
// Common to almost all SVG elements — not repeated per tag.

type PresentationAttrs = {
  fill?: string;
  "fill-opacity"?: XmlNumber;
  "fill-rule"?: "nonzero" | "evenodd";
  stroke?: string;
  "stroke-width"?: XmlNumber;
  "stroke-opacity"?: XmlNumber;
  "stroke-dasharray"?: string;
  "stroke-dashoffset"?: XmlNumber;
  "stroke-linecap"?: "butt" | "round" | "square";
  "stroke-linejoin"?: "miter" | "round" | "bevel";
  opacity?: XmlNumber;
  visibility?: "visible" | "hidden" | "collapse";
  transform?: string;
  "clip-path"?: string;
  mask?: string;
  filter?: string;
  cursor?: string;
  "pointer-events"?: string;
  "font-family"?: string;
  "font-size"?: XmlNumber | string;
  "font-weight"?: "normal" | "bold" | XmlNumber;
  "font-style"?: "normal" | "italic" | "oblique";
  "text-decoration"?: string;
  color?: string;
  display?: string;
  overflow?: "visible" | "hidden" | "scroll" | "auto";
};

// Common to all elements (id, class, data-*, aria-*, style)
export type CoreAttrs = PartOf<SvgElements> &
  PresentationAttrs & {
    id?: string;
    class?: string;
    style?: string;
    tabindex?: XmlNumber;
    lang?: string;
    [dataAttr: `data-${string}`]: string | XmlNumber | boolean | undefined;
    [ariaAttr: `aria-${string}`]: string | XmlNumber | boolean | undefined;
  };

// ─── Per-Tag Attribute Interfaces ─────────────────────────────────────────────

export type SvgAttrs = CoreAttrs & {
  width?: XmlNumber | string;
  height?: XmlNumber | string;
  viewBox?: string;
  xmlns?: string;
  "xmlns:xlink"?: string;
  preserveAspectRatio?: string;
  x?: XmlNumber;
  y?: XmlNumber;
};

export type GAttrs = CoreAttrs;

export type DefsAttrs = CoreAttrs;

export type SymbolAttrs = CoreAttrs & {
  viewBox?: string;
  preserveAspectRatio?: string;
  x?: XmlNumber;
  y?: XmlNumber;
  width?: XmlNumber | string;
  height?: XmlNumber | string;
};

export type UseAttrs = CoreAttrs & {
  href?: string;
  "xlink:href"?: string;
  x?: XmlNumber;
  y?: XmlNumber;
  width?: XmlNumber | string;
  height?: XmlNumber | string;
};

export type RectAttrs = CoreAttrs & {
  x?: XmlNumber | string;
  y?: XmlNumber | string;
  width: XmlNumber | string;
  height: XmlNumber | string;
  rx?: XmlNumber;
  ry?: XmlNumber;
};

export type CircleAttrs = CoreAttrs & {
  cx?: XmlNumber;
  cy?: XmlNumber;
  r: XmlNumber;
};

export type EllipseAttrs = CoreAttrs & {
  cx?: XmlNumber;
  cy?: XmlNumber;
  rx?: XmlNumber;
  ry?: XmlNumber;
};

export type LineAttrs = CoreAttrs & {
  x1: XmlNumber;
  y1: XmlNumber;
  x2: XmlNumber;
  y2: XmlNumber;
  "marker-start"?: string;
  "marker-mid"?: string;
  "marker-end"?: string;
};

export type PolylineAttrs = CoreAttrs & {
  points: string;
  "marker-start"?: string;
  "marker-mid"?: string;
  "marker-end"?: string;
};

export type PolygonAttrs = CoreAttrs & {
  points: string;
};

export type PathAttrs = CoreAttrs & {
  d: string;
  "marker-start"?: string;
  "marker-mid"?: string;
  "marker-end"?: string;
};

export type TextAttrs = CoreAttrs & {
  x?: XmlNumber;
  y?: XmlNumber;
  dx?: XmlNumber | string;
  dy?: XmlNumber | string;
  "text-anchor"?: "start" | "middle" | "end";
  "dominant-baseline"?: string;
  "writing-mode"?: string;
  "text-length"?: XmlNumber;
  "length-adjust"?: string;
  "xml:space"?: "default" | "preserve";
};

export type TspanAttrs = CoreAttrs & {
  x?: XmlNumber;
  y?: XmlNumber;
  dx?: XmlNumber | string;
  dy?: XmlNumber | string;
  "text-anchor"?: "start" | "middle" | "end";
  "dominant-baseline"?: string;
};

export type TextPathAttrs = CoreAttrs & {
  href?: string;
  startOffset?: XmlNumber | string;
  method?: "align" | "stretch";
  spacing?: "auto" | "exact";
};

export type ImageAttrs = CoreAttrs & {
  href?: string;
  "xlink:href"?: string;
  x?: XmlNumber;
  y?: XmlNumber;
  width: XmlNumber | string;
  height: XmlNumber | string;
  preserveAspectRatio?: string;
};

export type ForeignObjectAttrs = CoreAttrs & {
  x?: XmlNumber;
  y?: XmlNumber;
  width: XmlNumber | string;
  height: XmlNumber | string;
};

export type LinearGradientAttrs = CoreAttrs & {
  x1?: XmlNumber | string;
  y1?: XmlNumber | string;
  x2?: XmlNumber | string;
  y2?: XmlNumber | string;
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  gradientTransform?: string;
  spreadMethod?: "pad" | "reflect" | "repeat";
  href?: string;
};

export type RadialGradientAttrs = CoreAttrs & {
  cx?: XmlNumber | string;
  cy?: XmlNumber | string;
  r?: XmlNumber | string;
  fx?: XmlNumber | string;
  fy?: XmlNumber | string;
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  gradientTransform?: string;
  spreadMethod?: "pad" | "reflect" | "repeat";
  href?: string;
};

export type StopAttrs = CoreAttrs & {
  offset: XmlNumber | string;
  "stop-color"?: string;
  "stop-opacity"?: XmlNumber;
};

export type PatternAttrs = CoreAttrs & {
  x?: XmlNumber | string;
  y?: XmlNumber | string;
  width: XmlNumber | string;
  height: XmlNumber | string;
  patternUnits?: "userSpaceOnUse" | "objectBoundingBox";
  patternTransform?: string;
  viewBox?: string;
};

export type FilterAttrs = CoreAttrs & {
  x?: XmlNumber | string;
  y?: XmlNumber | string;
  width?: XmlNumber | string;
  height?: XmlNumber | string;
  filterUnits?: "userSpaceOnUse" | "objectBoundingBox";
  primitiveUnits?: "userSpaceOnUse" | "objectBoundingBox";
};

export type FeGaussianBlurAttrs = CoreAttrs & {
  in?: string;
  stdDeviation?: XmlNumber | string;
  result?: string;
};

export type FeOffsetAttrs = CoreAttrs & {
  in?: string;
  dx?: XmlNumber;
  dy?: XmlNumber;
  result?: string;
};

export type FeBlendAttrs = CoreAttrs & {
  in?: string;
  in2?: string;
  mode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
  result?: string;
};

export type FeFloodAttrs = CoreAttrs & {
  "flood-color"?: string;
  "flood-opacity"?: XmlNumber;
  result?: string;
};

export type FeCompositeAttrs = CoreAttrs & {
  in?: string;
  in2?: string;
  operator?: "over" | "in" | "out" | "atop" | "xor" | "arithmetic";
  k1?: XmlNumber;
  k2?: XmlNumber;
  k3?: XmlNumber;
  k4?: XmlNumber;
  result?: string;
};

export type FeColorMatrixAttrs = CoreAttrs & {
  in?: string;
  type?: "matrix" | "saturate" | "hueRotate" | "luminanceToAlpha";
  values?: string;
  keyTimes?: string;
  calcMode?: string;
  result?: string;
};

export type FeMergeNodeAttrs = CoreAttrs & {
  in?: string;
};

export type FeTurbulenceAttrs = CoreAttrs & {
  baseFrequency?: XmlNumber | string;
  numOctaves?: XmlNumber;
  seed?: XmlNumber;
  stitchTiles?: "stitch" | "noStitch";
  type?: "fractalNoise" | "turbulence";
  result?: string;
};

export type FeDisplacementMapAttrs = CoreAttrs & {
  in?: string;
  in2?: string;
  scale?: XmlNumber;
  xChannelSelector?: "R" | "G" | "B" | "A";
  yChannelSelector?: "R" | "G" | "B" | "A";
  result?: string;
};

export type FeMorphologyAttrs = CoreAttrs & {
  in?: string;
  operator?: "erode" | "dilate";
  radius?: XmlNumber | string;
  result?: string;
};

export type FeDropShadowAttrs = CoreAttrs & {
  dx?: XmlNumber;
  dy?: XmlNumber;
  stdDeviation?: XmlNumber | string;
  "flood-color"?: string;
  "flood-opacity"?: XmlNumber;
  result?: string;
};

export type ClipPathAttrs = CoreAttrs & {
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";
};

export type MaskAttrs = CoreAttrs & {
  x?: XmlNumber | string;
  y?: XmlNumber | string;
  width?: XmlNumber | string;
  height?: XmlNumber | string;
  maskUnits?: "userSpaceOnUse" | "objectBoundingBox";
  maskContentUnits?: "userSpaceOnUse" | "objectBoundingBox";
};

export type MarkerAttrs = CoreAttrs & {
  markerWidth?: XmlNumber;
  markerHeight?: XmlNumber;
  refX?: XmlNumber | string;
  refY?: XmlNumber | string;
  orient?: string;
  markerUnits?: "strokeWidth" | "userSpaceOnUse";
  viewBox?: string;
};

export type AnimateAttrs = CoreAttrs & {
  attributeName?: string;
  from?: string | XmlNumber;
  to?: string | XmlNumber;
  values?: string;
  dur?: string;
  repeatCount?: string | XmlNumber;
  begin?: string;
  fill?: "freeze" | "remove";
};

export type AnimateTransformAttrs = CoreAttrs & {
  attributeName?: string;
  type?: "translate" | "scale" | "rotate" | "skewX" | "skewY";
  from?: string;
  to?: string;
  values?: string;
  dur?: string;
  begin?: string;
  repeatCount?: string | XmlNumber;
};

export type AAttrs = CoreAttrs & {
  href?: string;
  "xlink:href"?: string;
  target?: "_self" | "_parent" | "_top" | "_blank";
};

export type TitleAttrs = CoreAttrs;
export type DescAttrs = CoreAttrs;
export type MetadataAttrs = CoreAttrs;
export type SwitchAttrs = CoreAttrs;
export type FeMergeAttrs = CoreAttrs;
export type AnimateMotionAttrs = CoreAttrs & {
  path?: string;
  rotate?: string;
  keyPoints?: string;
  keyTimes?: string;
  calcMode?: string;
  dur?: string;
  begin?: string;
  repeatCount?: string | XmlNumber;
};
export type MpathAttrs = CoreAttrs & { href?: string };
export type SetAttrs = CoreAttrs & { attributeName?: string; to?: string; begin?: string; dur?: string };
export type StyleAttrs = CoreAttrs & { type?: string };
export type ScriptAttrs = CoreAttrs & { type?: string; href?: string };

// ─── Element tuples ──────────────────────────────────────────────────────────
// A practical content model, not a complete SVG schema. Attribute interfaces own
// required/optional fields. Strings also preserve imported whitespace.

type Descriptive = Title | Desc | Metadata;
type Animation = Animate | AnimateTransform | AnimateMotion | Set;
type CommonChild = Descriptive | Animation | XmlComment | string;
type Graphics =
  | Svg
  | G
  | Use
  | Switch
  | Rect
  | Circle
  | Ellipse
  | Line
  | Polyline
  | Polygon
  | Path
  | Text
  | Image
  | ForeignObject
  | A;
type ContainerChild =
  | Graphics
  | Defs
  | Symbol
  | LinearGradient
  | RadialGradient
  | Pattern
  | Filter
  | ClipPath
  | Mask
  | Marker
  | Descriptive
  | Animation
  | Style
  | Script
  | XmlComment
  | XmlCdata
  | string;
type TextChild = string | Tspan | TextPath | A | Descriptive | Animation | XmlComment;
type FilterPrimitive =
  | FeBlend
  | FeColorMatrix
  | FeComposite
  | FeFlood
  | FeGaussianBlur
  | FeMerge
  | FeOffset
  | FeTurbulence
  | FeDisplacementMap
  | FeMorphology
  | FeDropShadow;

export type Svg = ["svg", SvgAttrs, ...ContainerChild[]];
export type G = ["g", GAttrs, ...ContainerChild[]];
export type Defs = ["defs", DefsAttrs, ...ContainerChild[]];
export type Symbol = ["symbol", SymbolAttrs, ...ContainerChild[]];
export type Use = ["use", UseAttrs, ...CommonChild[]];
export type Switch = ["switch", SwitchAttrs, ...ContainerChild[]];
export type Rect = ["rect", RectAttrs, ...CommonChild[]];
export type Circle = ["circle", CircleAttrs, ...CommonChild[]];
export type Ellipse = ["ellipse", EllipseAttrs, ...CommonChild[]];
export type Line = ["line", LineAttrs, ...CommonChild[]];
export type Polyline = ["polyline", PolylineAttrs, ...CommonChild[]];
export type Polygon = ["polygon", PolygonAttrs, ...CommonChild[]];
export type Path = ["path", PathAttrs, ...CommonChild[]];
export type Text = ["text", TextAttrs, ...TextChild[]];
export type Tspan = ["tspan", TspanAttrs, ...TextChild[]];
export type TextPath = ["textPath", TextPathAttrs, ...TextChild[]];
export type Image = ["image", ImageAttrs, ...CommonChild[]];
export type ForeignObject = ["foreignObject", ForeignObjectAttrs, ...XMLChild[]];
export type LinearGradient = ["linearGradient", LinearGradientAttrs, ...(Stop | CommonChild)[]];
export type RadialGradient = ["radialGradient", RadialGradientAttrs, ...(Stop | CommonChild)[]];
export type Stop = ["stop", StopAttrs, ...CommonChild[]];
export type Pattern = ["pattern", PatternAttrs, ...ContainerChild[]];
export type Filter = ["filter", FilterAttrs, ...(FilterPrimitive | CommonChild)[]];
export type FeBlend = ["feBlend", FeBlendAttrs, ...CommonChild[]];
export type FeColorMatrix = ["feColorMatrix", FeColorMatrixAttrs, ...CommonChild[]];
export type FeComposite = ["feComposite", FeCompositeAttrs, ...CommonChild[]];
export type FeFlood = ["feFlood", FeFloodAttrs, ...CommonChild[]];
export type FeGaussianBlur = ["feGaussianBlur", FeGaussianBlurAttrs, ...CommonChild[]];
export type FeMerge = ["feMerge", FeMergeAttrs, ...(FeMergeNode | CommonChild)[]];
export type FeMergeNode = ["feMergeNode", FeMergeNodeAttrs, ...CommonChild[]];
export type FeOffset = ["feOffset", FeOffsetAttrs, ...CommonChild[]];
export type FeTurbulence = ["feTurbulence", FeTurbulenceAttrs, ...CommonChild[]];
export type FeDisplacementMap = ["feDisplacementMap", FeDisplacementMapAttrs, ...CommonChild[]];
export type FeMorphology = ["feMorphology", FeMorphologyAttrs, ...CommonChild[]];
export type FeDropShadow = ["feDropShadow", FeDropShadowAttrs, ...CommonChild[]];
export type ClipPath = ["clipPath", ClipPathAttrs, ...ContainerChild[]];
export type Mask = ["mask", MaskAttrs, ...ContainerChild[]];
export type Animate = ["animate", AnimateAttrs, ...CommonChild[]];
export type AnimateTransform = ["animateTransform", AnimateTransformAttrs, ...CommonChild[]];
export type AnimateMotion = ["animateMotion", AnimateMotionAttrs, ...(Mpath | Descriptive | XmlComment | string)[]];
export type Mpath = ["mpath", MpathAttrs, ...CommonChild[]];
export type Set = ["set", SetAttrs, ...CommonChild[]];
export type Marker = ["marker", MarkerAttrs, ...ContainerChild[]];
export type A = ["a", AAttrs, ...ContainerChild[]];
export type Title = ["title", TitleAttrs, ...(string | XmlComment)[]];
export type Desc = ["desc", DescAttrs, ...(string | XmlComment)[]];
export type Metadata = ["metadata", MetadataAttrs, ...XMLChild[]];
export type Style = ["style", StyleAttrs, ...(string | XmlCdata | XmlComment)[]];
export type Script = ["script", ScriptAttrs, ...(string | XmlCdata | XmlComment)[]];

export type SvgElements =
  | Svg
  | G
  | Defs
  | Symbol
  | Use
  | Switch
  | Rect
  | Circle
  | Ellipse
  | Line
  | Polyline
  | Polygon
  | Path
  | Text
  | Tspan
  | TextPath
  | Image
  | ForeignObject
  | LinearGradient
  | RadialGradient
  | Stop
  | Pattern
  | Filter
  | FeBlend
  | FeColorMatrix
  | FeComposite
  | FeFlood
  | FeGaussianBlur
  | FeMerge
  | FeMergeNode
  | FeOffset
  | FeTurbulence
  | FeDisplacementMap
  | FeMorphology
  | FeDropShadow
  | ClipPath
  | Mask
  | Animate
  | AnimateTransform
  | AnimateMotion
  | Mpath
  | Set
  | Marker
  | A
  | Title
  | Desc
  | Metadata
  | Style
  | Script;

// ─── Typed constructor convenience ───────────────────────────────────────────

/** Attributes may be filled incrementally; construction does not establish completeness. */
export function svgEl<T extends SvgTag>(
  tag: T,
  attrs: Partial<ElementOf<SvgElements, T>[1]> = {},
  ...children: Children<ElementOf<SvgElements, T>>
) {
  return [tag, attrs, ...children] as unknown as ElementOf<SvgElements, T>;
}

export function svgRoot(width: number, height: number, attrs: SvgAttrs = {}, ...children: Children<Svg>): Svg {
  return svgEl("svg", { width, height, xmlns: SVG_NS, ...attrs }, ...children);
}
