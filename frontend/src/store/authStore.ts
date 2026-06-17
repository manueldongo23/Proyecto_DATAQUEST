import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../types';
import { resetQuestSessionSeed } from '../services/api';

export interface GuestUser {
  id: string;
  apodo: string;
  isGuest: true;
  guestUid: string;
  createdAt: number;
}

interface AuthStore {
  user: User | null;
  guestUser: GuestUser | null;
  token: string | null;
  isGuest: boolean;
  isAuthenticated: boolean;

  setUser: (user: User, token?: string) => void;
  setGuestUser: () => GuestUser;
  restoreGuestUser: () => GuestUser | null;
  logout: () => void;
  isProtectedFeature: (feature: 'quests' | 'ranking') => boolean;
  getDisplayName: () => string;
}

function readStoredGuestUser(): GuestUser | null {
  try {
    const raw = localStorage.getItem('guest_user');
    if (!raw) return null;
    return JSON.parse(raw) as GuestUser;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  guestUser: readStoredGuestUser(),
  token: localStorage.getItem('access_token'),
  isGuest: !!readStoredGuestUser(),
  isAuthenticated: false,

  setUser: (user, token) => {
    if (token) {
      localStorage.setItem('access_token', token);
    }
    localStorage.removeItem('guest_uid');
    localStorage.removeItem('guest_user');
    resetQuestSessionSeed();
    set({
      user,
      token: token || null,
      guestUser: null,
      isGuest: false,
      isAuthenticated: true,
    });
  },

  setGuestUser: () => {
    const guestUid = uuidv4();
    const guestName = `Guest_${guestUid.slice(0, 8)}`;
    resetQuestSessionSeed();

    const guestUser: GuestUser = {
      id: guestUid,
      apodo: guestName,
      isGuest: true,
      guestUid,
      createdAt: Date.now(),
    };

    localStorage.setItem('guest_uid', guestUid);
    localStorage.setItem('guest_user', JSON.stringify(guestUser));

    set({
      guestUser,
      isGuest: true,
      user: null,
      token: null,
      isAuthenticated: false,
    });

    return guestUser;
  },

  restoreGuestUser: () => {
    const guestUser = readStoredGuestUser();
    if (!guestUser) {
      return null;
    }

    set({
      guestUser,
      isGuest: true,
      user: null,
      token: null,
      isAuthenticated: false,
    });

    return guestUser;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('guest_uid');
    localStorage.removeItem('guest_user');
    resetQuestSessionSeed();
    set({
      user: null,
      guestUser: null,
      token: null,
      isGuest: false,
      isAuthenticated: false,
    });
  },

  isProtectedFeature: (feature) => {
    const state = get();
    if (state.isGuest && (feature === 'quests' || feature === 'ranking')) {
      return true;
    }
    return false;
  },

  getDisplayName: () => {
    const state = get();
    if (state.user) return state.user.apodo;
    if (state.guestUser) return state.guestUser.apodo;
    return 'Visitante';
  },
}));
