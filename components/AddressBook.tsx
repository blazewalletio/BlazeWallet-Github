'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Star, Filter, MoreVertical, Edit2, Trash2, X, ChevronDown, Users } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '@/lib/chains';
import AddContactModal from './AddContactModal';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ContactAddress {
  id: string;
  chain: string;
  address: string;
  label?: string;
}

interface Contact {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  notes?: string;
  is_favorite: boolean;
  addresses: ContactAddress[];
  transaction_count: number;
  total_sent_usd: number;
}

interface AddressBookProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contact: { address: string; name: string }) => void;
  filterChain?: string;
}

export default function AddressBook({ isOpen, onClose, onSelectContact, filterChain }: AddressBookProps) {
  const [user, setUser] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>(filterChain || 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  useBlockBodyScroll(isOpen);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      loadContacts();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (filterChain) {
      setSelectedChainFilter(filterChain);
    }
  }, [filterChain]);

  useEffect(() => {
    filterAndSortContacts();
  }, [contacts, searchQuery, selectedChainFilter]);

  const loadContacts = async () => {
    if (!user) return;

    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('name');

      if (contactsError) throw contactsError;

      const { data: addressesData, error: addressesError } = await supabase
        .from('contact_addresses')
        .select('*')
        .in('contact_id', contactsData?.map((c: any) => c.id) || []);

      if (addressesError) throw addressesError;

      const contactsWithAddresses = contactsData?.map((contact: any) => ({
        ...contact,
        addresses: addressesData?.filter((addr: any) => addr.contact_id === contact.id) || [],
      })) || [];

      setContacts(contactsWithAddresses);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const filterAndSortContacts = () => {
    let filtered = [...contacts];

    if (selectedChainFilter !== 'all') {
      filtered = filtered.filter(contact =>
        contact.addresses.some(addr => addr.chain === selectedChainFilter)
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(query) ||
        contact.tags.some(tag => tag.toLowerCase().includes(query)) ||
        contact.addresses.some(addr => addr.address.toLowerCase().includes(query))
      );
    }

    setFilteredContacts(filtered);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('contacts')
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
        .from('contacts')
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

    const chainAddress = contact.addresses.find(addr => 
      selectedChainFilter !== 'all' ? addr.chain === selectedChainFilter : true
    );

    if (chainAddress) {
      onSelectContact({
        address: chainAddress.address,
        name: contact.name,
      });
    }
  };

  if (!isOpen) return null;

  const chainOptions = [
    { value: 'all', label: 'All chains', logo: '🌐' },
    ...Object.entries(CHAINS).map(([key, chain]) => ({
      value: key,
      label: chain.name,
      logo: chain.icon,
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
                    Manage your saved contacts
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
                      placeholder="Search contacts..."
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
                      <span className="text-lg">{selectedChainOption.logo}</span>
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
                                <span className="text-lg">{option.logo}</span>
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

                {/* Contacts List */}
                <div className="space-y-3">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-2">
                        {searchQuery || selectedChainFilter !== 'all'
                          ? 'No contacts found'
                          : 'No contacts yet'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {searchQuery || selectedChainFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'Add your first contact to get started'}
                      </p>
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
                              </div>
                            )}

                            {/* Addresses */}
                            <div className="space-y-1">
                              {contact.addresses
                                .filter(addr => selectedChainFilter === 'all' || addr.chain === selectedChainFilter)
                                .slice(0, expandedContact === contact.id ? undefined : 1)
                                .map((addr) => (
                                  <div key={addr.id} className="flex items-center gap-2">
                                    <span className="text-xs">
                                      {CHAINS[addr.chain]?.icon || '🌐'}
                                    </span>
                                    <span className="text-xs text-gray-600 font-mono truncate">
                                      {addr.address.slice(0, 6)}...{addr.address.slice(-4)}
                                    </span>
                                    {addr.label && (
                                      <span className="text-xs text-gray-500">
                                        ({addr.label})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              
                              {contact.addresses.length > 1 && expandedContact !== contact.id && (
                                <button
                                  onClick={() => setExpandedContact(contact.id)}
                                  className="text-xs text-orange-600 hover:text-orange-700"
                                >
                                  +{contact.addresses.length - 1} more
                                </button>
                              )}

                              {expandedContact === contact.id && contact.addresses.length > 1 && (
                                <button
                                  onClick={() => setExpandedContact(null)}
                                  className="text-xs text-orange-600 hover:text-orange-700"
                                >
                                  Show less
                                </button>
                              )}
                            </div>
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

                        {/* Notes */}
                        {contact.notes && expandedContact === contact.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-600">{contact.notes}</p>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
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
