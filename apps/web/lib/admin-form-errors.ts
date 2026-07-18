import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { z } from 'zod';
import { ApiClientError } from './api-client';

export class AdminFormValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string[]>) {
    super('Certains champs sont invalides.');
    this.name = 'AdminFormValidationError';
  }
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((errors, issue) => {
    const field = String(issue.path[0] ?? 'root');
    errors[field] = [...(errors[field] ?? []), issue.message];
    return errors;
  }, {});
}

export function mutationFieldErrors(error: unknown): Record<string, string[]> {
  if (error instanceof AdminFormValidationError) return error.fieldErrors;
  if (error instanceof ApiClientError) return error.fieldErrors ?? {};
  return {};
}

export function mutationErrorMessage(error: unknown): string {
  if (error instanceof AdminFormValidationError) return error.message;
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'SESSION_EXPIRED':
      case 'UNAUTHORIZED':
        return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
      case 'INSUFFICIENT_PERMISSIONS':
        return "Vous n'avez pas la permission d'effectuer cette action.";
      case 'NETWORK_ERROR':
        return "L'API est momentanément inaccessible. Vérifiez les serveurs puis réessayez.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "L'opération n'a pas pu être effectuée.";
}

export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): void {
  const errors = mutationFieldErrors(error);
  for (const [field, messages] of Object.entries(errors)) {
    if (field !== 'root' && messages[0]) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
    }
  }
  setError('root' as Path<T>, { type: 'server', message: mutationErrorMessage(error) });
}
