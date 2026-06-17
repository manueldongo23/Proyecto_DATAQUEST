import React from 'react';
import { useAnnounceStore } from '../store/announceStore';

export const SrAnnouncer: React.FC = () => {
  const message = useAnnounceStore((s) => s.message);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
};
