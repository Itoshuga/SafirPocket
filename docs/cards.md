# Cartes : import et export administratifs

La page `/admin/cards` permet d'importer et d'exporter le catalogue réel en JSON ou CSV. Les deux
opérations passent exclusivement par l'API NestJS et exigent un JWT Supabase, un profil actif et
les permissions de la matrice partagée.

## Permissions

- `CARDS_EXPORT` autorise l'estimation et l'export.
- `CARDS_IMPORT` autorise l'analyse et la confirmation d'un import.
- `CARDS_CREATE` et `CARDS_UPDATE` sont aussi vérifiées selon le mode demandé.
- `CARDS_IMPORT_CREATE_RELATIONS` est réservée à `ADMINISTRATOR` et autorise la création contrôlée
  de raretés, saisons et types absents.

Le frontend masque les commandes indisponibles. Les guards NestJS et les services refont chaque
contrôle; l'affichage ne constitue jamais la protection.

## JSON versionné

Le format recommandé est :

```json
{
  "format": "safir-cards",
  "version": 1,
  "exportedAt": "2026-07-20T12:00:00.000Z",
  "cards": [
    {
      "name": "Eraimel du néant",
      "number": 46,
      "attack": 4,
      "defense": 4,
      "value": 3,
      "description": "|En jeu| : votre adversaire perd 1 PI.",
      "imageUrl": "https://example.com/cards/eraimel.png",
      "isCommander": false,
      "rarity": { "slug": "rare", "name": "Rare" },
      "season": { "slug": "origines", "name": "Origines" },
      "types": [
        { "slug": "neant", "name": "Néant" },
        { "slug": "creature", "name": "Créature" }
      ],
      "isActive": true,
      "metadata": {}
    }
  ]
}
```

Un tableau de cartes simple est accepté pour compatibilité. La version `1` est la seule version
reconnue. Les UUID ne sont jamais requis. L'option de métadonnées techniques ajoute `_technical`
aux exports, mais l'import ne lui fait pas confiance pour résoudre les relations.

## CSV

Les exports et modèles utilisent UTF-8 avec BOM, le séparateur `;` et les fins de ligne Windows.
Les types multiples utilisent `|`. Les colonnes, dans leur ordre canonique, sont :

```text
name;number;attack;defense;value;description;imageUrl;isCommander;raritySlug;rarityName;seasonSlug;seasonName;typeSlugs;typeNames;isActive;metadata
```

Les colonnes minimales sont `name`, `number`, `attack`, `defense`, `value`, `isCommander`,
`raritySlug`, `seasonSlug` et `typeSlugs`. `description`, `imageUrl`, `isActive`, `metadata` et les
noms de relations sont facultatifs. `metadata` doit contenir un objet JSON.

Alias pris en charge :

| Alias          | Colonne canonique |
| -------------- | ----------------- |
| `image_url`    | `imageUrl`        |
| `is_commander` | `isCommander`     |
| `rarity_slug`  | `raritySlug`      |
| `season_slug`  | `seasonSlug`      |
| `type_slugs`   | `typeSlugs`       |

Le parseur `csv-parse` gère les guillemets, séparateurs dans le texte, cellules vides, accents,
BOM et descriptions multilignes. Les cellules textuelles exportées commençant par `=`, `+`, `-`
ou `@` sont préfixées par une apostrophe pour neutraliser les formules de tableur. Les nombres sont
émis comme nombres et les statistiques négatives sont refusées par la validation partagée.

## Validation et relations

Le schéma d'import dérive du même schéma Zod que le formulaire manuel : longueurs, entiers,
booléens, URL HTTPS, au moins un type, types sans doublon et objet `metadata` limité à 10 000
caractères. Le fichier complet est analysé avant toute écriture.

La rareté, la saison et les types sont résolus par slug. Le nom normalisé est utilisé seulement
quand le slug est absent. Une relation inactive ou archivée est refusée. La création automatique
est désactivée par défaut; lorsqu'un administrateur la confirme, chaque relation doit avoir un nom
et un slug valides. Elle est créée inactive dans la transaction et les cartes concernées restent
inactives jusqu'à validation éditoriale.

La clé métier d'une carte est `(season_id, number)`. Les doublons du fichier sont tous signalés,
sans dépendre de l'ordre des lignes.

## Modes et conflits

- `CREATE_ONLY` ne crée que les clés absentes.
- `UPSERT` crée les clés absentes et remplace entièrement les champs et types des clés existantes.
- `UPDATE_ONLY` ne modifie que les clés existantes.
- `ERROR` rend un conflit bloquant; `SKIP` l'inscrit comme ligne ignorée.

Une carte archivée reste un conflit bloquant et n'est jamais restaurée implicitement.

## Aperçu et transaction

`POST /api/v1/admin/cards/import/preview` reçoit un multipart `file`, `format`, `mode`,
`conflictBehavior` et `createMissingRelations`. L'API vérifie taille, extension, MIME, contenu,
parse toutes les lignes, résout les relations et calcule les actions sans modifier le catalogue.

L'aperçu est enregistré dans `card_data_operations` avec le SHA-256 du fichier, les données
normalisées, l'acteur et une expiration de 15 minutes. Son UUID `importPreviewId` est lié à cet
acteur et utilisable une seule fois. `POST /api/v1/admin/cards/import/execute` accepte uniquement
l'identifiant et le hash; aucune donnée de carte modifiable par le navigateur n'est rejouée.

À la confirmation, une transaction PostgreSQL sérialisable revalide l'état courant, crée les
relations autorisées, crée ou met à jour les cartes, remplace `card_type_links`, synchronise la
variante Standard, écrit les audits et termine l'opération. Toute erreur annule l'ensemble.

## Export et historique

`POST /api/v1/admin/cards/export/estimate` compte les cartes côté serveur. `POST
/api/v1/admin/cards/export` accepte `ALL`, `FILTERED` ou le contrat futur `SELECTED`, applique les
filtres réels et produit un flux paginé par lots de 500. Aucun filtrage n'est effectué après
téléchargement dans le navigateur. JSON et CSV sont limités à 50 000 cartes par défaut.

Endpoints associés :

```text
POST /api/v1/admin/cards/import/preview
POST /api/v1/admin/cards/import/execute
GET  /api/v1/admin/cards/import/template/json
GET  /api/v1/admin/cards/import/template/csv
POST /api/v1/admin/cards/export/estimate
POST /api/v1/admin/cards/export
GET  /api/v1/admin/cards/data-operations
GET  /api/v1/admin/cards/data-operations/:operationId
GET  /api/v1/admin/cards/data-operations/:operationId/errors
```

`card_data_operations` conserve acteur, format, mode, hash, compteurs, filtres, statut et résumé
d'erreurs. Le contenu d'aperçu est supprimé après exécution, échec ou expiration. Les actions
`CARDS_IMPORT_PREVIEWED`, `CARDS_IMPORTED`, `CARDS_IMPORT_FAILED` et `CARDS_EXPORTED`, ainsi que
chaque carte ou relation créée, sont inscrites dans `admin_audit_logs`.

## Limites et erreurs

Variables configurables :

```dotenv
CARD_IMPORT_MAX_FILE_BYTES=5242880
CARD_IMPORT_MAX_ROWS=5000
CARD_IMPORT_PREVIEW_TTL_SECONDS=900
CARD_EXPORT_MAX_ROWS=50000
```

Les erreurs suivent le contrat API standard. Les codes dédiés couvrent fichier absent ou trop
grand, format/JSON/CSV/version invalides, trop de lignes, validation, doublons, relation absente,
conflit, aperçu absent/expiré/utilisé, hash différent, rollback et export vide ou trop volumineux.
Une erreur de parseur, Prisma ou PostgreSQL n'est jamais retournée brute.

Exemples : `docs/examples/card-import/cards-template.json`, `cards-template.csv` et
`cards-invalid-example.json`.
