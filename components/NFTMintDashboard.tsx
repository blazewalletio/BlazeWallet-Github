'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sparkles, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { NFTService, NFTCollection, NFTStats } from '@/lib/nft-service';
import { ethers } from 'ethers';

export default function NFTMintDashboard() {
  const { wallet } = useWalletStore();
  const [selectedSkin, setSelectedSkin] = useState<number | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Real data from contracts
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [stats, setStats] = useState<NFTStats | null>(null);
  const [nftService, setNftService] = useState<NFTService | null>(null);

  // Load data when wallet connects
  useEffect(() => {
    const loadData = async () => {
      if (!wallet) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const service = new NFTService(wallet);
        setNftService(service);
        
        const [collectionsData, statsData] = await Promise.all([
          service.getCollections(),
          service.getNFTStats(await wallet.getAddress()),
        ]);
        
        setCollections(collectionsData);
        setStats(statsData);
      } catch (err: any) {
        console.error('Error loading NFT data:', err);
        setError(err.message || 'Failed to load NFT data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [wallet]);

  // Helper function to get rarity based on collection
  const getRarity = (collection: NFTCollection) => {
    if (collection.maxSupply <= 100) return 'Legendary';
    if (collection.maxSupply <= 500) return 'Epic';
    if (collection.maxSupply <= 1000) return 'Rare';
    return 'Common';
  };

  // Helper function to get gradient based on collection name
  const getGradient = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('neon')) return 'from-purple-500 to-pink-500';
    if (nameLower.includes('galaxy')) return 'from-blue-500 to-cyan-500';
    if (nameLower.includes('diamond')) return 'from-orange-500 to-yellow-500';
    return 'from-green-500 to-emerald-500';
  };

  // Helper function to get benefits based on rarity
  const getBenefits = (rarity: string) => {
    switch (rarity) {
      case 'Legendary':
        return ['Exclusive theme', 'Personal manager', 'All features unlocked', 'Custom everything', 'Exclusive events'];
      case 'Epic':
        return ['Exclusive theme', 'VIP support', 'Alpha access', 'Custom sounds', 'Special effects'];
      case 'Rare':
        return ['Exclusive theme', 'Premium support', 'Beta access', 'Custom animations'];
      default:
        return ['Exclusive theme', 'Priority support', 'Early access to features'];
    }
  };

  const handleMint = async () => {
    if (selectedSkin === null || !nftService) return;
    
    try {
      setIsMinting(true);
      setError(null);
      setSuccess(null);
      
      const collection = collections[selectedSkin];
      console.log('Minting NFT from collection:', collection.name);
      
      const txHash = await nftService.mintNFT(collection.id);
      
      setSuccess(`Successfully minted ${collection.name} NFT! Transaction: ${txHash.slice(0, 10)}...`);
      setSelectedSkin(null);
      
      // Reload data to update stats
      const [collectionsData, statsData] = await Promise.all([
        nftService.getCollections(),
        nftService.getNFTStats(await wallet!.getAddress()),
      ]);
      
      setCollections(collectionsData);
      setStats(statsData);
      
    } catch (err: any) {
      console.error('Error minting NFT:', err);
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Palette className="w-6 h-6 text-orange-500" />
          NFT Collection
        </h2>
        <p className="text-gray-600">
          Mint exclusive Blaze Wallet NFT skins and unlock premium features
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-700 mb-1">NFT Benefits</h3>
            <p className="text-sm text-orange-600">
              Each NFT skin unlocks exclusive themes, features, and benefits. The rarer the skin, the more perks you get!
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
          <span className="ml-3 text-gray-600">Loading NFT data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-700 mb-1">Error</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-700 mb-1">Success</h3>
            <p className="text-sm text-green-600">{success}</p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Palette className="w-5 h-5" />
              <span className="text-sm font-semibold">Total Minted</span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{stats.totalMinted.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">
              NFT skins
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold">Your NFTs</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.userNFTs}</div>
            <div className="text-sm text-gray-600 mt-1">
              Currently owned
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold">Your BLAZE</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.userBlazeBalanceFormatted.toFixed(0)}</div>
            <div className="text-sm text-gray-600 mt-1">
              BLAZE tokens
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold">Premium Status</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">
              {stats.premiumStatus ? 'Yes' : 'No'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {stats.premiumStatus ? `${stats.premiumDiscount}% discount` : 'Get 1k+ BLAZE'}
            </div>
          </motion.div>
        </div>
      )}

      {/* NFT Collection */}
      {collections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map((collection, index) => {
            const isSelected = selectedSkin === index;
            const rarity = getRarity(collection);
            const gradient = getGradient(collection.name);
            const benefits = getBenefits(rarity);
            
            return (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedSkin(index)}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all bg-white ${
                  isSelected
                    ? 'border-orange-500 shadow-lg shadow-orange-500/20'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                } ${!collection.active ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {/* Rarity Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white ${
                  rarity === 'Legendary' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' :
                  rarity === 'Epic' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                  rarity === 'Rare' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                  'bg-gradient-to-r from-slate-500 to-slate-600'
                }`}>
                  {rarity}
                </div>

                {/* Preview */}
                <div className={`w-full h-48 rounded-xl bg-gradient-to-br ${gradient} mb-4 flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="text-center relative z-10">
                    <div className="w-20 h-20 mx-auto mb-2 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Sparkles className="w-10 h-10 text-white/80" />
                    </div>
                    <div className="text-white font-bold text-lg">{collection.name}</div>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-xl font-bold mb-1">{collection.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">Exclusive NFT skin for Blaze Wallet</p>

                  {/* Benefits */}
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-semibold">Benefits:</h4>
                    {benefits.map((benefit, i) => (
                      <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                        <div className="w-1 h-1 bg-orange-500 rounded-full" />
                        {benefit}
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Price:</span>
                      <span className="font-bold">{collection.priceFormatted.toFixed(2)} BLAZE</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Minted:</span>
                      <span className="font-semibold">{collection.minted}/{collection.maxSupply}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`}
                        style={{ width: `${collection.progress}%` }}
                      />
                    </div>

                    {!collection.active && (
                      <div className="text-xs text-red-600 font-semibold mt-2">
                        Collection not active
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* No Collections */}
      {!isLoading && collections.length === 0 && (
        <div className="text-center py-12">
          <Palette className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No NFT Collections Available</h3>
          <p className="text-gray-500">Check back later for new NFT collections to mint!</p>
        </div>
      )}

      {/* Mint Button */}
      {selectedSkin !== null && collections[selectedSkin] && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">{collections[selectedSkin].name}</h3>
              <p className="text-sm text-gray-600">Ready to mint</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{collections[selectedSkin].priceFormatted.toFixed(2)} BLAZE</div>
              <div className="text-sm text-gray-600">
                {stats?.premiumStatus ? `Premium discount applied!` : 'Standard price'}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleMint}
            disabled={isMinting || !collections[selectedSkin].active}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isMinting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Minting...
              </>
            ) : !collections[selectedSkin].active ? (
              <>
                <AlertCircle className="w-5 h-5" />
                Collection Not Active
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Mint NFT
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}
