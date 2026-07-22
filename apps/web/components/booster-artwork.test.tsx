import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TransparentBoosterArtwork } from './booster-artwork';

function renderArtwork(imageUrl: string | null) {
  return renderToStaticMarkup(
    createElement(TransparentBoosterArtwork, {
      imageUrl,
      name: 'Origines',
      priority: true,
    }),
  );
}

describe('TransparentBoosterArtwork', () => {
  it.each([
    'https://example.com/transparent-booster.png',
    'https://example.com/transparent-booster-with-margins.png',
    'https://project.supabase.co/storage/v1/object/public/booster-designs/user/booster.png',
  ])('preserves transparent remote artwork for %s', (imageUrl) => {
    const html = renderArtwork(imageUrl);

    expect(html).toContain('data-testid="transparent-booster-artwork"');
    expect(html).toContain('bg-transparent');
    expect(html).toContain('object-contain');
    expect(html).not.toContain('data-testid="booster-artwork-fallback"');
    expect(html).not.toContain('bg-surface-muted');
  });

  it('shows the neutral surface only when the artwork is missing', () => {
    const html = renderArtwork(null);

    expect(html).toContain('data-image-state="missing"');
    expect(html).toContain('data-testid="booster-artwork-fallback"');
    expect(html).toContain('bg-surface-muted');
    expect(html).not.toContain('<img');
  });
});
