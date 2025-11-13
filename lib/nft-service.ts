import { ethers } from 'ethers';
import { CONTRACTS, BlazeWalletSkinsABI, BlazeTokenABI } from './contracts-config';
import { logger } from '@/lib/logger';

export interface NFTCollection {
  id: number;
  name: string;
  baseURI: string;
  price: string;
  priceFormatted: number;
  maxSupply: number;
  minted: number;
  active: boolean;
  progress: number;
}

export interface UserNFT {
  tokenId: number;
  collectionId: number;
  serialNumber: number;
  owner: string;
  uri: string;
  collectionName: string;
}

export interface NFTStats {
  totalCollections: number;
  activeCollections: number;
  totalMinted: number;
  userNFTs: number;
  userBlazeBalance: string;
  userBlazeBalanceFormatted: number;
  premiumStatus: boolean;
  premiumDiscount: number;
}

export class NFTService {
  private nftContract: ethers.Contract;
  private blazeTokenContract: ethers.Contract;
  private wallet: ethers.Signer;

  constructor(wallet: ethers.Signer) {
    this.wallet = wallet;
    this.nftContract = new ethers.Contract(
      CONTRACTS.nftSkins,
      BlazeWalletSkinsABI.abi,
      wallet
    );
    this.blazeTokenContract = new ethers.Contract(
      CONTRACTS.blazeToken,
      BlazeTokenABI.abi,
      wallet
    );
  }

  /**
   * Get all NFT collections
   */
  async getCollections(): Promise<NFTCollection[]> {
    try {
      const nextCollectionId = await this.nftContract.nextCollectionId();
      const collections: NFTCollection[] = [];

      for (let i = 1; i < nextCollectionId; i++) {
        const collectionData = await this.nftContract.collections(i);
        const progress = collectionData.maxSupply > 0 
          ? (Number(collectionData.minted) / Number(collectionData.maxSupply)) * 100 
          : 0;

        collections.push({
          id: Number(collectionData.id),
          name: collectionData.name,
          baseURI: collectionData.baseURI,
          price: collectionData.price.toString(),
          priceFormatted: Number(ethers.formatEther(collectionData.price)),
          maxSupply: Number(collectionData.maxSupply),
          minted: Number(collectionData.minted),
          active: collectionData.active,
          progress,
        });
      }

      return collections.reverse(); // Show newest first
    } catch (error) {
      logger.error('Error fetching NFT collections:', error);
      throw error;
    }
  }

  /**
   * Get user's NFTs
   */
  async getUserNFTs(userAddress: string): Promise<UserNFT[]> {
    try {
      const tokenIds = await this.nftContract.getUserSkins(userAddress);
      const userNFTs: UserNFT[] = [];

      for (const tokenId of tokenIds) {
        const skinDetails = await this.nftContract.getSkinDetails(tokenId);
        const collectionData = await this.nftContract.collections(skinDetails.collectionId);

        userNFTs.push({
          tokenId: Number(skinDetails.tokenId),
          collectionId: Number(skinDetails.collectionId),
          serialNumber: Number(skinDetails.serialNumber),
          owner: skinDetails.owner,
          uri: skinDetails.uri,
          collectionName: collectionData.name,
        });
      }

      return userNFTs;
    } catch (error) {
      logger.error('Error fetching user NFTs:', error);
      throw error;
    }
  }

  /**
   * Get NFT statistics
   */
  async getNFTStats(userAddress: string): Promise<NFTStats> {
    try {
      const [
        nextCollectionId,
        userBlazeBalance,
        premiumStatus,
        premiumDiscount,
        userNFTs,
      ] = await Promise.all([
        this.nftContract.nextCollectionId(),
        this.blazeTokenContract.balanceOf(userAddress),
        this.nftContract.isPremiumUser(userAddress),
        this.nftContract.premiumDiscountPercentage(),
        this.getUserNFTs(userAddress),
      ]);

      const allCollections = await this.getCollections();
      const activeCollections = allCollections.filter(c => c.active).length;
      const totalMinted = allCollections.reduce((sum, c) => sum + c.minted, 0);

      return {
        totalCollections: Number(nextCollectionId) - 1,
        activeCollections,
        totalMinted,
        userNFTs: userNFTs.length,
        userBlazeBalance: userBlazeBalance.toString(),
        userBlazeBalanceFormatted: Number(ethers.formatEther(userBlazeBalance)),
        premiumStatus,
        premiumDiscount: Number(premiumDiscount),
      };
    } catch (error) {
      logger.error('Error fetching NFT stats:', error);
      throw error;
    }
  }

  /**
   * Mint an NFT from a collection
   */
  async mintNFT(collectionId: number): Promise<string> {
    try {
      // Check if user has enough BLAZE tokens
      const collection = await this.nftContract.collections(collectionId);
      const userAddress = await this.wallet.getAddress();
      const userBalance = await this.blazeTokenContract.balanceOf(userAddress);
      
      let price = collection.price;
      
      // Apply premium discount if applicable
      if (await this.nftContract.isPremiumUser(userAddress)) {
        const discountPercentage = await this.nftContract.premiumDiscountPercentage();
        price = price.mul(10000 - discountPercentage).div(10000);
      }

      if (userBalance < price) {
        throw new Error('Insufficient BLAZE balance');
      }

      // Approve tokens if needed
      const allowance = await this.blazeTokenContract.allowance(userAddress, CONTRACTS.nftSkins);
      if (allowance < price) {
        logger.log('Approving BLAZE tokens...');
        const approveTx = await this.blazeTokenContract.approve(CONTRACTS.nftSkins, price);
        await approveTx.wait();
        logger.log('BLAZE tokens approved');
      }

      // Mint the NFT
      logger.log('Minting NFT...');
      const tx = await this.nftContract.mintSkin(collectionId);
      const receipt = await tx.wait();

      logger.log('NFT minted successfully!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error minting NFT:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('Insufficient BLAZE balance')) {
        throw new Error('Insufficient BLAZE balance for minting');
      }
      if (error.message.includes('Collection sold out')) {
        throw new Error('This collection is sold out');
      }
      if (error.message.includes('Collection is not active')) {
        throw new Error('This collection is not active');
      }
      throw new Error(error.message || 'Failed to mint NFT');
    }
  }

  /**
   * Check if user can mint from a collection
   */
  async canMint(collectionId: number, userAddress: string): Promise<{
    canMint: boolean;
    reason?: string;
    price: string;
    priceFormatted: number;
    hasDiscount: boolean;
  }> {
    try {
      const collection = await this.nftContract.collections(collectionId);
      
      if (!collection.active) {
        return {
          canMint: false,
          reason: 'Collection is not active',
          price: collection.price.toString(),
          priceFormatted: Number(ethers.formatEther(collection.price)),
          hasDiscount: false,
        };
      }

      if (collection.minted >= collection.maxSupply) {
        return {
          canMint: false,
          reason: 'Collection is sold out',
          price: collection.price.toString(),
          priceFormatted: Number(ethers.formatEther(collection.price)),
          hasDiscount: false,
        };
      }

      const userBalance = await this.blazeTokenContract.balanceOf(userAddress);
      const isPremium = await this.nftContract.isPremiumUser(userAddress);
      
      let price = collection.price;
      let hasDiscount = false;
      
      if (isPremium) {
        const discountPercentage = await this.nftContract.premiumDiscountPercentage();
        price = price.mul(10000 - discountPercentage).div(10000);
        hasDiscount = true;
      }

      if (userBalance < price) {
        return {
          canMint: false,
          reason: 'Insufficient BLAZE balance',
          price: price.toString(),
          priceFormatted: Number(ethers.formatEther(price)),
          hasDiscount,
        };
      }

      return {
        canMint: true,
        price: price.toString(),
        priceFormatted: Number(ethers.formatEther(price)),
        hasDiscount,
      };
    } catch (error) {
      logger.error('Error checking mint eligibility:', error);
      throw error;
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return CONTRACTS.nftSkins;
  }
}
