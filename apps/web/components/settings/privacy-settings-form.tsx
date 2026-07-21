'use client';

import { ErrorState, Panel, SectionHeader, Select, Skeleton } from '@safir/ui';
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
      <div className="border-b border-border py-5">
        <label htmlFor="collection-visibility" className="text-sm font-semibold text-foreground">
          Visibilité de la collection
        </label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Choisissez qui peut parcourir les cartes affichées sur votre profil.
        </p>
        <Select
          id="collection-visibility"
          className="mt-3 max-w-xs"
          value={preferences.collectionVisibility}
          disabled={update.isPending}
          onChange={(event) => save({ collectionVisibility: event.target.value })}
        >
          <option value="PUBLIC">Tout le monde</option>
          <option value="FRIENDS">Amis uniquement</option>
          <option value="PRIVATE">Moi uniquement</option>
        </Select>
      </div>
      <PrivacySettingRow
        id="collection-stats"
        title="Afficher le résumé de collection"
        description="Autorise le nombre de cartes uniques et de decks sur votre profil public."
        checked={preferences.showCollectionStats}
        disabled={update.isPending}
        onChange={(checked) => save({ showCollectionStats: checked })}
      />
      <PrivacySettingRow
        id="card-quantities"
        title="Afficher les quantités de cartes"
        description="Les visiteurs autorisés voient le nombre exact de copies, jamais les quantités réservées."
        checked={preferences.showCardQuantities}
        disabled={update.isPending}
        onChange={(checked) => save({ showCardQuantities: checked })}
      />
      <PrivacySettingRow
        id="collection-completion"
        title="Afficher la progression globale"
        description="Les visiteurs autorisés voient la progression par rapport au catalogue publié."
        checked={preferences.showCollectionCompletion}
        disabled={update.isPending}
        onChange={(checked) => save({ showCollectionCompletion: checked })}
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
