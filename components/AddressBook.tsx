'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Star, Edit2, Trash2, X, ChevronDown, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CHAINS } from '@/lib/chains';
import AddContactModal from './AddContactModal';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { getCurrentAccount } from '@/lib/account-manager';
import { logger } from '@/lib/logger';

interface Contact {
  id: string;
  name: string;
  chain: string;
  address: string;
  emoji: string;
  profile_image?: string; // Base64 image or URL
  tags: string[];
  notes?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface AddressBookProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contact: { address: string; name: string }) => void;
  filterChain?: string;
}

export default function AddressBook({ isOpen, onClose, onSelectContact, filterChain }: AddressBookProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>(filterChain || 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useBlockBodyScroll(isOpen);

  useEffect(() => {
    const account = getCurrentAccount();
    if (account) {
      const userIdentifier = account.email || account.id;
      setUserId(userIdentifier);
    }
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      loadContacts();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (filterChain) {
      setSelectedChainFilter(filterChain);
    }
  }, [filterChain]);

  useEffect(() => {
    filterAndSortContacts();
  }, [contacts, searchQuery, selectedChainFilter]);

  const loadContacts = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('address_book')
        .select('*')
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      logger.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortContacts = () => {
    let filtered = [...contacts];

    // Filter by chain
    if (selectedChainFilter !== 'all') {
      filtered = filtered.filter(c => c.chain === selectedChainFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredContacts(filtered);
  };

  const handleToggleFavorite = async (contact: Contact) => {
    try {
      const { error } = await supabase
        .from('address_book')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contact.id);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      logger.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('address_book')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      logger.error('Failed to delete contact:', error);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    if (onSelectContact) {
      onSelectContact({ address: contact.address, name: contact.name });
      onClose();
    }
  };

  if (!isOpen) return null;

  const chainOptions = [
    { value: 'all', label: 'All chains', logo: '🌐', logoUrl: null },
    ...Object.entries(CHAINS).map(([key, chain]) => ({
      value: key,
      label: chain.name,
      logo: chain.icon,
      logoUrl: chain.logoUrl || null,
    })),
  ];

  const selectedChainOption = chainOptions.find(opt => opt.value === selectedChainFilter) || chainOptions[0];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed inset-0 sm:inset-4 sm:top-auto sm:bottom-4 sm:max-w-2xl sm:mx-auto z-50 flex flex-col bg-gradient-to-br from-orange-50 to-white sm:rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Address book</h2>
                  <p className="text-sm text-gray-600">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} saved</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="p-6 space-y-6">
                {/* Search & Filter Row */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                    />
                  </div>

                  {/* Chain Filter Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowChainDropdown(!showChainDropdown)}
                      className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all min-w-[140px]"
                    >
                      {selectedChainOption.logoUrl ? (
                        <img 
                          src={selectedChainOption.logoUrl} 
                          alt={selectedChainOption.label}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <span className="text-lg">{selectedChainOption.logo}</span>
                      )}
                      <span className="text-sm font-medium text-gray-700 flex-1 text-left truncate">
                        {selectedChainOption.label}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showChainDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showChainDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowChainDropdown(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20 max-h-80 overflow-y-auto"
                          >
                            {chainOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSelectedChainFilter(option.value);
                                  setShowChainDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                                  selectedChainFilter === option.value ? 'bg-orange-50' : ''
                                }`}
                              >
                                {option.logoUrl ? (
                                  <img 
                                    src={option.logoUrl} 
                                    alt={option.label}
                                    className="w-5 h-5 rounded-full"
                                  />
                                ) : (
                                  <span className="text-lg">{option.logo}</span>
                                )}
                                <span className={`text-sm font-medium flex-1 text-left ${
                                  selectedChainFilter === option.value ? 'text-orange-600' : 'text-gray-700'
                                }`}>
                                  {option.label}
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Add Contact Button */}
                <button
                  onClick={() => {
                    setSelectedContact(null);
                    setShowAddModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  Add new contact
                </button>

                {/* Loading State */}
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading contacts...</p>
                  </div>
                ) : (
                  /* Contacts List */
                  <div className="space-y-3">
                    {filteredContacts.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-900 font-semibold mb-2 text-lg">
                          {searchQuery || selectedChainFilter !== 'all'
                            ? 'No contacts found'
                            : 'No contacts yet'}
                        </p>
                        <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                          {searchQuery || selectedChainFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Save addresses you send to frequently for quick access and easier transactions.'}
                        </p>
                        {!searchQuery && selectedChainFilter === 'all' && contacts.length === 0 && (
                          <button
                            onClick={() => {
                              setSelectedContact(null);
                              setShowAddModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
                          >
                            <Plus className="w-5 h-5" />
                            Add your first contact
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredContacts.map((contact) => (
                        <motion.div
                          key={contact.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all"
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              {/* Profile Avatar - Photo or Emoji */}
                              <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {contact.profile_image ? (
                                  <img 
                                    src={contact.profile_image} 
                                    alt={contact.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-2xl">{contact.emoji}</span>
                                )}
                              </div>

                              {/* Contact Info */}
                              <div className="flex-1 min-w-0">
                                {/* Name */}
                                <h3 className="font-bold text-gray-900 text-base mb-1 leading-tight">
                                  {contact.name}
                                </h3>

                                {/* Chain */}
                                <div className="flex items-center gap-1.5 mb-2">
                                  {CHAINS[contact.chain]?.logoUrl ? (
                                    <img 
                                      src={CHAINS[contact.chain].logoUrl} 
                                      alt={CHAINS[contact.chain].name}
                                      className="w-4 h-4 rounded-full"
                                    />
                                  ) : (
                                    <span className="text-xs">{CHAINS[contact.chain]?.icon || '🌐'}</span>
                                  )}
                                  <span className="text-xs text-gray-600 font-medium">
                                    {CHAINS[contact.chain]?.name || contact.chain}
                                  </span>
                                </div>

                                {/* Address */}
                                <div className="text-xs text-gray-500 font-mono mb-2">
                                  {contact.address.slice(0, 10)}...{contact.address.slice(-8)}
                                </div>

                                {/* Tags */}
                                {contact.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {contact.tags.slice(0, 3).map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-md font-medium"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {contact.tags.length > 3 && (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md font-medium">
                                        +{contact.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleToggleFavorite(contact)}
                                  className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                  <Star className={`w-4 h-4 ${contact.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setShowAddModal(true);
                                  }}
                                  className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-400" />
                                </button>

                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </div>

                            {/* Notes Section */}
                            {contact.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <AnimatePresence>
                                  {expandedContact === contact.id ? (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                    >
                                      <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                                        {contact.notes}
                                      </p>
                                      <button
                                        onClick={() => setExpandedContact(null)}
                                        className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                      >
                                        Hide notes
                                      </button>
                                    </motion.div>
                                  ) : (
                                    <button
                                      onClick={() => setExpandedContact(contact.id)}
                                      className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                    >
                                      Show notes
                                    </button>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>

                          {/* Select Button */}
                          {onSelectContact && (
                            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                              <button
                                onClick={() => handleSelectContact(contact)}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-lg font-semibold transition-all text-sm"
                              >
                                Select
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Contact Modal */}
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedContact(null);
        }}
        onSaved={() => {
          loadContacts();
          setShowAddModal(false);
          setSelectedContact(null);
        }}
        editContact={selectedContact}
        prefillChain={filterChain}
      />
    </>
  );
}
