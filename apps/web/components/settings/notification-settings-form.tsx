'use client';

import { ErrorState, Panel, SectionHeader, Skeleton } from '@safir/ui';
import { PrivacySettingRow } from './privacy-setting-row';
import { usePreferences } from './use-preferences';

export function NotificationSettingsForm() {
  const { query, update } = usePreferences();
  if (query.isLoading) return <Skeleton className="h-[32rem]" />;
  if (query.isError || !query.data) return <ErrorState message="Préférences indisponibles." />;
  const value = query.data;
  const save = (body: Record<string, boolean>) => update.mutate(body);
  return (
    <Panel>
      <SectionHeader
        title="Notifications"
        description="Ajustez les communications optionnelles. Les alertes de sécurité essentielles restent actives."
      />
      <PrivacySettingRow
        id="security-emails"
        title="E-mails de sécurité"
        description="Connexion sensible, changement de mot de passe et cycle de suppression du compte."
        checked
        disabled
        onChange={() => undefined}
      />
      <PrivacySettingRow
        id="email-notifications"
        title="Notifications par e-mail"
        description="Autorise les communications de service non obligatoires."
        checked={value.emailNotifications}
        disabled={update.isPending}
        onChange={(checked) => save({ emailNotifications: checked })}
      />
      <PrivacySettingRow
        id="request-notifications"
        title="Demandes d'amis"
        description="Recevez une notification lorsqu'un joueur vous ajoute."
        checked={value.friendRequestNotifications}
        disabled={update.isPending}
        onChange={(checked) => save({ friendRequestNotifications: checked })}
      />
      <PrivacySettingRow
        id="acceptance-notifications"
        title="Acceptations d'amis"
        description="Recevez une notification lorsqu'une demande est acceptée."
        checked={value.friendAcceptanceNotifications}
        disabled={update.isPending}
        onChange={(checked) => save({ friendAcceptanceNotifications: checked })}
      />
      <PrivacySettingRow
        id="game-invites"
        title="Invitations de partie"
        description="Prépare les alertes liées aux futures invitations de jeu."
        checked={value.gameInviteNotifications}
        disabled={update.isPending}
        onChange={(checked) => save({ gameInviteNotifications: checked })}
      />
      <PrivacySettingRow
        id="game-news"
        title="Actualités du jeu"
        description="Nouveautés de Safir TCG et informations de saison."
        checked={value.gameNewsNotifications}
        disabled={update.isPending}
        onChange={(checked) => save({ gameNewsNotifications: checked })}
      />
      <PrivacySettingRow
        id="marketing-emails"
        title="E-mails marketing"
        description="Offres et communications promotionnelles optionnelles."
        checked={value.marketingEmails}
        disabled={update.isPending}
        onChange={(checked) => save({ marketingEmails: checked })}
      />
    </Panel>
  );
}
