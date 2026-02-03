/**
 * 📇 CONTACTS MODAL
 * Manage saved wallet addresses
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Search, Star, Clock, TrendingUp, Edit2, Trash2, 
  Plus, Check, AlertTriangle, Loader2, Copy, ChevronRight 
} from 'lucide-react';
import { contactsService, Contact, CreateContactData, UpdateContactData } from '@/lib/contacts-service';
import { CHAINS } from '@/lib/chains';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contact: Contact) => void; // For selecting in QuickPay
  filterChain?: string; // Optional: only show contacts for specific chain
}

type ViewMode = 'list' | 'add' | 'edit';
type SortBy = 'name' | 'recent' | 'frequent';

export default function ContactsModal({ 
  isOpen, 
  onClose, 
  onSelectContact,
  filterChain 
}: ContactsModalProps) {
  const [mode, setMode] = useState<ViewMode>('list');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateContactData>({
    name: '',
    address: '',
    chain: filterChain || 'ethereum',
    note: '',
    avatar_url: '',
    is_favorite: false,
  });
  const [formError, setFormError] = useState('');

  // Load contacts
  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const data = filterChain 
        ? await contactsService.getContactsByChain(filterChain)
        : await contactsService.getContacts(sortBy);
      setContacts(data);
      setFilteredContacts(data);
    } catch (error: any) {
      toast.error('Failed to load contacts');
      logger.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen, sortBy, filterChain]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(query) ||
      contact.address.toLowerCase().includes(query) ||
      contact.note?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const handleAddContact = async () => {
    setFormError('');
    
    // Validation
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.address.trim()) {
      setFormError('Address is required');
      return;
    }
    if (formData.address.length < 26) {
      setFormError('Invalid address format');
      return;
    }

    setIsLoading(true);
    try {
      await contactsService.createContact(formData);
      toast.success(`✅ ${formData.name} added to contacts!`);
      
      // Reset form
      setFormData({
        name: '',
        address: '',
        chain: filterChain || 'ethereum',
        note: '',
        avatar_url: '',
        is_favorite: false,
      });
      
      setMode('list');
      await loadContacts();
    } catch (error: any) {
      setFormError(error.message || 'Failed to add contact');
      toast.error(error.message || 'Failed to add contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;
    
    setFormError('');
    setIsLoading(true);
    
    try {
      const updates: UpdateContactData = {
        name: formData.name,
        note: formData.note,
        avatar_url: formData.avatar_url,
        is_favorite: formData.is_favorite,
      };
      
      await contactsService.updateContact(selectedContact.id, updates);
      toast.success(`✅ ${formData.name} updated!`);
      
      setMode('list');
      setSelectedContact(null);
      await loadContacts();
    } catch (error: any) {
      setFormError(error.message || 'Failed to update contact');
      toast.error(error.message || 'Failed to update contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Delete ${contact.name}?`)) return;
    
    setIsLoading(true);
    try {
      await contactsService.deleteContact(contact.id);
      toast.success(`✅ ${contact.name} deleted`);
      await loadContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (contact: Contact) => {
    try {
      await contactsService.toggleFavorite(contact.id);
      await loadContacts();
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      address: contact.address,
      chain: contact.chain,
      note: contact.note || '',
      avatar_url: contact.avatar_url || '',
      is_favorite: contact.is_favorite,
    });
    setMode('edit');
  };

  const handleSelectContact = (contact: Contact) => {
    if (onSelectContact) {
      onSelectContact(contact);
      onClose();
    }
  };

  const handleClose = () => {
    setMode('list');
    setSelectedContact(null);
    setSearchQuery('');
    setFormError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {mode === 'add' && 'Add Contact'}
                    {mode === 'edit' && 'Edit Contact'}
                    {mode === 'list' && 'Contacts'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {mode === 'list' && `${filteredContacts.length} saved ${filteredContacts.length === 1 ? 'address' : 'addresses'}`}
                    {mode === 'add' && 'Save a new wallet address'}
                    {mode === 'edit' && 'Update contact details'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {mode === 'list' && (
              <div className="space-y-4">
                {/* Search & Sort */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="recent">Recently Used</option>
                    <option value="frequent">Most Used</option>
                  </select>
                </div>

                {/* Contacts List */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">
                      {searchQuery ? 'No contacts found' : 'No contacts yet'}
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      {searchQuery ? 'Try a different search' : 'Add your first contact to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredContacts.map((contact) => (
                      <motion.div
                        key={contact.id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-all cursor-pointer"
                        onClick={() => handleSelectContact(contact)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">
                              {contact.avatar_url || CHAINS[contact.chain as keyof typeof CHAINS]?.icon || '👤'}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
                              {contact.is_favorite && (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 font-mono truncate mb-1">
                              {contact.address.slice(0, 8)}...{contact.address.slice(-6)}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                {CHAINS[contact.chain as keyof typeof CHAINS]?.icon} {CHAINS[contact.chain as keyof typeof CHAINS]?.name}
                              </span>
                              {contact.usage_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" /> {contact.usage_count}x
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(contact);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Star className={`w-5 h-5 ${contact.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditContact(contact);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-5 h-5 text-gray-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContact(contact);
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add/Edit Form */}
            {(mode === 'add' || mode === 'edit') && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Mom, John Doe, Exchange Wallet"
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Wallet Address *
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="0x... or bc1... or base58..."
                    rows={3}
                    disabled={mode === 'edit'} // Can't change address when editing
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-mono text-sm resize-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                {/* Chain */}
                {mode === 'add' && !filterChain && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Blockchain
                    </label>
                    <select
                      value={formData.chain}
                      onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                    >
                      {Object.entries(CHAINS).map(([key, chain]) => (
                        <option key={key} value={key}>
                          {chain.icon} {chain.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="e.g., Monthly rent, Trading account"
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>

                {/* Favorite Toggle */}
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_favorite}
                    onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Add to Favorites</div>
                    <div className="text-sm text-gray-600">Quick access for frequent use</div>
                  </div>
                  <Star className={`w-5 h-5 ${formData.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                </label>

                {/* Error */}
                {formError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-900">{formError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setMode('list');
                      setSelectedContact(null);
                      setFormError('');
                    }}
                    className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={mode === 'add' ? handleAddContact : handleUpdateContact}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{mode === 'add' ? 'Adding...' : 'Updating...'}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>{mode === 'add' ? 'Add Contact' : 'Update Contact'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer (only in list mode) */}
          {mode === 'list' && (
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button
                onClick={() => setMode('add')}
                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Contact</span>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

