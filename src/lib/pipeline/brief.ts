import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  imageFile: z.string().optional(), // uploaded filename
  imageUrl: z.string().url().optional(),
});

export const BriefSchema = z.object({
  campaignId: z.string().min(1),
  targetRegion: z.string().min(1),
  audience: z.string().min(1),
  locales: z.array(z.string()).nonempty(),
  // Require a default message, allow any other locale keys as strings
  message: z
    .object({ default: z.string().min(1) })
    .catchall(z.string().min(1)),
  // Optional legal disclaimer rendered smaller under the message
  disclaimer: z.string().optional(),
  outputFormat: z.enum(['png', 'jpeg']).optional().default('png'),
  products: z.array(ProductSchema).min(2),
});

export type Brief = z.infer<typeof BriefSchema>;
export type Product = z.infer<typeof ProductSchema>;

export function parseBrief(json: unknown): Brief {
  const parsed = BriefSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid brief: ' + parsed.error.message);
  }
  return parsed.data;
}
