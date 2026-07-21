export function profileSeasonCollectionHref({
  username,
  seasonSlug,
  ownProfile,
}: {
  username: string;
  seasonSlug: string;
  ownProfile: boolean;
}): string {
  const encodedSeason = encodeURIComponent(seasonSlug);
  return ownProfile
    ? `/profile/collection/${encodedSeason}`
    : `/users/${encodeURIComponent(username)}/collection/${encodedSeason}`;
}

export function profileHref(username?: string): string {
  return username ? `/users/${encodeURIComponent(username)}#collection` : '/profile#collection';
}
