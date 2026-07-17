'use client';

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
  const tone =
    toast.tone === 'error'
      ? 'border-red-400/40'
      : toast.tone === 'success'
        ? 'border-emerald-400/40'
        : 'border-sapphire-400/40';
  return (
    <div
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border ${tone} bg-ink-900 px-5 py-3 text-sm shadow-2xl md:bottom-6`}
      role="status"
    >
      {toast.message}
    </div>
  );
}
