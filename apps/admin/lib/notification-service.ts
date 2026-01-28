/**
 * 🔥 BLAZE WALLET - NOTIFICATION SERVICE
 * 
 * In-app notification system for Smart Send updates
 * - Transaction completed notifications
 * - Gas alert notifications
 * - Savings updates
 * - Real-time via polling
 * 
 * Note: PWA push notifications require service worker registration
 * and user permission - implemented here but optional
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface Notification {
  id: string;
  user_id: string;
  type: 'transaction_executed' | 'gas_alert' | 'savings_milestone' | 'transaction_failed';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

class NotificationService {
  // Use singleton supabase client to avoid "Multiple GoTrueClient instances" warning
  private supabase = supabase;
  private listeners: Set<(notifications: Notification[]) => void> = new Set();
  private unreadCount = 0;
  
  /**
   * Get user's notifications
   */
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('[Notifications] Failed to fetch:', error);
      return [];
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      this.unreadCount = count || 0;
      return this.unreadCount;
    } catch (error) {
      logger.error('[Notifications] Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      logger.error('[Notifications] Failed to mark as read:', error);
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      this.unreadCount = 0;
      this.notifyListeners([]);
    } catch (error) {
      logger.error('[Notifications] Failed to mark all as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      logger.error('[Notifications] Failed to delete:', error);
    }
  }

  /**
   * Subscribe to notification updates
   */
  subscribe(callback: (notifications: Notification[]) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(notifications: Notification[]): void {
    this.listeners.forEach(listener => listener(notifications));
  }

  /**
   * Start polling for new notifications
   */
  startPolling(userId: string, interval = 30000): () => void {
    const poll = async () => {
      const notifications = await this.getNotifications(userId);
      const unreadCount = await this.getUnreadCount(userId);
      
      if (unreadCount > this.unreadCount) {
        // New notifications - notify listeners
        this.notifyListeners(notifications);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, interval);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Request PWA push notification permission (optional)
   */
  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('[Notifications] Push notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Show browser notification (if permission granted)
   */
  async showBrowserNotification(title: string, message: string, data?: any): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/blaze-logo.png',
        badge: '/blaze-logo.png',
        data,
        tag: 'smart-send',
      });
    }
  }
}

export const notificationService = new NotificationService();

