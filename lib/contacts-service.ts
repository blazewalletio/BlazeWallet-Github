/**
 * 📇 CONTACTS SERVICE
 * Manage user's saved wallet addresses
 * Uses existing address_book table
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  address: string;
  chain: string;
  emoji?: string;
  profile_image?: string;
  tags: string[];
  notes?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContactData {
  name: string;
  address: string;
  chain: string;
  notes?: string;
  emoji?: string;
  profile_image?: string;
  is_favorite?: boolean;
  tags?: string[];
}

export interface UpdateContactData {
  name?: string;
  notes?: string;
  emoji?: string;
  profile_image?: string;
  is_favorite?: boolean;
  tags?: string[];
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
        .from('address_book')
        .select('*')
        .eq('user_id', user.id);

      // Apply sorting
      switch (sortBy) {
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        case 'recent':
          query = query.order('updated_at', { ascending: false });
          break;
        case 'frequent':
          // For address_book, just sort by favorites first, then name
          query = query.order('is_favorite', { ascending: false }).order('name', { ascending: true });
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
        .from('address_book')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', chain)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

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
        .from('address_book')
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
        .from('address_book')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

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
        .from('address_book')
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
        .from('address_book')
        .insert({
          user_id: user.id,
          name: contactData.name,
          address: contactData.address,
          chain: contactData.chain,
          notes: contactData.notes || '',
          emoji: contactData.emoji || '👤',
          profile_image: contactData.profile_image || '',
          is_favorite: contactData.is_favorite || false,
          tags: contactData.tags || [],
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
        .from('address_book')
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
        .from('address_book')
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
        .from('address_book')
        .select('is_favorite')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single();

      if (!contact) throw new Error('Contact not found');

      // Toggle favorite
      const { data, error } = await supabase
        .from('address_book')
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
   * Increment usage stats when sending to a contact (not implemented in address_book)
   */
  async incrementUsage(address: string, chain: string, amountUSD: number = 0): Promise<void> {
    // address_book doesn't have usage tracking, so this is a no-op
    // Could be added later if needed
    logger.log(`📊 Sent to contact: ${address.slice(0, 8)}... (${chain})`);
  }
}

export const contactsService = new ContactsService();
