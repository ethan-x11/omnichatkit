"use client";
import { type ReactNode, useState } from "react";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Sector,
  LabelList,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Rectangle,
  Area,
  AreaChart as RAreaChart,
  Radar,
  RadarChart as RRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart as RRadialChart,
} from "recharts";
export interface RendererProps<T = any> {
  props: T;
  children?: any;
  dispatch?: (payload: any) => void;
}
import { FileText, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import React from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Alert as UIAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table as UITable, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs as UITabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog as UIDialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox as UICheckbox } from "@/components/ui/checkbox";
import { Input as UIInput } from "@/components/ui/input";
import { Textarea as UITextarea } from "@/components/ui/textarea";
import { RadioGroup as UIRadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label as UILabel } from "@/components/ui/label";
import { Slider as UISlider } from "@/components/ui/slider";
import { ToggleGroup as UIToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { clsx } from "cn";

/* The runtime walks `{path}` bindings against the data model before
 * handing props to renderers, so every prop value below is post-resolution. */

const GAP = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-10",
};
const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
};
const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const CHART_PALETTE = ["#7c70f5", "#3aa37f", "#e89232", "#d5b62c", "#d54b53"];

const fmtNumber = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : n.toLocaleString();

/* A delta value is "meaningful" if it has a digit. Bare "+" / "-" or empty
 * strings shouldn't render a badge; that just produces an empty pill. */
const hasMeaningfulDelta = (v?: string) =>
  typeof v === "string" && /\d/.test(v);

/* Reduce verbose delta strings to the badge's job: just the magnitude.
 * Agents sometimes dump comparison prose like "vs. $89,498M in Q4 FY23"
 * into delta when asked about quarterly comparisons. The badge can't hold
 * that without breaking the card layout, so we extract the first signed
 * number/percent token and let the surrounding context (StatCard caption)
 * carry the original verbose string. */
const condenseDelta = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.length <= 8) return trimmed;
  const patterns = [
    /[+-]\s*\d+(?:[.,]\d+)?\s*%/,
    /\d+(?:[.,]\d+)?\s*%/,
    /[+-]\s*\$?\d+(?:[.,]\d+)?\s*[KMB]?/i,
    /\$?\d+(?:[.,]\d+)?\s*[KMB]?/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[0].replace(/\s+/g, "");
  }
  return trimmed;
};

/* Pull the first number from a free-form string. Handles $X, X.XM, etc.
 * Returns the number's magnitude (sign + numeric value), preserving the
 * order-of-magnitude suffix (k/M/B) when present. */
const parseMoneyish = (s: string): number | null => {
  if (typeof s !== "string") return null;
  const m = s.replace(/[,_]/g, "").match(/(-?\d+(?:\.\d+)?)\s*([kKmMbB]?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const suffix = (m[2] || "").toLowerCase();
  const mult =
    suffix === "k"
      ? 1_000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
          ? 1_000_000_000
          : 1;
  return n * mult;
};

/* When the agent leaves `delta` empty but caption carries a prior-period
 * value like "vs. $89,498M in Q4 FY23", compute the percentage from
 * value vs. that prior number so the user still sees the badge they
 * asked for. Returns a string like "+6.1%" / "-3.0%" or null when we
 * can't extract two comparable numbers. Loose by design: this is a
 * fallback for noisy prompts; the agent should provide its own delta. */
const autoDelta = (value?: string, caption?: string): string | null => {
  if (!value || !caption) return null;
  // Caption needs to look like a comparison. Anchor on "vs.", "from",
  // "compared", "prior", or a leading "$" right after the verb.
  if (!/vs\.|from|compared|prior|previous|last|relative to/i.test(caption)) {
    return null;
  }
  const current = parseMoneyish(value);
  const prior = parseMoneyish(caption);
  if (current == null || prior == null || prior === 0) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  if (!isFinite(pct)) return null;
  const sign = pct >= 0 ? "+" : "";
  // 1 decimal for sub-10% movements, integer otherwise: easier to scan.
  return `${sign}${Math.abs(pct) < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
};

const Stack = ({
  props,
  children,
}: RendererProps<{
  children: string[] | { componentId: string; path: string };
  gap?: keyof typeof GAP;
  align?: keyof typeof ALIGN;
}>) => (
  <div
    className={clsx(
      "flex flex-col",
      GAP[props.gap ?? "md"],
      props.align && ALIGN[props.align],
    )}
  >
    {Array.isArray(props.children)
      ? props.children.map((id) => <Slot key={id} render={children(id)} />)
      : null}
  </div>
);

const Row = ({
  props,
  children,
}: RendererProps<{
  children: string[];
  gap?: keyof typeof GAP;
  justify?: keyof typeof JUSTIFY;
  align?: keyof typeof ALIGN;
}>) => (
  <div
    className={clsx(
      "flex flex-wrap",
      GAP[props.gap ?? "sm"],
      props.justify && JUSTIFY[props.justify],
      ALIGN[props.align ?? "center"],
    )}
  >
    {Array.isArray(props.children)
      ? props.children.map((id) => <Slot key={id} render={children(id)} />)
      : null}
  </div>
);

const Grid = ({
  props,
  children,
}: RendererProps<{
  children: string[];
  columns?: number;
  gap?: keyof typeof GAP;
}>) => {
  const cols = props.columns ?? 3;
  const colMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-5",
    6: "grid-cols-2 lg:grid-cols-6",
  };
  return (
    <div className={clsx("grid", colMap[cols], GAP[props.gap ?? "md"])}>
      {Array.isArray(props.children)
        ? props.children.map((id) => <Slot key={id} render={children(id)} />)
        : null}
    </div>
  );
};

const Section = ({
  props,
  children,
}: RendererProps<{ title: string; eyebrow?: string; children?: string[] }>) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      {props.eyebrow && (
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
          {props.eyebrow}
        </span>
      )}
      <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">
        {props.title}
      </h2>
    </div>
    {Array.isArray(props.children)
      ? props.children.map((id) => <Slot key={id} render={children(id)} />)
      : null}
  </section>
);

const Card = ({
  props,
  children,
}: RendererProps<{
  child: string;
  tone?: "default" | "lilac" | "mint" | "warning";
}>) => {
  const tones: Record<string, string> = {
    default: "bg-[var(--surface)] border-[var(--line)]",
    lilac: "bg-[var(--card-lilac-bg)] border-[var(--card-lilac-border)]",
    mint: "bg-[var(--card-mint-bg)] border-[var(--card-mint-border)]",
    warning: "bg-[var(--card-warning-bg)] border-[var(--card-warning-border)]",
  };
  return (
    <UICard
      className={clsx(
        "rounded-[var(--radius)] border p-5",
        tones[props.tone ?? "default"],
      )}
    >
      {children(props.child)}
    </UICard>
  );
};

const Divider = () => <hr className="border-0 border-t border-[var(--line)]" />;

const Heading = ({
  props,
}: RendererProps<{ text: string; level?: "1" | "2" | "3" }>) => {
  const level = props.level ?? "2";
  const Tag = level === "1" ? "h1" : level === "3" ? "h3" : "h2";
  const sizes = {
    "1": "text-[30px] font-semibold tracking-tight leading-[1.1]",
    "2": "text-[20px] font-semibold tracking-tight leading-[1.2]",
    "3": "text-[15px] font-semibold leading-tight",
  } as const;
  return (
    <Tag className={clsx(sizes[level], "text-[var(--ink)]")}>{props.text}</Tag>
  );
};

const Text = ({
  props,
}: RendererProps<{
  text: string;
  variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";
}>) => {
  const styles = {
    h1: "text-[24px] font-bold text-[var(--ink)]",
    h2: "text-[20px] font-semibold text-[var(--ink)]",
    h3: "text-[16px] font-semibold text-[var(--ink)]",
    h4: "text-[15px] font-medium text-[var(--ink)]",
    h5: "text-[14px] font-medium text-[var(--ink)]",
    caption: "text-[13px] text-[var(--ink-2)]",
    body: "text-[14px] text-[var(--ink-2)] font-normal",
  };
  
  return (
    <p className={clsx("leading-relaxed whitespace-pre-line break-words", styles[props.variant || "body"])}>
      {props.text}
    </p>
  );
};

const Overline = ({ props }: RendererProps<{ text: string }>) => (
  <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
    {props.text}
  </span>
);

const Badge = ({
  props,
}: RendererProps<{
  label: string;
  tone?: "neutral" | "positive" | "warning" | "danger" | "info";
}>) => {
  const tones = {
    neutral:
      "bg-[var(--surface-soft)] text-[var(--ink-2)] border-[var(--line)]",
    info: "bg-[color-mix(in_oklab,var(--lilac)_18%,white)] text-[#2e2c75] border-[color-mix(in_oklab,var(--lilac)_60%,white)]",
    positive:
      "bg-[color-mix(in_oklab,var(--mint)_18%,white)] text-[#0a5d44] border-[color-mix(in_oklab,var(--mint)_70%,white)]",
    warning:
      "bg-[color-mix(in_oklab,var(--orange)_18%,white)] text-[#7a3f0f] border-[color-mix(in_oklab,var(--orange)_60%,white)]",
    danger:
      "bg-[color-mix(in_oklab,var(--red)_12%,white)] text-[#7a1b22] border-[color-mix(in_oklab,var(--red)_55%,white)]",
  } as const;
  return (
    <UIBadge
      variant="outline"
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] mono uppercase tracking-wider font-medium",
        tones[props.tone ?? "neutral"],
      )}
    >
      {props.label}
    </UIBadge>
  );
};

const Callout = ({
  props,
}: RendererProps<{
  body: string;
  title?: string;
  tone?: "info" | "positive" | "warning" | "neutral";
}>) => {
  const tone = props.tone ?? "info";
  const accents: Record<
    typeof tone,
    { bar: string; bg: string; chip: string }
  > = {
    info: {
      bar: "bg-[var(--lilac)]",
      bg: "bg-[color-mix(in_oklab,var(--lilac)_7%,var(--surface))]",
      chip: "text-[#2e2c75]",
    },
    positive: {
      bar: "bg-[var(--mint)]",
      bg: "bg-[color-mix(in_oklab,var(--mint)_8%,var(--surface))]",
      chip: "text-[#0a5d44]",
    },
    warning: {
      bar: "bg-[var(--orange)]",
      bg: "bg-[color-mix(in_oklab,var(--orange)_8%,var(--surface))]",
      chip: "text-[#7a3f0f]",
    },
    neutral: {
      bar: "bg-[var(--ink-2)]",
      bg: "bg-[var(--surface-soft)]",
      chip: "text-[var(--ink)]",
    },
  };
  const a = accents[tone];
  
  const uiVariantMap: Record<string, "default" | "destructive"> = {
    info: "default",
    positive: "default",
    warning: "default",
    neutral: "default"
  };

  return (
    <UIAlert
      variant={uiVariantMap[tone]}
      className={clsx(
        "relative rounded-[var(--radius)] border border-[var(--line)] pl-4 pr-5 py-4 flex flex-col gap-1.5 overflow-hidden",
        a.bg,
      )}
    >
      <span
        aria-hidden
        className={clsx("absolute left-0 top-0 bottom-0 w-1", a.bar)}
      />
      {props.title && (
        <AlertTitle
          className={clsx(
            "mono text-[10.5px] uppercase tracking-[0.14em] font-medium m-0",
            a.chip,
          )}
        >
          {props.title}
        </AlertTitle>
      )}
      <AlertDescription className="text-[13.5px] leading-relaxed text-[var(--ink-2)] mt-0">
        {props.body}
      </AlertDescription>
    </UIAlert>
  );
};

const BulletList = ({
  props,
}: RendererProps<{
  items: string[];
  ordered?: boolean;
}>) => {
  const items = Array.isArray(props.items) ? props.items : [];
  if (!items.length) return null;
  const Tag = props.ordered ? "ol" : "ul";
  // We render markers manually inside each <li>. `display: flex` on the
  // li (which we want for clean alignment) kills the browser's native
  // `list-decimal` / `list-disc` rendering, so for ordered lists we
  // synthesize the "1." / "2." prefix ourselves.
  return (
    <Tag className="flex flex-col gap-2 text-[14px] text-[var(--ink-2)] leading-relaxed list-none pl-0 m-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {props.ordered ? (
            <span
              aria-hidden
              className="mono tabular-nums text-[12px] text-[var(--ink)] font-medium leading-relaxed min-w-[1.25rem] flex-none"
            >
              {i + 1}.
            </span>
          ) : (
            <span
              aria-hidden
              className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--lilac)] flex-none"
            />
          )}
          <span className="flex-1 min-w-0">{it}</span>
        </li>
      ))}
    </Tag>
  );
};

const StatCard = ({
  props,
}: RendererProps<{
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  caption?: string;
}>) => {
  // Prefer the agent's delta. Fall back to auto-computing from value vs.
  // the prior number in caption when the agent left delta blank.
  const explicitDelta = hasMeaningfulDelta(props.delta)
    ? condenseDelta(props.delta!)
    : null;
  const computedDelta = explicitDelta
    ? null
    : autoDelta(props.value, props.caption);
  const finalDelta = explicitDelta ?? computedDelta;

  // Derive tone from the sign of the computed delta when the agent
  // didn't set deltaTone (or set it incorrectly relative to the actual
  // movement). For explicit deltas, trust the agent's tone choice.
  const inferredTone: "positive" | "negative" | "neutral" =
    computedDelta?.startsWith("-")
      ? "negative"
      : computedDelta?.startsWith("+")
        ? "positive"
        : (props.deltaTone ?? "neutral");
  const effectiveTone = explicitDelta
    ? (props.deltaTone ?? "neutral")
    : inferredTone;

  const deltaClass =
    effectiveTone === "positive"
      ? "text-[#0a5d44] bg-[color-mix(in_oklab,var(--mint)_22%,white)] border-[color-mix(in_oklab,var(--mint)_60%,white)]"
      : effectiveTone === "negative"
        ? "text-[#7a1b22] bg-[color-mix(in_oklab,var(--red)_15%,white)] border-[color-mix(in_oklab,var(--red)_45%,white)]"
        : "text-[var(--ink-2)] bg-[var(--surface-soft)] border-[var(--line)]";

  const arrow =
    effectiveTone === "positive"
      ? "↑"
      : effectiveTone === "negative"
        ? "↓"
        : "→";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-2.5">
      <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
        {props.label}
      </span>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[28px] font-semibold tracking-tight text-[var(--ink)] leading-none tabular-nums">
          {props.value}
        </span>
        {finalDelta && (
          <span
            className={clsx(
              "mono text-[11px] px-1.5 py-0.5 rounded-md border font-medium tabular-nums inline-flex items-center gap-1",
              deltaClass,
            )}
          >
            <span aria-hidden>{arrow}</span>
            {finalDelta}
          </span>
        )}
      </div>
      {props.caption && (
        <span className="text-[12px] text-[var(--ink)] leading-snug">
          {props.caption}
        </span>
      )}
    </div>
  );
};

type Series = { label: string; value: number }[];

const tooltipStyle = {
  background: "var(--glass-hover)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  color: "var(--ink)",
  boxShadow: "0 4px 12px -2px rgba(10, 10, 15, 0.08)",
};

/* Per-item text inside the tooltip. Recharts otherwise inherits the
 * series fill color (light lilac for our charts), which renders as
 * washed-out text. Force a saturated dark purple so the numbers stay
 * readable and on-brand. */
const tooltipItemStyle = {
  color: "#3b3a8a",
  fontSize: 12,
  fontWeight: 500,
};
const tooltipLabelStyle = {
  color: "var(--ink)",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 2,
};

const axisTickStyle = {
  fontSize: 11,
  fill: "var(--ink)",
  fontWeight: 500,
};

/* If long or many x-axis labels would collide, rotate them and let
 * recharts auto-skip overlapping ones. The threshold is conservative:
 * any label over 6 chars OR more than 6 data points → angle. */
function xAxisProps(data: Series) {
  const maxLen = data.reduce((m, d) => Math.max(m, (d.label ?? "").length), 0);
  const tilt = maxLen > 6 || data.length > 6;
  return {
    angle: tilt ? -28 : 0,
    height: tilt ? 56 : 24,
    textAnchor: tilt ? ("end" as const) : ("middle" as const),
    interval: "preserveStartEnd" as const,
    minTickGap: 8,
    dy: tilt ? 4 : 0,
  };
}

const BarChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const xa = xAxisProps(data);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <RBarChart
          data={data}
          margin={{ top: 24, right: 12, left: 4, bottom: xa.angle ? 16 : 4 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            angle={xa.angle}
            height={xa.height}
            textAnchor={xa.textAnchor}
            interval={xa.interval}
            minTickGap={xa.minTickGap}
            dy={xa.dy}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            width={44}
            tickFormatter={fmtNumber}
          />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dashed" />}
            cursor={{ fill: "var(--lilac-softer)" }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-value)">
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Bar>
        </RBarChart>
      </ChartContainer>
    </div>
  );
};

const LineChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const xa = xAxisProps(data);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ResponsiveContainer minWidth={150} minHeight={150}>
        <RLineChart
          data={data}
          margin={{ top: 24, right: 16, left: 4, bottom: xa.angle ? 16 : 4 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            angle={xa.angle}
            height={xa.height}
            textAnchor={xa.textAnchor}
            interval={xa.interval}
            minTickGap={xa.minTickGap}
            dy={xa.dy}
            padding={{ left: 20, right: 20 }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            width={44}
            tickFormatter={fmtNumber}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b3a8a"
            strokeWidth={2.5}
            dot={{
              r: 3.5,
              fill: "var(--lilac)",
              stroke: "#3b3a8a",
              strokeWidth: 1.5,
            }}
            activeDot={{ r: 5 }}
          >
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Line>
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
};

const HorizontalBarChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  // Auto-size: ~32px per row + padding. Caller can override via height.
  const height = props.height ?? Math.max(180, data.length * 32 + 48);
  return (
    <div style={{ width: "100%", height }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <RBarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 56, left: 4, bottom: 8 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            horizontal={true}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            tickFormatter={fmtNumber}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            width={120}
          />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dashed" />}
            cursor={{ fill: "var(--lilac-softer)" }}
          />
          <Bar 
            dataKey="value" 
            radius={[0, 6, 6, 0]}
            shape={(props: any) => <Rectangle {...props} fill={CHART_PALETTE[props.index % CHART_PALETTE.length]} />}
          >
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Bar>
        </RBarChart>
      </ChartContainer>
    </div>
  );
};

type ScatterPoint = { x: number; y: number; label?: string };

const ScatterChart = ({
  props,
}: RendererProps<{
  data: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}>) => {
  const data = props.data ?? [];
  return (
    <div style={{ width: "100%", height: props.height ?? 280 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <RScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={props.xLabel ?? "x"}
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            tickFormatter={fmtNumber}
            label={
              props.xLabel
                ? {
                    value: props.xLabel,
                    position: "insideBottom",
                    offset: -8,
                    style: { fontSize: 11, fill: "var(--ink)" },
                  }
                : undefined
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            name={props.yLabel ?? "y"}
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            width={44}
            tickFormatter={fmtNumber}
            label={
              props.yLabel
                ? {
                    value: props.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--ink)" },
                  }
                : undefined
            }
          />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dashed" />}
            cursor={{ strokeDasharray: "3 3" }}
          />
          <Scatter
            data={data}
            fill="var(--color-value)"
            stroke="#3b3a8a"
            strokeWidth={1.5}
          />
        </RScatterChart>
      </ChartContainer>
    </div>
  );
};

const DonutChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const total = data.reduce((s, d) => s + d.value, 0);
  const height = props.height ?? 240;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke="var(--surface)"
              strokeWidth={2}
              shape={(props: any) => <Sector {...props} fill={CHART_PALETTE[props.index % CHART_PALETTE.length]} />}
            />
          </PieChart>
        </ChartContainer>
        {/* Total in the middle of the donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink)]">
            Total
          </span>
          <span className="text-[20px] font-semibold tracking-tight text-[var(--ink)] tabular-nums leading-tight">
            {fmtNumber(total)}
          </span>
        </div>
      </div>

      {/* External legend with values */}
      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={`${d.label}-${i}`}
              className="flex items-center gap-3 text-[13px]"
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
              />
              <span className="text-[var(--ink-2)] truncate flex-1 min-w-0">
                {d.label}
              </span>
              <span className="mono tabular-nums text-[12.5px] text-[var(--ink)] font-medium shrink-0">
                {fmtNumber(d.value)}
              </span>
              <span className="mono text-[11px] text-[var(--ink)] shrink-0 w-9 text-right">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const DataTable = ({
  props,
}: RendererProps<{
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
}>) => {
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
      <UITable className="w-full text-[13.5px]">
        <TableHeader className="bg-[var(--surface-soft)]">
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={clsx(
                  "px-4 py-2.5 font-medium mono uppercase tracking-[0.1em] text-[10.5px] text-[var(--ink)] border-b border-[var(--line)] h-auto",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className={clsx(
                "border-b border-[var(--line-2)] last:border-b-0 transition-colors hover:bg-[var(--surface-soft)]",
              )}
            >
              {columns.map((c) => {
                const raw = row[c.key];
                const text = raw == null ? "" : String(raw);
                const looksLikeDelta = c.key === "delta" || c.key === "Δ";
                const meaningful = !looksLikeDelta || hasMeaningfulDelta(text);
                if (looksLikeDelta && meaningful) {
                  const tone = text.trim().startsWith("-")
                    ? "text-[#7a1b22]"
                    : text.trim().startsWith("+")
                      ? "text-[#0a5d44]"
                      : "text-[var(--ink-2)]";
                  return (
                    <TableCell
                      key={c.key}
                      className={clsx(
                        "px-4 py-3 tabular-nums mono text-[12px] font-medium",
                        c.align === "right" ? "text-right" : "text-left",
                        tone,
                      )}
                    >
                      {text}
                    </TableCell>
                  );
                }
                return (
                  <TableCell
                    key={c.key}
                    className={clsx(
                      "px-4 py-3 text-[var(--ink-2)]",
                      c.align === "right"
                        ? "text-right tabular-nums mono text-[13px]"
                        : "text-left",
                    )}
                  >
                    {meaningful ? (
                      (text as ReactNode)
                    ) : (
                      <span className="text-[var(--ink)]">. </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
};

const Button = ({
  props,
  dispatch,
  children,
}: RendererProps<{
  child: string;
  variant?: "default" | "primary" | "borderless";
  action:
    | { event: { name: string; context?: Record<string, unknown> } }
    | { functionCall: { call: string; args?: Record<string, unknown> } };
  checks?: { condition: boolean; message: string }[];
}>) => {
  const variantMap: Record<string, "default" | "outline" | "ghost"> = {
    primary: "default",
    default: "outline",
    borderless: "ghost",
  };
  return (
    <UIButton
      type="button"
      onClick={() =>
        dispatch?.({ ...props.action, sourceComponentId: undefined } as never)
      }
      variant={variantMap[props.variant ?? "default"]}
      className={clsx((!props.variant || props.variant === "default") && "py-6 px-4")}
    >
      {children(props.child)}
    </UIButton>
  );
};

const ChoiceChips = ({
  props,
  dispatch,
}: RendererProps<{
  label: string;
  options: { label: string; value: string }[];
  value: string | string[];
  multi?: boolean;
}>) => {
  const selected = Array.isArray(props.value)
    ? props.value
    : props.value
      ? [props.value]
      : [];
  const renderOptions = () =>
    (props.options ?? []).map((o) => {
      return (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          onClick={() =>
            dispatch?.({
              event: {
                name: "select_chip",
                context: { value: o.value, label: props.label },
              },
            } as never)
          }
          className={clsx(
            "px-3 py-1.5 rounded-full text-[12px] border transition mono",
            "data-[state=on]:bg-[var(--ink)] data-[state=on]:text-white data-[state=on]:border-[var(--ink)]",
            "bg-[var(--surface)] text-[var(--ink-2)] border-[var(--line)] hover:border-[var(--ink-2)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
          )}
        >
          {o.label}
        </ToggleGroupItem>
      );
    });

  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
        {props.label}
      </span>
      <UIToggleGroup
        multiple={props.multi}
        value={selected}
        onValueChange={(val) => {
          // Handled per item below, or we could handle it here.
        }}
        className="flex flex-wrap gap-2 justify-start"
      >
        {renderOptions()}
      </UIToggleGroup>
    </div>
  );
};

function Slot({ render }: { render: ReactNode }) {
  return <>{render}</>;
}

const InfoRow = ({ props }: RendererProps<{ label: string; value: string }>) => (
  <div className="flex items-start justify-between py-2 border-b border-[var(--line)] last:border-0">
    <span className="text-[13px] text-[var(--ink)] opacity-70 w-1/3">{props.label}</span>
    <span className="text-[14px] text-[var(--ink-2)] font-medium w-2/3 text-right">{props.value}</span>
  </div>
);

const StatusBadge = ({ props }: RendererProps<{ label: string; status?: "positive" | "negative" | "warning" | "neutral" }>) => {
  const tones = {
    neutral: "bg-[var(--surface-soft)] text-[var(--ink-2)] border-[var(--line)]",
    positive: "bg-[color-mix(in_oklab,var(--mint)_18%,white)] text-[#0a5d44] border-[color-mix(in_oklab,var(--mint)_70%,white)]",
    warning: "bg-[color-mix(in_oklab,var(--orange)_18%,white)] text-[#7a3f0f] border-[color-mix(in_oklab,var(--orange)_60%,white)]",
    negative: "bg-[color-mix(in_oklab,var(--red)_12%,white)] text-[#7a1b22] border-[color-mix(in_oklab,var(--red)_55%,white)]",
  } as const;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[12px] font-medium tracking-wide", tones[props.status ?? "neutral"])}>
      {props.label}
    </span>
  );
};

const Metric = ({ props }: RendererProps<{ label: string; value: string; trend?: string }>) => (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] text-[var(--ink-2)] font-medium uppercase tracking-wider">{props.label}</span>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-[var(--ink)]">{props.value}</span>
      {props.trend && <span className="text-[13px] font-medium" style={{ color: "var(--mint, #10b981)" }}>{props.trend}</span>}
    </div>
  </div>
);

const CatalogPieChart = ({ props, children }: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <PieChart>
          <Pie 
            data={data} 
            dataKey="value" 
            nameKey="label" 
            cx="50%" 
            cy="50%" 
            outerRadius={80} 
            fill="var(--color-value)" 
            label
            shape={(props: any) => <Sector {...props} fill={CHART_PALETTE[props.index % CHART_PALETTE.length]} />}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
        </PieChart>
      </ChartContainer>
    </div>
  );
};

const WaterfallChart = ({ props }: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  let current = 0;
  
  const waterfallData = data.map((item) => {
    const val = item.value ?? 0;
    const end = current + val;
    const start = current;
    current = end;
    return {
      ...item,
      waterfallRange: [Math.min(start, end), Math.max(start, end)],
      isPositive: val >= 0,
      originalValue: val,
    };
  });

  const xa = xAxisProps(waterfallData);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <RBarChart
          data={waterfallData}
          margin={{ top: 24, right: 12, left: 4, bottom: xa.angle ? 16 : 4 }}
        >
          <CartesianGrid stroke="var(--line-2)" vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            axisLine={true}
            tickLine={true}
            angle={xa.angle}
            height={xa.height}
            textAnchor={xa.textAnchor}
            interval={xa.interval}
            minTickGap={xa.minTickGap}
            dy={xa.dy}
          />
          <YAxis tick={axisTickStyle} axisLine={true} tickLine={true} width={44} tickFormatter={fmtNumber} />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dashed" />}
            cursor={{ fill: "var(--lilac-softer)" }}
          />
          <Bar 
            dataKey="waterfallRange"
            shape={(props: any) => {
              const { fill, payload, ...rest } = props;
              return (
                <Rectangle 
                  {...rest} 
                  fill={payload.isPositive ? "var(--mint, #10b981)" : "var(--red, #f43f5e)"} 
                  radius={[2, 2, 2, 2]} 
                />
              );
            }}
          />
        </RBarChart>
      </ChartContainer>
    </div>
  );
};

const RiskGauge = ({ props }: RendererProps<{ label?: string; value: number; riskLevel?: "low" | "medium" | "high"; description?: string; min?: number; max?: number }>) => {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const pct = Math.min(100, Math.max(0, ((props.value - min) / (max - min)) * 100));
  
  const colors = {
    low: "var(--mint, #10b981)",
    medium: "var(--orange, #f59e0b)",
    high: "var(--red, #f43f5e)",
  };
  const bgColor = props.riskLevel ? colors[props.riskLevel] : "var(--lilac, #8b5cf6)";

  return (
    <div className="w-full flex flex-col gap-2 py-2">
      <div className="flex justify-between items-end">
        {props.label && <div className="text-[13px] font-medium text-[var(--ink)]">{props.label}</div>}
        {props.riskLevel && (
          <div className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" 
               style={{ backgroundColor: `color-mix(in srgb, ${bgColor} 20%, transparent)`, color: bgColor }}>
            {props.riskLevel}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-[var(--ink-2)] font-medium px-1 mt-1">
        <span>{min}</span>
        <span className="text-[var(--ink)] font-bold text-lg">{props.value}</span>
        <span>{max}</span>
      </div>
      <div className="h-3 w-full bg-[var(--surface-soft)] rounded-full overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ backgroundColor: bgColor, width: `${pct}%` }} />
      </div>
      {props.description && <div className="text-[12px] text-[var(--ink-2)] mt-1">{props.description}</div>}
    </div>
  );
};


const ReportGenerationCard = ({ props }: RendererProps<{ report_id?: string; report_name?: string; blob_url?: string; generated_at?: string; status?: string; message?: string }>) => {
  const isSuccess = props.status === 'completed' || props.status === 'success';
  return (
    <div className="w-full max-w-2xl border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50/50 border-b border-slate-100 p-4">
        <div className="text-lg flex items-center gap-2 font-semibold text-slate-900">
          {isSuccess ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
          Report Generation Status
        </div>
        <div className="text-sm text-slate-500 mt-1">
          {props.message || (isSuccess ? "Report generated successfully." : "Report generation encountered an issue.")}
        </div>
      </div>
      <div className="p-6">
        {isSuccess && props.report_id ? (
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{props.report_name || 'Generated Report'}</p>
                {props.generated_at && <p className="text-xs text-slate-500">Generated: {new Date(props.generated_at).toLocaleString()}</p>}
              </div>
            </div>
            {props.blob_url && (
              <button
                className="gap-2 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 flex items-center text-slate-700 cursor-pointer"
                onClick={() => window.open(props.blob_url, '_blank')}
              >
                <Download className="w-4 h-4" /> View PDF
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
            {props.message || "The report could not be generated. Please check the logs."}
          </div>
        )}
      </div>
    </div>
  );
};

const Image = ({ props }: RendererProps<{ url: string; description?: string; fit?: string; variant?: string }>) => (
  <img
    src={props.url}
    alt={props.description || ""}
    className={clsx(
      "w-full h-auto rounded-[var(--radius)]",
      props.fit === 'scaleDown' ? 'object-scale-down'
        : props.fit ? `object-${props.fit}`
        : 'object-cover',
    )}
  />
);

const Icon = ({ props }: RendererProps<{ name: string | { svgPath: string } }>) => {
  // Handle svgPath object variant from the basic catalog spec
  if (props.name && typeof props.name === 'object' && 'svgPath' in props.name) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[var(--ink)]">
        <path d={(props.name as { svgPath: string }).svgPath} />
      </svg>
    );
  }
  let name = (typeof props.name === 'string' ? props.name : '').trim();
  // Convert camelCase icon names to snake_case for Material Symbols
  name = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (name === 'attachfile') name = 'attach_file';
  else if (name === 'arrowright') name = 'arrow_right';
  else if (name === 'arrowleft') name = 'arrow_left';
  return <span className="material-symbols-outlined text-[var(--ink)]">{name}</span>;
};

const Video = ({ props }: RendererProps<{ url: string }>) => (
  <video src={props.url} controls className="w-full rounded-[var(--radius)]" />
);

const AudioPlayer = ({ props }: RendererProps<{ url: string; description?: string }>) => (
  <div className="flex flex-col gap-2 p-4 rounded-[var(--radius)] bg-[var(--surface-soft)] border border-[var(--line)]">
    {props.description && <span className="text-sm font-medium text-[var(--ink)]">{props.description}</span>}
    <audio src={props.url} controls className="w-full h-10" />
  </div>
);

const Column = ({ props, children }: RendererProps<{
  children: string[] | { componentId: string; path: string };
  gap?: keyof typeof GAP;
  justify?: keyof typeof JUSTIFY;
  align?: keyof typeof ALIGN;
  weight?: number[];
}>) => (
  <div className={clsx('flex flex-col', GAP[props.gap ?? 'md'], props.justify && JUSTIFY[props.justify], props.align && ALIGN[props.align])}>
    {Array.isArray(props.children)
      ? props.children.map((id, i) => (
          <div key={id} style={{ flexGrow: (props.weight as number[] | undefined)?.[i] ?? 0 }} className={(props.weight as number[] | undefined)?.[i] ? 'flex flex-col' : undefined}>
            {children(id)}
          </div>
        ))
      : null}
  </div>
);

/**
 * List — renders an array of child component IDs as a vertical scrollable list.
 * The basic catalog spec uses `children` (array of IDs); this renderer also
 * accepts `items` as a fallback alias for backward-compatibility.
 */
const List = ({
  props,
  children,
}: RendererProps<{
  children?: string[] | { componentId: string; path: string };
  items?: string[];
  direction?: 'vertical' | 'horizontal';
  align?: keyof typeof ALIGN;
}>) => {
  const ids = Array.isArray(props.children)
    ? (props.children as string[])
    : Array.isArray(props.items)
    ? props.items
    : [];
  const isHorizontal = props.direction === 'horizontal';
  return (
    <div
      className={clsx(
        isHorizontal ? 'flex flex-row flex-wrap' : 'flex flex-col',
        'overflow-y-auto max-h-[400px] border border-[var(--line)] rounded-[var(--radius)] bg-[var(--surface)]',
        props.align && ALIGN[props.align],
      )}
    >
      {ids.map((id) => (
        <div key={id} className="border-b border-[var(--line)] last:border-b-0 p-3 hover:bg-[var(--surface-soft)] transition-colors">
          {children(id)}
        </div>
      ))}
    </div>
  );
};

const Tabs = ({ props, children }: RendererProps<{ tabs: { title: string; child: string }[] }>) => {
  if (!Array.isArray(props.tabs) || props.tabs.length === 0) return null;
  return (
    <UITabs defaultValue={String(0)} className="w-full flex flex-col gap-4">
      <TabsList className="bg-transparent border-b border-[var(--line)] rounded-none p-0 h-auto w-full justify-start gap-6">
        {props.tabs.map((tab, i) => (
          <TabsTrigger
            key={i}
            value={String(i)}
            className="rounded-none bg-transparent pb-2 px-1 text-[13px] font-medium border-b-2 border-transparent data-[state=active]:border-[var(--ink)] data-[state=active]:text-[var(--ink)] text-[var(--ink-2)] hover:text-[var(--ink)] data-[state=active]:shadow-none data-[state=active]:bg-transparent"
          >
            {tab.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {props.tabs.map((tab, i) => (
        <TabsContent key={i} value={String(i)} className="mt-0">
          {children(tab.child)}
        </TabsContent>
      ))}
    </UITabs>
  );
};

const Modal = ({ props, children }: RendererProps<{ trigger: string; content: string }>) => {
  return (
    <UIDialog>
      <DialogTrigger 
        nativeButton={false} 
        render={<div className="cursor-pointer inline-block text-left" />}
      >
        {children(props.trigger)}
      </DialogTrigger>
      <DialogContent className="bg-[var(--surface)] p-6 rounded-[var(--radius)] shadow-xl border border-[var(--line)] max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Modal</DialogTitle>
        <DialogDescription className="sr-only">Modal Content</DialogDescription>
        {children(props.content)}
      </DialogContent>
    </UIDialog>
  );
};

const CheckBox = ({ props, dispatch }: RendererProps<{ label?: string; value: boolean }>) => {
  const [localValue, setLocalValue] = React.useState(!!props.value);
  React.useEffect(() => { setLocalValue(!!props.value); }, [props.value]);
  const id = React.useId();

  return (
    <div className="flex items-center gap-2 w-fit">
      <UICheckbox
        id={id}
        checked={localValue}
        onCheckedChange={(checked) => {
          const val = !!checked;
          setLocalValue(val);
          dispatch?.({ type: "set", value: val } as never);
        }}
        className="w-[18px] h-[18px] rounded-[4px] border-[var(--line)] text-[var(--lilac)] focus:ring-[var(--lilac)]"
      />
      {props.label && (
        <UILabel htmlFor={id} className="text-[13px] font-medium text-[var(--ink)] cursor-pointer">
          {props.label}
        </UILabel>
      )}
    </div>
  );
};

const TextField = ({
  props,
  dispatch,
}: RendererProps<{
  label?: string;
  value?: string;
  variant?: 'shortText' | 'longText' | 'number' | 'obscured';
  checks?: any;
  validationRegexp?: string;
}>) => {
  const [localValue, setLocalValue] = React.useState(props.value || '');
  React.useEffect(() => { setLocalValue(props.value || ''); }, [props.value]);
  const id = React.useId();
  const isTextarea = props.variant === 'longText';
  const inputType = props.variant === 'obscured' ? 'password' : props.variant === 'number' ? 'number' : 'text';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {props.label && <UILabel htmlFor={id} className="text-[13px] font-medium text-[var(--ink)]">{props.label}</UILabel>}
      {isTextarea ? (
        <UITextarea
          id={id}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            dispatch?.({ type: 'set', value: e.target.value } as never);
          }}
          className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-[13px] text-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--lilac)] focus-visible:border-[var(--lilac)] min-h-[100px] transition-colors"
        />
      ) : (
        <UIInput
          id={id}
          type={inputType}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            dispatch?.({ type: 'set', value: e.target.value } as never);
          }}
          className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--lilac)] focus-visible:border-[var(--lilac)] transition-colors"
        />
      )}
    </div>
  );
};

const ChoicePicker = ({ props, dispatch }: RendererProps<{ options: { label: string; value: string }[]; value: string | string[]; variant?: "mutuallyExclusive" | "multipleSelection" }>) => {
  const isMulti = props.variant === "multipleSelection";
  const [selected, setSelected] = React.useState<string[]>(Array.isArray(props.value) ? props.value : props.value ? [props.value] : []);
  
  React.useEffect(() => {
    setSelected(Array.isArray(props.value) ? props.value : props.value ? [props.value] : []);
  }, [props.value]);

  if (isMulti) {
    return (
      <div className="flex flex-col gap-2.5">
        {(props.options ?? []).map((o) => {
          const isOn = selected.includes(o.value);
          const id = React.useId();
          return (
            <div key={o.value} className="flex items-center gap-2 w-fit">
              <UICheckbox
                id={id}
                checked={isOn}
                onCheckedChange={(checked) => {
                  const newSel = checked ? [...selected, o.value] : selected.filter(v => v !== o.value);
                  setSelected(newSel);
                  dispatch?.({ type: "set", value: newSel } as never);
                }}
                className="w-[18px] h-[18px] rounded-[4px] border-[var(--line)] text-[var(--lilac)] focus:ring-[var(--lilac)]"
              />
              <UILabel htmlFor={id} className="text-[13px] font-medium text-[var(--ink)] cursor-pointer">{o.label}</UILabel>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <UIRadioGroup
      value={selected[0] || ""}
      onValueChange={(val) => {
        setSelected([val]);
        dispatch?.({ type: "set", value: val } as never);
      }}
      className="flex flex-col gap-2.5"
    >
      {(props.options ?? []).map((o) => {
        const id = React.useId();
        return (
          <div key={o.value} className="flex items-center gap-2 w-fit">
            <RadioGroupItem
              value={o.value}
              id={id}
              className="w-[18px] h-[18px] border-[var(--line)] text-[var(--lilac)] focus:ring-[var(--lilac)]"
            />
            <UILabel htmlFor={id} className="text-[13px] font-medium text-[var(--ink)] cursor-pointer">{o.label}</UILabel>
          </div>
        );
      })}
    </UIRadioGroup>
  );
};

const Slider = ({ props, dispatch }: RendererProps<{ value: number; min?: number; max?: number; label?: string }>) => {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const [localValue, setLocalValue] = React.useState(props.value ?? min);

  React.useEffect(() => {
    setLocalValue(props.value ?? min);
  }, [props.value, min]);

  return (
    <div className="flex flex-col gap-2 w-full mt-1">
      <div className="flex justify-between items-center w-full">
        <span className="text-[13px] font-medium text-[var(--ink)]">{props.label}</span>
        <span className="text-[14px] font-bold text-[var(--ink)]">{localValue}</span>
      </div>
      <UISlider
        min={min}
        max={max}
        step={1}
        value={[localValue]}
        onValueChange={(vals) => {
          setLocalValue(typeof vals === 'number' ? vals : vals[0]);
        }}
        onValueCommitted={(vals) => {
          const v = typeof vals === 'number' ? vals : vals[0];
          dispatch?.({ type: 'set', value: v } as never);
        }}
        className="w-full cursor-pointer mt-1"
      />
      <div className="flex items-center justify-between text-[11px] text-[var(--ink-2)] font-medium">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

/**
 * DateTimeInput — A2UI basic catalog date/time picker.
 * Supports date-only, time-only, or combined date+time modes.
 */
const DateTimeInput = ({
  props,
  dispatch,
}: RendererProps<{
  value?: string;
  label?: string;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: string;
  max?: string;
}>) => {
  const enableDate = props.enableDate ?? false;
  const enableTime = props.enableTime ?? false;
  const inputType = enableDate && enableTime ? 'datetime-local' : enableDate ? 'date' : 'time';
  const [localValue, setLocalValue] = React.useState(props.value || '');
  React.useEffect(() => { setLocalValue(props.value || ''); }, [props.value]);
  const id = React.useId();

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {props.label && (
        <UILabel htmlFor={id} className="text-[13px] font-medium text-[var(--ink)]">
          {props.label}
        </UILabel>
      )}
      <UIInput
        id={id}
        type={inputType}
        value={localValue}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          setLocalValue(e.target.value);
          dispatch?.({ type: 'set', value: e.target.value } as never);
        }}
        className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--lilac)] focus-visible:border-[var(--lilac)] transition-colors"
      />
    </div>
  );
};

const AreaChart = ({ props }: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const xa = xAxisProps(data);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="h-full w-full">
        <RAreaChart data={data} margin={{ top: 24, right: 12, left: 4, bottom: xa.angle ? 16 : 4 }}>
          <CartesianGrid stroke="var(--line-2)" vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={axisTickStyle} axisLine={true} tickLine={true} angle={xa.angle} height={xa.height} textAnchor={xa.textAnchor} interval={xa.interval} minTickGap={xa.minTickGap} dy={xa.dy} />
          <YAxis tick={axisTickStyle} axisLine={true} tickLine={true} width={44} tickFormatter={fmtNumber} />
          <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} cursor={{ stroke: "var(--lilac-softer)", strokeWidth: 2 }} />
          <Area type="monotone" dataKey="value" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.3} />
        </RAreaChart>
      </ChartContainer>
    </div>
  );
};

const RadarChart = ({ props }: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="mx-auto aspect-square h-full w-full max-h-[250px]">
        <RRadarChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <PolarGrid stroke="var(--line-2)" />
          <PolarAngleAxis dataKey="label" tick={axisTickStyle} />
          <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
          <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.4} stroke="var(--color-value)" strokeWidth={2} />
        </RRadarChart>
      </ChartContainer>
    </div>
  );
};

const RadialChart = ({ props }: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ChartContainer config={{ value: { label: "Value", color: "var(--lilac)" } }} className="mx-auto aspect-square h-full w-full max-h-[250px]">
        <RRadialChart data={data} innerRadius="30%" outerRadius="100%">
          <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="label" />} />
          <RadialBar 
            dataKey="value" 
            background={{ fill: "var(--surface-soft)" }} 
            cornerRadius={4}
            shape={(props: any) => <Sector {...props} fill={CHART_PALETTE[props.index % CHART_PALETTE.length]} />}
          />
        </RRadialChart>
      </ChartContainer>
    </div>
  );
};

export const renderers = {
  AreaChart,
  RadarChart,
  RadialChart,
  Stack,
  Row,
  Grid,
  Section,
  Card,
  Divider,
  Heading,
  Text,
  Overline,
  Badge,
  Callout,
  BulletList,
  StatCard,
  BarChart,
  HorizontalBarChart,
  LineChart,
  DonutChart,
  ScatterChart,
  DataTable,
  Button,
  ChoiceChips,
  InfoRow,
  StatusBadge,
  Metric,
  PieChart: CatalogPieChart,
  WaterfallChart,
  RiskGauge,
  ReportGenerationCard,
  Image,
  Icon,
  Video,
  AudioPlayer,
  Column,
  List,
  Tabs,
  Modal,
  CheckBox,
  TextField,
  ChoicePicker,
  Slider,
  DateTimeInput,
};
