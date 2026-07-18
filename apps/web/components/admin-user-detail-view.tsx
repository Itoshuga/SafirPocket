'use client';

import {
  ROLE_LABELS,
  WARNING_SEVERITY_LABELS,
  canManageUserTarget,
  hasPermission,
  type AdminAuditLog,
  type AdminUserDetails,
  type AppPermission,
  type AppRole,
  type ModerationAction,
  type UserWarning,
  type WarningSeverity,
} from '@safir/shared-types';
import {
  adminUserEmailUpdateSchema,
  adminUserProfileUpdateSchema,
  banSchema,
  moderationSchema,
  passwordResetEmailSchema,
  roleChangeSchema,
  temporaryPasswordSchema,
  warningCreateSchema,
  warningRevokeSchema,
} from '@safir/validation';
import {
  Avatar,
  Badge,
  Button,
  DataList,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Panel,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clipboard,
  KeyRound,
  Mail,
  ShieldAlert,
  Trash2,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiFetch } from '@/lib/api-client';
import {
  applyApiFieldErrors,
  mutationErrorMessage,
  mutationFieldErrors,
  zodFieldErrors,
} from '@/lib/admin-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';

type UserTab = 'overview' | 'profile' | 'security' | 'moderation' | 'history';
type UserAction =
  | 'email'
  | 'password-reset'
  | 'temporary-password'
  | 'warning'
  | 'revoke-warning'
  | 'suspend'
  | 'unsuspend'
  | 'ban'
  | 'unban'
  | 'role';

interface ProfileFormState {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
}

interface ActionFormState {
  email: string;
  temporaryPassword: string;
  confirmPassword: string;
  confirmationUsername: string;
  reason: string;
  internalNote: string;
  severity: WarningSeverity;
  suspensionPreset: '1h' | '24h' | '3d' | '7d' | '30d' | 'custom' | 'indefinite';
  customSuspensionEnd: string;
  role: AppRole;
}

interface PendingAction {
  type: UserAction;
  warningId?: string;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value?: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : 'Non renseignée';
}

function roleTone(role: AppRole) {
  return role === 'ADMINISTRATOR'
    ? 'danger'
    : role === 'MODERATOR'
      ? 'warning'
      : role === 'PIONEER'
        ? 'primary'
        : 'neutral';
}

function statusTone(status: AdminUserDetails['status']) {
  return status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger';
}

function emptyActionForm(user?: AdminUserDetails): ActionFormState {
  return {
    email: user?.email ?? '',
    temporaryPassword: '',
    confirmPassword: '',
    confirmationUsername: '',
    reason: '',
    internalNote: '',
    severity: 'LOW',
    suspensionPreset: '24h',
    customSuspensionEnd: '',
    role: user?.role ?? 'USER',
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
}

function ModerationList({ actions }: { actions: ModerationAction[] }) {
  if (!actions.length) {
    return <p className="text-sm text-muted-foreground">Aucune action de modération.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {actions.map((entry) => (
        <li key={entry.id} className="py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{entry.action}</p>
            <time className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</time>
          </div>
          <p className="mt-1 text-muted-foreground">{entry.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Par {entry.actor?.displayName ?? entry.actor?.username ?? 'Compte supprimé'}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AdminUserDetailView({ userId }: { userId: string }) {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const { profile: actor, refreshProfile } = useAuth();
  const [tab, setTab] = useState<UserTab>('overview');
  const [warningStatus, setWarningStatus] = useState<'all' | 'active' | 'revoked'>('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionForm, setActionForm] = useState<ActionFormState>(() => emptyActionForm());
  const [actionErrors, setActionErrors] = useState<Record<string, string[]>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const user = useQuery({
    queryKey: queryKeys.adminUser(userId),
    queryFn: () => apiFetch<AdminUserDetails>(`/api/v1/admin/users/${userId}`),
  });
  const warnings = useQuery({
    queryKey: queryKeys.adminUserWarnings(userId, warningStatus),
    queryFn: () =>
      apiFetch<UserWarning[]>(`/api/v1/admin/users/${userId}/warnings?status=${warningStatus}`),
    enabled: tab === 'moderation' || tab === 'history',
  });
  const moderationHistory = useQuery({
    queryKey: queryKeys.adminModerationHistory(userId),
    queryFn: () => apiFetch<ModerationAction[]>(`/api/v1/admin/users/${userId}/moderation-history`),
    enabled: tab === 'history',
  });
  const auditLogs = useQuery({
    queryKey: queryKeys.adminUserAuditLogs(userId),
    queryFn: () => apiFetch<AdminAuditLog[]>(`/api/v1/admin/users/${userId}/audit-logs`),
    enabled: tab === 'history',
  });

  const profileForm = useForm<ProfileFormState>({
    defaultValues: { username: '', displayName: '', bio: '', avatarUrl: '' },
  });

  useEffect(() => {
    if (!user.data) return;
    profileForm.reset({
      username: user.data.username,
      displayName: user.data.displayName ?? '',
      bio: user.data.bio ?? '',
      avatarUrl: user.data.avatarUrl ?? '',
    });
  }, [profileForm, user.data]);

  const profileMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch(`/api/v1/admin/users/${userId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      notify('Les modifications du profil ont été enregistrées.', 'success');
      await invalidateUserData();
    },
    onError: (error) => applyApiFieldErrors(error, profileForm.setError),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      type,
      payload,
      warningId,
    }: PendingAction & { payload: Record<string, unknown> }) => {
      const route =
        type === 'email'
          ? 'email'
          : type === 'password-reset'
            ? 'password-reset-email'
            : type === 'temporary-password'
              ? 'temporary-password'
              : type === 'warning'
                ? 'warnings'
                : type === 'revoke-warning'
                  ? `warnings/${warningId}/revoke`
                  : type;
      return apiFetch(`/api/v1/admin/users/${userId}/${route}`, {
        method: type === 'email' || type === 'role' ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (_response, variables) => {
      const messages: Record<UserAction, string> = {
        email: "L'adresse e-mail a été mise à jour.",
        'password-reset': 'Le lien de réinitialisation a été envoyé.',
        'temporary-password': 'Le mot de passe temporaire a été défini.',
        warning: "L'avertissement a été ajouté.",
        'revoke-warning': "L'avertissement a été révoqué.",
        suspend: "L'utilisateur a été suspendu.",
        unsuspend: 'La suspension a été levée.',
        ban: "L'utilisateur a été banni.",
        unban: "L'utilisateur a été débanni.",
        role: 'Le rôle a été modifié.',
      };
      notify(messages[variables.type], 'success');
      setPendingAction(null);
      setActionErrors({});
      setActionError(null);
      await invalidateUserData();
    },
    onError: (error) => {
      setActionErrors(mutationFieldErrors(error));
      setActionError(mutationErrorMessage(error));
    },
  });

  async function invalidateUserData() {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.adminUser(userId) }),
      client.invalidateQueries({ queryKey: ['admin', 'user', userId, 'warnings'] }),
      client.invalidateQueries({ queryKey: queryKeys.adminModerationHistory(userId) }),
      client.invalidateQueries({ queryKey: queryKeys.adminUserAuditLogs(userId) }),
      client.invalidateQueries({ queryKey: ['admin', 'users'] }),
      client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
    ]);
    if (actor?.id === userId) await refreshProfile();
  }

  function setActionField<K extends keyof ActionFormState>(field: K, value: ActionFormState[K]) {
    setActionForm((current) => ({ ...current, [field]: value }));
    setActionErrors((current) => ({ ...current, [field]: [] }));
    setActionError(null);
  }

  function openAction(type: UserAction, warningId?: string) {
    setActionForm(emptyActionForm(user.data));
    setActionErrors({});
    setActionError(null);
    setPendingAction({ type, warningId });
  }

  function suspensionEnd(): string | null | undefined {
    const preset = actionForm.suspensionPreset;
    if (preset === 'indefinite') return null;
    if (preset === 'custom') {
      if (!actionForm.customSuspensionEnd) return undefined;
      return new Date(actionForm.customSuspensionEnd).toISOString();
    }
    const hours = { '1h': 1, '24h': 24, '3d': 72, '7d': 168, '30d': 720 }[preset];
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }

  function submitAction() {
    if (!pendingAction) return;
    const commonModeration = {
      reason: actionForm.reason,
      internalNote: actionForm.internalNote,
    };
    const parsed = (() => {
      switch (pendingAction.type) {
        case 'email':
          return adminUserEmailUpdateSchema.safeParse({ email: actionForm.email });
        case 'password-reset':
          return passwordResetEmailSchema.safeParse({});
        case 'temporary-password':
          if (actionForm.temporaryPassword !== actionForm.confirmPassword) {
            return temporaryPasswordSchema.safeParse({
              temporaryPassword: actionForm.temporaryPassword,
              confirmationUsername: actionForm.confirmationUsername,
              unexpectedConfirmationError: true,
            });
          }
          return temporaryPasswordSchema.safeParse({
            temporaryPassword: actionForm.temporaryPassword,
            confirmationUsername: actionForm.confirmationUsername,
          });
        case 'warning':
          return warningCreateSchema.safeParse({
            ...commonModeration,
            severity: actionForm.severity,
          });
        case 'revoke-warning':
          return warningRevokeSchema.safeParse(commonModeration);
        case 'suspend': {
          const end = suspensionEnd();
          if (end === undefined) {
            setActionErrors({ customSuspensionEnd: ['Choisissez une date de fin.'] });
            return null;
          }
          return moderationSchema.safeParse({ ...commonModeration, suspendedUntil: end });
        }
        case 'ban':
          return banSchema.safeParse({
            ...commonModeration,
            confirmationUsername: actionForm.confirmationUsername,
          });
        case 'role':
          return roleChangeSchema.safeParse({
            ...commonModeration,
            role: actionForm.role,
            ...(actor?.id === userId
              ? { confirmationUsername: actionForm.confirmationUsername }
              : {}),
          });
        default:
          return moderationSchema.safeParse(commonModeration);
      }
    })();
    if (!parsed) return;
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      if (
        pendingAction.type === 'temporary-password' &&
        actionForm.temporaryPassword !== actionForm.confirmPassword
      ) {
        errors.confirmPassword = ['Les mots de passe ne correspondent pas.'];
      }
      setActionErrors(errors);
      setActionError('Vérifiez les champs signalés.');
      return;
    }
    actionMutation.mutate({
      ...pendingAction,
      payload: parsed.data as Record<string, unknown>,
    });
  }

  function submitProfile(values: ProfileFormState) {
    profileForm.clearErrors();
    const parsed = adminUserProfileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      for (const [field, messages] of Object.entries(zodFieldErrors(parsed.error))) {
        if (messages[0]) {
          profileForm.setError(field as keyof ProfileFormState, { message: messages[0] });
        }
      }
      return;
    }
    profileMutation.mutate(parsed.data as Record<string, unknown>);
  }

  if (user.isLoading) return <Skeleton className="h-[44rem]" />;
  if (user.isError || !user.data) {
    return (
      <ErrorState
        title="Utilisateur introuvable"
        message="Le profil demandé n'a pas pu être chargé."
        action={<Button onClick={() => void user.refetch()}>Réessayer</Button>}
      />
    );
  }

  const target = user.data;
  const can = (permission: AppPermission) =>
    Boolean(actor && canManageUserTarget(actor, target, permission));
  const canReadHistory = Boolean(
    actor && hasPermission(actor.role, 'USERS_VIEW_MODERATION_HISTORY'),
  );

  return (
    <div>
      <header className="mb-6 border-b border-border pb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" />
            Utilisateurs
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar
              src={target.avatarUrl}
              alt={target.username}
              fallback={target.username}
              size="lg"
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{target.username}</h1>
              <p className="truncate text-sm text-muted-foreground">{target.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={roleTone(target.role)}>{target.roleLabel}</Badge>
                <Badge tone={statusTone(target.status)}>{target.statusLabel}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('USERS_WARN') ? (
              <Button variant="secondary" size="sm" onClick={() => openAction('warning')}>
                <ShieldAlert className="size-4" />
                Avertir
              </Button>
            ) : null}
            {can('USERS_BAN') && target.status !== 'BANNED' ? (
              <Button variant="danger" size="sm" onClick={() => openAction('ban')}>
                <Ban className="size-4" />
                Bannir
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>Inscription: {formatDate(target.createdAt)}</span>
          <span>Dernière connexion: {formatDate(target.lastLoginAt)}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => {
              void navigator.clipboard.writeText(target.id);
              notify("L'identifiant a été copié.", 'success');
            }}
          >
            <Clipboard className="size-3.5" />
            {target.id}
          </button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as UserTab)}
        tabs={[
          { value: 'overview', label: "Vue d'ensemble" },
          { value: 'profile', label: 'Profil' },
          { value: 'security', label: 'Sécurité' },
          { value: 'moderation', label: 'Modération' },
          { value: 'history', label: 'Historique' },
        ]}
      >
        <Tabs.Content value="overview">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <h2 className="mb-3 text-base font-semibold">Compte</h2>
              <DataList
                items={[
                  { label: "Nom d'utilisateur", value: `@${target.username}` },
                  { label: 'Nom affiché', value: target.displayName ?? 'Non renseigné' },
                  { label: 'E-mail', value: target.email },
                  { label: 'Rôle', value: target.roleLabel },
                  { label: 'Statut', value: target.statusLabel },
                  { label: 'Inscription', value: formatDate(target.createdAt) },
                  { label: 'Dernière connexion', value: formatDate(target.lastLoginAt) },
                ]}
              />
            </Panel>
            <Panel>
              <h2 className="mb-3 text-base font-semibold">Modération</h2>
              <DataList
                items={[
                  { label: 'Avertissements actifs', value: target.activeWarningsCount },
                  { label: 'Avertissements au total', value: target.totalWarningsCount },
                  {
                    label: 'Suspension en cours',
                    value:
                      target.status === 'SUSPENDED'
                        ? target.suspendedUntil
                          ? `Jusqu'au ${formatDate(target.suspendedUntil)}`
                          : 'Indéfinie'
                        : 'Non',
                  },
                  {
                    label: 'Mot de passe temporaire',
                    value: target.mustChangePassword ? 'Changement requis' : 'Non',
                  },
                ]}
              />
            </Panel>
            <Panel className="lg:col-span-2">
              <h2 className="mb-3 text-base font-semibold">Actions récentes</h2>
              <ModerationList actions={target.latestModerationActions} />
            </Panel>
          </div>
        </Tabs.Content>

        <Tabs.Content value="profile">
          <Panel className="max-w-3xl">
            <h2 className="text-base font-semibold">Informations du profil</h2>
            <form
              className="mt-5 space-y-4"
              onSubmit={profileForm.handleSubmit(submitProfile)}
              noValidate
            >
              {profileForm.formState.errors.root?.message ? (
                <ErrorState message={profileForm.formState.errors.root.message} />
              ) : null}
              <label className="block text-sm font-medium">
                {"Nom d'utilisateur"}
                <Input
                  className="mt-1.5"
                  disabled={!can('USERS_UPDATE_PROFILE')}
                  aria-invalid={Boolean(profileForm.formState.errors.username)}
                  {...profileForm.register('username')}
                />
                <FieldError message={profileForm.formState.errors.username?.message} />
              </label>
              <label className="block text-sm font-medium">
                Nom affiché
                <Input
                  className="mt-1.5"
                  disabled={!can('USERS_UPDATE_PROFILE')}
                  aria-invalid={Boolean(profileForm.formState.errors.displayName)}
                  {...profileForm.register('displayName')}
                />
                <FieldError message={profileForm.formState.errors.displayName?.message} />
              </label>
              <label className="block text-sm font-medium">
                Biographie
                <Textarea
                  className="mt-1.5"
                  disabled={!can('USERS_UPDATE_PROFILE')}
                  aria-invalid={Boolean(profileForm.formState.errors.bio)}
                  {...profileForm.register('bio')}
                />
                <FieldError message={profileForm.formState.errors.bio?.message} />
              </label>
              <label className="block text-sm font-medium">
                {"URL de l'avatar"}
                <Input
                  type="url"
                  className="mt-1.5"
                  disabled={!can('USERS_UPDATE_PROFILE')}
                  aria-invalid={Boolean(profileForm.formState.errors.avatarUrl)}
                  {...profileForm.register('avatarUrl')}
                />
                <FieldError message={profileForm.formState.errors.avatarUrl?.message} />
              </label>
              {can('USERS_UPDATE_PROFILE') ? (
                <div className="flex justify-end">
                  <Button type="submit" loading={profileMutation.isPending}>
                    Enregistrer
                  </Button>
                </div>
              ) : null}
            </form>
          </Panel>
        </Tabs.Content>

        <Tabs.Content value="security">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <h2 className="text-base font-semibold">Accès au compte</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Adresse e-mail</p>
                  <p className="font-medium">{target.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dernière connexion</p>
                  <p className="font-medium">{formatDate(target.lastLoginAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Changement de mot de passe requis</p>
                  <Badge tone={target.mustChangePassword ? 'warning' : 'success'}>
                    {target.mustChangePassword ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              </div>
            </Panel>
            <Panel>
              <h2 className="text-base font-semibold">Actions de sécurité</h2>
              <div className="mt-4 flex flex-col items-start gap-2">
                {can('USERS_UPDATE_EMAIL') ? (
                  <Button variant="secondary" onClick={() => openAction('email')}>
                    <Mail className="size-4" />
                    Modifier l’adresse e-mail
                  </Button>
                ) : null}
                {can('USERS_SEND_PASSWORD_RESET') ? (
                  <Button variant="secondary" onClick={() => openAction('password-reset')}>
                    <Mail className="size-4" />
                    Envoyer un lien de réinitialisation
                  </Button>
                ) : null}
                {can('USERS_SET_TEMPORARY_PASSWORD') ? (
                  <Button variant="outline" onClick={() => openAction('temporary-password')}>
                    <KeyRound className="size-4" />
                    Définir un mot de passe temporaire
                  </Button>
                ) : null}
                {!can('USERS_VIEW_SECURITY') ? (
                  <p className="text-sm text-muted-foreground">
                    Les actions de sécurité ne sont pas disponibles pour ce compte.
                  </p>
                ) : null}
              </div>
            </Panel>
            {hasPermission(actor?.role ?? 'USER', 'USERS_DELETE') ? (
              <Panel className="border-danger/25 lg:col-span-2">
                <h2 className="text-base font-semibold text-danger">Zone dangereuse</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  La suppression et l’anonymisation restent désactivées tant que les dépendances et
                  règles de conservation ne sont pas entièrement prises en charge.
                </p>
                <Button className="mt-4" variant="danger" disabled>
                  <Trash2 className="size-4" />
                  Supprimer définitivement le compte
                </Button>
              </Panel>
            ) : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="moderation">
          <div className="space-y-5">
            <Panel>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Statut du compte</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {target.status === 'SUSPENDED' && target.suspendedUntil
                      ? `Suspendu jusqu'au ${formatDate(target.suspendedUntil)}`
                      : target.statusLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can('USERS_SUSPEND') && target.status === 'SUSPENDED' ? (
                    <Button variant="secondary" onClick={() => openAction('unsuspend')}>
                      <CheckCircle2 className="size-4" />
                      Lever la suspension
                    </Button>
                  ) : can('USERS_SUSPEND') && target.status !== 'BANNED' ? (
                    <Button variant="secondary" onClick={() => openAction('suspend')}>
                      <ShieldAlert className="size-4" />
                      Suspendre
                    </Button>
                  ) : null}
                  {can('USERS_BAN') && target.status === 'BANNED' ? (
                    <Button variant="secondary" onClick={() => openAction('unban')}>
                      <CheckCircle2 className="size-4" />
                      Débannir
                    </Button>
                  ) : can('USERS_BAN') ? (
                    <Button variant="danger" onClick={() => openAction('ban')}>
                      <Ban className="size-4" />
                      Bannir
                    </Button>
                  ) : null}
                  {can('USERS_CHANGE_ROLE') ? (
                    <Button variant="outline" onClick={() => openAction('role')}>
                      <UserCog className="size-4" />
                      Modifier le rôle
                    </Button>
                  ) : null}
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Avertissements</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {target.activeWarningsCount} actif(s), {target.totalWarningsCount} au total
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={warningStatus}
                    aria-label="Filtrer les avertissements"
                    onChange={(event) =>
                      setWarningStatus(event.target.value as typeof warningStatus)
                    }
                  >
                    <option value="all">Tous</option>
                    <option value="active">Actifs</option>
                    <option value="revoked">Révoqués</option>
                  </Select>
                  {can('USERS_WARN') ? (
                    <Button onClick={() => openAction('warning')}>Ajouter</Button>
                  ) : null}
                </div>
              </div>
              {warnings.isLoading ? <Skeleton className="mt-5 h-48" /> : null}
              {warnings.isError ? (
                <div className="mt-5">
                  <ErrorState message="Impossible de charger les avertissements." />
                </div>
              ) : null}
              {warnings.data?.length ? (
                <ul className="mt-5 divide-y divide-border">
                  {warnings.data.map((warning) => (
                    <li key={warning.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={
                                warning.severity === 'HIGH'
                                  ? 'danger'
                                  : warning.severity === 'MEDIUM'
                                    ? 'warning'
                                    : 'neutral'
                              }
                            >
                              {warning.severityLabel}
                            </Badge>
                            <Badge tone={warning.isActive ? 'warning' : 'neutral'}>
                              {warning.isActive ? 'Actif' : 'Révoqué'}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium">{warning.reason}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Par {warning.issuedBy?.username ?? 'Compte supprimé'} ·{' '}
                            {formatDate(warning.createdAt)}
                          </p>
                        </div>
                        {warning.isActive && can('USERS_WARN') ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAction('revoke-warning', warning.id)}
                          >
                            Révoquer
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : !warnings.isLoading && !warnings.isError ? (
                <div className="mt-5">
                  <EmptyState compact title="Aucun avertissement" />
                </div>
              ) : null}
            </Panel>
          </div>
        </Tabs.Content>

        <Tabs.Content value="history">
          {!canReadHistory ? (
            <ErrorState
              title="Accès limité"
              message="Vous n'avez pas la permission de consulter cet historique."
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel>
                <h2 className="mb-3 text-base font-semibold">Modération</h2>
                {moderationHistory.isLoading ? <Skeleton className="h-56" /> : null}
                {moderationHistory.data ? (
                  <ModerationList actions={moderationHistory.data} />
                ) : null}
              </Panel>
              <Panel>
                <h2 className="mb-3 text-base font-semibold">Journal administratif</h2>
                {auditLogs.isLoading ? <Skeleton className="h-56" /> : null}
                {auditLogs.data?.length ? (
                  <ul className="divide-y divide-border">
                    {auditLogs.data.map((entry) => (
                      <li key={entry.id} className="py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{entry.action}</p>
                          <time className="text-xs text-muted-foreground">
                            {formatDate(entry.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Par {entry.actor?.displayName ?? entry.actor?.username ?? 'Système'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : !auditLogs.isLoading ? (
                  <p className="text-sm text-muted-foreground">Aucune entrée d’audit.</p>
                ) : null}
              </Panel>
            </div>
          )}
        </Tabs.Content>
      </Tabs>

      <ActionDialog
        target={target}
        actorId={actor?.id}
        pending={pendingAction}
        form={actionForm}
        errors={actionErrors}
        rootError={actionError}
        loading={actionMutation.isPending}
        onFieldChange={setActionField}
        onClose={() => {
          if (!actionMutation.isPending) setPendingAction(null);
        }}
        onSubmit={submitAction}
      />
    </div>
  );
}

function ActionDialog({
  target,
  actorId,
  pending,
  form,
  errors,
  rootError,
  loading,
  onFieldChange,
  onClose,
  onSubmit,
}: {
  target: AdminUserDetails;
  actorId?: string;
  pending: PendingAction | null;
  form: ActionFormState;
  errors: Record<string, string[]>;
  rootError: string | null;
  loading: boolean;
  onFieldChange: <K extends keyof ActionFormState>(field: K, value: ActionFormState[K]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!pending) return null;
  const titles: Record<UserAction, string> = {
    email: "Modifier l'adresse e-mail",
    'password-reset': 'Envoyer un lien de réinitialisation',
    'temporary-password': 'Définir un mot de passe temporaire',
    warning: 'Ajouter un avertissement',
    'revoke-warning': 'Révoquer un avertissement',
    suspend: 'Suspendre le compte',
    unsuspend: 'Lever la suspension',
    ban: 'Bannir le compte',
    unban: 'Débannir le compte',
    role: 'Modifier le rôle',
  };
  const danger = pending.type === 'ban';
  const needsModerationFields = [
    'warning',
    'revoke-warning',
    'suspend',
    'unsuspend',
    'ban',
    'unban',
    'role',
  ].includes(pending.type);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={titles[pending.type]}
      description={`Compte ciblé: @${target.username}`}
      footer={
        <>
          <Button variant="ghost" disabled={loading} onClick={onClose}>
            Annuler
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onSubmit}>
            Confirmer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rootError ? <ErrorState title="Action impossible" message={rootError} /> : null}
        {pending.type === 'email' ? (
          <label className="block text-sm font-medium">
            Nouvelle adresse e-mail
            <Input
              type="email"
              className="mt-1.5"
              value={form.email}
              aria-invalid={Boolean(errors.email?.length)}
              onChange={(event) => onFieldChange('email', event.target.value)}
            />
            <FieldError message={errors.email?.[0]} />
          </label>
        ) : null}
        {pending.type === 'password-reset' ? (
          <p className="text-sm text-muted-foreground">
            Un lien à usage unique sera envoyé à {target.email}. Aucun jeton ne sera affiché ici.
          </p>
        ) : null}
        {pending.type === 'temporary-password' ? (
          <>
            <label className="block text-sm font-medium">
              Mot de passe temporaire
              <Input
                type="password"
                autoComplete="new-password"
                className="mt-1.5"
                value={form.temporaryPassword}
                aria-invalid={Boolean(errors.temporaryPassword?.length)}
                onChange={(event) => onFieldChange('temporaryPassword', event.target.value)}
              />
              <FieldError message={errors.temporaryPassword?.[0]} />
            </label>
            <label className="block text-sm font-medium">
              Confirmer le mot de passe
              <Input
                type="password"
                autoComplete="new-password"
                className="mt-1.5"
                value={form.confirmPassword}
                aria-invalid={Boolean(errors.confirmPassword?.length)}
                onChange={(event) => onFieldChange('confirmPassword', event.target.value)}
              />
              <FieldError message={errors.confirmPassword?.[0]} />
            </label>
          </>
        ) : null}
        {pending.type === 'warning' ? (
          <label className="block text-sm font-medium">
            Sévérité
            <Select
              className="mt-1.5"
              value={form.severity}
              onChange={(event) => onFieldChange('severity', event.target.value as WarningSeverity)}
            >
              {Object.entries(WARNING_SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {pending.type === 'suspend' ? (
          <>
            <label className="block text-sm font-medium">
              Durée
              <Select
                className="mt-1.5"
                value={form.suspensionPreset}
                onChange={(event) =>
                  onFieldChange(
                    'suspensionPreset',
                    event.target.value as ActionFormState['suspensionPreset'],
                  )
                }
              >
                <option value="1h">1 heure</option>
                <option value="24h">24 heures</option>
                <option value="3d">3 jours</option>
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="custom">Personnalisée</option>
                <option value="indefinite">Indéfinie</option>
              </Select>
            </label>
            {form.suspensionPreset === 'custom' ? (
              <label className="block text-sm font-medium">
                Fin de suspension
                <Input
                  type="datetime-local"
                  className="mt-1.5"
                  value={form.customSuspensionEnd}
                  aria-invalid={Boolean(errors.customSuspensionEnd?.length)}
                  onChange={(event) => onFieldChange('customSuspensionEnd', event.target.value)}
                />
                <FieldError message={errors.customSuspensionEnd?.[0]} />
              </label>
            ) : null}
          </>
        ) : null}
        {pending.type === 'role' ? (
          <label className="block text-sm font-medium">
            Nouveau rôle
            <Select
              className="mt-1.5"
              value={form.role}
              onChange={(event) => onFieldChange('role', event.target.value as AppRole)}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {needsModerationFields ? (
          <>
            <label className="block text-sm font-medium">
              Raison
              <Input
                className="mt-1.5"
                value={form.reason}
                aria-invalid={Boolean(errors.reason?.length)}
                onChange={(event) => onFieldChange('reason', event.target.value)}
              />
              <FieldError message={errors.reason?.[0]} />
            </label>
            <label className="block text-sm font-medium">
              Note interne
              <Textarea
                className="mt-1.5"
                value={form.internalNote}
                aria-invalid={Boolean(errors.internalNote?.length)}
                onChange={(event) => onFieldChange('internalNote', event.target.value)}
              />
              <FieldError message={errors.internalNote?.[0]} />
            </label>
          </>
        ) : null}
        {pending.type === 'ban' ||
        pending.type === 'temporary-password' ||
        (pending.type === 'role' && actorId === target.id) ? (
          <label className="block text-sm font-medium">
            Saisissez @{target.username} pour confirmer
            <Input
              className="mt-1.5"
              value={form.confirmationUsername}
              aria-invalid={Boolean(errors.confirmationUsername?.length)}
              onChange={(event) => onFieldChange('confirmationUsername', event.target.value)}
            />
            <FieldError message={errors.confirmationUsername?.[0]} />
          </label>
        ) : null}
      </div>
    </Dialog>
  );
}
