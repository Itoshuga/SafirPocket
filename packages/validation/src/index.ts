import { z } from 'zod';

export const idSchema = z.uuid();

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/),
    displayName: z.string().trim().min(1).max(80).nullable(),
    bio: z.string().trim().max(500).nullable(),
    avatarPath: z.string().trim().max(500).nullable(),
  })
  .partial()
  .strict();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export const cardFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  set: z.string().trim().max(80).optional(),
  rarity: z.string().trim().max(50).optional(),
  type: z.string().trim().max(50).optional(),
  sort: z.enum(['name', '-name', 'number', '-createdAt']).default('number'),
});

export const collectionFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  set: z.string().trim().max(80).optional(),
  rarity: z.string().trim().max(50).optional(),
  sort: z.enum(['recent', 'name', '-quantity']).default('recent'),
});

export const rankingsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const deckCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
  format: z.string().trim().min(1).max(50).default('open'),
  metadata: z.record(z.string(), z.json()).default({}),
});

export const deckUpdateSchema = deckCreateSchema.partial().strict();

export const deckCardSchema = z.object({
  cardVariantId: idSchema,
  quantity: z.number().int().min(1).max(999),
});

export const boosterOpenSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export const queueJoinSchema = z.object({
  format: z.string().trim().min(1).max(50),
  deckId: idSchema,
});

export const queueLeaveSchema = z.object({
  format: z.string().trim().min(1).max(50),
});

export const matchReferenceSchema = z.object({ matchId: idSchema });
export const matchReadySchema = matchReferenceSchema;
export const matchResyncSchema = matchReferenceSchema.extend({
  lastSequence: z.number().int().min(0),
});

export const matchActionIntentSchema = z.object({
  actionId: z.string().uuid(),
  matchId: idSchema,
  expectedSequence: z.number().int().min(0),
  type: z.enum(['PASS_PRIORITY', 'PLAY_CARD', 'TECHNICAL_DRAW']),
  payload: z.record(z.string(), z.unknown()),
});

export type CardFilters = z.infer<typeof cardFiltersSchema>;
export type CollectionFilters = z.infer<typeof collectionFiltersSchema>;
export type RankingsQuery = z.infer<typeof rankingsQuerySchema>;
export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
export type DeckUpdateInput = z.infer<typeof deckUpdateSchema>;
export type DeckCardInput = z.infer<typeof deckCardSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
