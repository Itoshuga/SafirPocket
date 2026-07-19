'use client';

import { ErrorState, Panel, SectionHeader, Skeleton } from '@safir/ui';
import { PrivacySettingRow } from './privacy-setting-row';
import { usePreferences } from './use-preferences';

export function PrivacySettingsForm() {
  const { query, update } = usePreferences();
  if (query.isLoading) return <Skeleton className="h-[34rem]" />;
  if (query.isError || !query.data) return <ErrorState message="Préférences indisponibles." />;
  const preferences = query.data;
  const save = (body: Record<string, boolean | string>) => update.mutate(body);
  return (
    <Panel>
      <SectionHeader
        title="Confidentialité"
        description="Choisissez les informations visibles et la manière dont les autres joueurs peuvent vous trouver."
      />
      <PrivacySettingRow
        id="profile-public"
        title="Profil public"
        description="Votre page publique, votre biographie et les statistiques autorisées sont consultables."
        checked={preferences.profileVisibility === 'PUBLIC'}
        disabled={update.isPending}
        onChange={(checked) => save({ profileVisibility: checked ? 'PUBLIC' : 'PRIVATE' })}
      />
      <PrivacySettingRow
        id="appear-search"
        title="Apparaître dans la recherche"
        description="Votre username peut être trouvé dans la recherche de joueurs, même avec un profil privé."
        checked={preferences.appearInUserSearch}
        disabled={update.isPending}
        onChange={(checked) => save({ appearInUserSearch: checked })}
      />
      <PrivacySettingRow
        id="friend-requests"
        title="Autoriser les demandes d'amis"
        description="Les autres joueurs peuvent vous envoyer une demande, sous réserve des blocages."
        checked={preferences.allowFriendRequests}
        disabled={update.isPending}
        onChange={(checked) => save({ allowFriendRequests: checked })}
      />
      <PrivacySettingRow
        id="online-status"
        title="Afficher le statut en ligne"
        description="Prépare la visibilité de votre statut lorsque la présence temps réel sera activée."
        checked={preferences.showOnlineStatus}
        disabled={update.isPending}
        onChange={(checked) => save({ showOnlineStatus: checked })}
      />
      <PrivacySettingRow
        id="collection-stats"
        title="Afficher les statistiques de collection"
        description="Autorise les totaux de cartes et de decks sur votre profil public."
        checked={preferences.showCollectionStats}
        disabled={update.isPending}
        onChange={(checked) => save({ showCollectionStats: checked })}
      />
      <PrivacySettingRow
        id="game-stats"
        title="Afficher les statistiques de jeu"
        description="Autorise les parties, victoires et informations de classement sur votre profil public."
        checked={preferences.showGameStats}
        disabled={update.isPending}
        onChange={(checked) => save({ showGameStats: checked })}
      />
    </Panel>
  );
}
