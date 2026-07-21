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
- Les taux premium sont des points de base entiers totalisant exactement 10 000. Les six positions communes, les deux positions premium, le débit éventuel, l’historique et les `upsert` de collection sont atomiques.
- Le bucket `booster-designs` est public en lecture, borné en taille et MIME, mais ses écritures sont réservées aux rôles privilégiés. Aucune image binaire n’est stockée dans PostgreSQL.
- Les événements de match sont produits par le moteur serveur et versionnés; le navigateur n’envoie que des intentions validées.
- Les uploads sont limités par bucket, taille, extension et ownership. L’application doit également vérifier le contenu MIME réel avant tout upload privilégié.
- Les modifications administratives sont transactionnelles et écrivent un audit avec acteur, entité, action, états avant/après et identifiant de requête. Les tables de modération, d’audit et de rapport de migration ne sont pas accessibles directement aux rôles client.
- `user_warnings` est append-only du point de vue métier : un avertissement est révoqué, jamais supprimé. Sa raison, sa sévérité, son auteur et sa révocation sont auditables; RLS retire tout accès direct aux rôles `anon` et `authenticated`.
- La clé `SUPABASE_SERVICE_ROLE_KEY` n'est chargée que dans `apps/api`. Le frontend ne reçoit jamais cette clé, un token de reset ou une valeur de mot de passe.
- L'adresse de connexion est modifiée via Supabase Auth Admin, puis synchronisée dans `user_profiles`. Une transaction applicative en échec déclenche une compensation Auth; si elle échoue aussi, l'API signale explicitement qu'une réparation est requise.
- Un administrateur peut déclencher un reset ou définir un mot de passe temporaire, mais ne peut jamais consulter le mot de passe actuel. Les mots de passe restent exclusivement dans Supabase Authentication et sont exclus des logs et de l'audit.
- Les protections d'affichage frontend ne remplacent jamais les guards de permissions, le contrôle de hiérarchie, les transactions et RLS côté serveur.
- Les préférences de confidentialité sont persistées dans `user_preferences`. Le profil public et
  la recherche appliquent ces choix côté API sans retourner d'e-mail ou de statut de modération.
- `collection_visibility` est indépendante de `profile_visibility`. `ProfileAccessPolicyService`
  vérifie propriétaire, amitié et blocages avant toute statistique ou collection publique; les
  quantités exactes et la progression ont leurs propres préférences. Les quantités réservées ne
  sont jamais retournées par l'endpoint public.
- Les demandes d'amis, acceptations et blocages sont transactionnels. Un index de paire empêche les
  demandes inversées simultanées; un blocage annule les demandes et l'amitié sans notifier la cible.
- La désactivation volontaire reste distincte de `SUSPENDED` et `BANNED`. Les routes de
  réactivation vérifient toujours le statut administratif.
- Les changements d'e-mail et de mot de passe utilisent Supabase Auth sous le bearer de
  l'utilisateur. `user_security_events` ne stocke ni mot de passe, ni token, ni adresse IP brute.
- La suppression définitive est différée de 30 jours. Le service final pseudonymise l'identité,
  minimise les audits et supprime l'utilisateur Auth en dernier; son ordonnanceur de production
  reste à configurer. Voir `docs/personal-space.md`.

Voir `docs/administration.md` pour la matrice fonctionnelle et les procédures de migration.
