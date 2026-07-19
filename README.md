# Safir Pocket

Safir Pocket est la fondation web de collection pour Safir TCG : catalogue de cartes, collection, decks, boosters transactionnels et architecture temps réel pour les futurs matchs. Cette étape ne prétend définir aucune règle officielle du jeu. Le moteur partagé contient uniquement un scénario technique minimal, explicitement versionné.

## Stack

- Monorepo pnpm 11 + Turborepo, Node.js 24 LTS, TypeScript strict
- Next.js 16, React 19, App Router, Tailwind CSS 4, TanStack Query, Zustand
- Radix UI, Lucide, class-variance-authority, React Hook Form et Zod
- NestJS 11, REST, Socket.IO, Helmet, CORS strict, rate limiting, Pino
- Supabase Auth, PostgreSQL, Storage, migrations SQL et RLS
- Prisma 7 comme client typé, avec l’adaptateur PostgreSQL
- Redis 8 préparé via Docker Compose; file mémoire par défaut en local
- Vitest, tests HTTP et Playwright

## Architecture

```text
apps/
  web/                 application Next.js mobile-first
  api/                 API NestJS et gateway /match
packages/
  ui/                  composants accessibles partagés
  shared-types/        contrats REST et Socket.IO
  validation/          schémas Zod des entrées externes
  game-engine/         transitions pures et registre d’effets
  config/              validation typée de l’environnement API
  eslint-config/       conventions lint réutilisables
  typescript-config/   configurations strictes
supabase/
  migrations/          unique historique de schéma
  seed.sql             données fictives locales uniquement
prisma/schema.prisma   reflet typé des tables applicatives
```

Le frontend n’accède directement qu’aux données autorisées par RLS. Les opérations sensibles passent par l’API, qui vérifie le JWT Supabase par JWKS et dérive l’utilisateur du claim `sub`. L’ouverture d’un booster débite le portefeuille, écrit l’audit, tire les cartes côté serveur, crée l’historique et met à jour la collection dans une transaction PostgreSQL sérialisable.

## Prérequis

- Node.js 24 LTS, conformément à `.nvmrc` et au champ `engines` de `package.json`.
- pnpm 11.12.0, conformément au champ `packageManager`.
- Git.
- Docker Desktop démarré pour Supabase local et Redis. Le frontend, les tests unitaires et le build peuvent être utilisés sans Docker.

Sur macOS, installez au besoin Homebrew et `nvm`, puis exécutez `nvm install && nvm use`.
Sur Windows, installez Node 24 LTS avec `fnm`, `nvm-windows` ou l’installateur officiel, puis
redémarrez le terminal. Dans les deux cas, préparez la version exacte de pnpm :

```bash
corepack enable
corepack prepare pnpm@11.12.0 --activate
node --version
corepack pnpm --version
```

Si PowerShell bloque un ancien shim `pnpm.ps1`, utilisez `corepack pnpm` à la place de `pnpm`.
Il n’est pas nécessaire d’assouplir la politique d’exécution du système.

## Installation

```bash
pnpm install --frozen-lockfile
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
pnpm prisma:generate
```

Équivalent PowerShell :

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
corepack pnpm prisma:generate
```

Les fichiers `.env*` réels sont ignorés par Git. Ne placez jamais une clé service role ou une URL PostgreSQL dans `apps/web`.

Pour tester depuis un autre appareil du réseau local, ajoutez son origine frontend à
`WEB_ORIGINS` sous forme de liste séparée par des virgules et définissez `NEXT_PUBLIC_APP_URL` avec
l’adresse IP locale de la machine. Le client web remplace automatiquement le nom d’hôte `localhost`
de `NEXT_PUBLIC_API_URL` par celui utilisé dans le navigateur, et Next autorise l’hôte déclaré par
`NEXT_PUBLIC_APP_URL` en développement.

## Supabase local

Le CLI est installé comme dépendance de développement. Démarrez la stack :

```bash
pnpm db:start
pnpm db:status
```

`supabase start` applique les migrations et le seed fictif à la base locale neuve. Recopiez les valeurs affichées sans les publier :

- API URL → `SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_URL`
- anon key → `SUPABASE_ANON_KEY` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`, API uniquement
- PostgreSQL local → `DATABASE_URL` et `DIRECT_URL` (en local, typiquement le port 54322)

La clé `anon` est publique par conception et limitée par RLS. La clé `service_role` contourne RLS : elle doit rester exclusivement côté serveur.

Commandes de données :

```bash
pnpm db:migration:new nom_additif
pnpm db:migrations:list
pnpm db:types
pnpm prisma:generate
pnpm db:stop
```

Le script `db:types` écrit les types Supabase locaux dans `packages/shared-types/src/database.generated.ts`. Générez-les uniquement lorsque la stack locale tourne.

### Convention de migration obligatoire

Les fichiers SQL de `supabase/migrations` constituent l’unique source de vérité. Prisma sert uniquement à générer un client, interroger PostgreSQL et gérer des transactions. **N’exécutez jamais** `prisma migrate dev` ou `prisma migrate deploy`. Après une migration Supabase, mettez prudemment à jour `prisma/schema.prisma`, lancez `pnpm prisma:generate`, `pnpm typecheck`, les tests et le build. `prisma db pull` n’est acceptable qu’après inspection et sauvegarde des personnalisations du schéma.

## Projet Supabase distant

Créez un projet depuis le tableau de bord Supabase, puis renseignez localement :

```dotenv
SUPABASE_PROJECT_REF=...
SUPABASE_ACCESS_TOKEN=...
DATABASE_URL=postgresql://...       # endpoint poolé pour l’API
DIRECT_URL=postgresql://...         # endpoint direct pour les outils
```

Avant tout push distant : vérifiez la référence cible sans afficher de secrets, l’authentification CLI, les URLs et l’historique distant. Procédure non destructive :

```bash
pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm db:migrations:list
pnpm db:push
pnpm exec supabase migration list
pnpm db:types
pnpm prisma:generate
pnpm typecheck && pnpm test && pnpm build
```

N’appliquez jamais automatiquement `supabase/seed.sql` à une base distante existante. La CI ne lie aucun projet et ne déploie aucune migration.

## Redis

Redis est facultatif pour démarrer : la file de matchmaking locale utilise `InMemoryMatchmakingQueue` derrière une interface remplaçable. Pour préparer Redis :

```bash
pnpm redis:start
pnpm redis:stop
```

La valeur locale par défaut est `REDIS_URL=redis://localhost:6379`.

## Démarrage

Avec Supabase local configuré :

```bash
pnpm dev
```

Ou séparément :

```bash
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:3001, santé sur /health
```

L’API valide toutes ses variables au démarrage et cite uniquement les noms invalides. Elle refuse de démarrer si une URL, une clé ou une connexion obligatoire manque.

## Authentification

`/login` prend en charge inscription avec nom d’utilisateur, connexion et récupération de mot de passe par e-mail. `/auth/callback` échange le code PKCE. Le trigger `on_auth_user_created` crée atomiquement `user_profiles` avec le même UUID, le rôle `USER` et le statut `ACTIVE`; aucun mot de passe n’est copié dans le schéma applicatif. `proxy.ts` rafraîchit la session et protège les pages privées. Après validation du JWT, l’API recharge toujours le profil pour obtenir le rôle et bloquer les comptes suspendus ou bannis. La gateway Socket.IO applique le même contrôle à la connexion et avant chaque intention.

L’architecture Supabase accepte un futur provider Google OAuth, mais aucun bouton inactif n’est affiché tant que le provider et ses URLs de redirection ne sont pas configurés.

## Interface et design system

L’application utilise exclusivement un thème clair, y compris lorsque le système est en mode sombre. Les tokens sémantiques Tailwind vivent dans `apps/web/app/globals.css`; les primitives accessibles sont regroupées dans `packages/ui`. Les composants métier (`TcgCard`, construction de deck, catalogue, booster) restent dans `apps/web/components` et composent ces primitives.

- Navigation latérale sur bureau, en-tête et navigation basse sur mobile. Les sections
  administratives vivent exclusivement dans le groupe repliable `Administration` de la navigation
  principale; le drawer mobile réutilise la même configuration et les mêmes permissions.
- Rayons limités à `sm`, `md` et `lg`, ombres légères et accent saphir unique.
- Filtres de catalogue et de collection synchronisés avec l’URL et exécutés par l’API.
- `next/image` conserve le ratio des cartes; la route `/artwork/card/*` relaie Storage avec la clé anon publique et laisse les policies RLS contrôler la lecture.
- `prefers-reduced-motion` est respecté; le profil permet aussi une préférence locale de réduction des animations.

Voir [docs/design-system.md](docs/design-system.md) pour les conventions complètes.

## Routes et endpoints applicatifs

Pages publiques : `/`, `/login`, `/cards`, `/cards/[id]`, `/rankings`. Pages authentifiées : `/collection`, `/decks`, `/decks/new`, `/decks/[id]`, `/boosters`, `/play`, `/profile`. L’espace `/admin` est monté uniquement pour `MODERATOR` et `ADMINISTRATOR`; les permissions de chaque endpoint restent la protection autoritaire.

La configuration typée de la navigation se trouve dans `apps/web/lib/navigation.ts`. Elle déclare
le groupe Administration, ses sous-routes, leur correspondance exacte et la permission requise.
`MODERATOR` voit les sections opérationnelles; `AUDIT_LOGS_READ` réserve Journaux aux
administrateurs. Il n'existe aucune navigation horizontale propre aux layouts administratifs.

Les endpoints ajoutés pour la refonte sont notamment :

- `GET /api/v1/card-facets` pour les filtres du catalogue ;
- `GET /api/v1/me/collection` paginé et filtrable, plus `/summary` et `/card/:cardId` ;
- `GET /api/v1/me/profile/summary` pour le tableau de bord et le profil ;
- `GET /api/v1/rankings` et `GET /api/v1/me/ranking` ;
- `GET /api/v1/me/wallets` et `GET /api/v1/me/booster-openings` ;
- `GET /api/v1/admin/overview` pour les compteurs autorisés.
- `GET /api/v1/auth/username-availability` et `GET/PATCH /api/v1/me/profile` pour l’identité applicative ;
- `/api/v1/admin/users` pour recherche, modération, rôles et historique ;
- `/api/v1/admin/users/:userId` et ses sous-routes `profile`, `email`, `role`, `warnings`, `suspend`, `ban`, `password-reset-email`, `temporary-password`, `moderation-history` et `audit-logs` pour la page dédiée de gestion ;
- `/api/v1/admin/cards`, `/rarities`, `/seasons` et `/card-types` pour le catalogue relationnel ;
- `GET /api/v1/admin/audit-logs` pour les administrateurs.

Les erreurs API normalisées exposent au premier niveau `code`, `message`, `details`, `fieldErrors` et `requestId` lorsque disponibles. `ApiClientError` accepte aussi l’ancien format enveloppé pendant la transition et conserve ces informations afin que les formulaires puissent rattacher les erreurs aux champs.

La migration `20260718090000_user_security_warnings.sql` ajoute les avertissements historisés et le marqueur `must_change_password`. Les mots de passe restent exclusivement dans Supabase Authentication; aucun administrateur ne peut consulter le mot de passe actuel. Les changements d'e-mail, resets et mots de passe temporaires utilisent l'API officielle Supabase depuis NestJS.

## Sécurité et données

- RLS est actif sur toutes les tables, y compris le catalogue afin de masquer les brouillons.
- Les clients ne peuvent pas écrire `user_cards`, `wallets`, `currency_transactions`, tirages ou résultats de match.
- Les probabilités de boosters sont invisibles aux clients; le tirage utilise `crypto.randomInt` côté serveur.
- Les transactions monétaires sont immuables et toutes les ouvertures utilisent un UUID d’idempotence.
- Les effets stockés sont des identifiants et paramètres JSON validés. Aucun JavaScript en base n’est exécuté.
- Les uploads sont bornés par bucket, MIME, taille et propriétaire. L’API devra aussi inspecter le contenu réel avant les futurs endpoints d’upload.
- Les logs expurgent Authorization, cookies, mots de passe et tokens, et chaque réponse HTTP porte un identifiant de requête.

Voir [docs/security.md](docs/security.md), [docs/administration.md](docs/administration.md) et [AGENTS.md](AGENTS.md).

## Qualité et tests

Après une première installation, téléchargez Chromium une fois pour Playwright :

```bash
pnpm --filter @safir/web exec playwright install chromium
```

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Les tests couvrent notamment santé, JWT invalide, contrat du trigger d’inscription, matrice de permissions, transitions et audit de modération, blocage HTTP/Socket.IO, catalogue relationnel, cycles d’archivage, idempotence/rollback booster et transitions du moteur. Playwright vérifie l’inscription, la connexion, le catalogue, les gardes et le responsive. Les parcours administratifs authentifiés s’activent avec `E2E_AUTH_EMAIL` et `E2E_AUTH_PASSWORD`; ils sont ignorés explicitement lorsque ces comptes de test ne sont pas configurés. Les tests unitaires ne nécessitent aucune base distante.

## Dépannage

- **Variables API invalides** : comparez `apps/api/.env` à son exemple; le message ne révèle aucune valeur.
- **Prisma Client absent** : renseignez au moins `DIRECT_URL` puis lancez `pnpm prisma:generate`.
- **API incapable de joindre PostgreSQL** : vérifiez `pnpm db:status`, le port 54322 et `DATABASE_URL`.
- **Docker indisponible** : démarrez Docker Desktop avant Supabase/Redis.
- **`pnpm.ps1` bloqué sous PowerShell** : préfixez les commandes par `corepack pnpm`; ne changez pas la politique d’exécution globale uniquement pour ce projet.
- **Navigateur Playwright absent** : lancez `pnpm --filter @safir/web exec playwright install chromium`, puis `pnpm test:e2e`.
- **Session en boucle** : vérifiez `site_url`, l’URL `/auth/callback` et les deux variables publiques Supabase.
- **CORS Socket.IO/REST** : `WEB_ORIGIN` définit l’origine principale et `WEB_ORIGINS` les origines supplémentaires autorisées, séparées par des virgules.
- **Types après migration** : ne lancez pas Prisma Migrate; actualisez le reflet Prisma, générez le client et relancez les vérifications.

## Espace personnel

`/profile`, `/users/[username]` et `/settings/*` couvrent le profil public ou privé, les
préférences persistées, les amis, les blocages et le cycle volontaire du compte. La migration
`20260719110000_personal_space_social_account_lifecycle.sql` ajoute les tables et champs associés.
La suppression est programmée avec 30 jours de grâce; le traitement final pseudonymise les
historiques nécessaires et supprime Supabase Auth en dernier.

Voir [docs/personal-space.md](docs/personal-space.md) pour les routes, endpoints, règles RLS,
différences entre confidentialité, désactivation et modération, ainsi que la stratégie
d'anonymisation.
