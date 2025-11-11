'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, AlertCircle, Smile } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '@/lib/chains';

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
}

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editContact?: Contact | null;
  prefillChain?: string;
  prefillAddress?: string;
}

const EMOJI_OPTIONS = [
  '👤', '👨', '👩', '👨‍💼', '👩‍💼', '🏢', '🏦', '💼', '🏪', '🏛️',
  '👨‍👩‍👧', '👨‍👩‍👧‍👦', '💑', '👫', '🤝', '🎯', '💰', '💎', '🔥', '⭐',
  '🌟', '✨', '💫', '🚀', '🎨', '🎭', '🎪', '🎬', '🎮', '🎲'
];

const COMMON_TAGS = [
  'Familie', 'Vrienden', 'Werk', 'Zakelijk', 'Exchange', 
  'DeFi', 'NFT', 'Staking', 'Mining', 'Leverancier'
];

export default function AddContactModal({
  isOpen,
  onClose,
  onSaved,
  editContact,
  prefillChain,
  prefillAddress,
}: AddContactModalProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  const [name, setName] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [address, setAddress] = useState('');
  const [emoji, setEmoji] = useState('👤');
  const [isFavorite, setIsFavorite] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [newTag, setNewTag] = useState('');
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or edit contact changes
  useEffect(() => {
    if (isOpen) {
      if (editContact) {
        // Edit mode
        setName(editContact.name);
        setChain(editContact.chain);
        setAddress(editContact.address);
        setEmoji(editContact.emoji);
        setIsFavorite(editContact.is_favorite);
        setTags(editContact.tags || []);
        setNotes(editContact.notes || '');
      } else {
        // Add mode
        setName('');
        setChain(prefillChain || 'ethereum');
        setAddress(prefillAddress || '');
        setEmoji('👤');
        setIsFavorite(false);
        setTags([]);
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, editContact, prefillChain, prefillAddress]);

  const validateAddress = (addr: string, chainName: string): boolean => {
    if (!addr) return false;
    
    // Basic validation per chain type
    if (chainName === 'solana') {
      // Solana addresses are base58 encoded, typically 32-44 chars
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
    } else if (['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash'].includes(chainName)) {
      // Bitcoin-like addresses
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr) || // Legacy
             /^bc1[ac-hj-np-z02-9]{39,59}$/.test(addr) || // Segwit
             /^ltc1[ac-hj-np-z02-9]{39,59}$/.test(addr); // Litecoin
    } else {
      // EVM chains (Ethereum-like)
      return /^0x[a-fA-F0-9]{40}$/.test(addr);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Vul een naam in');
      return;
    }
    
    if (!address.trim()) {
      setError('Vul een adres in');
      return;
    }

    if (!validateAddress(address, chain)) {
      setError('Dit lijkt geen geldig adres voor ' + CHAINS[chain as keyof typeof CHAINS]?.name);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editContact) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from('address_book')
          .update({
            name: name.trim(),
            chain,
            address: address.trim(),
            emoji,
            is_favorite: isFavorite,
            tags,
            notes: notes.trim() || null,
          })
          .eq('id', editContact.id);

        if (updateError) throw updateError;
      } else {
        // Create new contact
        const { error: insertError } = await supabase
          .from('address_book')
          .insert({
            user_id: user!.id,
            name: name.trim(),
            chain,
            address: address.trim(),
            emoji,
            is_favorite: isFavorite,
            tags,
            notes: notes.trim() || null,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('Dit adres bestaat al in je contacten');
          } else {
            throw insertError;
          }
          setLoading(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error saving contact:', error);
      setError('Er ging iets mis bij het opslaan');
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editContact ? 'Contact bewerken' : 'Nieuw contact'}
              </h2>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="space-y-6">
              {/* Name & Emoji */}
              <div className="flex gap-3">
                {/* Emoji Picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-50 hover:from-orange-200 hover:to-orange-100 rounded-2xl flex items-center justify-center text-3xl transition-all"
                  >
                    {emoji}
                  </button>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl p-3 z-10 grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {EMOJI_OPTIONS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            setEmoji(e);
                            setShowEmojiPicker(false);
                          }}
                          className="w-10 h-10 hover:bg-orange-50 rounded-xl flex items-center justify-center text-2xl transition-colors"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Naam
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Bijv. Mom, Binance, Alex..."
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Chain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chain
                </label>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  disabled={!!editContact} // Can't change chain when editing
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {Object.entries(CHAINS).map(([key, chainData]) => (
                    <option key={key} value={key}>
                      {chainData.name}
                    </option>
                  ))}
                </select>
                {editContact && (
                  <p className="text-xs text-gray-500 mt-1">
                    Chain kan niet worden aangepast
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* Favorite Toggle */}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl">
                <div>
                  <h4 className="font-medium text-gray-900">Toevoegen aan favorieten</h4>
                  <p className="text-sm text-gray-600">Favorieten worden bovenaan getoond</p>
                </div>
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    isFavorite ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      isFavorite ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (optioneel)
                </label>
                
                {/* Common tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMON_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (!tags.includes(tag)) {
                          setTags([...tags, tag]);
                        }
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-600 rounded-xl text-sm font-medium transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>

                {/* Selected tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:bg-white/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Custom tag input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Eigen tag toevoegen..."
                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Toevoegen
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notities (optioneel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bijv. Zakelijk adres, alleen voor grote bedragen..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 rounded-2xl text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-2xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !name.trim() || !address.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {editContact ? 'Opslaan' : 'Contact toevoegen'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

