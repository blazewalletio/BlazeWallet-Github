'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookUser, X, Star, ChevronDown } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '@/lib/chains';
import { BlockchainService } from '@/lib/blockchain';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editContact?: any;
  prefillChain?: string;
  prefillAddress?: string;
}

const EMOJI_OPTIONS = [
  '👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧑‍💻', '👨‍🔧', '👩‍🔬',
  '🏢', '🏦', '🏪', '🏭', '🏛️', '💼', '🎯', '💎', '🚀',
  '⭐', '🌟', '✨', '💫', '🔥', '💰', '💵', '🪙', '💳',
  '🎨', '🎵', '🎮', '⚽', '🏀'
];

const COMMON_TAGS = ['Family', 'Friend', 'Business', 'Exchange', 'DeFi', 'NFT', 'Trading'];

export default function AddContactModal({
  isOpen,
  onClose,
  onSaved,
  editContact,
  prefillChain,
  prefillAddress,
}: AddContactModalProps) {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👤');
  const [selectedChain, setSelectedChain] = useState(prefillChain || 'ethereum');
  const [address, setAddress] = useState(prefillAddress || '');
  const [addressLabel, setAddressLabel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useBlockBodyScroll(isOpen);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (isOpen && editContact) {
      setName(editContact.name);
      setSelectedEmoji(editContact.emoji || '👤');
      setTags(editContact.tags || []);
      setNotes(editContact.notes || '');
      setIsFavorite(editContact.is_favorite || false);
      
      if (editContact.addresses && editContact.addresses.length > 0) {
        const firstAddr = editContact.addresses[0];
        setSelectedChain(firstAddr.chain);
        setAddress(firstAddr.address);
        setAddressLabel(firstAddr.label || '');
      }
    } else if (isOpen) {
      // Reset form for new contact
      setName('');
      setSelectedEmoji('👤');
      setSelectedChain(prefillChain || 'ethereum');
      setAddress(prefillAddress || '');
      setAddressLabel('');
      setTags([]);
      setCustomTag('');
      setNotes('');
      setIsFavorite(false);
      setError('');
    }
  }, [isOpen, editContact, prefillChain, prefillAddress]);

  const validateAddress = () => {
    if (!address.trim()) {
      setError('Address is required');
      return false;
    }

    // For Solana, use basic validation
    if (selectedChain === 'solana') {
      const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      if (!isValid) {
        setError('Invalid Solana address (Base58, 32-44 characters)');
        return false;
      }
      return true;
    }

    // For Bitcoin-like chains, use basic validation
    if (['bitcoin', 'litecoin', 'dogecoin', 'bitcoin-cash'].includes(selectedChain)) {
      const isValid = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{39,59}$|^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$|^[qp][a-z0-9]{41}$/.test(address);
      if (!isValid) {
        setError('Invalid Bitcoin-like address');
        return false;
      }
      return true;
    }

    // For EVM chains, use BlockchainService static method
    if (!BlockchainService.isValidAddress(address)) {
      setError('Invalid Ethereum address (0x...)');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!user) {
      setError('Please log in to save contacts');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!validateAddress()) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editContact) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            name: name.trim(),
            emoji: selectedEmoji,
            tags,
            notes: notes.trim() || null,
            is_favorite: isFavorite,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editContact.id);

        if (updateError) throw updateError;

        // Update address if changed
        if (editContact.addresses && editContact.addresses.length > 0) {
          const { error: addrError } = await supabase
            .from('contact_addresses')
            .update({
              chain: selectedChain,
              address: address.trim(),
              label: addressLabel.trim() || null,
            })
            .eq('id', editContact.addresses[0].id);

          if (addrError) throw addrError;
        }
      } else {
        // Create new contact
        const { data: newContact, error: insertError } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            name: name.trim(),
            emoji: selectedEmoji,
            tags,
            notes: notes.trim() || null,
            is_favorite: isFavorite,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add address
        const { error: addrError } = await supabase
          .from('contact_addresses')
          .insert({
            contact_id: newContact.id,
            chain: selectedChain,
            address: address.trim(),
            label: addressLabel.trim() || null,
          });

        if (addrError) throw addrError;
      }

      onSaved();
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      setError(err.message || 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  if (!isOpen) return null;

  const chainOptions = Object.entries(CHAINS).map(([key, chain]) => ({
    value: key,
    label: chain.name,
    logo: chain.icon,
  }));

  const selectedChainOption = chainOptions.find(opt => opt.value === selectedChain) || chainOptions[0];

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
                  <BookUser className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editContact ? 'Edit contact' : 'Add contact'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {editContact ? 'Update contact details' : 'Save a new contact'}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="p-6 space-y-6">
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4"
                  >
                    <p className="text-sm text-red-600">{error}</p>
                  </motion.div>
                )}

                {/* Name & Emoji */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Contact name
                  </label>
                  <div className="flex gap-3">
                    {/* Emoji Picker Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center text-3xl hover:from-orange-200 hover:to-orange-100 transition-all"
                      >
                        {selectedEmoji}
                      </button>

                      <AnimatePresence>
                        {showEmojiPicker && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setShowEmojiPicker(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="absolute left-0 top-16 z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-3 grid grid-cols-6 gap-2 w-64"
                            >
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmoji(emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="text-2xl hover:bg-orange-50 rounded-lg p-2 transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Name Input */}
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />

                    {/* Favorite Star */}
                    <button
                      type="button"
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                        isFavorite
                          ? 'bg-yellow-100 hover:bg-yellow-200'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Chain Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Network
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowChainDropdown(!showChainDropdown)}
                      className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <span className="text-xl">{selectedChainOption.logo}</span>
                      <span className="text-sm font-medium text-gray-700 flex-1 text-left">
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
                            className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20 max-h-80 overflow-y-auto"
                          >
                            {chainOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSelectedChain(option.value);
                                  setShowChainDropdown(false);
                                  setError(''); // Clear validation error
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                                  selectedChain === option.value ? 'bg-orange-50' : ''
                                }`}
                              >
                                <span className="text-lg">{option.logo}</span>
                                <span className={`text-sm font-medium flex-1 text-left ${
                                  selectedChain === option.value ? 'text-orange-600' : 'text-gray-700'
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

                {/* Address */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder={selectedChain === 'solana' ? 'Solana address...' : '0x...'}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setError(''); // Clear error on change
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Address Label (Optional) */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Label <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Primary, Business, Trading..."
                    value={addressLabel}
                    onChange={(e) => setAddressLabel(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Tags <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          tags.includes(tag)
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {tags.map((tag) => (
                        <div
                          key={tag}
                          className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-sm"
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-orange-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      disabled={!customTag.trim()}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg text-sm font-medium transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Add any notes about this contact..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pb-6">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim() || !address.trim()}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
              >
                {isSaving ? 'Saving...' : editContact ? 'Save changes' : 'Add contact'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
