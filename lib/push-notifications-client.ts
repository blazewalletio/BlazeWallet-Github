import { supabase } from '@/lib/supabase';

const DEVICE_ID_KEY = 'device_id';
let cachedPublicVapidKey: string | null = null;

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('No active session');
  return token;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token');
  const json = await res.json().catch(() => ({}));
  if (!json?.token) throw new Error('CSRF token unavailable');
  return json.token as string;
}

async function resolvePublicVapidKey(): Promise<string> {
  if (cachedPublicVapidKey) return cachedPublicVapidKey;

  const fromPublicEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (fromPublicEnv) {
    cachedPublicVapidKey = fromPublicEnv;
    return fromPublicEnv;
  }

  const response = await fetch('/api/notifications/config', { method: 'GET' });
  if (!response.ok) {
    throw new Error('Push config endpoint unavailable');
  }

  const data = await response.json().catch(() => ({}));
  const key = typeof data?.publicVapidKey === 'string' ? data.publicVapidKey.trim() : '';
  if (!key) {
    throw new Error('Push is not configured (missing VAPID public key)');
  }

  cachedPublicVapidKey = key;
  return key;
}

function getPlatform(): 'web' | 'pwa' | 'ios' | 'android' {
  const ua = navigator.userAgent || '';
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (/android/i.test(ua)) return isStandalone ? 'pwa' : 'web';
  if (/iphone|ipad|ipod/i.test(ua)) return isStandalone ? 'pwa' : 'web';
  return isStandalone ? 'pwa' : 'web';
}

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getPushSupportState(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') return { supported: false, reason: 'Window unavailable' };
  if (!window.isSecureContext) return { supported: false, reason: 'Secure context required (HTTPS)' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Service worker not supported' };
  if (!('PushManager' in window)) return { supported: false, reason: 'Push API not supported' };
  if (!('Notification' in window)) return { supported: false, reason: 'Notification API not supported' };
  return { supported: true };
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePushNotifications(): Promise<void> {
  const support = getPushSupportState();
  if (!support.supported) {
    throw new Error(support.reason || 'Push notifications not supported on this device');
  }

  const publicVapidKey = await resolvePublicVapidKey();

  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked in browser settings');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicVapidKey),
    });
  }

  const [token, csrfToken] = await Promise.all([getAuthToken(), getCsrfToken()]);

  const subscribeRes = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      deviceId: getDeviceId(),
      platform: getPlatform(),
    }),
  });

  if (!subscribeRes.ok) {
    const errorJson = await subscribeRes.json().catch(() => ({}));
    throw new Error(errorJson?.error || 'Failed to register push subscription');
  }

  const prefRes = await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      notifications_enabled: true,
      in_app_enabled: true,
      push_enabled: true,
    }),
  });

  if (!prefRes.ok) {
    const errorJson = await prefRes.json().catch(() => ({}));
    throw new Error(errorJson?.error || 'Failed to save notification preferences');
  }
}

export async function disablePushNotifications(): Promise<void> {
  const [token, csrfToken] = await Promise.all([getAuthToken(), getCsrfToken()]);

  let endpoint: string | null = null;
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint || null;
    await subscription?.unsubscribe().catch(() => undefined);
  }

  await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ endpoint }),
  });

  const prefRes = await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      notifications_enabled: false,
      push_enabled: false,
    }),
  });

  if (!prefRes.ok) {
    const errorJson = await prefRes.json().catch(() => ({}));
    throw new Error(errorJson?.error || 'Failed to disable notification preferences');
  }
}

export async function sendNotificationTest(): Promise<void> {
  const [token, csrfToken] = await Promise.all([getAuthToken(), getCsrfToken()]);
  const res = await fetch('/api/notifications/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error || 'Failed to send test notification');
  }
}

export async function fetchNotificationPreferences(): Promise<Record<string, any> | null> {
  const token = await getAuthToken();
  const res = await fetch('/api/notifications/preferences', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.preferences || null;
}

export async function updateNotificationPreferences(
  payload: Record<string, boolean>
): Promise<Record<string, any> | null> {
  const [token, csrfToken] = await Promise.all([getAuthToken(), getCsrfToken()]);
  const res = await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error || 'Failed to update notification preferences');
  }

  const data = await res.json().catch(() => null);
  return data?.preferences || null;
}


