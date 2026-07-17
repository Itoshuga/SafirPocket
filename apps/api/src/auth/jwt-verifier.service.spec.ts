import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtVerifierService } from './jwt-verifier.service.js';

describe('JwtVerifierService', () => {
  it('rejects a malformed token without exposing token contents', async () => {
    const config = { getOrThrow: () => 'https://example.supabase.co' };
    const service = new JwtVerifierService(config as never);
    await expect(service.verify('definitely-not-a-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
