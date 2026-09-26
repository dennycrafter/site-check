import type { ReactNode } from "react";
import type { OutlineId } from "@/lib/steps";

type Shape =
  | { kind: "rect"; cx: number; cy: number; w: number; h: number; mask: boolean }
  | { kind: "circle"; cx: number; cy: number; d: number; mask: boolean }
  | { kind: "corners"; xs: number[] };

/** All numbers are percentages of the video box (circle diameter is % of width). */
const OUTLINES: Record<OutlineId, { shape: Shape; label: string }> = {
  small_center: { shape: { kind: "rect", cx: 50, cy: 50, w: 18, h: 24, mask: false }, label: "Meter here" },
  circle_large: {
    shape: { kind: "circle", cx: 50, cy: 45, d: 42, mask: true },
    label: "Meter here, whole box in view",
  },
  small_right_edge: {
    shape: { kind: "rect", cx: 84, cy: 50, w: 16, h: 22, mask: false },
    label: "Meter here",
  },
  small_left_edge: {
    shape: { kind: "rect", cx: 16, cy: 50, w: 16, h: 22, mask: false },
    label: "Meter here",
  },
  corner_markers: { shape: { kind: "corners", xs: [8, 92] }, label: "Corners here" },
  medium_center: {
    shape: { kind: "rect", cx: 50, cy: 50, w: 36, h: 44, mask: false },
    label: "Breaker box here",
  },
  rect_large: {
    shape: { kind: "rect", cx: 50, cy: 50, w: 76, h: 50, mask: true },
    label: "Main switch here, lid open",
  },
};

const STROKE = {
  stroke: "white",
  strokeWidth: 3,
  fill: "none",
  vectorEffect: "non-scaling-stroke" as const,
};

/**
 * Overlay drawn in a coordinate space 100 units wide and 100 * (h / w) tall,
 * so circles stay round on any video aspect ratio.
 */
export function Outline({ id, aspect }: { id: OutlineId; aspect: number }) {
  const { shape, label } = OUTLINES[id];
  const W = 100;
  const H = 100 / aspect;
  const y = (pct: number) => (pct / 100) * H;
  const fontSize = Math.max(4, Math.min(5.5, H * 0.045));

  let outline: ReactNode;
  let cutout: ReactNode = null;
  let labelY: number;
  let labelX = 50;

  if (shape.kind === "rect") {
    const w = shape.w;
    const h = y(shape.h);
    const x = shape.cx - w / 2;
    const top = y(shape.cy) - h / 2;
    const r = Math.min(w, h) * 0.08;
    outline = <rect x={x} y={top} width={w} height={h} rx={r} {...STROKE} />;
    if (shape.mask) cutout = <rect x={x} y={top} width={w} height={h} rx={r} fill="black" />;
    labelX = shape.cx;
    labelY = top + h + fontSize * 1.6;
  } else if (shape.kind === "circle") {
    const r = shape.d / 2;
    const cy = y(shape.cy);
    outline = <circle cx={shape.cx} cy={cy} r={r} {...STROKE} />;
    if (shape.mask) cutout = <circle cx={shape.cx} cy={cy} r={r} fill="black" />;
    labelY = Math.min(cy + r + fontSize * 1.6, H - fontSize * 0.6);
  } else {
    outline = shape.xs.map((x) => (
      <line key={x} x1={x} y1={0} x2={x} y2={H} {...STROKE} strokeDasharray="10 8" />
    ));
    labelY = fontSize * 1.8;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {cutout && (
        <>
          <defs>
            <mask id={`mask-${id}`}>
              <rect x={0} y={0} width={W} height={H} fill="white" />
              {cutout}
            </mask>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="black" fillOpacity={0.45} mask={`url(#mask-${id})`} />
        </>
      )}
      <g style={{ filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.85))" }}>
        {outline}
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fill="white"
          fontSize={fontSize}
          fontWeight={600}
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {label}
        </text>
      </g>
    </svg>
  );
}
