import type { ReactNode } from 'react';
import { AdminAccessBoundary } from '@/components/admin-access-boundary';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessBoundary>{children}</AdminAccessBoundary>;
}
