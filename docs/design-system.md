# Design system Safir Pocket

## Direction

Safir Pocket est une application de collection premium, sobre et exclusivement claire. Le fond est blanc cassé, les surfaces sont blanches, les séparations reposent sur des bordures fines et les ombres restent fonctionnelles. Le bleu saphir est l’unique accent de marque dominant. Les références à la gemme se limitent au logo et à quelques icônes, jamais à des textures, halos ou cadres fantasy.

Le rendu force `color-scheme: light`. Il ne doit exister ni classe `dark:`, ni listener de préférence sombre, ni sélecteur soleil/lune. `prefers-reduced-motion` et la préférence locale du profil réduisent toutes les animations.

## Tokens

Les variables Tailwind se trouvent dans `apps/web/app/globals.css` :

- fonds et textes : `background`, `foreground`, `surface`, `surface-muted`, `surface-hover` ;
- séparations : `border`, `border-strong`, `muted`, `muted-foreground` ;
- marque : `primary`, `primary-hover`, `primary-soft`, `primary-foreground` ;
- sémantique : `success`, `warning`, `danger`, `focus-ring` ;
- rayons : `sm` pour badges, `md` pour contrôles, `lg` pour cartes, panneaux et dialogues ;
- ombres : `control`, `card`, `dialog` seulement.

Modifier une valeur à cet endroit plutôt que d’introduire une couleur hexadécimale dans un composant. L’exception est `global-error.tsx`, rendu hors de la feuille applicative lors d’une erreur racine.

## Composants

`packages/ui` expose les primitives sans logique métier : boutons, contrôles, cartes, badges, overlays Radix, états, pagination, tableaux et en-têtes. Une variante est ajoutée avec `class-variance-authority` uniquement si elle représente une intention répétée. Les boutons sont limités à `primary`, `secondary`, `outline`, `ghost`, `danger` et aux tailles `sm`, `md`, `lg`, `icon`.

Pour ajouter un composant partagé :

1. choisir `primitives.tsx`, `overlays.tsx` ou `data.tsx` selon sa responsabilité ;
2. utiliser exclusivement les tokens sémantiques ;
3. prévoir focus visible, disabled, clavier et réduction des animations ;
4. l’exporter depuis `packages/ui/src/index.ts` ;
5. ajouter un test si le composant contient une logique non triviale ;
6. lancer build UI, lint et typecheck.

Les composants métier restent dans `apps/web/components`. `TcgCard` propose les modes `compact`, `grid`, `collection`, `deck`, `detail`. `CardImage` réserve un ratio 5/7, utilise `next/image`, et affiche un fallback neutre sans provoquer de décalage de mise en page.

Le profil social compose `ProfileBanner`, `SocialProfileHeader`, `ProfileStatsOverview` et
`ProfileCollectionBySeason`. La bannière conserve environ 2,4:1 sur mobile et 3,5:1 dès `sm`;
l’avatar chevauche son bord inférieur. Les statistiques forment une seule surface légère avec quatre
valeurs au maximum, des séparateurs fins et une progression globale, jamais une série de widgets.
La barre passe de quatre colonnes dès `sm` à deux colonnes sur mobile et s’adapte au nombre de
valeurs publiques autorisées. La page principale montre seulement les aperçus saisonniers; le
panneau de filtres partagé `CardsToolbar` appartient aux routes détaillées de saison. Chaque aperçu
contient cinq cartes maximum, sur une rangée horizontale défilable en mobile avec une largeur de
carte équivalente au desktop, puis cinq colonnes dès `md` sur toute la largeur disponible.

## Mise en page responsive

- `lg` et plus : barre latérale de 256 px, contenu plafonné à `max-w-screen-xl`.
- sous `lg` : en-tête compact, navigation basse à cinq actions et drawer pour les sections secondaires.
- les tableaux ont une représentation `MobileList` sous `md` ; les filtres du catalogue passent dans un drawer ; le deck builder empile composition et collection avant `xl`.
- les cibles tactiles principales mesurent au moins 40 px et aucune action essentielle ne dépend du survol.

Valider 375, 430, 768, 1024, 1280 et 1440 px, sans débordement horizontal. Les titres restent entre 24 et 48 px selon leur contexte ; les longs paragraphes ne sont pas centrés.

## Données et formulaires

React Hook Form utilise les schémas de `packages/validation` avec le resolver Zod lorsque la forme du formulaire correspond au contrat API. Les erreurs serveur normalisées sont conservées par `ApiClientError`, y compris `fieldErrors` et `requestId`. La validation frontend améliore le retour utilisateur mais ne remplace jamais celle de Nest.

Les listes volumineuses sont paginées et filtrées côté serveur. Les clés de cache sont définies dans `apps/web/lib/query-keys.ts`. Après une mutation, invalider la collection, le résumé ou le deck affecté plutôt que l’ensemble du cache.

## Ajouter une donnée ou un endpoint

1. définir la réponse dans `packages/shared-types` ;
2. définir et exporter le schéma d’entrée dans `packages/validation` ;
3. parser l’entrée dans le contrôleur Nest avec `parseInput` ;
4. appliquer ownership, rôle et contraintes métier dans le service ;
5. limiter le `select` Prisma aux données nécessaires ;
6. ajouter tests de succès, validation et autorisation ;
7. consommer via `apiFetch` avec une clé de query centralisée ;
8. documenter l’endpoint dans le README.

Si une table, un index ou une policy change, créer une nouvelle migration additive dans `supabase/migrations`, mettre à jour le reflet `prisma/schema.prisma`, exécuter `pnpm prisma:generate`, puis toutes les validations. Ne jamais utiliser Prisma Migrate.

## Vérifications

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```
