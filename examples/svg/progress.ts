import { serializeXml } from "../../src/serialize.ts";
import { svgEl, svgRoot } from "../../types/svg.ts";

// Build a small progress indicator for a web page. The value controls both
// the arc and its label; serialization stays outside the builder.
function progressSvg(progress: number, size: number) {
  const center = size / 2;
  const strokeWidth = size / 12;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  return svgRoot(
    size,
    size,
    { viewBox: `0 0 ${size} ${size}`, "aria-labelledby": "progress-title" },
    svgEl("title", { id: "progress-title" }, `${progress}% complete`),
    svgEl(
      "g",
      { fill: "none", "stroke-width": strokeWidth },
      svgEl("circle", { cx: center, cy: center, r: radius, stroke: "#e2e8f0" }),
      svgEl("circle", {
        cx: center,
        cy: center,
        r: radius,
        stroke: "#0d9488",
        "stroke-linecap": "round",
        "stroke-dasharray": `${((circumference * progress) / 100).toFixed(2)} ${circumference.toFixed(2)}`,
        transform: `rotate(-90 ${center} ${center})`,
      }),
    ),
    svgEl(
      "text",
      {
        x: center,
        y: center,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-family": "system-ui, sans-serif",
        "font-size": radius / 2,
        fill: "#334155",
      },
      `${progress}%`,
    ),
  );
}

console.log(serializeXml(progressSvg(72, 96)));
