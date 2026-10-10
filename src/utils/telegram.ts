import { TelegramUserData } from '../types/game';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation?: () => void;
        headerColor?: string;
        backgroundColor?: string;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            language_code?: string;
          };
          query_id?: string;
          auth_date?: number;
          hash?: string;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        sendData?: (data: string) => void;
      };
    };
  }
}

export function initTelegramWebApp(): TelegramUserData {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#0d0f12');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0d0f12');
      if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    } catch {
      // Ignored
    }

    if (tg.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return {
        id: u.id,
        first_name: u.first_name || 'Игрок',
        last_name: u.last_name,
        username: u.username,
        photo_url: u.photo_url,
        auth_date: tg.initDataUnsafe.auth_date,
        isLinkedToTelegram: true,
      };
    }
  }

  // Fallback demo user for local testing & browser preview
  const savedDemo = localStorage.getItem('sim_gacha_demo_user');
  if (savedDemo) {
    try {
      return JSON.parse(savedDemo);
    } catch {
      // ignore
    }
  }

  const demoUser: TelegramUserData = {
    id: 7770001,
    first_name: 'LuckyCollector',
    username: 'lucky_sim',
    isLinkedToTelegram: false,
  };
  localStorage.setItem('sim_gacha_demo_user', JSON.stringify(demoUser));
  return demoUser;
}

export function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error' | 'selection'
) {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (!haptic) return;

    if (type === 'selection') {
      haptic.selectionChanged();
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      haptic.notificationOccurred(type);
    } else {
      haptic.impactOccurred(type);
    }
  } catch {
    // Graceful fallback
  }
}

export function isInsideTelegram(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}
