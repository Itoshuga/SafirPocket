import { z } from 'zod';

export const idSchema = z.uuid();

export const appRoleSchema = z.enum(['USER', 'PIONEER', 'MODERATOR', 'ADMINISTRATOR']);
export const accountStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']);
export const profileVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.")
  .max(24, "Le nom d'utilisateur ne peut pas dépasser 24 caractères.")
  .regex(
    /^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$/,
    'Utilisez uniquement lettres, chiffres, tirets bas et tirets, sans tiret aux extrémités.',
  );

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

const nullableTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const signupSchema = credentialsSchema
  .extend({
    username: usernameSchema,
    confirmPassword: z.string().min(8).max(128),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export const usernameAvailabilityQuerySchema = z.object({ username: usernameSchema });

export const profileUpdateSchema = z
  .object({
    username: usernameSchema,
    displayName: nullableTrimmedString(50),
    bio: nullableTrimmedString(300),
    avatarUrl: nullableTrimmedString(2048),
  })
  .partial()
  .strict();

export const userPreferencesUpdateSchema = z
  .object({
    profileVisibility: profileVisibilitySchema,
    allowFriendRequests: z.boolean(),
    appearInUserSearch: z.boolean(),
    showOnlineStatus: z.boolean(),
    showCollectionStats: z.boolean(),
    showGameStats: z.boolean(),
    emailNotifications: z.boolean(),
    friendRequestNotifications: z.boolean(),
    friendAcceptanceNotifications: z.boolean(),
    gameInviteNotifications: z.boolean(),
    gameNewsNotifications: z.boolean(),
    marketingEmails: z.boolean(),
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Aucune préférence à enregistrer.',
  });

export const userSearchQuerySchema = z.object({
  query: z.string().trim().min(2, 'Saisissez au moins 2 caractères.').max(50),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const friendActionSchema = z.object({}).strict();

const reauthenticationNonceSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Saisissez le code de réauthentification à 6 chiffres.');

const strongPasswordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
  .max(128)
  .regex(/[a-z]/, 'Ajoutez une lettre minuscule.')
  .regex(/[A-Z]/, 'Ajoutez une lettre majuscule.')
  .regex(/[0-9]/, 'Ajoutez un chiffre.')
  .regex(/[^A-Za-z0-9]/, 'Ajoutez un caractère spécial.');

export const accountEmailUpdateSchema = z
  .object({
    email: z.email('Saisissez une adresse e-mail valide.').trim().max(320),
    reauthenticationNonce: reauthenticationNonceSchema,
  })
  .strict();

export const accountPasswordUpdateSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().max(128),
    reauthenticationNonce: reauthenticationNonceSchema,
  })
  .strict()
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export const accountReauthenticationSchema = z.object({}).strict();

export const accountSessionsRevokeSchema = z.object({ confirmation: z.literal(true) }).strict();

export const accountDeactivateSchema = z
  .object({
    confirmationUsername: usernameSchema,
    confirmed: z.literal(true),
  })
  .strict();

export const accountReactivateSchema = z
  .object({ confirmationUsername: usernameSchema, confirmed: z.literal(true) })
  .strict();

export const accountDeletionRequestSchema = z
  .object({
    confirmationUsername: usernameSchema,
    confirmed: z.literal(true),
    reason: nullableTrimmedString(500),
  })
  .strict();

export const accountDeletionCancelSchema = z
  .object({ confirmationUsername: usernameSchema, confirmed: z.literal(true) })
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

const optionalDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Utilisez une date au format AAAA-MM-JJ.',
  )
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
    'Cette date est invalide.',
  )
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const nullableDescriptionSchema = z.string().trim().max(5000).nullable().optional();
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Le slug doit utiliser des minuscules et des tirets.');
const displayColorSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^#[0-9A-Fa-f]{6}$/.test(value),
    'Utilisez une couleur hexadécimale complète.',
  )
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();
const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === '') return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Utilisez une URL HTTPS valide.')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const adminUsersQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  role: appRoleSchema.optional(),
  status: accountStatusSchema.optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'username', '-username', 'lastLoginAt', '-lastLoginAt'])
    .default('-createdAt'),
});

export const moderationSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    internalNote: nullableTrimmedString(2000),
    suspendedUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export const roleChangeSchema = z
  .object({
    role: appRoleSchema,
    reason: z.string().trim().min(3).max(500),
    internalNote: nullableTrimmedString(2000),
    confirmationUsername: z.string().trim().max(24).optional(),
  })
  .strict();

export const banSchema = moderationSchema
  .safeExtend({ confirmationUsername: usernameSchema })
  .strict();

export const adminUserProfileUpdateSchema = profileUpdateSchema.refine(
  (input) => Object.keys(input).length > 0,
  { message: 'Aucune modification à enregistrer.' },
);

export const adminUserEmailUpdateSchema = z
  .object({ email: z.email('Saisissez une adresse e-mail valide.').trim().max(320) })
  .strict();

export const passwordResetEmailSchema = z.object({}).strict();

export const temporaryPasswordSchema = z
  .object({
    temporaryPassword: z
      .string()
      .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
      .max(128)
      .regex(/[a-z]/, 'Ajoutez une lettre minuscule.')
      .regex(/[A-Z]/, 'Ajoutez une lettre majuscule.')
      .regex(/[0-9]/, 'Ajoutez un chiffre.')
      .regex(/[^A-Za-z0-9]/, 'Ajoutez un caractère spécial.'),
    confirmationUsername: usernameSchema,
  })
  .strict();

export const warningSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const warningCreateSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    internalNote: nullableTrimmedString(2000),
    severity: warningSeveritySchema,
  })
  .strict();

export const warningRevokeSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    internalNote: nullableTrimmedString(2000),
  })
  .strict();

export const warningHistoryQuerySchema = z.object({
  status: z.enum(['active', 'revoked', 'all']).default('all'),
});

export const adminCardsQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  seasonId: idSchema.optional(),
  rarityId: idSchema.optional(),
  typeId: idSchema.optional(),
  isCommander: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  archived: z.enum(['active', 'archived', 'all']).default('active'),
  sort: z.enum(['number', '-number', 'name', '-name', 'updatedAt', '-updatedAt']).default('number'),
});

const cardInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    number: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    attack: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    defense: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    description: nullableDescriptionSchema,
    imageUrl: httpsUrlSchema,
    isCommander: z.boolean(),
    rarityId: idSchema,
    seasonId: idSchema,
    typeIds: z.array(idSchema).min(1, 'Sélectionnez au moins un type.').max(20),
    isActive: z.boolean(),
  })
  .strict();

function rejectDuplicateTypes(typeIds: string[] | undefined, context: z.RefinementCtx): void {
  if (typeIds && new Set(typeIds).size !== typeIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['typeIds'],
      message: 'Un type est sélectionné plusieurs fois.',
    });
  }
}

export const createCardSchema = cardInputSchema.superRefine(({ typeIds }, context) => {
  rejectDuplicateTypes(typeIds, context);
});

export const updateCardSchema = cardInputSchema
  .partial()
  .superRefine(({ typeIds }, context) => rejectDuplicateTypes(typeIds, context));

const taxonomyBaseSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: slugSchema,
    description: nullableTrimmedString(2000),
    displayColor: displayColorSchema,
    sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const createRaritySchema = taxonomyBaseSchema;
export const updateRaritySchema = taxonomyBaseSchema.partial().strict();
export const createCardTypeSchema = taxonomyBaseSchema;
export const updateCardTypeSchema = taxonomyBaseSchema.partial().strict();

const seasonInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slugSchema,
    code: nullableTrimmedString(24),
    description: nullableTrimmedString(2000),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
    sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

const seasonDatesAreValid = ({
  startDate,
  endDate,
}: {
  startDate?: string | null;
  endDate?: string | null;
}) => !startDate || !endDate || new Date(endDate) > new Date(startDate);

const seasonDateError = {
  path: ['endDate'],
  message: 'La date de fin doit être postérieure à la date de début.',
};

export const createSeasonSchema = seasonInputSchema.refine(seasonDatesAreValid, seasonDateError);
export const updateSeasonSchema = seasonInputSchema
  .partial()
  .refine(seasonDatesAreValid, seasonDateError);

export const adminTaxonomyQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  archived: z.enum(['active', 'archived', 'all']).default('active'),
});

export const adminAuditQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  entityType: z.string().trim().max(80).optional(),
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

const boosterDropRateEntrySchema = z
  .object({
    rarityId: idSchema,
    dropRateBps: z.coerce.number().int().min(1).max(10_000),
    sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  })
  .strict();

function validateDropRates(
  dropRates: Array<{ rarityId: string; dropRateBps: number }> | undefined,
  commonRarityId: string | undefined,
  context: z.RefinementCtx,
): void {
  if (!dropRates) return;
  if (new Set(dropRates.map(({ rarityId }) => rarityId)).size !== dropRates.length) {
    context.addIssue({
      code: 'custom',
      path: ['dropRates'],
      message: 'Une rareté premium ne peut apparaître qu’une fois.',
    });
  }
  if (commonRarityId && dropRates.some(({ rarityId }) => rarityId === commonRarityId)) {
    context.addIssue({
      code: 'custom',
      path: ['dropRates'],
      message: 'La rareté commune garantie ne peut pas être premium.',
    });
  }
  if (dropRates.reduce((total, rate) => total + rate.dropRateBps, 0) !== 10_000) {
    context.addIssue({
      code: 'custom',
      path: ['dropRates'],
      message: 'Le total des taux doit être exactement égal à 100 %.',
    });
  }
}

const optionalDateTimeSchema = z
  .string()
  .trim()
  .max(50)
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(value)),
    'Saisissez une date et une heure valides.',
  )
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const boosterInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Le slug doit utiliser des minuscules et des tirets.'),
    description: nullableTrimmedString(5000),
    imageUrl: httpsUrlSchema,
    seasonId: idSchema,
    guaranteedCommonRarityId: idSchema,
    costAmount: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    currencyCode: nullableTrimmedString(50),
    availableFrom: optionalDateTimeSchema,
    availableUntil: optionalDateTimeSchema,
    sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
    isActive: z.boolean().default(false),
    dropRates: z.array(boosterDropRateEntrySchema).min(1).max(100),
  })
  .strict();

function validateBoosterInput(
  input: {
    guaranteedCommonRarityId?: string;
    costAmount?: number;
    currencyCode?: string | null;
    availableFrom?: string | null;
    availableUntil?: string | null;
    dropRates?: Array<{ rarityId: string; dropRateBps: number }>;
  },
  context: z.RefinementCtx,
): void {
  validateDropRates(input.dropRates, input.guaranteedCommonRarityId, context);
  if (input.costAmount && !input.currencyCode) {
    context.addIssue({
      code: 'custom',
      path: ['currencyCode'],
      message: 'Une monnaie est requise pour un booster payant.',
    });
  }
  if (
    input.availableFrom &&
    input.availableUntil &&
    new Date(input.availableUntil) <= new Date(input.availableFrom)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['availableUntil'],
      message: 'La date de fin doit être postérieure à la date de début.',
    });
  }
}

export const createBoosterSchema = boosterInputSchema.superRefine(validateBoosterInput);
export const updateBoosterSchema = boosterInputSchema.partial().superRefine(validateBoosterInput);
export const updateBoosterDropRatesSchema = z
  .object({ dropRates: z.array(boosterDropRateEntrySchema).min(1).max(100) })
  .strict()
  .superRefine(({ dropRates }, context) => validateDropRates(dropRates, undefined, context));

export const adminBoostersQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  seasonId: idSchema.optional(),
  archived: z.enum(['active', 'archived', 'all']).default('active'),
  active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', '-name', 'updatedAt', '-updatedAt', 'sortOrder']).default('sortOrder'),
});

export const packOpeningsQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const openBoosterSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const boosterOpenSchema = openBoosterSchema;

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
export type SignupInput = z.infer<typeof signupSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
export type BanInput = z.infer<typeof banSchema>;
export type RoleChangeInput = z.infer<typeof roleChangeSchema>;
export type AdminUserProfileUpdateInput = z.infer<typeof adminUserProfileUpdateSchema>;
export type AdminUserEmailUpdateInput = z.infer<typeof adminUserEmailUpdateSchema>;
export type TemporaryPasswordInput = z.infer<typeof temporaryPasswordSchema>;
export type WarningCreateInput = z.infer<typeof warningCreateSchema>;
export type WarningRevokeInput = z.infer<typeof warningRevokeSchema>;
export type WarningHistoryQuery = z.infer<typeof warningHistoryQuerySchema>;
export type AdminCardsQuery = z.infer<typeof adminCardsQuerySchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type CreateCardFormInput = z.input<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CreateRarityInput = z.infer<typeof createRaritySchema>;
export type UpdateRarityInput = z.infer<typeof updateRaritySchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type CreateCardTypeInput = z.infer<typeof createCardTypeSchema>;
export type UpdateCardTypeInput = z.infer<typeof updateCardTypeSchema>;
export type AdminTaxonomyQuery = z.infer<typeof adminTaxonomyQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
export type DeckUpdateInput = z.infer<typeof deckUpdateSchema>;
export type DeckCardInput = z.infer<typeof deckCardSchema>;
export type CreateBoosterInput = z.infer<typeof createBoosterSchema>;
export type CreateBoosterFormInput = z.input<typeof createBoosterSchema>;
export type UpdateBoosterInput = z.infer<typeof updateBoosterSchema>;
export type UpdateBoosterDropRatesInput = z.infer<typeof updateBoosterDropRatesSchema>;
export type AdminBoostersQuery = z.infer<typeof adminBoostersQuerySchema>;
export type PackOpeningsQuery = z.infer<typeof packOpeningsQuerySchema>;
export type OpenBoosterInput = z.infer<typeof openBoosterSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserPreferencesUpdateInput = z.infer<typeof userPreferencesUpdateSchema>;
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;
export type AccountEmailUpdateInput = z.infer<typeof accountEmailUpdateSchema>;
export type AccountPasswordUpdateInput = z.infer<typeof accountPasswordUpdateSchema>;
export type AccountDeactivateInput = z.infer<typeof accountDeactivateSchema>;
export type AccountReactivateInput = z.infer<typeof accountReactivateSchema>;
export type AccountDeletionRequestInput = z.infer<typeof accountDeletionRequestSchema>;
export type AccountDeletionCancelInput = z.infer<typeof accountDeletionCancelSchema>;
