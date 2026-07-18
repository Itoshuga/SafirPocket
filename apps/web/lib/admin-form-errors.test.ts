import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-client';
import { mutationErrorMessage, mutationFieldErrors } from './admin-form-errors';

describe('administration form errors', () => {
  it('keeps backend field errors attached to their controls', () => {
    const error = new ApiClientError(409, 'SEASON_ALREADY_EXISTS', 'Slug déjà utilisé.', {
      slug: ['Ce slug est déjà utilisé.'],
    });
    expect(mutationFieldErrors(error)).toEqual({ slug: ['Ce slug est déjà utilisé.'] });
    expect(mutationErrorMessage(error)).toBe('Slug déjà utilisé.');
  });

  it('turns auth, permission and network failures into actionable messages', () => {
    expect(mutationErrorMessage(new ApiClientError(401, 'SESSION_EXPIRED', 'expired'))).toContain(
      'Reconnectez-vous',
    );
    expect(
      mutationErrorMessage(new ApiClientError(403, 'INSUFFICIENT_PERMISSIONS', 'forbidden')),
    ).toContain('permission');
    expect(mutationErrorMessage(new ApiClientError(0, 'NETWORK_ERROR', 'offline'))).toContain(
      'inaccessible',
    );
  });
});
