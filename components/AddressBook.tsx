'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Star, Edit2, Trash2, X, ChevronDown, Users, CheckCircle2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '@/lib/chains';
import AddContactModal from './AddContactModal';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { getCurrentAccount } from '@/lib/account-manager';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Contact {
  id: string;
  name: string;
  chain: string;
  address: string;
  emoji: string;
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
  const [userId, setUserId] = useState<string | null>(null);  // Changed from 'user' to 'userId'
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
      console.error('Failed to load contacts:', error);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortContacts = () => {
    let filtered = [...contacts];

    if (selectedChainFilter !== 'all') {
      filtered = filtered.filter(contact => contact.chain === selectedChainFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(query) ||
        contact.tags.some(tag => tag.toLowerCase().includes(query)) ||
        contact.address.toLowerCase().includes(query)
      );
    }

    setFilteredContacts(filtered);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('address_book')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      await loadContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleToggleFavorite = async (contact: Contact) => {
    try {
      const { error } = await supabase
        .from('address_book')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contact.id);

      if (error) throw error;
      await loadContacts();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    if (!onSelectContact) return;
    onSelectContact({
      address: contact.address,
      name: contact.name,
    });
  };

  if (!isOpen) return null;

  const chainOptions = [
    { value: 'all', label: 'All chains', logo: '🌐', logoUrl: null },
    ...Object.entries(CHAINS).map(([key, chain]) => ({
      value: key,
      label: chain.name,
      logo: chain.icon,
      logoUrl: chain.logoUrl,
    })),
  ];

  const selectedChainOption = chainOptions.find(opt => opt.value === selectedChainFilter) || chainOptions[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            {/* Header */}
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Address book</h2>
                  <p className="text-sm text-gray-600">
                    {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} saved
                  </p>
                </div>
              </div>
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
                      placeholder="Search by name, address, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
                          className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                        >
                          <div className="flex items-start gap-4">
                            {/* Emoji Avatar */}
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">
                              {contact.emoji}
                            </div>

                            {/* Contact Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {contact.name}
                                </h3>
                                {contact.is_favorite && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                )}
                              </div>

                              {/* Chain Badge */}
                              <div className="flex items-center gap-2 mb-2">
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

                              {/* Tags */}
                              {contact.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {contact.tags.slice(0, 3).map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {contact.tags.length > 3 && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                                      +{contact.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Address */}
                              <div className="text-xs text-gray-600 font-mono truncate">
                                {contact.address.slice(0, 12)}...{contact.address.slice(-8)}
                              </div>

                              {/* Notes (Expanded) */}
                              {contact.notes && expandedContact === contact.id && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-xs text-gray-600">{contact.notes}</p>
                                </div>
                              )}

                              {/* Expand button for notes */}
                              {contact.notes && expandedContact !== contact.id && (
                                <button
                                  onClick={() => setExpandedContact(contact.id)}
                                  className="text-xs text-orange-600 hover:text-orange-700 mt-2"
                                >
                                  Show notes
                                </button>
                              )}

                              {expandedContact === contact.id && contact.notes && (
                                <button
                                  onClick={() => setExpandedContact(null)}
                                  className="text-xs text-orange-600 hover:text-orange-700 mt-2"
                                >
                                  Hide notes
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleFavorite(contact)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title={contact.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Star className={`w-4 h-4 ${contact.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setShowAddModal(true);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit contact"
                              >
                                <Edit2 className="w-4 h-4 text-gray-600" />
                              </button>

                              <button
                                onClick={() => handleDeleteContact(contact.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete contact"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>

                              {onSelectContact && (
                                <button
                                  onClick={() => handleSelectContact(contact)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white text-xs font-semibold rounded-lg transition-all"
                                >
                                  Select
                                </button>
                              )}
                            </div>
                          </div>
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
        prefillChain={selectedChainFilter !== 'all' ? selectedChainFilter : undefined}
      />
    </AnimatePresence>
  );
}
