import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flattened = result.error.flatten();
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Les données reçues sont invalides.',
      details: flattened,
      fieldErrors: flattened.fieldErrors,
    });
  }
  return result.data;
}
