import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface AppState {
  mobileMenuOpen: boolean;
  toast: Toast | null;
  setMobileMenuOpen: (open: boolean) => void;
  notify: (message: string, tone?: Toast['tone']) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mobileMenuOpen: false,
  toast: null,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  notify: (message, tone = 'info') => set({ toast: { id: crypto.randomUUID(), message, tone } }),
  clearToast: () => set({ toast: null }),
}));
