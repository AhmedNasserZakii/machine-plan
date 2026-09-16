'use client';

import { useEffect, useState } from 'react';

/** Shared online flag for OfflineBanner and mutation controls. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

/** Mutations must stay disabled while offline (no write queue). */
export function useCanMutate(): boolean {
  return useOnline();
}
