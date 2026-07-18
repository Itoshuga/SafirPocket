# Modèle de sécurité

- Supabase SQL est l’unique source de vérité du schéma et des policies RLS.
- Les clients peuvent lire le catalogue publié et leurs propres données.
- Les clients peuvent gérer leurs decks, mais jamais écrire l’inventaire, les monnaies, les tirages ou les résultats de match.
- L’API vérifie le JWT Supabase par JWKS, dérive toujours l’utilisateur du `sub` vérifié et utilise une connexion serveur protégée.
- Le rôle du JWT ou du body n’est jamais une source d’autorité. `AccountAccessService` recharge `user_profiles` après chaque validation JWT et la gateway Socket.IO revérifie le statut avant chaque événement sensible.
- `ACTIVE` autorise la session, `SUSPENDED` la bloque jusqu’à réactivation ou expiration, et `BANNED` la bloque sans échéance. Une expiration automatique écrit la modération et l’audit dans la même transaction.
- Les permissions sont centralisées dans `apps/api/src/common/auth/permissions.ts`. `MODERATOR` gère les comptes USER/PIONEER et le catalogue sans suppression définitive. `ADMINISTRATOR` gère aussi les rôles, restaurations, suppressions définitives et journaux d’audit.
- Un acteur ne peut jamais se modérer lui-même. Un modérateur ne peut pas agir sur un modérateur ou administrateur, et le dernier administrateur actif ne peut pas perdre son accès.
- Les clients authentifiés ne peuvent modifier que `username`, `display_name`, `avatar_url` et `bio` de leur propre profil. Rôle, statut, e-mail, suspension et historique restent serveur uniquement.
- La configuration pondérée des boosters n’est pas exposée par RLS. Le tirage utilise une source aléatoire cryptographique et une transaction sérialisable.
- Les événements de match sont produits par le moteur serveur et versionnés; le navigateur n’envoie que des intentions validées.
- Les uploads sont limités par bucket, taille, extension et ownership. L’application doit également vérifier le contenu MIME réel avant tout upload privilégié.
- Les modifications administratives sont transactionnelles et écrivent un audit avec acteur, entité, action, états avant/après et identifiant de requête. Les tables de modération, d’audit et de rapport de migration ne sont pas accessibles directement aux rôles client.
- `user_warnings` est append-only du point de vue métier : un avertissement est révoqué, jamais supprimé. Sa raison, sa sévérité, son auteur et sa révocation sont auditables; RLS retire tout accès direct aux rôles `anon` et `authenticated`.
- La clé `SUPABASE_SERVICE_ROLE_KEY` n'est chargée que dans `apps/api`. Le frontend ne reçoit jamais cette clé, un token de reset ou une valeur de mot de passe.
- L'adresse de connexion est modifiée via Supabase Auth Admin, puis synchronisée dans `user_profiles`. Une transaction applicative en échec déclenche une compensation Auth; si elle échoue aussi, l'API signale explicitement qu'une réparation est requise.
- Un administrateur peut déclencher un reset ou définir un mot de passe temporaire, mais ne peut jamais consulter le mot de passe actuel. Les mots de passe restent exclusivement dans Supabase Authentication et sont exclus des logs et de l'audit.
- Les protections d'affichage frontend ne remplacent jamais les guards de permissions, le contrôle de hiérarchie, les transactions et RLS côté serveur.

Voir `docs/administration.md` pour la matrice fonctionnelle et les procédures de migration.
