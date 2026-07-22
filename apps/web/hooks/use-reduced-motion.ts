'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  const observer = new MutationObserver(onChange);
  media.addEventListener('change', onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-reduce-motion'],
  });
  return () => {
    media.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

function getSnapshot() {
  return (
    window.matchMedia(QUERY).matches || document.documentElement.dataset.reduceMotion === 'true'
  );
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
