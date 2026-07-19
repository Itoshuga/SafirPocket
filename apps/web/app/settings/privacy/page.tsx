import type { Metadata } from 'next';
import { PrivacySettingsForm } from '@/components/settings/privacy-settings-form';

export const metadata: Metadata = { title: 'Confidentialité' };
export default function SettingsPrivacyPage() {
  return <PrivacySettingsForm />;
}
