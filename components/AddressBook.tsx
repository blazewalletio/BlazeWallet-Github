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
  inline?: boolean; // ✅ NEW: Render inline without modal wrapper
}

export default function AddressBook({ isOpen, onClose, onSelectContact, filterChain, inline = false }: AddressBookProps) {
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

  useBlockBodyScroll(isOpen && !inline); // ✅ Don't block scroll in inline mode

  // ✅ FIX: Load userId when modal opens (not just on mount)
  useEffect(() => {
    if (!isOpen) return;
    
    const loadUserId = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        logger.error('Failed to get user:', error);
        setIsLoading(false); // Stop loading if auth fails
        return;
      }
      
      if (user) {
        setUserId(user.id);
        logger.log(`✅ User ID loaded: ${user.id}`);
      } else {
        logger.warn('⚠️ No authenticated user found');
        setIsLoading(false); // Stop loading if no user
      }
    };
    
    loadUserId();
  }, [isOpen]); // ✅ Re-run when modal opens

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
    if (!userId) {
      setIsLoading(false); // ✅ FIX: Stop loading if no user
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('address_book')
        .select('*')
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('name');

      if (error) {
        logger.error('Failed to load contacts:', error);
        throw error;
      }
      
      setContacts(data || []);
      logger.log(`✅ Loaded ${data?.length || 0} contacts`);
    } catch (error) {
      logger.error('Failed to load contacts:', error);
      setContacts([]); // ✅ Clear contacts on error
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

  // ✅ Address Book Content (reusable for both modal and inline)
  const addressBookContent = (
    <div className={inline ? "space-y-6" : "flex-1 overflow-y-auto"}>
      <div className={inline ? "" : "max-w-4xl mx-auto p-6 pb-24"}>
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
          {!inline && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
          )}
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
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                                  selectedChainFilter === option.value ? 'bg-orange-50' : ''
                                }`}
                              >
                                {option.logoUrl ? (
                                  <img 
                                    src={option.logoUrl} 
                                    alt={option.label}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                  />
                                ) : (
                              <span className="text-lg flex-shrink-0">{option.logo}</span>
                                )}
                            <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                                  {option.label}
                                </span>
                            {selectedChainFilter === option.value && (
                              <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            )}
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl transition-all shadow-sm"
                >
                  <Plus className="w-5 h-5" />
              <span className="font-medium">Add contact</span>
                </button>

            {/* Contacts List */}
                {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading contacts...
                  </div>
            ) : filteredContacts.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                          {searchQuery || selectedChainFilter !== 'all'
                            ? 'No contacts found'
                            : 'No contacts yet'}
                        </p>
                <p className="text-sm text-gray-500">
                          {searchQuery || selectedChainFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first contact to get started'}
                </p>
                      </div>
                    ) : (
              <div className="space-y-3">
                {filteredContacts.map((contact) => (
                  <div
                          key={contact.id}
                    className="border border-gray-200 rounded-xl hover:shadow-md transition-all overflow-hidden"
                        >
                    {/* Contact Header (Always Visible) */}
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        if (onSelectContact) {
                          onSelectContact({ address: contact.address, name: contact.name });
                          if (!inline) onClose();
                        } else {
                          setExpandedContact(expandedContact === contact.id ? null : contact.id);
                        }
                      }}
                    >
                      {/* Avatar/Emoji */}
                                {contact.profile_image ? (
                                  <img 
                                    src={contact.profile_image} 
                                    alt={contact.name}
                          className="w-12 h-12 rounded-full object-cover"
                                  />
                                ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-2xl">
                          {contact.emoji}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
                          {contact.is_favorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
                                )}
                              </div>
                        <p className="text-xs text-gray-500 truncate">{contact.address}</p>
                        {/* Chain Badge */}
                        {(() => {
                          const chain = CHAINS[contact.chain as keyof typeof CHAINS];
                          return chain ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              {chain.logoUrl ? (
                                    <img 
                                  src={chain.logoUrl} 
                                  alt={chain.name}
                                      className="w-4 h-4 rounded-full"
                                    />
                                  ) : (
                                <span className="text-sm">{chain.icon}</span>
                                  )}
                              <span className="text-xs text-gray-600 font-medium">{chain.name}</span>
                                </div>
                          ) : null;
                        })()}
                              </div>

                              {/* Actions */}
                      {!onSelectContact && (
                        <div className="flex items-center gap-2">
                                <button
                            onClick={(e) => {
                              e.stopPropagation();
                                    setSelectedContact(contact);
                                    setShowAddModal(true);
                                  }}
                            className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                                >
                            <Edit2 className="w-4 h-4 text-orange-600" />
                                </button>
                                <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContact(contact.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                >
                            <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                      )}
                            </div>

                    {/* Expanded Details */}
                    {!onSelectContact && (
                                <AnimatePresence>
                                  {expandedContact === contact.id ? (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-2"
                          >
                            {contact.notes && (
                              <p className="text-sm text-gray-700">{contact.notes}</p>
                            )}
                            {contact.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {contact.tags.map((tag, i) => (
                                  <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                    {tag}
                                  </span>
                                ))}
                            </div>
                          )}
                        </motion.div>
                        ) : null}
                      </AnimatePresence>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {inline ? (
        // ✅ Inline Mode: Render content directly (no modal wrapper)
        addressBookContent
      ) : (
        // ✅ Modal Mode: Render with backdrop and overlay
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
              />

              {/* Full Screen Overlay */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-orange-50 to-white overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {addressBookContent}
      </motion.div>
          </>
        )}
      </AnimatePresence>
      )}

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
