import { z } from "zod";

/**
 * Schemas mirror the upstream data repo (vivekyarla/compute-deal-map-data).
 * companies.yml is an array of Company; deals/*.yml is one Deal per file.
 * Kept permissive (optional fields) so a schema drift in the data repo
 * degrades gracefully instead of failing the whole build.
 */

export const CompanySchema = z.object({
  slug: z.string(),
  name: z.string(),
  ticker: z.string().nullable().optional(),
  category: z.string(),
  subline: z.string().optional(),
  acquired: z.boolean().optional(),
});
export type Company = z.infer<typeof CompanySchema>;

// Helper: many string fields in the data repo are sometimes literally `null`
// (not just absent), so accept both null and undefined.
const nullableString = z.string().nullable().optional();

export const DealSchema = z.object({
  id: z.string(),
  source_slug: z.string(),
  source_name: nullableString,
  target_slug: z.string(),
  target_name: nullableString,
  deal_type: z.string(),
  value_billions: z.number().nullable().optional(),
  value_display: nullableString,
  date: nullableString,
  date_display: nullableString,
  description: nullableString,
  source_url: nullableString,
});
export type Deal = z.infer<typeof DealSchema>;
