import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from './contracts-config';
import { logger } from '@/lib/logger';

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  voteCountYes: string;
  voteCountNo: string;
  startTime: number;
  endTime: number;
  executed: boolean;
  hasVoted?: boolean;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  votingPower: string;
  votingPowerFormatted: number;
}

// BlazeGovernance ABI (simplified version)
const GOVERNANCE_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "_blazeTokenAddress", "type": "uint256"},
      {"internalType": "uint256", "name": "_proposalThreshold", "type": "uint256"},
      {"internalType": "uint256", "name": "_votingPeriod", "type": "uint256"},
      {"internalType": "uint256", "name": "_quorumPercentage", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "id", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "proposer", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "description", "type": "string"},
      {"indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"}
    ],
    "name": "ProposalCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "proposalId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"},
      {"indexed": false, "internalType": "bool", "name": "support", "type": "bool"},
      {"indexed": false, "internalType": "uint256", "name": "votes", "type": "uint256"}
    ],
    "name": "Voted",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "string", "name": "_description", "type": "string"}],
    "name": "createProposal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proposalCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "proposals",
    "outputs": [
      {"internalType": "uint256", "name": "id", "type": "uint256"},
      {"internalType": "address", "name": "proposer", "type": "address"},
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "uint256", "name": "voteCountYes", "type": "uint256"},
      {"internalType": "uint256", "name": "voteCountNo", "type": "uint256"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "bool", "name": "executed", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proposalThreshold",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_proposalId", "type": "uint256"}, {"internalType": "bool", "name": "_support", "type": "bool"}],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_proposalId", "type": "uint256"}, {"internalType": "address", "name": "_voter", "type": "address"}],
    "name": "hasVoted",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_user", "type": "address"}],
    "name": "getVotingPower",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class GovernanceService {
  private contract: ethers.Contract;
  private wallet: ethers.Signer;
  private blazeToken: ethers.Contract;

  constructor(wallet: ethers.Signer) {
    this.wallet = wallet;
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESSES.governance,
      GOVERNANCE_ABI,
      wallet
    );
    
    // We need the BLAZE token contract to get user balance (voting power)
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
   * Get all proposals
   */
  async getProposals(): Promise<Proposal[]> {
    try {
      // ✅ FIXED: Use proposalCount instead of nextProposalId()
      const proposalCount = await this.contract.proposalCount();
      const userAddress = await this.wallet.getAddress();
      
      const proposals: Proposal[] = [];
      
      // Fetch all proposals (from 1 to proposalCount)
      for (let i = 1; i <= Number(proposalCount); i++) {
        try {
          const proposal = await this.contract.proposals(i);
          const hasVoted = await this.contract.hasVoted(i, userAddress);
          
          proposals.push({
            id: Number(proposal.id),
            proposer: proposal.proposer,
            description: proposal.description,
            voteCountYes: proposal.voteCountYes.toString(),
            voteCountNo: proposal.voteCountNo.toString(),
            startTime: Number(proposal.startTime),
            endTime: Number(proposal.endTime),
            executed: proposal.executed,
            hasVoted
          });
        } catch (error) {
          // Proposal might not exist, skip it
          logger.log(`Proposal ${i} not found, skipping...`);
        }
      }
      
      return proposals;
    } catch (error) {
      logger.error('Error getting proposals:', error);
      throw error;
    }
  }

  /**
   * Get governance statistics
   */
  async getGovernanceStats(userAddress: string): Promise<GovernanceStats> {
    try {
      const [proposals, votingPower] = await Promise.all([
        this.getProposals(),
        this.getVotingPower(userAddress)
      ]);

      const now = Math.floor(Date.now() / 1000);
      const activeProposals = proposals.filter(p => 
        p.startTime <= now && 
        p.endTime > now && 
        !p.executed
      ).length;
      
      const passedProposals = proposals.filter(p => 
        p.endTime <= now && 
        !p.executed &&
        BigInt(p.voteCountYes) > BigInt(p.voteCountNo)
      ).length;

      return {
        totalProposals: proposals.length,
        activeProposals,
        passedProposals,
        votingPower: votingPower.toString(),
        votingPowerFormatted: Number(ethers.formatEther(votingPower))
      };
    } catch (error) {
      logger.error('Error getting governance stats:', error);
      throw error;
    }
  }

  /**
   * Get user's voting power (BLAZE token balance)
   */
  async getVotingPower(userAddress: string): Promise<bigint> {
    try {
      const balance = await this.blazeToken.balanceOf(userAddress);
      return balance;
    } catch (error) {
      logger.error('Error getting voting power:', error);
      throw error;
    }
  }

  /**
   * Create a new proposal
   */
  async createProposal(description: string): Promise<string> {
    try {
      logger.log('Creating proposal...');
      const tx = await this.contract.createProposal(description);
      const receipt = await tx.wait();
      
      logger.log('Proposal created successfully!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error creating proposal:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('Insufficient BLAZE tokens')) {
        throw new Error('You need at least 10,000 BLAZE tokens to create a proposal');
      }
      throw new Error(error.message || 'Failed to create proposal');
    }
  }

  /**
   * Vote on a proposal
   */
  async vote(proposalId: number, support: boolean): Promise<string> {
    try {
      logger.log(`Voting ${support ? 'for' : 'against'} proposal ${proposalId}...`);
      const tx = await this.contract.vote(proposalId, support);
      const receipt = await tx.wait();
      
      logger.log('Vote cast successfully!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error voting:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('Already voted')) {
        throw new Error('You have already voted on this proposal');
      }
      if (error.message.includes('Voting has ended')) {
        throw new Error('Voting period has ended for this proposal');
      }
      throw new Error(error.message || 'Failed to cast vote');
    }
  }

  /**
   * Check if user can create a proposal (has enough BLAZE tokens)
   */
  async canCreateProposal(userAddress: string): Promise<boolean> {
    try {
      const [balance, threshold] = await Promise.all([
        this.blazeToken.balanceOf(userAddress),
        this.contract.proposalThreshold()
      ]);
      
      return balance >= threshold;
    } catch (error) {
      logger.error('Error checking proposal eligibility:', error);
      return false;
    }
  }

  /**
   * Get proposal threshold
   */
  async getProposalThreshold(): Promise<string> {
    try {
      const threshold = await this.contract.proposalThreshold();
      return ethers.formatEther(threshold);
    } catch (error) {
      logger.error('Error getting proposal threshold:', error);
      return '10000'; // Default fallback
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return CONTRACT_ADDRESSES.governance;
  }
}
