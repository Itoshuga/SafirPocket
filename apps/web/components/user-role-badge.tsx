import { ROLE_LABELS, type AppRole } from '@safir/shared-types';
import { Badge } from '@safir/ui';

const roleTones: Record<AppRole, 'neutral' | 'primary' | 'warning' | 'danger'> = {
  USER: 'neutral',
  PIONEER: 'primary',
  MODERATOR: 'warning',
  ADMINISTRATOR: 'danger',
};

export function UserRoleBadge({ role }: { role: AppRole }) {
  const label = ROLE_LABELS[role];
  return (
    <Badge tone={roleTones[role]} aria-label={`Rôle : ${label}`}>
      {label}
    </Badge>
  );
}
