'use client';

import { useState } from 'react';
import { Rocket, AlertCircle, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { logger } from '@/lib/logger';

export default function FounderDeploy() {
  const { wallet, currentChain, balance } = useWalletStore();
  const chain = CHAINS[currentChain];
  const [step, setStep] = useState<'ready' | 'deploying' | 'success'>('ready');
  const [tokenAddress, setTokenAddress] = useState('');
  const [copied, setCopied] = useState(false);

  const handleDeploy = () => {
    if (!wallet) return;
    
    setStep('deploying');
    
    // This will trigger external deployment
    // Show instructions to user
    setTimeout(() => {
      // Simulated - in reality you'll deploy via hardhat
      setStep('success');
      setTokenAddress('0x...(will be real after deployment)');
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!wallet) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-6">
          <AlertCircle className="w-12 h-12 text-theme-primary mb-3" />
          <h3 className="text-lg font-semibold mb-2">No Wallet Found</h3>
          <p className="text-theme-text-secondary">Create or import a wallet first to deploy Blaze Token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🔥 Deploy Blaze Token</h1>
        <p className="text-theme-text-secondary">Deploy the official Blaze Token from your wallet</p>
      </div>

      {/* Wallet Info */}
      <div className="bg-theme-bg-secondary/50 rounded-xl p-6 border border-theme-border-primary/50">
        <h3 className="font-semibold mb-3">Deployment Wallet</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-theme-text-secondary">Address:</span>
            <span className="font-mono">{wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-theme-text-secondary">Network:</span>
            <span>{chain.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-theme-text-secondary">Balance:</span>
            <span>{balance} {chain.nativeCurrency.symbol}</span>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      {step === 'ready' && (
        <div className="bg-theme-bg-secondary/50 rounded-xl p-6 border border-theme-border-primary/50">
          <h3 className="font-semibold mb-4">📋 Pre-Deployment Checklist</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-theme-primary mt-0.5" />
              <div>
                <div className="font-medium">Wallet Created</div>
                <div className="text-sm text-theme-text-secondary">Your Blaze wallet is ready</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-theme-primary mt-0.5" />
              <div>
                <div className="font-medium">Network Selected</div>
                <div className="text-sm text-theme-text-secondary">{chain.name} ({chain.id === 97 ? 'Testnet' : 'Mainnet'})</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {parseFloat(balance) > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-theme-primary mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
              )}
              <div>
                <div className="font-medium">Gas Fees Available</div>
                <div className="text-sm text-theme-text-secondary">
                  {parseFloat(balance) > 0 
                    ? `${balance} ${chain.nativeCurrency.symbol} available`
                    : `Need ${chain.nativeCurrency.symbol} for gas fees`
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Instructions */}
      {step === 'ready' && (
        <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-6">
          <h3 className="font-semibold mb-3">🚀 Ready to Deploy!</h3>
          <p className="text-sm text-theme-text-primary mb-4">
            Click below to get your deployment command. Run it in your terminal to deploy Blaze Token.
          </p>
          
          <button
            onClick={handleDeploy}
            disabled={parseFloat(balance) === 0}
            className="w-full py-3 bg-gradient-primary rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <Rocket className="w-5 h-5 inline mr-2" />
            Get Deployment Command
          </button>
        </div>
      )}

      {/* Deploying State */}
      {step === 'deploying' && (
        <div className="bg-theme-bg-secondary/50 rounded-xl p-6 border border-theme-border-primary/50">
          <h3 className="font-semibold mb-4">📦 Deployment Instructions</h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-theme-text-secondary mb-2">Step 1: Export your private key</div>
              <div className="bg-theme-bg-card/50 rounded-lg p-3 font-mono text-sm">
                Private Key: {wallet.privateKey.slice(0, 20)}...
                <button
                  onClick={() => copyToClipboard(wallet.privateKey)}
                  className="ml-2 text-theme-primary hover:text-theme-primary"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 inline" /> : <Copy className="w-4 h-4 inline" />}
                </button>
              </div>
            </div>

            <div>
              <div className="text-sm text-theme-text-secondary mb-2">Step 2: Create .env file</div>
              <div className="bg-theme-bg-card/50 rounded-lg p-3 font-mono text-sm overflow-x-auto">
                cd contracts<br/>
                echo "PRIVATE_KEY={wallet.privateKey}" &gt; .env
              </div>
            </div>

            <div>
              <div className="text-sm text-theme-text-secondary mb-2">Step 3: Deploy to {chain.name}</div>
              <div className="bg-theme-bg-card/50 rounded-lg p-3 font-mono text-sm">
                npm run deploy:{chain.id === 97 ? 'testnet' : 'bsc'}
              </div>
            </div>

            <div className="bg-theme-primary/10 border border-theme-border/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div className="text-sm text-theme-text-primary">
                  <strong>Important:</strong> Run these commands in your terminal. The deployment will take ~30 seconds and cost ~$5 in gas fees.
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('success')}
              className="w-full py-3 bg-theme-bg-card hover:bg-theme-bg-secondary rounded-xl transition-colors"
            >
              I've Deployed the Token
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {step === 'success' && (
        <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-6">
          <div className="text-center mb-6">
            <CheckCircle2 className="w-16 h-16 text-theme-primary mx-auto mb-3" />
            <h3 className="text-2xl font-bold mb-2">🎉 Blaze Token Deployed!</h3>
            <p className="text-theme-text-secondary">Your token is now live on {chain.name}</p>
          </div>

          <div className="bg-theme-bg-card/50 rounded-lg p-4 mb-4">
            <div className="text-sm text-theme-text-secondary mb-2">Contract Address:</div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm">{tokenAddress || '(paste from terminal)'}</div>
              <button
                onClick={() => copyToClipboard(tokenAddress)}
                className="text-theme-primary hover:text-theme-primary"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`${chain.explorerUrl}/address/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-4 bg-theme-bg-card hover:bg-theme-bg-secondary rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </a>
            <button
              onClick={() => {
                setStep('ready');
                setTokenAddress('');
              }}
              className="py-2 px-4 bg-theme-bg-card hover:bg-theme-bg-secondary rounded-lg transition-colors"
            >
              Deploy Another
            </button>
          </div>

          <div className="mt-6 p-4 bg-theme-primary/10 border border-theme-border/20 rounded-lg">
            <h4 className="font-semibold mb-2">🎯 Next Steps:</h4>
            <ul className="text-sm text-theme-text-primary space-y-1">
              <li>1. Add liquidity on PancakeSwap ($400)</li>
              <li>2. Lock liquidity for 2 years</li>
              <li>3. Post on social media</li>
              <li>4. Start marketing!</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}




