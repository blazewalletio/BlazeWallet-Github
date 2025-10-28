#!/bin/bash

# List of all modal/overlay components that need the useBlockBodyScroll hook
modals=(
  "BuyModal"
  "SendModal"
  "ReceiveModal"
  "SwapModal"
  "SettingsModal"
  "AISettingsModal"
  "PriorityListModal"
  "AITransactionAssistant"
  "AIRiskScanner"
  "AIPortfolioAdvisor"
  "AIGasOptimizer"
  "AIBrainAssistant"
  "AIConversationalAssistant"
  "StakingDashboard"
  "GovernanceDashboard"
  "LaunchpadDashboard"
  "CashbackTracker"
  "ReferralDashboard"
  "VestingDashboard"
  "NFTMintDashboard"
)

echo "Modals/overlays that need useBlockBodyScroll:"
for modal in "${modals[@]}"; do
  echo "- $modal"
done

