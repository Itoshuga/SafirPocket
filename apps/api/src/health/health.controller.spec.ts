import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns a healthy API payload', () => {
    const result = new HealthController().getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('safir-pocket-api');
    expect(Date.parse(result.timestamp)).not.toBeNaN();
  });
});
