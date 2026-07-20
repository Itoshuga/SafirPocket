import type {
  CardImportError,
  CardImportFormat,
  SafirCardExportFile,
  SafirCardExportItem,
} from '@safir/shared-types';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export const CARD_CSV_COLUMNS = [
  'name',
  'number',
  'attack',
  'defense',
  'value',
  'description',
  'imageUrl',
  'isCommander',
  'raritySlug',
  'rarityName',
  'seasonSlug',
  'seasonName',
  'typeSlugs',
  'typeNames',
  'isActive',
  'metadata',
] as const;

const requiredCsvColumns = [
  'name',
  'number',
  'attack',
  'defense',
  'value',
  'isCommander',
  'raritySlug',
  'seasonSlug',
  'typeSlugs',
] as const;

const csvAliases: Readonly<Record<string, (typeof CARD_CSV_COLUMNS)[number]>> = {
  image_url: 'imageUrl',
  is_commander: 'isCommander',
  rarity_slug: 'raritySlug',
  season_slug: 'seasonSlug',
  type_slugs: 'typeSlugs',
};

export interface ParsedCardImportRow {
  row: number;
  value: unknown;
  errors: CardImportError[];
}

export class CardDataCodecError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CardDataCodecError';
  }
}

export function parseCardImport(
  buffer: Buffer,
  format: CardImportFormat,
  maxRows: number,
): ParsedCardImportRow[] {
  if (buffer.length === 0) {
    throw new CardDataCodecError('CARD_IMPORT_EMPTY', "Le fichier d'import est vide.");
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new CardDataCodecError(
      `CARD_IMPORT_INVALID_${format}`,
      'Le fichier doit utiliser un encodage UTF-8 valide.',
    );
  }
  if (!text.trim()) {
    throw new CardDataCodecError('CARD_IMPORT_EMPTY', "Le fichier d'import est vide.");
  }
  return format === 'JSON' ? parseJson(text, maxRows) : parseCsv(text, maxRows);
}

function parseJson(text: string, maxRows: number): ParsedCardImportRow[] {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new CardDataCodecError('CARD_IMPORT_INVALID_JSON', 'Le fichier JSON est invalide.');
  }
  let cards: unknown[];
  if (Array.isArray(document)) {
    cards = document;
  } else if (document && typeof document === 'object') {
    const envelope = document as Record<string, unknown>;
    if (envelope.format !== 'safir-cards') {
      throw new CardDataCodecError(
        'CARD_IMPORT_INVALID_JSON',
        'Le document JSON doit utiliser le format « safir-cards ».',
      );
    }
    if (envelope.version !== 1) {
      throw new CardDataCodecError(
        'CARD_IMPORT_VERSION_UNSUPPORTED',
        "Cette version du format d'import n'est pas prise en charge.",
        { receivedVersion: envelope.version, supportedVersions: [1] },
      );
    }
    if (!Array.isArray(envelope.cards)) {
      throw new CardDataCodecError(
        'CARD_IMPORT_INVALID_JSON',
        'La propriété cards doit être un tableau.',
      );
    }
    cards = envelope.cards;
  } else {
    throw new CardDataCodecError(
      'CARD_IMPORT_INVALID_JSON',
      'Le document JSON doit être un tableau ou un objet versionné.',
    );
  }
  assertRowCount(cards.length, maxRows);
  return cards.map((value, index) => ({ row: index + 1, value, errors: [] }));
}

function parseCsv(text: string, maxRows: number): ParsedCardImportRow[] {
  let records: Array<{ record: Record<string, string>; info: { lines: number } }>;
  try {
    records = parse(text, {
      bom: true,
      columns: (headers: string[]) => normalizeHeaders(headers),
      delimiter: ';',
      info: true,
      relax_column_count: false,
      skip_empty_lines: true,
    }) as Array<{ record: Record<string, string>; info: { lines: number } }>;
  } catch (error) {
    if (error instanceof CardDataCodecError) throw error;
    throw new CardDataCodecError('CARD_IMPORT_INVALID_CSV', 'Le fichier CSV est invalide.');
  }
  assertRowCount(records.length, maxRows);
  return records.map(({ record, info }, index) =>
    normalizeCsvRecord(record, info.lines || index + 2),
  );
}

function normalizeHeaders(headers: string[]): string[] {
  const normalized = headers.map((header) => {
    const value = header.replace(/^\uFEFF/, '').trim();
    return csvAliases[value] ?? value;
  });
  const duplicates = normalized.filter((header, index) => normalized.indexOf(header) !== index);
  if (duplicates.length) {
    throw new CardDataCodecError(
      'CARD_IMPORT_INVALID_CSV',
      'Le CSV contient des colonnes dupliquées.',
      {
        columns: [...new Set(duplicates)],
      },
    );
  }
  const missing = requiredCsvColumns.filter((column) => !normalized.includes(column));
  if (missing.length) {
    throw new CardDataCodecError(
      'CARD_IMPORT_INVALID_CSV',
      'Le CSV ne contient pas toutes les colonnes obligatoires.',
      { missingColumns: missing },
    );
  }
  return normalized;
}

function normalizeCsvRecord(record: Record<string, string>, row: number): ParsedCardImportRow {
  const errors: CardImportError[] = [];
  const typeSlugs = splitTypes(record.typeSlugs);
  const typeNames = splitTypes(record.typeNames);
  if (typeNames.length && typeNames.length !== typeSlugs.length) {
    errors.push({
      row,
      cardName: record.name,
      field: 'typeNames',
      value: record.typeNames,
      code: 'CARD_IMPORT_VALIDATION_FAILED',
      message: 'Le nombre de noms de types doit correspondre au nombre de slugs.',
    });
  }
  let metadata: unknown = {};
  let technical: unknown;
  if (record.metadata?.trim()) {
    try {
      metadata = JSON.parse(record.metadata);
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        const { _technical, ...publicMetadata } = metadata as Record<string, unknown>;
        metadata = publicMetadata;
        technical = _technical;
      }
    } catch {
      errors.push({
        row,
        cardName: record.name,
        field: 'metadata',
        value: record.metadata,
        code: 'CARD_IMPORT_VALIDATION_FAILED',
        message: 'Les métadonnées doivent être un objet JSON valide.',
      });
    }
  }
  return {
    row,
    errors,
    value: {
      name: record.name,
      number: record.number,
      attack: record.attack,
      defense: record.defense,
      value: record.value,
      description: emptyToNull(record.description),
      imageUrl: emptyToNull(record.imageUrl),
      isCommander: record.isCommander,
      rarity: {
        slug: emptyToUndefined(record.raritySlug),
        name: emptyToUndefined(record.rarityName),
      },
      season: {
        slug: emptyToUndefined(record.seasonSlug),
        name: emptyToUndefined(record.seasonName),
      },
      types: typeSlugs.map((slug, index) => ({ slug, name: typeNames[index] })),
      isActive: record.isActive?.trim() ? record.isActive : true,
      metadata,
      ...(technical === undefined ? {} : { _technical: technical }),
    },
  };
}

function assertRowCount(count: number, maxRows: number): void {
  if (count === 0) {
    throw new CardDataCodecError('CARD_IMPORT_EMPTY', 'Le fichier ne contient aucune carte.');
  }
  if (count > maxRows) {
    throw new CardDataCodecError(
      'CARD_IMPORT_TOO_MANY_ROWS',
      `Le fichier dépasse la limite de ${maxRows} cartes.`,
      { maxRows, receivedRows: count },
    );
  }
}

function splitTypes(value: string | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyToNull(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function stringifyCardsCsv(cards: SafirCardExportItem[], includeHeader = true): string {
  const records = cards.map((card) => ({
    name: safeSpreadsheetText(card.name),
    number: card.number,
    attack: card.attack,
    defense: card.defense,
    value: card.value,
    description: safeSpreadsheetText(card.description ?? ''),
    imageUrl: safeSpreadsheetText(card.imageUrl ?? ''),
    isCommander: card.isCommander,
    raritySlug: safeSpreadsheetText(card.rarity.slug ?? ''),
    rarityName: safeSpreadsheetText(card.rarity.name ?? ''),
    seasonSlug: safeSpreadsheetText(card.season.slug ?? ''),
    seasonName: safeSpreadsheetText(card.season.name ?? ''),
    typeSlugs: safeSpreadsheetText(
      card.types
        .map(({ slug }) => slug)
        .filter(Boolean)
        .join('|'),
    ),
    typeNames: safeSpreadsheetText(
      card.types
        .map(({ name }) => name)
        .filter(Boolean)
        .join('|'),
    ),
    isActive: card.isActive,
    metadata: safeSpreadsheetText(
      JSON.stringify(
        card._technical ? { ...card.metadata, _technical: card._technical } : card.metadata,
      ),
    ),
  }));
  return stringify(records, {
    columns: CARD_CSV_COLUMNS,
    delimiter: ';',
    header: includeHeader,
    record_delimiter: 'windows',
  });
}

export function stringifyCardsJson(cards: SafirCardExportItem[], exportedAt: string): string {
  const document: SafirCardExportFile = {
    format: 'safir-cards',
    version: 1,
    exportedAt,
    cards,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function safeSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function cardImportTemplate(format: CardImportFormat): Buffer {
  const example: SafirCardExportItem = {
    name: 'Carte exemple - à remplacer',
    number: 1,
    attack: 1,
    defense: 1,
    value: 1,
    description: 'Exemple sans donnée réelle.',
    imageUrl: null,
    isCommander: false,
    rarity: { slug: 'rare', name: 'Rare' },
    season: { slug: 'saison-exemple', name: 'Saison exemple' },
    types: [{ slug: 'type-exemple', name: 'Type exemple' }],
    isActive: false,
    metadata: {},
  };
  const content =
    format === 'JSON'
      ? stringifyCardsJson([example], new Date(0).toISOString())
      : `\uFEFF${stringifyCardsCsv([example])}`;
  return Buffer.from(content, 'utf8');
}
