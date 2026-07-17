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

## Modules sensibles

Examiner RLS et ajouter des tests lors de toute modification de `boosters`, `economy`, `matches`, `matchmaking`, `auth`, `user_cards`, `wallets`, Storage ou des rôles. Toute écriture économique doit rester transactionnelle, traçable et idempotente.

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
