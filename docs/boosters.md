# Boosters Safir

## Règle de contenu

Un booster contient toujours huit cartes. Les positions 1 à 6 tirent une carte publiée, active et
non archivée de la saison et de la rareté commune configurées. Les positions 7 et 8 effectuent
chacune un tirage indépendant parmi les raretés premium, puis choisissent une carte éligible de la
rareté obtenue dans la même saison. Les doublons sont autorisés.

Les taux sont stockés dans `booster_rarity_drop_rates.drop_rate_bps` en points de base. `10000`
représente 100 %. Le formulaire convertit au plus deux décimales de pourcentage en entier; Zod,
le service admin, l’activation et l’ouverture exigent tous un total exact de `10000`. La rareté
commune garantie ne peut pas figurer dans ces taux.

## Données et variantes

`booster_products` est l’entité de design. Plusieurs lignes peuvent référencer la même
`card_seasons`, avec un nom, un slug, un visuel, un prix, des dates et des taux indépendants.
`booster_product_slots` est conservée uniquement pour la compatibilité des anciennes données et
ne pilote plus les nouvelles ouvertures.

Le pool par défaut vient de `cards.season_id`. Une carte doit être publiée, active, non archivée et
posséder une variante. La première variante existante selon `display_order` est utilisée; aucune
variante n’est créée pendant une ouverture. La collection reste donc exclusivement fondée sur
`user_cards.card_variant_id`.

La création administrative d’une carte ajoute sa variante `standard`. La migration
`20260719233000_backfill_standard_card_variants.sql` ajoute cette même variante uniquement aux
cartes historiques qui n’en possèdent aucune.

`pack_openings` conserve la saison, le coût et le nom du booster au moment de l’ouverture.
`pack_opening_cards` conserve huit lignes, une par position, avec la catégorie `COMMON` ou
`PREMIUM`, les identifiants carte/variante/rareté, les noms en snapshot et les quantités avant et
après attribution.

## Ouverture autoritaire

Le navigateur envoie uniquement l’identifiant du booster et un UUID d’idempotence. NestJS charge
la configuration, valide la saison et les pools, puis utilise `crypto.randomInt` via
`BoosterRandomService`. `BoosterDrawService` centralise le tirage entier pondéré et accepte une
source déterministe dans les tests.

Une transaction PostgreSQL sérialisable effectue, dans cet ordre logique, le débit éventuel, la
création de l’ouverture, les huit `upsert` de collection, les huit résultats et la finalisation. Un
coût nul ne crée aucune transaction monétaire. Un coût positif exige une monnaie, décrémente le
portefeuille avec une condition de solde et écrit `currency_transactions`. Tout échec annule
l’ensemble.

La contrainte `(user_id, idempotency_key)` empêche les replays. Une nouvelle action volontaire
génère un UUID; une relance réseau réutilise le même UUID et retourne l’ouverture achevée sans
nouveau débit ni nouveau tirage.

## Séquence visuelle et reprise

Après le succès du `POST`, le client place le résultat autoritaire dans le cache TanStack Query et
navigue vers `/boosters/open/[openingId]`. Cette route recharge au besoin
`GET /api/v1/me/pack-openings/:id`, qui vérifie le propriétaire. La scène ne tire aucune carte et ne
modifie jamais les quantités : elle trie et valide les huit emplacements reçus, puis anime ce
résultat déjà persisté.

La séquence suit une machine d’états typée : chargement, préchargement des visuels, coupe,
ouverture, sortie des cartes, révélation unitaire, récapitulatif et fin. Les emplacements 1 à 6
doivent être `COMMON` et les emplacements 7 et 8 `PREMIUM`; un résultat incomplet, dupliqué ou mal
catégorisé est refusé. Les seuils de coupe et de balayage sont centralisés et les gestes gauche et
droite avancent tous deux vers la carte suivante. Le clavier propose les mêmes actions.

Une progression locale versionnée par `openingId` permet de reprendre après actualisation. Elle
n’est écrite qu’après une interaction significative, à partir de la coupe validée, expire après
sept jours et est supprimée au récapitulatif. Les formats invalides, incohérents ou rattachés à une
autre ouverture sont supprimés. Cette progression n’est jamais une source métier : le résultat
complet est relu depuis l’API.

Le mode d’entrée est décidé une seule fois après le chargement : récapitulatif demandé, replay,
marqueur frais en `sessionStorage`, progression significative à reprendre, puis ouverture fraîche
par défaut. Le marqueur posé juste avant la navigation depuis le catalogue est consommé de manière
idempotente. Une ouverture sans progression, y compris après un rechargement avant la coupe,
revient directement au booster fermé sans modal. `/boosters/history` propose le récapitulatif et un
replay visuel; ces actions ne rappellent jamais le `POST` d’ouverture.

Les images du booster et des huit cartes sont préchargées avec un délai maximal et un fallback. Le
PNG du booster est rendu avec `next/image`, `object-contain` et un parent transparent; ses deux
calques découpés partagent une ombre `drop-shadow` de silhouette, sans surface rectangulaire. La
scène Three.js est chargée uniquement sur la route d’ouverture. En mouvement réduit, les
transitions sont supprimées et les boutons restent l’action principale accessible.

## Administration et sécurité

Les permissions `BOOSTERS_READ_ADMIN`, `BOOSTERS_CREATE`, `BOOSTERS_UPDATE`,
`BOOSTERS_ARCHIVE` et `BOOSTERS_MANAGE_DROP_RATES` sont accordées aux modérateurs et
administrateurs. `BOOSTERS_RESTORE` et `BOOSTERS_DELETE_PERMANENTLY` restent réservées aux
administrateurs. Une suppression définitive est refusée dès qu’un historique référence le
booster.

Toutes les mutations admin passent par NestJS, une transaction Prisma et `admin_audit_logs`. RLS
ne publie que les boosters actifs, publiés et non archivés. Les taux n’ont aucune policy de lecture
directe et toutes les écritures de boosters, taux, ouvertures, collection et monnaie sont révoquées
pour `anon` et `authenticated`. Le bucket public `booster-designs` limite les images à 10 Mio et
aux formats JPEG, PNG, WebP et AVIF; seules les identités privilégiées peuvent y écrire.

## Endpoints

Administration :

```text
GET/POST            /api/v1/admin/boosters
GET/PATCH/DELETE    /api/v1/admin/boosters/:id
POST                /api/v1/admin/boosters/:id/duplicate
POST                /api/v1/admin/boosters/:id/activate
POST                /api/v1/admin/boosters/:id/deactivate
POST                /api/v1/admin/boosters/:id/restore
DELETE              /api/v1/admin/boosters/:id/permanent
GET/PUT             /api/v1/admin/boosters/:id/drop-rates
POST                /api/v1/admin/boosters/:id/validate
```

Public et utilisateur :

```text
GET                 /api/v1/booster-products
GET                 /api/v1/booster-products/:id
GET                 /api/v1/booster-products/:id/drop-rates
POST                /api/v1/booster-products/:id/open
GET                 /api/v1/me/pack-openings
GET                 /api/v1/me/pack-openings/:id
```

`GET /api/v1/me/booster-openings` reste un alias de compatibilité limité aux douze dernières
ouvertures.
