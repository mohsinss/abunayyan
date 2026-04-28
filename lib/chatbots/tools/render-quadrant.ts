import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const QuadrantSchema = z.object({
  title: z.string().min(1).max(90),
  description: z.string().max(140).optional(),
  xAxis: z.object({
    label: z.string().max(30),
    unit: z.string().max(8).optional(),
    threshold: z.number(),
  }),
  yAxis: z.object({
    label: z.string().max(30),
    unit: z.string().max(8).optional(),
    threshold: z.number(),
  }),
  quadrants: z
    .object({
      tl: z.string().max(30).optional(),
      tr: z.string().max(30).optional(),
      bl: z.string().max(30).optional(),
      br: z.string().max(30).optional(),
    })
    .optional(),
  points: z
    .array(
      z.object({
        label: z.string().max(24),
        x: z.number(),
        y: z.number(),
        tone: z.enum(["good", "bad", "warn", "neutral"]).optional(),
        size: z.number().min(2).max(20).optional(),
      }),
    )
    .min(1)
    .max(40),
});

const description =
  "Render a 2-axis scatter with labeled quadrants. Use for portfolio views like " +
  "'Strong/Weak vs Heavy/Light' or 'Optimise/Restructure vs Hold/Divest'. Pass " +
  "x-axis and y-axis labels + threshold values; the chart draws dividing lines " +
  "at the thresholds and renders the quadrant labels in the corners.";

export const renderQuadrant: ToolDefinition = {
  id: "renderQuadrant",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: QuadrantSchema,
      execute: async (args) => args,
    }),
};

export type QuadrantArgs = z.infer<typeof QuadrantSchema>;
