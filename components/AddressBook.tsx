'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Star, Edit2, Trash2, X, ChevronRight,
  BookUser, Loader2, Tag, StickyNote, Calendar, TrendingUp
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '@/lib/chains';
import AddContactModal from './AddContactModal';

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
  is_favorite: boolean;
  tags: string[];
  notes?: string;
  created_at: string;
  transaction_count?: number;
  total_sent?: string;
  last_used?: string;
}

interface AddressBookProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contact: Contact) => void; // For picking from SendModal
  filterChain?: string; // Only show contacts for specific chain
}

export default function AddressBook({ isOpen, onClose, onSelectContact, filterChain }: AddressBookProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>(filterChain || 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadContacts();
    }
  }, [isOpen, user]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery, selectedChainFilter]);

  const loadContacts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('address_book')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    // Apply chain filter
    if (selectedChainFilter !== 'all') {
      filtered = filtered.filter(c => c.chain === selectedChainFilter);
    }

    // Apply search
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

  const toggleFavorite = async (contact: Contact) => {
    try {
      const { error } = await supabase
        .from('address_book')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contact.id);

      if (error) throw error;

      await loadContacts();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Weet je zeker dat je dit contact wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('address_book')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      await loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleContactClick = (contact: Contact) => {
    if (onSelectContact) {
      // Picker mode - return selected contact
      onSelectContact(contact);
      onClose();
    } else {
      // View mode - show details
      setSelectedContact(contact);
      setShowDetailModal(true);
    }
  };

  const favorites = filteredContacts.filter(c => c.is_favorite);
  const regular = filteredContacts.filter(c => !c.is_favorite);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <BookUser className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {onSelectContact ? 'Kies contact' : 'Adresboek'}
                  </h2>
                  <p className="text-orange-100 text-sm">
                    {contacts.length} {contacts.length === 1 ? 'contact' : 'contacten'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-200" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam, adres of tag..."
                className="w-full bg-white/20 backdrop-blur-sm text-white placeholder-orange-200 pl-12 pr-4 py-3 rounded-2xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>

            {/* Chain Filter */}
            {!filterChain && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedChainFilter('all')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedChainFilter === 'all'
                      ? 'bg-white text-orange-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Alle chains
                </button>
                {Object.entries(CHAINS).map(([key, chain]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedChainFilter(key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedChainFilter === key
                        ? 'bg-white text-orange-600'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {chain.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-280px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <BookUser className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery || selectedChainFilter !== 'all' 
                    ? 'Geen contacten gevonden' 
                    : 'Nog geen contacten'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery || selectedChainFilter !== 'all'
                    ? 'Probeer een andere zoekopdracht'
                    : 'Voeg je eerste contact toe om te beginnen'}
                </p>
                {!onSelectContact && !searchQuery && selectedChainFilter === 'all' && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium hover:shadow-lg transition-all"
                  >
                    <Plus className="w-5 h-5 inline mr-2" />
                    Contact toevoegen
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Favorites */}
                {favorites.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                      Favorieten
                    </h3>
                    <div className="space-y-2">
                      {favorites.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onClick={() => handleContactClick(contact)}
                          onToggleFavorite={() => toggleFavorite(contact)}
                          onEdit={() => {
                            setSelectedContact(contact);
                            setShowAddModal(true);
                          }}
                          onDelete={() => deleteContact(contact.id)}
                          isPickerMode={!!onSelectContact}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Regular Contacts */}
                {regular.length > 0 && (
                  <div>
                    {favorites.length > 0 && (
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Alle contacten
                      </h3>
                    )}
                    <div className="space-y-2">
                      {regular.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onClick={() => handleContactClick(contact)}
                          onToggleFavorite={() => toggleFavorite(contact)}
                          onEdit={() => {
                            setSelectedContact(contact);
                            setShowAddModal(true);
                          }}
                          onDelete={() => deleteContact(contact.id)}
                          isPickerMode={!!onSelectContact}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!onSelectContact && (
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedContact(null);
                  setShowAddModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nieuw contact toevoegen
              </button>
            </div>
          )}
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
      </motion.div>
    </AnimatePresence>
  );
}

// Contact Card Component
function ContactCard({
  contact,
  onClick,
  onToggleFavorite,
  onEdit,
  onDelete,
  isPickerMode,
}: {
  contact: Contact;
  onClick: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPickerMode: boolean;
}) {
  const chain = CHAINS[contact.chain as keyof typeof CHAINS];
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          onClick={onClick}
          className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center text-2xl cursor-pointer hover:scale-105 transition-transform"
        >
          {contact.emoji}
        </div>

        {/* Info */}
        <div onClick={onClick} className="flex-1 cursor-pointer">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{contact.name}</h4>
            {contact.is_favorite && (
              <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {chain && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                {chain.name}
              </span>
            )}
            <span className="text-gray-400">•</span>
            <span className="font-mono text-xs">
              {contact.address.slice(0, 6)}...{contact.address.slice(-4)}
            </span>
          </div>
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {contact.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isPickerMode && (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                contact.is_favorite
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <Star className={`w-4 h-4 ${contact.is_favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors text-gray-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center transition-colors text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {isPickerMode && (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </motion.div>
  );
}

