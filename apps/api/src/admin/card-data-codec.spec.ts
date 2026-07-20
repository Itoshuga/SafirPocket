import { safirCardImportItemSchema } from '@safir/validation';
import { describe, expect, it } from 'vitest';
import {
  CardDataCodecError,
  parseCardImport,
  safeSpreadsheetText,
  stringifyCardsCsv,
  stringifyCardsJson,
} from './card-data-codec.js';

const validCard = {
  name: 'Éraimel du néant',
  number: 46,
  attack: 4,
  defense: 4,
  value: 3,
  description: '|En jeu| : votre adversaire perd 1 PI.',
  imageUrl: 'https://example.com/card.png',
  isCommander: false,
  rarity: { slug: 'rare', name: 'Rare' },
  season: { slug: 'origines', name: 'Origines' },
  types: [
    { slug: 'neant', name: 'Néant' },
    { slug: 'creature', name: 'Créature' },
  ],
  isActive: true,
  metadata: {},
};

function parseJson(value: unknown, maxRows = 5_000) {
  return parseCardImport(Buffer.from(JSON.stringify(value)), 'JSON', maxRows);
}

describe('card data JSON codec', () => {
  it('accepts the versioned document and a simple array', () => {
    expect(parseJson({ format: 'safir-cards', version: 1, cards: [validCard] })[0]?.value).toEqual(
      validCard,
    );
    expect(parseJson([validCard])[0]?.value).toEqual(validCard);
  });

  it.each([
    [Buffer.from('{'), 'CARD_IMPORT_INVALID_JSON'],
    [Buffer.from(''), 'CARD_IMPORT_EMPTY'],
    [
      Buffer.from(JSON.stringify({ format: 'safir-cards', version: 2, cards: [] })),
      'CARD_IMPORT_VERSION_UNSUPPORTED',
    ],
  ])('rejects an invalid JSON document', (buffer, code) => {
    expect(() => parseCardImport(buffer, 'JSON', 5_000)).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it('enforces the configured row limit', () => {
    expect(() => parseJson([validCard, validCard], 1)).toThrowError(
      expect.objectContaining({ code: 'CARD_IMPORT_TOO_MANY_ROWS' }),
    );
  });

  it('writes a valid versioned export', () => {
    const output = JSON.parse(stringifyCardsJson([validCard], new Date(0).toISOString()));
    expect(output).toMatchObject({ format: 'safir-cards', version: 1, cards: [validCard] });
  });
});

describe('card data CSV codec', () => {
  it('handles BOM, accents, quoted delimiters, line breaks and multiple types', () => {
    const csv =
      '\uFEFFname;number;attack;defense;value;description;imageUrl;isCommander;raritySlug;rarityName;seasonSlug;seasonName;typeSlugs;typeNames;isActive;metadata\r\n' +
      '"Éraimel; du néant";46;4;4;3;"Première ligne\nSeconde ligne";https://example.com/card.png;false;rare;Rare;origines;Origines;"neant|creature";"Néant|Créature";true;"{}"\r\n';

    const parsed = parseCardImport(Buffer.from(csv), 'CSV', 5_000)[0]!;
    expect(parsed.errors).toEqual([]);
    expect(parsed.value).toMatchObject({
      name: 'Éraimel; du néant',
      description: 'Première ligne\nSeconde ligne',
      types: [
        { slug: 'neant', name: 'Néant' },
        { slug: 'creature', name: 'Créature' },
      ],
    });
    expect(safirCardImportItemSchema.safeParse(parsed.value).success).toBe(true);
  });

  it('supports the documented snake_case aliases', () => {
    const csv =
      'name;number;attack;defense;value;image_url;is_commander;rarity_slug;season_slug;type_slugs\n' +
      'Carte;1;1;1;1;;false;rare;origines;creature\n';
    expect(parseCardImport(Buffer.from(csv), 'CSV', 5_000)[0]?.value).toMatchObject({
      imageUrl: null,
      isCommander: 'false',
      rarity: { slug: 'rare' },
      season: { slug: 'origines' },
      types: [{ slug: 'creature' }],
    });
  });

  it('rejects a missing required column', () => {
    expect(() => parseCardImport(Buffer.from('name;number\nCarte;1\n'), 'CSV', 5_000)).toThrowError(
      expect.objectContaining({ code: 'CARD_IMPORT_INVALID_CSV' }),
    );
  });

  it('reports invalid metadata without exposing the parser error', () => {
    const csv =
      'name;number;attack;defense;value;isCommander;raritySlug;seasonSlug;typeSlugs;metadata\n' +
      'Carte;1;1;1;1;false;rare;origines;creature;"{"\n';
    const parsed = parseCardImport(Buffer.from(csv), 'CSV', 5_000)[0]!;
    expect(parsed.errors).toEqual([
      expect.objectContaining({ field: 'metadata', code: 'CARD_IMPORT_VALIDATION_FAILED' }),
    ]);
  });

  it.each(['yes', '1', 'FALSEE'])(
    'leaves an invalid boolean for shared validation: %s',
    (value) => {
      const csv =
        'name;number;attack;defense;value;isCommander;raritySlug;seasonSlug;typeSlugs\n' +
        `Carte;1;1;1;1;${value};rare;origines;creature\n`;
      const parsed = parseCardImport(Buffer.from(csv), 'CSV', 5_000)[0]!;
      expect(safirCardImportItemSchema.safeParse(parsed.value).success).toBe(false);
    },
  );

  it('neutralizes spreadsheet formulas in text columns', () => {
    expect(safeSpreadsheetText('=HYPERLINK("https://example.com")')).toMatch(/^'/);
    const csv = stringifyCardsCsv([{ ...validCard, name: '=2+2' }]);
    expect(csv).toContain("'=2+2");
  });
});

describe('CardDataCodecError', () => {
  it('does not expose implementation details', () => {
    const error = new CardDataCodecError('CARD_IMPORT_INVALID_CSV', 'CSV invalide');
    expect(error).toMatchObject({ name: 'CardDataCodecError', code: 'CARD_IMPORT_INVALID_CSV' });
  });
});
