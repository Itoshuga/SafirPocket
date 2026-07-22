# Espace personnel, confidentialite et cycle de vie du compte

## Routes web

- `/profile` presente la banniere, l'avatar superpose, l'identite, les actions, les statistiques
  compactes et un apercu de collection organise par saison.
- `/users/[username]` reprend la meme structure sociale et ajoute uniquement les saisons non vides
  de la collection publique autorisee.
- `/profile/collection/[seasonSlug]` et `/users/[username]/collection/[seasonSlug]` affichent la
  grille complete d'une saison. Recherche, filtres, tri et pagination vivent uniquement dans ces
  vues detaillees.
- `/collection` est une redirection de compatibilite vers `/profile#collection` et ne contient plus
  d'implementation concurrente.
- `/settings/profile`, `/settings/privacy`, `/settings/notifications`, `/settings/account` et
  `/settings/friends` forment l'unique espace de preferences. `/settings` redirige vers le profil.

Un profil prive n'est pas un compte supprime. Il peut rester trouvable par username lorsque
`appear_in_user_search` est actif, mais sa page ne retourne ni biographie, ni avatar, ni statistiques.
Une desactivation volontaire n'est ni une suspension ni un bannissement : les champs
`is_deactivated` et `deactivated_at` restent separes de `status`.

## Profil et preferences

`user_preferences` est cree par trigger pour chaque nouveau profil. La migration effectue aussi un
backfill idempotent des comptes existants. Les valeurs ne sont pas une source locale Zustand ou
`localStorage`; les pages lisent et modifient `GET/PATCH /api/v1/me/preferences`.

Le username reste unique par `normalized_username`. L'API limite sa modification a une fois tous
les 30 jours grace a `username_changed_at`; l'acces PostgREST ne peut pas contourner ce delai.
La biographie est limitee a 300 caracteres par Zod et par l'API. Les avatars JPEG, PNG ou WebP de
5 Mo maximum utilisent le bucket `avatars`, un dossier par UUID et les policies Storage existantes.

La migration `20260721200000_profile_social_banners.sql` ajoute `banner_url` et
`banner_position_y`, contraint entre 0 et 100 avec une valeur par defaut de 50. Les fichiers sont
stockes dans le bucket public `profile-banners`, jamais dans PostgreSQL. Chaque objet appartient au
dossier de l'UUID Auth, accepte JPEG, PNG ou WebP et reste limite a 8 Mio. Le navigateur envoie le
fichier avec le JWT Supabase; l'API verifie ensuite le chemin proprietaire, les metadonnees et la
signature binaire avant de conserver le chemin. Un remplacement supprime l'ancien objet seulement
apres la mise a jour du profil. La suppression de compte retire les avatars et bannieres avant
l'anonymisation.

Les e-mails de securite essentiels restent obligatoires. Les autres preferences preparent les futurs
producteurs de notifications sans simuler un systeme d'envoi qui n'existe pas encore.

La migration `20260721100000_profile_collection_visibility.sql` ajoute une confidentialite de
collection distincte avec les valeurs `PUBLIC`, `FRIENDS` et `PRIVATE`. Les colonnes
`show_card_quantities` et `show_collection_completion` permettent de masquer independamment les
copies exactes et la progression. Les comptes existants conservent les valeurs publiques et
visibles par defaut grace aux contraintes `NOT NULL DEFAULT`.

## Profil public et recherche

`GET /api/v1/users/:username/public-profile` recherche exclusivement par
`normalized_username`. Il retourne le role applicatif public et les permissions d'affichage, mais
jamais e-mail, statut de moderation, avertissement, identifiant Auth, preference privee ou audit.
Les statistiques sont chargees separement par `GET /api/v1/users/:username/profile-stats` et sont
omises selon les preferences de collection et de jeu.

`GET /api/v1/users/:username/collection` conserve le contrat historique. Les profils utilisent
`GET /api/v1/me/collection/seasons` ou
`GET /api/v1/users/:username/collection/seasons` pour obtenir les agregats et cinq cartes maximum
par saison. L'apercu suit un ordre stable : rarete decroissante, numero de collection croissant,
puis ordre de variante. Le premier booster publie et actif par `sort_order`, puis par nom, fournit
le visuel; aucun booster n'est choisi aleatoirement. Le profil propre conserve les saisons vides,
alors que le profil public les masque.

Les endpoints `GET /api/v1/me/collection/seasons/:seasonSlug` et leur variante publique appliquent
recherche, rarete, type, Commandant, possession personnelle, tri et pagination cote serveur.
L'action visible des blocs s'appelle `Explorer la collection`. `ProfileAccessPolicyService`
centralise l'acces au profil, aux
statistiques, a la collection, aux quantites et aux demandes d'amis. Une collection `FRIENDS`
exige une ligne d'amitie effective; une demande en attente ne suffit pas. L'endpoint public ne
retourne jamais les quantites reservees ni les dates d'obtention.

Les familles TanStack Query `profileQueryKeys.seasonCollections(username)` et
`profileQueryKeys.seasonCollection(username, seasonSlug, filters)` separent les resumes, les pages
detaillees, le proprietaire et les profils publics. Les mutations d'inventaire invalident la racine
profil et collection, sans recharger le reste de l'application.

`GET /api/v1/users/search` exige une session, au moins deux caracteres, une pagination bornee a 50
et un rate limit dedie. Les comptes desactives, supprimes, masques par
`appear_in_user_search=false` et toute relation bloquee sont exclus.

## Amis et blocages

Les mutations sont autoritaires dans NestJS et transactionnelles :

- `friend_requests` conserve les etats `PENDING`, `ACCEPTED`, `DECLINED` et `CANCELLED` ;
- un index partiel sur `least(user_id)` / `greatest(user_id)` interdit les doublons actifs directs
  et inverses ;
- `friendships` stocke les UUID dans l'ordre canonique et impose une paire unique ;
- `user_blocks` interdit l'auto-blocage et une paire dupliquee.

Le destinataire seul accepte ou refuse. L'expediteur seul annule. Les deux comptes doivent rester
actifs lors de l'acceptation. Un blocage annule les demandes en attente et retire l'amitie dans la
meme transaction. Il n'envoie aucune notification et l'API publique ne revele pas a la personne
bloquee la raison de l'indisponibilite.

Endpoints :

```text
GET    /api/v1/me/friends
GET    /api/v1/me/friend-requests
GET    /api/v1/me/friend-requests/sent
POST   /api/v1/users/:userId/friend-request
POST   /api/v1/users/by-username/:username/friend-request
POST   /api/v1/users/by-username/:username/friend-request/accept
POST   /api/v1/users/by-username/:username/friend-request/decline
DELETE /api/v1/users/by-username/:username/friendship
POST   /api/v1/users/by-username/:username/block
DELETE /api/v1/users/by-username/:username/block
POST   /api/v1/me/friend-requests/:requestId/accept
POST   /api/v1/me/friend-requests/:requestId/decline
DELETE /api/v1/me/friend-requests/:requestId
DELETE /api/v1/me/friends/:userId
GET    /api/v1/me/blocked-users
POST   /api/v1/users/:userId/block
DELETE /api/v1/users/:userId/block
```

## Compte et Supabase Auth

Le changement d'e-mail et de mot de passe utilise l'API officielle Supabase Auth avec le bearer
token de l'utilisateur. Un code de reauthentification Supabase est demande. Le trigger
`on_auth_user_email_updated` synchronise l'e-mail applicatif apres la confirmation effective.
Les mots de passe et codes ne sont jamais ecrits dans PostgreSQL, les audits ou les logs.

```text
GET   /api/v1/me/account/security-settings
POST  /api/v1/me/account/reauthenticate
PATCH /api/v1/me/account/email
PATCH /api/v1/me/account/password
POST  /api/v1/me/account/sessions/revoke
POST  /api/v1/me/account/deactivate
POST  /api/v1/me/account/reactivate
POST  /api/v1/me/account/deletion-request
POST  /api/v1/me/account/deletion-cancel
```

La desactivation revoque toutes les sessions et masque le compte, tout en conservant collection,
decks et amities. Une reconnexion officielle permet d'ouvrir la page Compte et de confirmer la
reactivation. Le guard verifie d'abord le bannissement ou la suspension : la reactivation volontaire
ne les contourne jamais.

## Suppression programmee et anonymisation

Une demande applique une periode de grace de 30 jours, desactive le compte et revoque ses sessions.
L'annulation est possible apres reconnexion tant que l'echeance n'est pas passee.
`AccountService.processDueDeletions()` constitue le traitement serveur idempotent, par lots bornes.
Aucun cron de production n'est active : l'exploitation doit planifier cet appel dans un worker
protege et superviser son resultat.

| Categorie                                                         | Traitement                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Avatar, bio, nom affiche, preferences                             | supprimes                                                                             |
| Demandes, amities, blocages, decks, collection, missions, wallets | supprimes                                                                             |
| Identite du profil                                                | username et e-mail pseudonymises, role ramene a `USER`                                |
| Classement public                                                 | supprime                                                                              |
| Matchs, ouvertures, transactions, moderation                      | conserves sous UUID pseudonyme pour l'integrite, la fraude et les obligations legales |
| Evenements de securite et acteur des audits                       | identifiant retire, metadonnees minimisees                                            |
| Supabase Auth                                                     | supprime en dernier                                                                   |

Le lien historique direct entre `user_profiles.id` et `auth.users` est retire par la migration pour
permettre cette pseudonymisation. Le trigger de creation Auth reste l'autorite de provisionnement.

## Migration et RLS

`20260719110000_personal_space_social_account_lifecycle.sql` est additive. Elle ajoute les enums,
tables, contraintes, index, triggers, backfill et policies. Les utilisateurs lisent leurs propres
preferences, demandes, amities, blocages et evenements. Les mutations sociales et de compte ne sont
pas accordees a `authenticated` et passent par NestJS. Le `service_role`, les URLs de base et les
tokens restent exclusivement serveur.
