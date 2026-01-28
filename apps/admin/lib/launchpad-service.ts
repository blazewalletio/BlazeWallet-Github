import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from './contracts-config';
import { logger } from '@/lib/logger';

export interface Project {
  id: number;
  projectOwner: string;
  name: string;
  tokenSymbol: string;
  projectToken: string;
  totalTokensOffered: string;
  tokenPriceBNB: string;
  softCapBNB: string;
  hardCapBNB: string;
  minContributionBNB: string;
  maxContributionBNB: string;
  startTime: number;
  endTime: number;
  raisedAmountBNB: string;
  participants: number;
  active: boolean;
  ended: boolean;
  fundsClaimed: boolean;
  tokensDistributed: boolean;
}

export interface LaunchpadStats {
  totalProjects: number;
  activeProjects: number;
  totalRaised: string;
  totalRaisedFormatted: number;
  userContributions: string;
  userContributionsFormatted: number;
  hasEarlyAccess: boolean;
}

// BlazeChainLaunchpad ABI (simplified version)
const LAUNCHPAD_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_blazeTokenAddress", "type": "address"},
      {"internalType": "address", "name": "_treasuryWallet", "type": "address"},
      {"internalType": "uint256", "name": "_platformFeePercentage", "type": "uint256"},
      {"internalType": "uint256", "name": "_earlyAccessThreshold", "type": "uint256"},
      {"internalType": "uint256", "name": "_earlyAccessDuration", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "projectId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "contributor", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amountBNB", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "tokensReceived", "type": "uint256"}
    ],
    "name": "Contribution",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_projectId", "type": "uint256"}],
    "name": "contribute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "earlyAccessDuration",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "earlyAccessThreshold",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_projectId", "type": "uint256"}],
    "name": "getProject",
    "outputs": [
      {"internalType": "uint256", "name": "id", "type": "uint256"},
      {"internalType": "address", "name": "projectOwner", "type": "address"},
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "tokenSymbol", "type": "string"},
      {"internalType": "address", "name": "projectToken", "type": "address"},
      {"internalType": "uint256", "name": "totalTokensOffered", "type": "uint256"},
      {"internalType": "uint256", "name": "tokenPriceBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "softCapBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "hardCapBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "minContributionBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "maxContributionBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "raisedAmountBNB", "type": "uint256"},
      {"internalType": "uint256", "name": "participants", "type": "uint256"},
      {"internalType": "bool", "name": "active", "type": "bool"},
      {"internalType": "bool", "name": "ended", "type": "bool"},
      {"internalType": "bool", "name": "fundsClaimed", "type": "bool"},
      {"internalType": "bool", "name": "tokensDistributed", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_projectId", "type": "uint256"}, {"internalType": "address", "name": "_contributor", "type": "address"}],
    "name": "getContribution",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextProjectId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformFeePercentage",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class LaunchpadService {
  private contract: ethers.Contract;
  private wallet: ethers.Signer;
  private blazeToken: ethers.Contract;

  constructor(wallet: ethers.Signer) {
    this.wallet = wallet;
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESSES.launchpad,
      LAUNCHPAD_ABI,
      wallet
    );
    
    // We need the BLAZE token contract to check early access
    this.blazeToken = new ethers.Contract(
      CONTRACT_ADDRESSES.blazeToken,
      [
        {
          "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      wallet
    );
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    try {
      const nextProjectId = await this.contract.nextProjectId();
      const projects: Project[] = [];
      
      // Fetch all projects (from 1 to nextProjectId - 1)
      for (let i = 1; i < Number(nextProjectId); i++) {
        try {
          const project = await this.contract.getProject(i);
          
          projects.push({
            id: Number(project.id),
            projectOwner: project.projectOwner,
            name: project.name,
            tokenSymbol: project.tokenSymbol,
            projectToken: project.projectToken,
            totalTokensOffered: project.totalTokensOffered.toString(),
            tokenPriceBNB: project.tokenPriceBNB.toString(),
            softCapBNB: project.softCapBNB.toString(),
            hardCapBNB: project.hardCapBNB.toString(),
            minContributionBNB: project.minContributionBNB.toString(),
            maxContributionBNB: project.maxContributionBNB.toString(),
            startTime: Number(project.startTime),
            endTime: Number(project.endTime),
            raisedAmountBNB: project.raisedAmountBNB.toString(),
            participants: Number(project.participants),
            active: project.active,
            ended: project.ended,
            fundsClaimed: project.fundsClaimed,
            tokensDistributed: project.tokensDistributed,
          });
        } catch (error) {
          // Project might not exist, skip it
          logger.log(`Project ${i} not found, skipping...`);
        }
      }
      
      return projects;
    } catch (error) {
      logger.error('Error getting projects:', error);
      throw error;
    }
  }

  /**
   * Get launchpad statistics
   */
  async getLaunchpadStats(userAddress: string): Promise<LaunchpadStats> {
    try {
      const [projects, earlyAccessThreshold, userBalance] = await Promise.all([
        this.getProjects(),
        this.contract.earlyAccessThreshold(),
        this.blazeToken.balanceOf(userAddress)
      ]);

      const now = Math.floor(Date.now() / 1000);
      const activeProjects = projects.filter(p => 
        p.active && 
        p.startTime <= now && 
        p.endTime > now
      ).length;

      const totalRaised = projects.reduce((sum, p) => sum + BigInt(p.raisedAmountBNB), 0n);
      
      // Calculate user's total contributions
      let userContributions = 0n;
      for (const project of projects) {
        try {
          const contribution = await this.contract.getContribution(project.id, userAddress);
          userContributions += contribution;
        } catch (error) {
          // User might not have contributed to this project
        }
      }

      const hasEarlyAccess = userBalance >= earlyAccessThreshold;

      return {
        totalProjects: projects.length,
        activeProjects,
        totalRaised: totalRaised.toString(),
        totalRaisedFormatted: Number(ethers.formatEther(totalRaised)),
        userContributions: userContributions.toString(),
        userContributionsFormatted: Number(ethers.formatEther(userContributions)),
        hasEarlyAccess
      };
    } catch (error) {
      logger.error('Error getting launchpad stats:', error);
      throw error;
    }
  }

  /**
   * Contribute to a project
   */
  async contribute(projectId: number, amountBNB: string): Promise<string> {
    try {
      const amountWei = ethers.parseEther(amountBNB);
      logger.log(`Contributing ${amountBNB} BNB to project ${projectId}...`);
      
      const tx = await this.contract.contribute(projectId, { value: amountWei });
      const receipt = await tx.wait();
      
      logger.log('Contribution successful!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error contributing:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('Project is not active')) {
        throw new Error('Project is not currently active');
      }
      if (error.message.includes('Contribution below minimum')) {
        throw new Error('Contribution amount is below the minimum required');
      }
      if (error.message.includes('Contribution exceeds maximum')) {
        throw new Error('Contribution amount exceeds the maximum allowed');
      }
      if (error.message.includes('Early access period active')) {
        throw new Error('You need early access to contribute now. Hold more BLAZE tokens for early access.');
      }
      throw new Error(error.message || 'Failed to contribute to project');
    }
  }

  /**
   * Get user's contribution to a specific project
   */
  async getUserContribution(projectId: number, userAddress: string): Promise<string> {
    try {
      const contribution = await this.contract.getContribution(projectId, userAddress);
      return ethers.formatEther(contribution);
    } catch (error) {
      logger.error('Error getting user contribution:', error);
      return '0';
    }
  }

  /**
   * Check if user has early access
   */
  async hasEarlyAccess(userAddress: string): Promise<boolean> {
    try {
      const [balance, threshold] = await Promise.all([
        this.blazeToken.balanceOf(userAddress),
        this.contract.earlyAccessThreshold()
      ]);
      
      return balance >= threshold;
    } catch (error) {
      logger.error('Error checking early access:', error);
      return false;
    }
  }

  /**
   * Get early access threshold
   */
  async getEarlyAccessThreshold(): Promise<string> {
    try {
      const threshold = await this.contract.earlyAccessThreshold();
      return ethers.formatEther(threshold);
    } catch (error) {
      logger.error('Error getting early access threshold:', error);
      return '5000'; // Default fallback
    }
  }

  /**
   * Get early access duration
   */
  async getEarlyAccessDuration(): Promise<number> {
    try {
      const duration = await this.contract.earlyAccessDuration();
      return Number(duration);
    } catch (error) {
      logger.error('Error getting early access duration:', error);
      return 3600; // Default 1 hour
    }
  }

  /**
   * Get project status
   */
  getProjectStatus(project: Project): 'upcoming' | 'live' | 'ended' | 'failed' {
    const now = Math.floor(Date.now() / 1000);
    
    if (!project.active || project.ended) {
      return 'ended';
    }
    
    if (project.startTime > now) {
      return 'upcoming';
    }
    
    if (project.endTime <= now) {
      return 'ended';
    }
    
    return 'live';
  }

  /**
   * Calculate progress percentage
   */
  calculateProgress(project: Project): number {
    const raised = BigInt(project.raisedAmountBNB);
    const hardCap = BigInt(project.hardCapBNB);
    
    if (hardCap === 0n) return 0;
    
    return (Number(raised) / Number(hardCap)) * 100;
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return CONTRACT_ADDRESSES.launchpad;
  }
}
