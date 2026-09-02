/**
 * A2UI custom catalog. platform-agnostic component definitions.
 */
import { z } from "zod";

export const CATALOG_ID = "https://omnichatkit.local/catalog/v1";

/* child and children refer to component IDs (resolved at render time). */
const childRef = z.string();
const childrenRef = z.union([
  z.array(z.string()),
  z.object({ componentId: z.string(), path: z.string() }),
]);

/* Helpers for "may be a literal or a path binding". */
const stringOrPath = z.union([z.string(), z.object({ path: z.string() })]);

export const definitions = {
  Stack: {
    description:
      "Vertical layout. Children stack top→bottom with consistent gap. Use as the default page/section container.",
    props: z.object({
      children: childrenRef,
      gap: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
    }),
  },

  Row: {
    description:
      "Horizontal layout. Children sit side-by-side; wraps on small screens. Use for toolbars, metric rows, badge groups.",
    props: z.object({
      children: childrenRef,
      gap: z.enum(["xs", "sm", "md", "lg"]).optional(),
      justify: z.enum(["start", "center", "end", "spaceBetween"]).optional(),
      align: z.enum(["start", "center", "end"]).optional(),
    }),
  },

  Grid: {
    description:
      "Responsive grid. Children fill columns left→right. Use for stat-card rows, chart pairs, card galleries.",
    props: z.object({
      children: childrenRef,
      columns: z.number().int().min(1).max(6).optional(),
      gap: z.enum(["xs", "sm", "md", "lg"]).optional(),
    }),
  },

  Section: {
    description:
      "Titled section with optional eyebrow + actions row. Use to group dashboard regions (e.g. 'Revenue', 'Top customers').",
    props: z.object({
      title: z.string(),
      eyebrow: z.string().optional(),
      children: childrenRef,
    }),
  },

  Card: {
    description:
      "Bordered, rounded surface with padding. Pass a child layout (Stack/Row/Grid) as child.",
    props: z.object({
      child: childRef,
      tone: z.enum(["default", "lilac", "mint", "warning"]).optional(),
    }),
  },

  Divider: {
    description: "A 1px line. No props.",
    props: z.object({}),
  },

  InfoRow: {
    description: "A layout for key-value pairs (e.g. 'Status' : 'Active').",
    props: z.object({
      label: stringOrPath,
      value: stringOrPath,
    }),
  },

  Heading: {
    description:
      "Page or section title. Use level 1 once per surface; 2 for major sections; 3 for sub-blocks.",
    props: z.object({
      text: stringOrPath,
      level: z.enum(["1", "2", "3"]).optional(),
    }),
  },

  Text: {
    description:
      "The text content to display. While simple Markdown formatting is supported, utilizing dedicated UI components is generally preferred.",
    props: z.object({
      text: stringOrPath,
      variant: z.enum(["h1", "h2", "h3", "h4", "h5", "caption", "body"]).optional(),
    }),
  },

  Image: {
    description: "Render image from URL.",
    props: z.object({
      url: stringOrPath,
      description: stringOrPath.optional(),
      fit: z.enum(["cover", "contain", "fill", "none", "scaleDown"]).optional(),
      variant: z.string().optional(),
    }),
  },

  Icon: {
    description: "Render system icons.",
    props: z.object({
      name: z.union([stringOrPath, z.object({ svgPath: stringOrPath })]),
    }),
  },

  Video: {
    description: "Render video player.",
    props: z.object({
      url: stringOrPath,
    }),
  },

  AudioPlayer: {
    description: "Render audio player with description.",
    props: z.object({
      url: stringOrPath,
      description: stringOrPath.optional(),
    }),
  },

  Column: {
    description: "Vertical layout. Arrange children vertically.",
    props: z.object({
      children: childrenRef,
      gap: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      justify: z.enum(["start", "center", "end", "spaceBetween"]).optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      weight: z.union([z.array(z.number()), z.object({ path: z.string() })]).optional(),
    }),
  },

  List: {
    description: "Render scrollable list.",
    props: z.object({
      children: childrenRef.optional(),
      items: childrenRef.optional(),
      direction: z.enum(["vertical", "horizontal"]).optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
    }),
  },

  Tabs: {
    description: "Tabbed navigation using tabs.",
    props: z.object({
      tabs: z.array(z.object({ title: stringOrPath, child: childRef })).min(1),
    }),
  },

  Modal: {
    description: "Popup triggered by trigger displaying content.",
    props: z.object({
      trigger: childRef,
      content: childRef,
    }),
  },

  CheckBox: {
    description: "Boolean checkbox.",
    props: z.object({
      label: stringOrPath.optional(),
      value: z.union([z.boolean(), z.object({ path: z.string() })]),
    }),
  },

  TextField: {
    description: "Input field supporting label, value, variant, and checks.",
    props: z.object({
      label: stringOrPath.optional(),
      value: z.union([z.string(), z.object({ path: z.string() })]).optional(),
      variant: z.enum(["shortText", "longText", "number", "obscured"]).optional(),
      checks: z.any().optional(),
      validationRegexp: z.string().optional(),
    }),
  },

  ChoicePicker: {
    description: "Choice picker supporting options and variants.",
    props: z.object({
      options: z.union([
        z.array(z.object({ label: z.string(), value: z.string() })),
        z.object({ path: z.string() }),
      ]),
      value: z.union([z.string(), z.array(z.string()), z.object({ path: z.string() })]),
      variant: z.enum(["mutuallyExclusive", "multipleSelection"]).optional(),
    }),
  },

  Slider: {
    description: "Support ranges using min, max.",
    props: z.object({
      value: z.union([z.number(), z.object({ path: z.string() })]),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
  },

  DateTimeInput: {
    description: "Date/time picker.",
    props: z.object({
      value: stringOrPath.optional(),
      label: stringOrPath.optional(),
      enableDate: z.boolean().optional(),
      enableTime: z.boolean().optional(),
      min: stringOrPath.optional(),
      max: stringOrPath.optional(),
    }),
  },

  Overline: {
    description:
      "Tiny ALL-CAPS mono label that sits above a heading. Common typography pattern (Material Design calls this 'Overline'). Use for section categories like 'OVERVIEW · Q1 2025'.",
    props: z.object({ text: stringOrPath }),
  },

  Badge: {
    description:
      "Small inline status pill. Use tone to imply meaning (positive=green, warning=amber, neutral=lilac).",
    props: z.object({
      label: stringOrPath,
      tone: z
        .enum(["neutral", "positive", "warning", "danger", "info"])
        .optional(),
    }),
  },

  StatusBadge: {
    description: "Status indicator pill.",
    props: z.object({
      label: stringOrPath,
      status: z.enum(["positive", "negative", "warning", "neutral"]).optional(),
    }),
  },

  Callout: {
    description:
      "Block-level highlight for a key insight, definition, or warning. Use for 'the takeaway' moments inside an explanation. Tone picks the accent color (info=lilac, positive=green, warning=amber, neutral=grey).",
    props: z.object({
      body: stringOrPath,
      title: stringOrPath.optional(),
      tone: z.enum(["info", "positive", "warning", "neutral"]).optional(),
    }),
  },

  BulletList: {
    description:
      "Bulleted or numbered list. Use for short enumerations like 'three key contributions' or 'steps to reproduce'. Pass items as a literal string array or a {path} binding.",
    props: z.object({
      items: z.union([z.array(z.string()), z.object({ path: z.string() })]),
      ordered: z.boolean().optional(),
    }),
  },

  StatCard: {
    description:
      "Single big-number metric. Always include label + value. Use delta (e.g. '+12.4%') with deltaTone for trend.",
    props: z.object({
      label: stringOrPath,
      value: stringOrPath,
      delta: stringOrPath.optional(),
      deltaTone: z.enum(["positive", "negative", "neutral"]).optional(),
      caption: stringOrPath.optional(),
    }),
  },

  Metric: {
    description: "Compact metric display.",
    props: z.object({
      label: stringOrPath,
      value: stringOrPath,
      trend: stringOrPath.optional(),
    }),
  },

  BarChart: {
    description:
      "Vertical bars. data must be an inline array of {label, value} objects (or a path that resolves to one). Use when labels are short (months, regions, < 7 chars). For long labels (customer names, country names), use HorizontalBarChart instead.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  HorizontalBarChart: {
    description:
      "Horizontal bars (rows). Same data shape as BarChart: [{label, value}]. Use for ranked lists where labels are long (e.g. 'Top 10 customers by ARR'). Height auto-sizes from row count.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(640).optional(),
    }),
  },

  LineChart: {
    description:
      "Time-series line. data is [{label, value}, ...]. Use for trends where you want the direction of change to be the main signal.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  DonutChart: {
    description:
      "Donut / segment chart. data is [{label, value}, ...]. Use for share-of-total breakdowns with 3-6 slices.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  PieChart: {
    description: "Traditional pie chart for share-of-total breakdowns.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  AreaChart: {
    description: "Area chart for showing volume or magnitude over time.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  RadarChart: {
    description: "Radar chart for multi-variable comparison.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  RadialChart: {
    description: "Radial bar chart for comparing categories in a circular format.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  WaterfallChart: {
    description: "Shows cumulative effect of sequential values.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  RiskGauge: {
    description: "Gauge to display a bounded score or risk level.",
    props: z.object({
      label: stringOrPath.optional(),
      value: z.number(),
      riskLevel: z.enum(["low", "medium", "high"]).optional(),
      description: stringOrPath.optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
  },

  ScatterChart: {
    description:
      "X/Y scatter plot for correlation questions. data is [{x: number, y: number, label?: string}]. Use when the user asks 'is X correlated with Y' or 'plot A against B'. Provide xLabel and yLabel so the user knows what each axis represents.",
    props: z.object({
      data: z.union([
        z.array(
          z.object({
            x: z.number(),
            y: z.number(),
            label: z.string().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
      xLabel: z.string().optional(),
      yLabel: z.string().optional(),
      height: z.number().int().min(160).max(560).optional(),
    }),
  },

  DataTable: {
    description:
      "Rows x columns table. columns is a list of {key, label}; rows is a list of records keyed by column key.",
    props: z.object({
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(["left", "right"]).optional(),
        }),
      ),
      rows: z.union([
        z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
        z.object({ path: z.string() }),
      ]),
    }),
  },

  Button: {
    description:
      "Action button. Variant 'primary' is the main CTA. 'default' is standard. 'borderless' has no background.",
    props: z.object({
      child: childRef,
      variant: z.enum(["default", "primary", "borderless"]).optional(),
      action: z.union([
        z.object({
          event: z.object({
            name: z.string(),
            context: z.record(z.string(), z.unknown()).optional(),
          }),
        }),
        z.object({
          functionCall: z.object({
            call: z.string(),
            args: z.record(z.string(), z.unknown()).optional(),
            returnType: z.string().optional(),
          }),
        }),
      ]),
      checks: z
        .array(
          z.object({
            condition: z.any(),
            message: z.string(),
          })
        )
        .optional(),
    }),
  },

  ChoiceChips: {
    description:
      "Horizontal pills bound to a data-model path. Use for scope filters and quick switches.",
    props: z.object({
      label: z.string(),
      options: z.union([
        z.array(z.object({ label: z.string(), value: z.string() })),
        z.object({ path: z.string() }),
      ]),
      value: z.object({ path: z.string() }),
      multi: z.boolean().optional(),
    }),
  },

  ReportGenerationCard: {
    description: "Displays the status and link to the newly generated report.",
    props: z.object({
      report_id: z.string().optional(),
      report_name: z.string().optional(),
      blob_url: z.string().optional(),
      generated_at: z.string().optional(),
      status: z.string().optional(),
      message: z.string().optional(),
    }),
  },
};

export type Definitions = typeof definitions;
