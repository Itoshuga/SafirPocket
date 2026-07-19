import type { Metadata } from 'next';
import { AccountSettings } from '@/components/settings/account-settings';

export const metadata: Metadata = { title: 'Compte' };
export default function SettingsAccountPage() {
  return <AccountSettings />;
}
