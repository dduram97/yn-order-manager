"use client";

import type { StatSlice } from "@/lib/supabase/customer-order-stats";
import {
  resolveChartColor,
  type ChartColorKind,
} from "@/lib/constants/chart-colors";

interface DonutChartProps {
  title: string;
  slices: StatSlice[];
  /** 채널/상품 색상 맵 구분 */
  colorKind?: ChartColorKind;
  onSliceClick?: (label: string) => void;
  activeLabel?: string | null;
  emptyMessage?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function DonutChart({
  title,
  slices,
  colorKind = "channel",
  onSliceClick,
  activeLabel,
  emptyMessage = "데이터가 없습니다.",
}: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const visibleSlices = slices.filter((s) => s.count > 0);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 68;
  const stroke = 28;

  let angle = 0;
  const arcs =
    total === 0
      ? []
      : visibleSlices.map((slice) => {
          const sweep = (slice.count / total) * 360;
          const startAngle = angle;
          const endAngle = angle + sweep;
          angle = endAngle;
          const color = resolveChartColor(colorKind, slice.label);
          return {
            ...slice,
            color,
            path:
              sweep >= 359.9
                ? undefined
                : describeArc(cx, cy, radius, startAngle, endAngle),
            fullCircle: sweep >= 359.9,
          };
        });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {total === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="#e4e4e7"
                strokeWidth={stroke}
              />
            ) : (
              arcs.map((arc) =>
                arc.fullCircle ? (
                  <circle
                    key={arc.label}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={stroke}
                    className={onSliceClick ? "cursor-pointer" : undefined}
                    onClick={() => onSliceClick?.(arc.label)}
                  />
                ) : (
                  <path
                    key={arc.label}
                    d={arc.path}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={stroke}
                    strokeLinecap="butt"
                    className={onSliceClick ? "cursor-pointer" : undefined}
                    onClick={() => onSliceClick?.(arc.label)}
                  />
                )
              )
            )}
            <circle cx={cx} cy={cy} r={radius - stroke / 2 - 4} fill="white" />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-zinc-900 text-lg font-semibold"
              style={{ fontSize: "18px", fontWeight: 600 }}
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              className="fill-zinc-500"
              style={{ fontSize: "11px" }}
            >
              건
            </text>
          </svg>
        </div>

        <div className="w-full min-w-0 flex-1 space-y-2">
          {total === 0 ? (
            <p className="text-sm text-zinc-500">{emptyMessage}</p>
          ) : (
            visibleSlices.map((slice) => {
              const active = activeLabel === slice.label;
              const color = resolveChartColor(colorKind, slice.label);
              return (
                <button
                  key={slice.label}
                  type="button"
                  disabled={!onSliceClick}
                  onClick={() => onSliceClick?.(slice.label)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    onSliceClick ? "hover:bg-zinc-50" : ""
                  } ${active ? "bg-zinc-100" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-zinc-800">{slice.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-600">
                    {slice.count}건 · {slice.percent}%
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
