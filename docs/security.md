# Modèle de sécurité

- Supabase SQL est l’unique source de vérité du schéma et des policies RLS.
- Les clients peuvent lire le catalogue publié et leurs propres données.
- Les clients peuvent gérer leurs decks, mais jamais écrire l’inventaire, les monnaies, les tirages ou les résultats de match.
- L’API vérifie le JWT Supabase par JWKS, dérive toujours l’utilisateur du `sub` vérifié et utilise une connexion serveur protégée.
- La configuration pondérée des boosters n’est pas exposée par RLS. Le tirage utilise une source aléatoire cryptographique et une transaction sérialisable.
- Les événements de match sont produits par le moteur serveur et versionnés; le navigateur n’envoie que des intentions validées.
- Les uploads sont limités par bucket, taille, extension et ownership. L’application doit également vérifier le contenu MIME réel avant tout upload privilégié.
