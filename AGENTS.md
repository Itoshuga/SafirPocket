# Consignes agents — Safir Pocket

Lire avant toute modification : `README.md`, `docs/security.md`, `supabase/migrations/`, `prisma/schema.prisma` et les contrats de `packages/shared-types` / `packages/validation`.

## Architecture

- `apps/web` : Next.js App Router, Supabase SSR, TanStack Query et Zustand.
- `apps/api` : NestJS, API REST, gateway Socket.IO et services autoritaires.
- `packages/game-engine` : logique pure indépendante de tout framework.
- `packages/shared-types`, `validation`, `ui`, `config` : contrats et briques partagés.
- `supabase/migrations` : source unique de vérité du schéma PostgreSQL et de RLS.
- `prisma/schema.prisma` : reflet typé du schéma, jamais un historique de migrations.

## Règles absolues

1. Ne jamais lancer `prisma migrate dev`, `prisma migrate deploy` ou une commande Prisma qui modifie le schéma.
2. Toute évolution de base passe par une migration additive dans `supabase/migrations`; synchroniser ensuite Prisma et lancer `pnpm prisma:generate`.
3. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` ou `SUPABASE_ACCESS_TOKEN` au frontend, au log ou à Git.
4. Ne jamais appliquer de migration distante avant validation explicite de la référence projet, de la session CLI et de l’état des migrations.
5. Ne jamais lancer `supabase db reset` sur une base distante, ni effacement global, `TRUNCATE` général ou suppression d’utilisateurs.
6. Le serveur est autoritaire pour l’inventaire, l’économie, les boosters, les missions, les récompenses et les matchs. Le client envoie uniquement des intentions validées.
7. Aucun code provenant de PostgreSQL ne doit être exécuté. Les effets utilisent exclusivement le registre contrôlé de `packages/game-engine`.
8. Vérifier le propriétaire depuis le JWT (`sub`), jamais depuis un identifiant utilisateur envoyé dans le body.
9. L’interface est exclusivement claire. Ne pas ajouter de `dark:`, sélecteur de thème, dégradé décoratif, halo, texture fantasy ou couleur non sémantique.
10. Utiliser les tokens de `apps/web/app/globals.css` et les primitives de `packages/ui`; ne pas dupliquer un bouton, champ, panneau, état vide ou dialogue dans une page.
11. Toute donnée affichée comme un état métier doit venir de l’API. Les agrégats de collection, quantités réservées, portefeuilles, tirages et classements ne sont jamais recalculés comme source de vérité dans le client.
12. Centraliser les clés TanStack Query dans `apps/web/lib/query-keys.ts` et invalider seulement les familles concernées après une mutation.
13. Le rôle et le statut applicatifs viennent exclusivement de `user_profiles` après validation du JWT. Ne jamais faire confiance à `app_metadata`, `user_metadata`, un cookie applicatif ou un body pour autoriser une action.
14. Toute action d’administration sensible doit utiliser la matrice de permissions, une transaction Prisma et écrire `admin_audit_logs`; toute modération écrit aussi `user_moderation_actions`.
15. Les cartes utilisent les relations `rarity`, `season` et `typeLinks`. Les colonnes `rarity`, `card_type`, `set_id` et autres champs historiques restent uniquement des ponts de compatibilité pendant la migration.
16. Archiver avec `deleted_at` et `is_active`; ne proposer une suppression définitive qu’à un administrateur et seulement après vérification des références.
17. Déclarer toute navigation dans `apps/web/lib/navigation.ts`. Les sections admin restent des
    sous-entrées repliables de la sidebar principale, filtrées par la matrice partagée; ne pas
    réintroduire de barre horizontale ou de tabs de navigation dans les layouts `/admin`.
18. Aucun mot de passe actuel, temporaire ou token de reset ne doit être lu, retourné ou journalisé. Les changements de mot de passe et d'e-mail passent exclusivement par Supabase Auth depuis l'API.
19. Les avertissements sont révoqués, jamais supprimés; avertissements, suspensions, bannissements et changements de rôle restent historisés et audités.

## Chaîne de changement

Lorsqu’une interface nécessite une donnée absente, mettre à jour dans le même changement : contrat partagé, Zod si l’entrée est externe, contrôleur Nest, service Prisma, tests et documentation. Une migration Supabase additive n’est créée que si le schéma ou une policy doit réellement changer. Ne pas créer de migration pour une agrégation calculable depuis les tables existantes.

Les conventions visuelles, responsive et de composants sont détaillées dans `docs/design-system.md`.

## Modules sensibles

Examiner RLS et ajouter des tests lors de toute modification de `boosters`, `economy`, `matches`, `matchmaking`, `auth`, `user_profiles`, `user_moderation_actions`, `admin_audit_logs`, `user_cards`, `wallets`, Storage, du catalogue ou des rôles. Toute écriture économique doit rester transactionnelle, traçable et idempotente.

## Vérifications obligatoires

Depuis la racine :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Pour un changement de schéma : valider la migration Supabase locale, mettre à jour `prisma/schema.prisma`, lancer `pnpm prisma:generate`, puis refaire toutes les vérifications. Ne corriger jamais une erreur en désactivant TypeScript strict ou RLS.
