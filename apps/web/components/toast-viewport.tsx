'use client';

import { Toast } from '@safir/ui';
import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';

export function ToastViewport() {
  const toast = useAppStore((state) => state.toast);
  const clear = useAppStore((state) => state.clearToast);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clear, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div className="fixed inset-x-4 bottom-20 z-[60] mx-auto max-w-sm md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-96">
      <Toast
        tone={toast.tone === 'error' ? 'danger' : toast.tone === 'success' ? 'success' : 'neutral'}
        title={toast.message}
      />
    </div>
  );
}
