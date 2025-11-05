'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Sparkles, Lock, Check, AlertTriangle } from 'lucide-react';

interface NFTMintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NFTMintModal({ isOpen, onClose }: NFTMintModalProps) {
  const [selectedSkin, setSelectedSkin] = useState<number | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  const skins = [
    {
      id: 1,
      name: 'Blaze Founder',
      description: 'Genesis NFT with exclusive founder benefits',
      price: 0.1,
      supply: 100,
      minted: 67,
      benefits: ['2x staking rewards', 'Exclusive badge', 'Early access'],
      rarity: 'Legendary',
      gradient: 'from-theme-primary via-red-500 to-theme-primary',
    },
    {
      id: 2,
      name: 'Diamond Flames',
      description: 'Premium wallet skin with diamond effects',
      price: 0.05,
      supply: 500,
      minted: 234,
      benefits: ['1.5x staking rewards', 'Diamond theme', 'VIP support'],
      rarity: 'Epic',
      gradient: 'from-theme-primary via-blue-500 to-theme-primary',
    },
    {
      id: 3,
      name: 'Golden Spark',
      description: 'Limited edition golden theme',
      price: 0.03,
      supply: 1000,
      minted: 789,
      benefits: ['1.2x staking rewards', 'Gold theme', 'Priority features'],
      rarity: 'Rare',
      gradient: 'from-theme-primary via-orange-500 to-amber-500',
    },
    {
      id: 4,
      name: 'Neon Night',
      description: 'Cyberpunk-inspired wallet design',
      price: 0.02,
      supply: 2000,
      minted: 456,
      benefits: ['Custom theme', 'Neon effects', 'Exclusive animations'],
      rarity: 'Uncommon',
      gradient: 'from-theme-primary via-purple-500 to-theme-primary',
    },
  ];

  const handleMint = async () => {
    if (selectedSkin === null) return;
    
    setIsMinting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsMinting(false);
    
    alert(`🎉 Successfully minted ${skins[selectedSkin].name}!`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-theme-bg-card rounded-2xl border border-theme-border-primary/50 pointer-events-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-theme-bg-card/95 backdrop-blur-xl border-b border-theme-border-primary/50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Palette className="w-6 h-6 text-theme-primary" />
                    NFT Collection
                  </h2>
                  <p className="text-sm text-theme-text-secondary mt-1">
                    Mint exclusive wallet skins as NFTs
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-theme-text-secondary hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Info Banner */}
                <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-theme-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-theme-primary mb-1">Limited Edition NFTs</p>
                      <p className="text-theme-text-primary">
                        Each NFT grants unique wallet themes and multiplied staking rewards. 
                        Only mintable in BLAZE tokens!
                      </p>
                    </div>
                  </div>
                </div>

                {/* NFT Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {skins.map((skin, index) => {
                    const isSelected = selectedSkin === index;
                    const availability = ((skin.supply - skin.minted) / skin.supply) * 100;

                    return (
                      <motion.div
                        key={skin.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedSkin(index)}
                        className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-theme-border bg-theme-primary/10'
                            : 'border-theme-border-primary bg-theme-bg-secondary/50 hover:border-slate-600'
                        }`}
                      >
                        {/* Rarity Badge */}
                        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${
                          skin.rarity === 'Legendary' ? 'bg-gradient-to-r from-theme-primary to-theme-primary' :
                          skin.rarity === 'Epic' ? 'bg-gradient-to-r from-theme-primary to-theme-primary' :
                          skin.rarity === 'Rare' ? 'bg-gradient-to-r from-theme-primary to-theme-primary' :
                          'bg-gradient-to-r from-slate-500 to-slate-600'
                        }`}>
                          {skin.rarity}
                        </div>

                        {/* Preview */}
                        <div className={`w-full h-48 rounded-xl bg-gradient-to-br ${skin.gradient} mb-4 flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-black/20" />
                          <Sparkles className="w-20 h-20 text-white/80 relative z-10" />
                        </div>

                        {/* Info */}
                        <div>
                          <h3 className="text-xl font-bold mb-1">{skin.name}</h3>
                          <p className="text-sm text-theme-text-secondary mb-4">{skin.description}</p>

                          {/* Benefits */}
                          <div className="space-y-2 mb-4">
                            {skin.benefits.map((benefit, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <Check className="w-4 h-4 text-theme-primary" />
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>

                          {/* Supply */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-theme-text-secondary">Minted</span>
                              <span className="font-semibold">{skin.minted} / {skin.supply}</span>
                            </div>
                            <div className="h-2 bg-theme-bg-card rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${skin.gradient}`}
                                style={{ width: `${(skin.minted / skin.supply) * 100}%` }}
                              />
                            </div>
                            {availability < 20 && (
                              <p className="text-xs text-theme-primary mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Only {skin.supply - skin.minted} left!</span>
                              </p>
                            )}
                          </div>

                          {/* Price */}
                          <div className="flex items-center justify-between pt-4 border-t border-theme-border-primary">
                            <div>
                              <div className="text-2xl font-bold">{skin.price} ETH</div>
                              <div className="text-sm text-theme-text-secondary">
                                ≈ {(skin.price / 0.01 * 1700).toFixed(0)} BLAZE
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-8 h-8 rounded-full bg-theme-primary flex items-center justify-center">
                                <Check className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Mint Button */}
                {selectedSkin !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <button
                      onClick={handleMint}
                      disabled={isMinting}
                      className="w-full py-4 bg-gradient-to-r from-theme-primary to-theme-primary hover:from-theme-primary hover:to-theme-primary rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isMinting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Minting...
                        </span>
                      ) : (
                        `Mint ${skins[selectedSkin].name} for ${skins[selectedSkin].price} ETH`
                      )}
                    </button>

                    <p className="text-center text-sm text-theme-text-secondary mt-4">
                      💡 5% of all NFT sales are burned to reduce BLAZE supply
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
