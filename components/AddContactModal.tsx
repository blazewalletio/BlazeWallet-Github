'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ChevronDown, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CHAINS } from '@/lib/chains';
import { BlockchainService } from '@/lib/blockchain';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { getCurrentAccount } from '@/lib/account-manager';
import { logger } from '@/lib/logger';

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
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👤');
  const [profileImage, setProfileImage] = useState<string | null>(null); // ✨ NEW
  const [selectedChain, setSelectedChain] = useState(prefillChain || 'ethereum');
  const [address, setAddress] = useState(prefillAddress || '');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Real-time validation states
  const [addressValidation, setAddressValidation] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [duplicateWarning, setDuplicateWarning] = useState<{show: boolean, existingName: string} | null>(null);

  useBlockBodyScroll(isOpen);

  useEffect(() => {
    logger.log('🔍 [AddContactModal] Fetching user ID from account manager...');
    const account = getCurrentAccount();
    logger.log('🔍 [AddContactModal] Current account:', account);
    
    if (account) {
      // Use displayName (email) or id (wallet hash) as user_id
      const userIdentifier = account.email || account.id;
      logger.log('✅ [AddContactModal] User identifier:', userIdentifier);
      setUserId(userIdentifier);
    } else {
      logger.error('❌ [AddContactModal] No account found!');
      setUserId(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen && editContact) {
      setName(editContact.name);
      setSelectedEmoji(editContact.emoji || '👤');
      setProfileImage(editContact.profile_image || null); // ✨ NEW
      setSelectedChain(editContact.chain);
      setAddress(editContact.address);
      setTags(editContact.tags || []);
      setNotes(editContact.notes || '');
      setIsFavorite(editContact.is_favorite || false);
    } else if (isOpen) {
      // Reset form for new contact
      setName('');
      setSelectedEmoji('👤');
      setProfileImage(null); // ✨ NEW
      setSelectedChain(prefillChain || 'ethereum');
      setAddress(prefillAddress || '');
      setTags([]);
      setCustomTag('');
      setNotes('');
      setIsFavorite(false);
      setError('');
      setAddressValidation('idle');
      setDuplicateWarning(null);
      setShowSuccessAnimation(false);
    }
  }, [isOpen, editContact, prefillChain, prefillAddress]);

  // Real-time address validation
  useEffect(() => {
    if (!address || address.length < 10) {
      setAddressValidation('idle');
      return;
    }

    const validateTimeout = setTimeout(async () => {
      setAddressValidation('validating');
      
      // Validate address format
      let isValid = false;
      if (selectedChain === 'solana') {
        isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } else if (['bitcoin', 'litecoin', 'dogecoin', 'bitcoin-cash'].includes(selectedChain)) {
        isValid = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{39,59}$|^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$|^[qp][a-z0-9]{41}$/.test(address);
      } else {
        isValid = BlockchainService.isValidAddress(address);
      }

      setAddressValidation(isValid ? 'valid' : 'invalid');

      // Check for duplicates (only if valid and not editing)
      if (isValid && !editContact && userId) {
        try {
          const { data } = await supabase
            .from('address_book')
            .select('name')
            .eq('user_id', userId)
            .eq('chain', selectedChain)
            .eq('address', address.trim())
            .limit(1)
            .single();

          if (data) {
            setDuplicateWarning({ show: true, existingName: data.name });
          } else {
            setDuplicateWarning(null);
          }
        } catch (err) {
          // No duplicate found (expected error)
          setDuplicateWarning(null);
        }
      }
    }, 500);

    return () => clearTimeout(validateTimeout);
  }, [address, selectedChain, userId, editContact]);

  // ✨ NEW: Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image too large. Please use an image smaller than 2MB.');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize image
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate crop dimensions (square crop from center)
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        // Draw and resize
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        // Convert to Base64 (JPEG for smaller size)
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setProfileImage(base64);
        setError('');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    logger.log('🔍 [AddContactModal] handleSave called');
    logger.log('🔍 [AddContactModal] Current userId state:', userId);
    
    if (!userId) {
      logger.error('❌ [AddContactModal] No user ID found!');
      setError('Please log in to save contacts');
      return;
    }

    logger.log('✅ [AddContactModal] User is logged in, proceeding...');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!address.trim()) {
      setError('Address is required');
      return;
    }

    if (addressValidation === 'invalid') {
      setError('Please enter a valid address');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editContact) {
        // Update existing contact
        logger.log('🔄 [AddContactModal] Updating contact:', editContact.id);
        const { error: updateError } = await supabase
          .from('address_book')
          .update({
            name: name.trim(),
            chain: selectedChain,
            address: address.trim(),
            emoji: selectedEmoji,
            profile_image: profileImage, // ✨ NEW
            tags,
            notes: notes.trim() || null,
            is_favorite: isFavorite,
          })
          .eq('id', editContact.id);

        if (updateError) {
          logger.error('❌ [AddContactModal] Update error:', updateError);
          throw updateError;
        }
        logger.log('✅ [AddContactModal] Contact updated successfully');
      } else {
        // Create new contact
        logger.log('➕ [AddContactModal] Creating new contact for user:', userId);
        const contactData = {
          user_id: userId,
          name: name.trim(),
          chain: selectedChain,
          address: address.trim(),
          emoji: selectedEmoji,
          profile_image: profileImage, // ✨ NEW
          tags,
          notes: notes.trim() || null,
          is_favorite: isFavorite,
        };
        logger.log('📝 [AddContactModal] Contact data:', contactData);
        
        const { data: insertData, error: insertError } = await supabase
          .from('address_book')
          .insert(contactData)
          .select();

        if (insertError) {
          logger.error('❌ [AddContactModal] Insert error:', insertError);
          throw insertError;
        }
        logger.log('✅ [AddContactModal] Contact created successfully:', insertData);
      }

      // Show success animation
      setShowSuccessAnimation(true);
      setTimeout(() => {
        onSaved();
      }, 1000);
    } catch (err: any) {
      logger.error('❌ [AddContactModal] Failed to save contact:', err);
      setError(err.message || 'Failed to save contact');
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
    logoUrl: chain.logoUrl,
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
                disabled={isSaving}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors disabled:opacity-50"
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
                {error && !showSuccessAnimation && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 flex-1">{error}</p>
                  </motion.div>
                )}

                {/* Success Animation */}
                <AnimatePresence>
                  {showSuccessAnimation && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <p className="text-sm text-green-700 font-semibold">
                        Contact {editContact ? 'updated' : 'saved'} successfully!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Duplicate Warning */}
                {duplicateWarning?.show && !showSuccessAnimation && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800 font-semibold mb-1">
                          This address already exists
                        </p>
                        <p className="text-xs text-yellow-700">
                          You already have this address saved as "{duplicateWarning.existingName}". You can still add it again if you want.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Name & Profile Photo */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Contact name
                  </label>
                  <div className="flex gap-3">
                    {/* Profile Photo / Emoji Picker */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="profile-image-upload"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('profile-image-upload')?.click()}
                        disabled={isSaving}
                        className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center overflow-hidden hover:from-orange-200 hover:to-orange-100 transition-all disabled:opacity-50 group relative"
                        title="Click to upload photo"
                      >
                        {profileImage ? (
                          <>
                            <img 
                              src={profileImage} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-medium">Change</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-3xl">{selectedEmoji}</span>
                        )}
                      </button>

                      {/* Secondary button for emoji picker (only show if no photo) */}
                      {!profileImage && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            disabled={isSaving}
                            className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-orange-600 transition-all disabled:opacity-50 shadow-md"
                            title="Change emoji"
                          >
                            ✏️
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
                        </>
                      )}

                      {/* Remove photo button (only show if photo exists) */}
                      {profileImage && (
                        <button
                          type="button"
                          onClick={() => setProfileImage(null)}
                          disabled={isSaving}
                          className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-all disabled:opacity-50 shadow-md"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Name Input */}
                    <input aria-label="John Doe"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Favorite Star */}
                    <button
                      type="button"
                      onClick={() => setIsFavorite(!isFavorite)}
                      disabled={isSaving}
                      className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 ${
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
                      disabled={isSaving}
                      className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     aria-expanded={showChainDropdown}>
                      {selectedChainOption.logoUrl ? (
                        <img 
                          src={selectedChainOption.logoUrl} 
                          alt={selectedChainOption.label}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <span className="text-xl">{selectedChainOption.logo}</span>
                      )}
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
                                  setError('');
                                  setAddressValidation('idle');
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                                  selectedChain === option.value ? 'bg-orange-50' : ''
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

                {/* Address with Real-time Validation */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Address
                  </label>
                  <div className="relative">
                    <input aria-label="Text input"
                      type="text"
                      placeholder={selectedChain === 'solana' ? 'Solana address...' : '0x...'}
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setError('');
                      }}
                      disabled={isSaving}
                      className={`w-full px-4 py-3 pr-12 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        addressValidation === 'valid' 
                          ? 'border-green-500 focus:ring-green-500/20 focus:border-green-500' 
                          : addressValidation === 'invalid'
                          ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                          : 'border-gray-200 focus:ring-orange-500/20 focus:border-orange-500'
                      }`}
                    />
                    
                    {/* Validation Icons */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {addressValidation === 'validating' && (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      )}
                      {addressValidation === 'valid' && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {addressValidation === 'invalid' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Helper Text */}
                  {addressValidation === 'valid' && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Valid {CHAINS[selectedChain]?.name || selectedChain} address
                    </p>
                  )}
                  {addressValidation === 'invalid' && address.length >= 10 && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Invalid address format
                    </p>
                  )}
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
                        disabled={isSaving}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
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
                            disabled={isSaving}
                            className="hover:text-orange-900 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input aria-label="Custom tag..."
                      type="text"
                      placeholder="Custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                      disabled={isSaving}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      disabled={!customTag.trim() || isSaving}
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
                    disabled={isSaving}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
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
                disabled={isSaving || !name.trim() || !address.trim() || addressValidation === 'invalid' || addressValidation === 'validating'}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : showSuccessAnimation ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Saved!
                  </>
                ) : (
                  editContact ? 'Save changes' : 'Add contact'
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
