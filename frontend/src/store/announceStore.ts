import { create } from 'zustand';

interface AnnounceState {
  message: string;
  announce: (msg: string) => void;
}

export const useAnnounceStore = create<AnnounceState>((set) => ({
  message: '',
  announce: (msg: string) => {
    set({ message: msg });
    setTimeout(() => set({ message: '' }), 3000);
  },
}));
