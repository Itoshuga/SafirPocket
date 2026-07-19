import type { Metadata } from 'next';
import { FriendsSettings } from '@/components/settings/friends-settings';

export const metadata: Metadata = { title: 'Amis' };
export default function SettingsFriendsPage() {
  return <FriendsSettings />;
}
