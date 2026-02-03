/**
 * 📇 CONTACTS SERVICE
 * Manage user's saved wallet addresses
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  address: string;
  chain: string;
  note?: string;
  avatar_url?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  usage_count: number;
  total_sent_usd: number;
}

export interface CreateContactData {
  name: string;
  address: string;
  chain: string;
  note?: string;
  avatar_url?: string;
  is_favorite?: boolean;
}

export interface UpdateContactData {
  name?: string;
  note?: string;
  avatar_url?: string;
  is_favorite?: boolean;
}

class ContactsService {
  /**
   * Get all contacts for current user
   */
  async getContacts(sortBy: 'name' | 'recent' | 'frequent' = 'name'): Promise<Contact[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id);

      // Apply sorting
      switch (sortBy) {
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        case 'recent':
          query = query.order('last_used_at', { ascending: false, nullsFirst: false });
          break;
        case 'frequent':
          query = query.order('usage_count', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get contacts:', error);
      throw error;
    }
  }

  /**
   * Get contacts filtered by chain
   */
  async getContactsByChain(chain: string): Promise<Contact[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', chain)
        .order('is_favorite', { ascending: false })
        .order('usage_count', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get contacts by chain:', error);
      throw error;
    }
  }

  /**
   * Get favorite contacts
   */
  async getFavoriteContacts(): Promise<Contact[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_favorite', true)
        .order('name', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get favorite contacts:', error);
      throw error;
    }
  }

  /**
   * Search contacts by name or address
   */
  async searchContacts(query: string): Promise<Contact[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
        .order('is_favorite', { ascending: false })
        .order('usage_count', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to search contacts:', error);
      throw error;
    }
  }

  /**
   * Get a specific contact by address and chain
   */
  async getContactByAddress(address: string, chain: string): Promise<Contact | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('address', address)
        .eq('chain', chain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.error('Failed to get contact by address:', error);
      return null;
    }
  }

  /**
   * Create a new contact
   */
  async createContact(contactData: CreateContactData): Promise<Contact> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if contact already exists
      const existing = await this.getContactByAddress(contactData.address, contactData.chain);
      if (existing) {
        throw new Error('Contact with this address already exists');
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          ...contactData,
        })
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Contact created:', data.name);
      return data;
    } catch (error: any) {
      logger.error('Failed to create contact:', error);
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, updates: UpdateContactData): Promise<Contact> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Contact updated:', data.name);
      return data;
    } catch (error: any) {
      logger.error('Failed to update contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', user.id);

      if (error) throw error;

      logger.log('✅ Contact deleted');
    } catch (error: any) {
      logger.error('Failed to delete contact:', error);
      throw error;
    }
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(contactId: string): Promise<Contact> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('is_favorite')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single();

      if (!contact) throw new Error('Contact not found');

      // Toggle favorite
      const { data, error } = await supabase
        .from('contacts')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contactId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error: any) {
      logger.error('Failed to toggle favorite:', error);
      throw error;
    }
  }

  /**
   * Increment usage stats when sending to a contact
   */
  async incrementUsage(address: string, chain: string, amountUSD: number = 0): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call database function
      const { error } = await supabase.rpc('increment_contact_usage', {
        p_user_id: user.id,
        p_address: address,
        p_chain: chain,
        p_amount_usd: amountUSD,
      });

      if (error) {
        logger.warn('Failed to increment contact usage:', error);
      }
    } catch (error: any) {
      logger.warn('Failed to increment contact usage:', error);
    }
  }
}

export const contactsService = new ContactsService();

