import type { Metadata } from 'next';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';

export const metadata: Metadata = { title: 'Profil - Préférences' };
export default function SettingsProfilePage() {
  return <ProfileSettingsForm />;
}
