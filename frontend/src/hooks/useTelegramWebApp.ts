import { useEffect, useState, useMemo } from 'react';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (event: string, callback: () => void) => void;
  offEvent: (event: string, callback: () => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text: string;
    }>;
  }, callback?: (buttonId?: string) => void) => void;
  showScanQrPopup: (params: {
    text?: string;
  }, callback?: (text: string) => boolean) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean, contact?: any) => void) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (error: string | null, stored?: boolean) => void) => void;
    getItem: (key: string, callback?: (error: string | null, value?: string) => void) => void;
    getItems: (keys: string[], callback?: (error: string | null, values?: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: string | null, removed?: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: string | null, removed?: boolean) => void) => void;
    getKeys: (callback?: (error: string | null, keys?: string[]) => void) => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
    query_id?: string;
    auth_date: number;
    hash: string;
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isVersionAtLeast: (version: string) => boolean;
  platform: string;
  version: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
}

export const useTelegramWebApp = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  const webApp = useMemo(() => {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  }, []);

  useEffect(() => {
    if (webApp) {
      // Инициализируем WebApp
      try { webApp.ready(); } catch { /* старые клиенты */ }
      try { webApp.expand(); } catch { /* старые клиенты */ }
      try { webApp.BackButton.hide(); } catch { /* убираем мерцание кнопки назад */ }
      
      // Настраиваем внешний вид (защита от WebAppMethodUnsupported)
      try { webApp.setHeaderColor('#2563eb'); } catch { /* noop */ }
      try { webApp.setBackgroundColor('#f8fafc'); } catch { /* noop */ }
      
      // Получаем данные пользователя
      if (webApp.initDataUnsafe.user) {
        const telegramUser = webApp.initDataUnsafe.user;
        setUser({
          id: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          languageCode: telegramUser.language_code,
          isPremium: telegramUser.is_premium,
          photoUrl: telegramUser.photo_url,
        });
      }
      
      // Устанавливаем цветовую схему
      try { setColorScheme(webApp.colorScheme); } catch { /* noop */ }
      
      setIsLoaded(true);
    }
  }, [webApp]);

  const showAlert = (message: string, callback?: () => void) => {
    if (webApp && typeof webApp.showAlert === 'function') {
      try { webApp.showAlert(message, callback); } catch { window.alert(message); callback?.(); }
    } else {
      // Fallback для обычного браузера
      window.alert(message);
      callback?.();
    }
  };

  const showConfirm = (message: string, callback?: (confirmed: boolean) => void) => {
    if (webApp && typeof webApp.showConfirm === 'function') {
      try { webApp.showConfirm(message, callback); } catch { const confirmed = window.confirm(message); callback?.(confirmed); }
    } else {
      // Fallback для обычного браузера
      const confirmed = window.confirm(message);
      callback?.(confirmed);
    }
  };

  const hapticFeedback = {
    impactLight: () => webApp?.HapticFeedback.impactOccurred('light'),
    impactMedium: () => webApp?.HapticFeedback.impactOccurred('medium'),
    impactHeavy: () => webApp?.HapticFeedback.impactOccurred('heavy'),
    success: () => { try { webApp?.HapticFeedback.notificationOccurred('success'); } catch {} },
    error: () => { try { webApp?.HapticFeedback.notificationOccurred('error'); } catch {} },
    warning: () => { try { webApp?.HapticFeedback.notificationOccurred('warning'); } catch {} },
    selectionChanged: () => webApp?.HapticFeedback.selectionChanged(),
  };

  const mainButton = {
    setText: (text: string) => { try { webApp?.MainButton.setText(text); } catch {} },
    show: () => webApp?.MainButton.show(),
    hide: () => webApp?.MainButton.hide(),
    enable: () => webApp?.MainButton.enable(),
    disable: () => webApp?.MainButton.disable(),
    showProgress: () => webApp?.MainButton.showProgress(),
    hideProgress: () => webApp?.MainButton.hideProgress(),
    onClick: (callback: () => void) => { try { webApp?.MainButton.onClick(callback); } catch {} },
    offClick: (callback: () => void) => { try { webApp?.MainButton.offClick(callback); } catch {} },
  };

  const backButton = {
    show: () => { try { webApp?.BackButton.show(); } catch {} },
    hide: () => { try { webApp?.BackButton.hide(); } catch {} },
    onClick: (callback: () => void) => { try { webApp?.BackButton.onClick(callback); } catch {} },
    offClick: (callback: () => void) => { try { webApp?.BackButton.offClick(callback); } catch {} },
  };

  const close = () => {
    if (webApp) {
      try { webApp.close(); } catch { window.close(); }
    } else {
      // Fallback для обычного браузера
      window.close();
    }
  };

  const sendData = (data: string) => {
    webApp?.sendData(data);
  };

  const openTelegramLink = (url: string) => {
    if (webApp && typeof webApp.openTelegramLink === 'function') {
      try { webApp.openTelegramLink(url); } catch { window.open(url, '_blank'); }
    } else {
      window.open(url, '_blank');
    }
  };

  const openLink = (url: string, options?: { tryInstantView?: boolean }) => {
    if (webApp && typeof webApp.openLink === 'function') {
      try { webApp.openLink(url, { try_instant_view: options?.tryInstantView }); } catch { window.open(url, '_blank'); }
    } else {
      window.open(url, '_blank');
    }
  };

  const isInTelegram = () => {
    return webApp !== null;
  };

  return {
    webApp,
    isLoaded,
    user,
    colorScheme,
    isInTelegram: isInTelegram(),
    showAlert,
    showConfirm,
    hapticFeedback,
    mainButton,
    backButton,
    close,
    sendData,
    openTelegramLink,
    openLink,
  };
};
