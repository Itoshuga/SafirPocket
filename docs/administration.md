# Administration, identité et catalogue

## Identité applicative

Supabase Auth reste l'unique gestionnaire des mots de passe et sessions. Le trigger `on_auth_user_created` crée `public.user_profiles` après l'insertion Auth avec le même UUID, l'e-mail Auth, le nom d'utilisateur normalisé, `USER` et `ACTIVE`. Une violation du format ou de l'unicité annule l'inscription Auth et renvoie un code stable.

Le nom d'utilisateur contient 3 à 24 lettres ASCII, chiffres, `_` ou `-`; il ne commence ni ne finit par `-`. `normalized_username = lower(username)` porte l'unicité insensible à la casse. `user_profiles` ne contient aucun mot de passe.

| Rôle            | Usage                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| `USER`          | Compte standard                                                                       |
| `PIONEER`       | Badge fonctionnel sans accès administratif                                            |
| `MODERATOR`     | Lecture admin, modération des USER/PIONEER et gestion non destructive du catalogue    |
| `ADMINISTRATOR` | Rôles, restaurations, suppressions définitives et audit en plus des droits modérateur |

Les statuts sont `ACTIVE`, `SUSPENDED` et `BANNED`. L'API et Socket.IO chargent le profil après validation du JWT. Une suspension arrivée à expiration est levée transactionnellement et auditée.

## Réparation des profils manquants

La migration fournit `repair_missing_user_profiles(apply_changes boolean default false)`, exécutable uniquement avec `service_role`. Elle ne modifie jamais un profil existant et le dry-run est le comportement par défaut.

1. Sauvegarder et inspecter `auth.users` et `user_profiles`.
2. Exécuter `select * from public.repair_missing_user_profiles(false);`.
3. Corriger les lignes `SKIPPED_EMAIL_MISSING`, `SKIPPED_USERNAME_INVALID` ou `SKIPPED_IDENTITY_CONFLICT`.
4. Après validation explicite, exécuter `select * from public.repair_missing_user_profiles(true);`.
5. Relancer le dry-run; aucun résultat `READY` ne doit subsister.

La fonction est idempotente: les profils créés ne sont plus sélectionnés au passage suivant.

## Modération et audit

`user_moderation_actions` conserve la cible, l'acteur, l'action, les anciens/nouveaux rôles ou statuts, la raison, une note interne et des métadonnées. `admin_audit_logs` couvre aussi les cartes et taxonomies avec les états avant/après et `request_id`.

Les protections sont appliquées dans les services, pas seulement dans l'interface: pas d'auto-modération, pas d'action d'un modérateur sur un rôle égal ou supérieur, et conservation d'au moins un administrateur actif.

La page `/admin/users/[userId]` regroupe Vue d'ensemble, Profil, Sécurité, Modération et Historique. Elle charge les agrégats depuis l'API et n'utilise jamais la liste complète comme source de vérité. La suppression définitive reste désactivée tant que la conservation des dépendances et l'anonymisation ne sont pas prises en charge de bout en bout.

### Matrice utilisateur

| Permission                                                           | Modérateur                  | Administrateur                                  |
| -------------------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| `USERS_READ`, `USERS_VIEW_SECURITY`, `USERS_VIEW_MODERATION_HISTORY` | USER/PIONEER                | Oui                                             |
| `USERS_UPDATE_PROFILE`, `USERS_SEND_PASSWORD_RESET`                  | USER/PIONEER                | Oui                                             |
| `USERS_WARN`, `USERS_SUSPEND`, `USERS_BAN`                           | USER/PIONEER, hors soi-même | Oui, hors auto-modération                       |
| `USERS_UPDATE_EMAIL`, `USERS_SET_TEMPORARY_PASSWORD`                 | Non                         | Oui                                             |
| `USERS_CHANGE_ROLE`, `USERS_DELETE`                                  | Non                         | Oui, avec protections du dernier administrateur |

La matrice partagée masque les commandes interdites dans Next.js. Les décorateurs et guards NestJS la réappliquent, puis le service contrôle la hiérarchie et la cible dans la transaction.

### Sécurité du compte

- L'adresse e-mail est modifiée d'abord par l'API Admin officielle Supabase Auth, puis synchronisée dans `user_profiles` et auditée dans une transaction. Si la transaction échoue, le service tente de restaurer l'ancienne adresse Auth; un échec de compensation retourne une erreur de réparation explicite.
- L'envoi d'un reset utilise `resetPasswordForEmail`. Le lien ou token n'est jamais retourné au navigateur. Le succès comme l'échec opérationnel est audité sans secret.
- Le mot de passe temporaire est réservé aux administrateurs, défini via Supabase Auth, jamais lu ni journalisé, puis `must_change_password` est activé et l'action auditée. Si l'état applicatif ne peut pas être synchronisé, l'API retourne une erreur de réparation; le mot de passe ne figure dans aucun état avant/après.
- Aucun endpoint, écran ou journal ne permet de consulter le mot de passe actuel. Les mots de passe restent exclusivement dans Supabase Authentication.

### Avertissements, suspensions et bannissements

`user_warnings` conserve chaque avertissement `LOW`, `MEDIUM` ou `HIGH`. Une révocation renseigne `revoked_at` et `revoked_by_user_id`; elle ne supprime jamais la ligne. La table est protégée par RLS et inaccessible directement aux rôles navigateur. Les créations et révocations écrivent aussi `admin_audit_logs`.

Une suspension passe le profil à `SUSPENDED`, conserve sa raison dans `user_moderation_actions` et peut définir `suspended_until`. Une levée manuelle ou automatique rétablit `ACTIVE`. Un bannissement passe à `BANNED` sans supprimer les données. L'API, Socket.IO, les boosters et les parties passent par le contrôle de statut commun et refusent les comptes bloqués.

### Endpoints utilisateur

```text
GET   /api/v1/admin/users
GET   /api/v1/admin/users/:userId
PATCH /api/v1/admin/users/:userId/profile
PATCH /api/v1/admin/users/:userId/email
PATCH /api/v1/admin/users/:userId/role
POST  /api/v1/admin/users/:userId/password-reset-email
POST  /api/v1/admin/users/:userId/temporary-password
GET   /api/v1/admin/users/:userId/warnings
POST  /api/v1/admin/users/:userId/warnings
POST  /api/v1/admin/users/:userId/warnings/:warningId/revoke
POST  /api/v1/admin/users/:userId/suspend
POST  /api/v1/admin/users/:userId/unsuspend
POST  /api/v1/admin/users/:userId/ban
POST  /api/v1/admin/users/:userId/unban
GET   /api/v1/admin/users/:userId/moderation-history
GET   /api/v1/admin/users/:userId/audit-logs
```

### Erreurs administratives

Les erreurs suivent `{ code, message, details?, fieldErrors?, requestId? }`. Les formulaires rattachent `fieldErrors` aux champs et conservent les valeurs en cas d'échec. Les principaux codes sont `VALIDATION_ERROR`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `INSUFFICIENT_PERMISSIONS`, les conflits `SEASON_*`, `RARITY_*`, `CARD_TYPE_*` et `CARD_*`, ainsi que `RESOURCE_STILL_REFERENCED`, `DATABASE_CONSTRAINT_ERROR` et `INTERNAL_SERVER_ERROR`. Aucune erreur Prisma, PostgreSQL ou stack trace brute ne traverse l'API.

## Navigation administrative

L'espace Administration est un groupe repliable de la sidebar principale, jamais une barre
horizontale propre aux pages admin. Desktop et drawer mobile consomment la configuration unique
`apps/web/lib/navigation.ts`; le layout `/admin` conserve uniquement la protection d'accès et le
contenu des pages.

Le groupe apparaît avec `ADMIN_ACCESS`. Ses liens sont ensuite filtrés par permission:

- `MODERATOR` voit Vue d'ensemble, Utilisateurs, Cartes, Boosters, Raretés, Saisons et Types;
- `ADMINISTRATOR` voit les mêmes sections ainsi que Journaux grâce à `AUDIT_LOGS_READ`;
- `USER` et `PIONEER` ne voient jamais le groupe.

Le matching est segmenté: `/admin` active seulement Vue d'ensemble, tandis que les routes enfants
comme `/admin/users/:id` ou `/admin/cards/new` activent leur section parente. Le groupe s'ouvre
automatiquement sur toute route `/admin`, expose `aria-expanded`, `aria-controls` et
`aria-current="page"`, et le drawer mobile se ferme après le choix d'une destination. Ces règles
d'affichage ne remplacent jamais les guards NestJS ni les contrôles serveur.

## Boosters

`/admin/boosters`, `/admin/boosters/new` et `/admin/boosters/:id` gèrent plusieurs designs par
saison. Le formulaire verrouille le contenu à six communes et deux cartes premium, convertit les
pourcentages en points de base et refuse l’enregistrement tant que le total diffère de 100 %.

Les modérateurs peuvent consulter, créer, modifier, configurer les taux, activer, désactiver,
dupliquer et archiver. Les administrateurs peuvent en plus restaurer et supprimer définitivement
un booster sans historique. Le service revalide la saison, la rareté commune, les pools de cartes,
les dates et le total avant activation, puis audite chaque mutation. Voir `docs/boosters.md`.

## Catalogue relationnel

Une carte référence exactement une rareté et une saison, et au moins un type via `card_type_links`. Le couple `(season_id, number)` est unique. Les entrées portent `is_active` et `deleted_at`; l'API publique ne renvoie que les cartes actives, publiées et non archivées.

Les suppressions usuelles sont logiques. Une suppression définitive est réservée à `ADMINISTRATOR` et refusée tant que des cartes, variantes ou liens utilisent la ressource.

## Conversion des données existantes

La migration `20260717200000_identity_moderation_admin_catalog.sql` :

1. renomme `profiles` sans changer les UUID ou clés étrangères ;
2. convertit les anciens rôles vers `app_role` ;
3. crée raretés et types depuis les valeurs texte existantes ;
4. transforme les `card_sets` en saisons avec le même UUID ;
5. conserve les colonnes historiques et les URLs HTTPS existantes ;
6. associe les cartes aux nouvelles relations ;
7. attribue un numéro de repli non destructif aux numéros non numériques ou dupliqués ;
8. enregistre ces cas dans `catalog_migration_issues`.

Après migration locale, inspecter :

```sql
select *
from public.catalog_migration_issues
where migration_name = '20260717200000_identity_moderation_admin_catalog'
order by created_at, entity_id;
```

Le rapport indique les données converties avec repli; aucune carte n'est supprimée. Les corrections éditoriales se font ensuite via l'API d'administration.

La migration additive `20260718090000_user_security_warnings.sql` ajoute `user_profiles.must_change_password`, l'enum `warning_severity`, la table `user_warnings`, ses index, son trigger `updated_at` et ses policies RLS. Elle ajoute aussi l'unicité insensible à la casse des noms de saison. Elle ne supprime ni ne réécrit aucune donnée existante.

## Procédure Supabase

Les migrations Supabase sont l'unique source de vérité. Ne jamais lancer Prisma Migrate.

En local: démarrer Docker, exécuter `pnpm db:start`, inspecter le rapport, mettre à jour le reflet Prisma, puis lancer `pnpm prisma:generate` et toutes les vérifications.

Avant une opération distante, confirmer explicitement la référence du projet, la session CLI, les URLs, la sauvegarde et `pnpm db:migrations:list`. N'appliquer que les migrations manquantes avec `pnpm db:push`; ne jamais appliquer le seed ou une réparation automatiquement.

## Tests E2E authentifiés

Les parcours Playwright administratifs utilisent une session et des réponses API simulées uniquement sur le serveur E2E local. Le contournement est compilé hors production, exige `E2E_MOCK_AUTH_SECRET` et un cookie HTTP-only de même valeur, et n'accorde aucun droit dans NestJS ou Supabase :

```dotenv
E2E_MOCK_AUTH_SECRET=une-valeur-locale-ephemere
```

Playwright vérifie ainsi le formulaire de saison, l'invalidation de liste, la page utilisateur, le username, les avertissements, suspension/levée, reset de mot de passe, création de carte, permissions, responsive et erreurs console. Une validation contre le projet Supabase lié nécessite séparément un compte de test administrateur et ne doit jamais réutiliser un compte réel sans autorisation explicite.
