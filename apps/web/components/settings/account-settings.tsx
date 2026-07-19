'use client';

import type { AccountSecuritySettings } from '@safir/shared-types';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  ErrorState,
  Input,
  Panel,
  SectionHeader,
  Skeleton,
  Textarea,
} from '@safir/ui';
import {
  accountDeactivateSchema,
  accountDeletionCancelSchema,
  accountDeletionRequestSchema,
  accountEmailUpdateSchema,
  accountPasswordUpdateSchema,
  accountReactivateSchema,
} from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, Mail, Power, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '../auth-provider';

function fieldMessage(
  result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
  field: string,
) {
  if (result.success) return null;
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

export function AccountSettings() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const { signOut, refreshProfile } = useAuth();
  const [reauthCodeSent, setReauthCodeSent] = useState(false);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionsDialog, setSessionsDialog] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [confirmationUsername, setConfirmationUsername] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');

  const settings = useQuery({
    queryKey: queryKeys.accountSecurity,
    queryFn: () => apiFetch<AccountSecuritySettings>('/api/v1/me/account/security-settings'),
  });
  const action = useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body = {},
    }: {
      path: string;
      method?: 'POST' | 'PATCH';
      body?: unknown;
    }) => apiFetch<unknown>(path, { method, body: JSON.stringify(body) }),
    onError: (error) => setFormError(error.message),
  });
  const resetDangerForm = () => {
    setConfirmationUsername('');
    setConfirmed(false);
    setReason('');
    setFormError(null);
  };
  const refreshAccount = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.accountSecurity }),
      client.invalidateQueries({ queryKey: queryKeys.profile }),
    ]);
    await refreshProfile();
  };
  const leaveApplication = async () => {
    await signOut().catch(() => undefined);
    window.location.assign('/login');
  };

  if (settings.isLoading) return <Skeleton className="h-[42rem]" />;
  if (settings.isError || !settings.data) return <ErrorState message="Compte indisponible." />;

  if (settings.data.isDeactivated) {
    const deletionScheduled = settings.data.deletion.state === 'SCHEDULED';
    const schema = deletionScheduled ? accountDeletionCancelSchema : accountReactivateSchema;
    return (
      <Panel>
        <SectionHeader
          title={deletionScheduled ? 'Suppression programmée' : 'Compte désactivé'}
          description={
            deletionScheduled
              ? `La suppression est prévue le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(settings.data.deletion.scheduledFor!))}.`
              : 'Vos données sont conservées et votre profil public reste masqué.'
          }
        />
        <div className="max-w-lg space-y-4">
          <label className="block text-sm font-medium">
            Confirmez votre username
            <Input
              className="mt-1.5"
              value={confirmationUsername}
              onChange={(event) => setConfirmationUsername(event.target.value)}
            />
          </label>
          <Checkbox
            id="reactivation-confirmation"
            label={
              deletionScheduled ? "J'annule la suppression programmée" : 'Je réactive mon compte'
            }
            checked={confirmed}
            onCheckedChange={setConfirmed}
          />
          {formError ? <ErrorState message={formError} /> : null}
          <Button
            loading={action.isPending}
            onClick={() => {
              const parsed = schema.safeParse({ confirmationUsername, confirmed });
              if (!parsed.success) {
                setFormError(parsed.error.issues[0]?.message ?? 'Confirmation invalide.');
                return;
              }
              action.mutate(
                {
                  path: deletionScheduled
                    ? '/api/v1/me/account/deletion-cancel'
                    : '/api/v1/me/account/reactivate',
                  body: parsed.data,
                },
                {
                  onSuccess: async () => {
                    notify(
                      deletionScheduled ? 'Suppression annulée.' : 'Compte réactivé.',
                      'success',
                    );
                    await refreshAccount();
                    window.location.assign('/profile');
                  },
                },
              );
            }}
          >
            <RotateCcw className="size-4" />
            {deletionScheduled ? 'Annuler la suppression' : 'Réactiver mon compte'}
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeader
          title="Adresse e-mail"
          description={`Adresse actuelle : ${settings.data.email}`}
        />
        <div className="max-w-lg space-y-4">
          <label className="block text-sm font-medium">
            Nouvelle adresse e-mail
            <Input
              className="mt-1.5"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Code de réauthentification
            <Input
              className="mt-1.5"
              inputMode="numeric"
              maxLength={6}
              value={emailCode}
              onChange={(event) => setEmailCode(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  { path: '/api/v1/me/account/reauthenticate' },
                  {
                    onSuccess: () => {
                      setReauthCodeSent(true);
                      notify('Code de réauthentification envoyé.', 'success');
                    },
                  },
                )
              }
            >
              <Mail className="size-4" /> Envoyer un code
            </Button>
            <Button
              size="sm"
              loading={action.isPending}
              onClick={() => {
                const parsed = accountEmailUpdateSchema.safeParse({
                  email,
                  reauthenticationNonce: emailCode,
                });
                if (!parsed.success) {
                  setFormError(
                    fieldMessage(parsed, 'email') ??
                      fieldMessage(parsed, 'reauthenticationNonce') ??
                      'Formulaire invalide.',
                  );
                  return;
                }
                action.mutate(
                  { path: '/api/v1/me/account/email', method: 'PATCH', body: parsed.data },
                  {
                    onSuccess: () => {
                      notify(
                        'Consultez vos e-mails pour confirmer la nouvelle adresse.',
                        'success',
                      );
                      setEmail('');
                      setEmailCode('');
                      setFormError(null);
                    },
                  },
                );
              }}
            >
              Enregistrer
            </Button>
          </div>
          {reauthCodeSent ? (
            <p className="text-xs text-success">Le code a été envoyé à votre adresse actuelle.</p>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Mot de passe" />
        <div className="max-w-lg space-y-4">
          <label className="block text-sm font-medium">
            Nouveau mot de passe
            <Input
              className="mt-1.5"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Confirmer le mot de passe
            <Input
              className="mt-1.5"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Code de réauthentification
            <Input
              className="mt-1.5"
              inputMode="numeric"
              maxLength={6}
              value={passwordCode}
              onChange={(event) => setPasswordCode(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  { path: '/api/v1/me/account/reauthenticate' },
                  { onSuccess: () => notify('Code de réauthentification envoyé.', 'success') },
                )
              }
            >
              <KeyRound className="size-4" /> Envoyer un code
            </Button>
            <Button
              size="sm"
              loading={action.isPending}
              onClick={() => {
                const parsed = accountPasswordUpdateSchema.safeParse({
                  password,
                  confirmPassword,
                  reauthenticationNonce: passwordCode,
                });
                if (!parsed.success) {
                  setFormError(parsed.error.issues[0]?.message ?? 'Formulaire invalide.');
                  return;
                }
                action.mutate(
                  { path: '/api/v1/me/account/password', method: 'PATCH', body: parsed.data },
                  {
                    onSuccess: () => {
                      notify('Mot de passe modifié.', 'success');
                      setPassword('');
                      setConfirmPassword('');
                      setPasswordCode('');
                      setFormError(null);
                    },
                  },
                );
              }}
            >
              Modifier le mot de passe
            </Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title="Sessions"
          description="Révoque toutes les sessions, y compris celle utilisée actuellement."
        />
        <Button variant="secondary" onClick={() => setSessionsDialog(true)}>
          <LogOut className="size-4" /> Déconnecter toutes les sessions
        </Button>
      </Panel>

      {formError ? <ErrorState message={formError} /> : null}

      <section className="rounded-lg border border-danger/20 bg-surface p-5 sm:p-6">
        <SectionHeader
          title="Zone dangereuse"
          description="Ces actions masquent votre profil et interrompent votre accès."
        />
        <div className="flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm font-medium">Désactivation temporaire</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vos données et vos amitiés sont conservées.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDeactivateDialog(true)}>
            <Power className="size-4" /> Désactiver mon compte
          </Button>
        </div>
        <div className="mt-4 flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm font-medium">Suppression définitive</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Une période d&apos;annulation de 30 jours est appliquée.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setDeleteDialog(true)}>
            <Trash2 className="size-4" /> Supprimer définitivement
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={sessionsDialog}
        onOpenChange={setSessionsDialog}
        title="Déconnecter toutes les sessions ?"
        description="Vous devrez vous reconnecter sur chaque appareil."
        confirmLabel="Tout déconnecter"
        loading={action.isPending}
        onConfirm={() =>
          action.mutate(
            { path: '/api/v1/me/account/sessions/revoke', body: { confirmation: true } },
            { onSuccess: leaveApplication },
          )
        }
      />

      <Dialog
        open={deactivateDialog}
        onOpenChange={(open) => {
          setDeactivateDialog(open);
          if (!open) resetDangerForm();
        }}
        title="Désactiver mon compte"
        description="Le profil public sera masqué et toutes les sessions seront fermées."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeactivateDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={action.isPending}
              onClick={() => {
                const parsed = accountDeactivateSchema.safeParse({
                  confirmationUsername,
                  confirmed,
                });
                if (!parsed.success) {
                  setFormError(parsed.error.issues[0]?.message ?? 'Confirmation invalide.');
                  return;
                }
                action.mutate(
                  { path: '/api/v1/me/account/deactivate', body: parsed.data },
                  { onSuccess: leaveApplication },
                );
              }}
            >
              Confirmer la désactivation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Saisissez votre username
            <Input
              className="mt-1.5"
              value={confirmationUsername}
              onChange={(event) => setConfirmationUsername(event.target.value)}
            />
          </label>
          <Checkbox
            id="deactivate-confirm"
            label="Je comprends les conséquences"
            checked={confirmed}
            onCheckedChange={setConfirmed}
          />
          {formError ? <ErrorState message={formError} /> : null}
        </div>
      </Dialog>

      <Dialog
        open={deleteDialog}
        onOpenChange={(open) => {
          setDeleteDialog(open);
          if (!open) resetDangerForm();
        }}
        title="Programmer la suppression"
        description="Le compte sera désactivé maintenant puis anonymisé après 30 jours."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={action.isPending}
              onClick={() => {
                const parsed = accountDeletionRequestSchema.safeParse({
                  confirmationUsername,
                  confirmed,
                  reason: reason || null,
                });
                if (!parsed.success) {
                  setFormError(parsed.error.issues[0]?.message ?? 'Confirmation invalide.');
                  return;
                }
                action.mutate(
                  { path: '/api/v1/me/account/deletion-request', body: parsed.data },
                  { onSuccess: leaveApplication },
                );
              }}
            >
              Programmer la suppression
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Saisissez votre username
            <Input
              className="mt-1.5"
              value={confirmationUsername}
              onChange={(event) => setConfirmationUsername(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Raison facultative
            <Textarea
              className="mt-1.5"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Checkbox
            id="delete-confirm"
            label="Je demande la suppression définitive après 30 jours"
            checked={confirmed}
            onCheckedChange={setConfirmed}
          />
          {formError ? <ErrorState message={formError} /> : null}
        </div>
      </Dialog>
    </div>
  );
}
