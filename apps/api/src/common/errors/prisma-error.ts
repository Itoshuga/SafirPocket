import { ConflictException } from '@nestjs/common';

interface PrismaLikeError {
  code?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface UniqueConstraintMapping {
  matches: string[];
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

function errorSearchText(error: PrismaLikeError): string {
  const target = error.meta?.target;
  const constraint = error.meta?.constraint;
  return [
    error.message,
    typeof target === 'string' ? target : Array.isArray(target) ? target.join(' ') : '',
    typeof constraint === 'string' ? constraint : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function rethrowPrismaConstraint(
  error: unknown,
  uniqueMappings: UniqueConstraintMapping[] = [],
): never {
  const prismaError = error as PrismaLikeError;
  const searchText = errorSearchText(prismaError);

  if (prismaError.code === 'P2002' || searchText.includes('unique constraint')) {
    const mapping = uniqueMappings.find(({ matches }) =>
      matches.some((match) => searchText.includes(match.toLowerCase())),
    );
    if (mapping) {
      throw new ConflictException({
        code: mapping.code,
        message: mapping.message,
        ...(mapping.fieldErrors ? { fieldErrors: mapping.fieldErrors } : {}),
      });
    }
    throw new ConflictException({
      code: 'DATABASE_CONSTRAINT_ERROR',
      message: 'Une valeur existe déjà pour cette ressource.',
    });
  }

  if (['P2003', 'P2004', 'P2011', 'P2012', 'P2023'].includes(prismaError.code ?? '')) {
    throw new ConflictException({
      code: 'DATABASE_CONSTRAINT_ERROR',
      message: "L'opération ne respecte pas une contrainte de données.",
    });
  }

  throw error;
}
