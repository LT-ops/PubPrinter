import { useState, useEffect } from 'react';
import './App.css'
import { ethers } from 'ethers';
import { TOKENS } from "./constants/tokens";
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiConfig, http, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSimulateContract } from 'wagmi';
import { useAccount, useBalance } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TokenCard from './TokenCard';
import { useDexScreenerTokenPrice } from './components/shared';
import TipJar from './components/TipJar';

// --- Chain and WalletConnect Setup ---
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

const pulseChain = {
  id: 369,
  name: 'PulseChain',
  network: 'pulsechain',
  nativeCurrency: {
    name: 'Pulse',
    symbol: 'PLS',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.pulsechain.com'] },
    public: { http: ['https://rpc.pulsechain.com'] },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
  testnet: false,
};

const config = getDefaultConfig({
  appName: 'PubPrinter',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [pulseChain],
  transports: {
    [pulseChain.id]: http('https://rpc.pulsechain.com'),
  },
});

const queryClient = new QueryClient();

// --- Minting Step Logic ---
// Calculates minting cost, step, and supply info for a token based on total supply
interface MintingDebugInfo {
  totalSupply: number;
  stepSize: number;
  initialSupply: number;
  mintedAfterInitial: number;
  currentStepNumber: number;
  initialBaseCost: number;
  totalIncrease: number;
  currentCost: number;
  nextMintingStep: number;
  remainingAtCurrentCost: number;
  tokenType: string;
}

interface MintingInfo {
  currentCost: number;
  remainingAtCurrentCost: number;
  nextMintingStep: number;
  debug: MintingDebugInfo;
}

function getMintingInfo(totalSupply: number | undefined, step: number, initialSupply: number = 0): MintingInfo {
  // Calculate mint cost based on step logic
  if (typeof totalSupply !== 'number' || isNaN(totalSupply)) {
    const baseCost = 2;
    return {
      currentCost: baseCost,
      remainingAtCurrentCost: initialSupply > 0 ? initialSupply : step,
      nextMintingStep: initialSupply + step,
      debug: {
        totalSupply: 0,
        stepSize: step,
        initialSupply,
        mintedAfterInitial: 0,
        currentStepNumber: 0,
        initialBaseCost: baseCost,
        totalIncrease: 0,
        currentCost: baseCost,
        nextMintingStep: initialSupply + step,
        remainingAtCurrentCost: initialSupply > 0 ? initialSupply : step,
        tokenType: step === 1111 ? 'EOE' : 'BTB',
      },
    };
  }
  // If supply is less than initialSupply, still show base cost
  if (totalSupply < initialSupply) {
    const baseCost = 2;
    return {
      currentCost: baseCost,
      remainingAtCurrentCost: initialSupply - totalSupply,
      nextMintingStep: initialSupply,
      debug: {
        totalSupply: totalSupply || 0,
        stepSize: step,
        initialSupply,
        mintedAfterInitial: 0,
        currentStepNumber: 0,
        initialBaseCost: baseCost,
        totalIncrease: 0,
        currentCost: baseCost,
        nextMintingStep: initialSupply,
        remainingAtCurrentCost: initialSupply - totalSupply,
        tokenType: step === 1111 ? 'EOE' : 'BTB',
      },
    };
  }
  // EOE and BTB start at baseCost 2, increase by 1 every step
  const baseCost = 2;
  // Use totalSupply + 1 to get the cost for the next token to be minted
  const nextTokenSupply = Math.floor(totalSupply) + 1;
  const mintedAfterInitial = Math.max(0, nextTokenSupply - initialSupply - 1);
  const currentStep = Math.floor(mintedAfterInitial / step);
  const currentCost = baseCost + currentStep;
  const nextMintingStep = initialSupply + (currentStep + 1) * step;
  const remainingAtCurrentCost = nextMintingStep - Math.floor(totalSupply);
  const debugInfo: MintingDebugInfo = {
    totalSupply: totalSupply || 0,
    stepSize: step,
    initialSupply,
    mintedAfterInitial,
    currentStepNumber: currentStep,
    initialBaseCost: baseCost,
    totalIncrease: currentStep,
    currentCost,
    nextMintingStep,
    remainingAtCurrentCost,
    tokenType: step === 1111 ? 'EOE' : 'BTB',
  };
  return {
    currentCost,
    remainingAtCurrentCost,
    nextMintingStep,
    debug: debugInfo,
  };
}

// Enhanced function to check minting profitability with more detailed status
function checkMintingProfitability(
  currentCost: number,
  mintedTokenMarketPrice: string | undefined,
  parentTokenMarketPrice: string | undefined
): {
  isProfitable: boolean,
  profitMargin: number,
  profitColor: string,
  status: 'profit' | 'breakeven' | 'loss' | 'unknown',
  statusLabel: string,
  statusClass: string,
  icon: string
} {
  if (
    !mintedTokenMarketPrice ||
    isNaN(Number(mintedTokenMarketPrice)) ||
    !parentTokenMarketPrice ||
    isNaN(Number(parentTokenMarketPrice))
  ) {
    return { 
      isProfitable: false, 
      profitMargin: 0, 
      profitColor: 'text-gray-500',
      status: 'unknown',
      statusLabel: 'UNKNOWN',
      statusClass: 'bg-gray-100 text-gray-500',
      icon: '❓'
    };
  }

  const mintingCostUSD = currentCost * Number(parentTokenMarketPrice);
  const marketPriceUSD = Number(mintedTokenMarketPrice);
  const profitMargin = ((marketPriceUSD - mintingCostUSD) / mintingCostUSD) * 100;

  if (profitMargin > 2) {
    return {
      isProfitable: true,
      profitMargin,
      profitColor: profitMargin > 20 ? 'text-green-600' : 'text-green-500',
      status: 'profit',
      statusLabel: 'PROFIT',
      statusClass: profitMargin > 20 ? 'bg-green-100 text-green-700' : 'bg-green-50 text-green-600',
      icon: '💰'
    };
  } else if (profitMargin >= -2 && profitMargin <= 2) {
    return {
      isProfitable: false,
      profitMargin,
      profitColor: 'text-yellow-600',
      status: 'breakeven',
      statusLabel: 'BREAK EVEN',
      statusClass: 'bg-yellow-50 text-yellow-700',
      icon: '⚖️'
    };
  } else {
    return {
      isProfitable: false,
      profitMargin,
      profitColor: profitMargin > -20 ? 'text-yellow-500' : 'text-red-500',
      status: 'loss',
      statusLabel: 'LOSS',
      statusClass: profitMargin > -20 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700',
      icon: '⚠️'
    };
  }
}

// --- Mint Button & Modal ---
// Handles approval, allowance, and minting for a token
function MintButton({ token, label, parentToken, parentSymbol, disabled, currentCost, darkMode }: { token: any, label: string, parentToken: any, parentSymbol: string, disabled?: boolean, currentCost?: number, darkMode?: boolean }) {
  const { address } = useAccount();
  
  // Use separate state variables to avoid cross-dependencies that cause infinite loops
  const [amount, setAmount] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [stepWarning, setStepWarning] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);

  // --- Parent token balance for user guidance ---
  // Fix: Only pass 'token' to useBalance if address is defined and parentToken is not native (PLS)
  const isNative = !parentToken.address;
  const balanceArgs = address
    ? isNative
      ? { address, chainId: 369 }
      : { address, token: parentToken.address as `0x${string}`, chainId: 369 }
    : { address, chainId: 369 };
  const { data: parentBalanceData } = useBalance(balanceArgs);

  // Fix: declare effectiveTotalSupply at the top before any use
  let effectiveTotalSupply = token.totalSupply;

  // Step boundary warning logic
  let mintingInfo: any = null;
  let mintStep = 0, initialSupply = 0, baseCost = 2;
  if (token.symbol === 'EOE') {
    // Always use integer part of totalSupply for step logic
    const eoeSupply = Math.floor(Number(token.totalSupply || 0));
    mintStep = TOKENS.EHONEEH.mintStep;
    initialSupply = 1111;
    mintingInfo = getMintingInfo(eoeSupply, mintStep, initialSupply);
  } else if (token.symbol === 'BTB') {
    const btbSupply = Math.floor(Number(token.totalSupply || 0));
    mintStep = TOKENS.BEETWOBEE.mintStep;
    initialSupply = 420;
    mintingInfo = getMintingInfo(btbSupply, mintStep, initialSupply);
  } else {
    mintingInfo = null;
  }

  // --- Mint amount preview and warnings ---
  let amountInWei: bigint | undefined = undefined;
  const decimals = token.decimals ?? 18;
  let amountNum = 0;
  try {
    if (amount && amount !== '0' && amount !== '0.' && Number(amount) > 0) {
      amountInWei = ethers.parseUnits(amount, decimals);
      amountNum = Number(amount);
    }
  } catch {
    amountInWei = undefined;
    amountNum = 0;
  }

  // Determine correct cost symbol for display
  let costSymbol = parentSymbol;
  // For EOE, cost is in A1A; for BTB, cost is in B2B; for A1A and B2B, cost is in PLS
  if (token.symbol === 'A1A' || token.symbol === 'B2B') {
    costSymbol = 'PLS';
  } else if (token.symbol === 'EOE') {
    costSymbol = 'A1A';
  } else if (token.symbol === 'BTB') {
    costSymbol = 'B2B';
  }

  // Calculate total mint cost using step logic
  let totalMintCost = mintingInfo?.currentCost && amountNum > 0 && (token.symbol === 'EOE' || token.symbol === 'BTB')
    ? calculateTotalMintCost({
        totalSupply: Math.floor(Number(effectiveTotalSupply || 0)),
        amount: amountNum,
        step: mintStep,
        initialSupply,
        baseCost,
      })
    : { totalCost: amountNum * (mintingInfo?.currentCost || 1), breakdown: [{ count: amountNum, cost: mintingInfo?.currentCost || 1 }] };

  // --- Gas estimation using useSimulateContract ---
  const simulate = useSimulateContract({
    address: token.address,
    abi: token.abi,
    functionName: 'mint',
    args: amountInWei ? [amountInWei] : undefined,
    chainId: 369,
    account: address,
    query: { enabled: !!amountInWei && !!address },
  });
  const gasEstimate = simulate.data?.request?.gas;
  const gasEstimationFailed = !!simulate.error;
  const gasIsHigh = gasEstimate && gasEstimate > 1000000n;

  // --- Show gas warning if user is likely to fail ---
  // Show if estimation fails, or if parent balance/allowance is insufficient
  let likelyToFail = false;
  if (amountInWei && parentBalanceData?.value) {
    // Calculate total cost using step cost
    const requiredBalance = parentToken.address
      ? ethers.parseUnits(totalMintCost.totalCost.toString(), parentToken.decimals || 18)
      : ethers.parseUnits(totalMintCost.totalCost.toString(), 18);
    if (parentBalanceData.value < requiredBalance) {
      likelyToFail = true;
    }
    if (parentToken.address && allowance !== undefined && allowance < requiredBalance) {
      likelyToFail = true;
    }
  }
  // Always show if estimation fails
  if (gasEstimationFailed) likelyToFail = true;
  // Show if gas is very high
  if (gasIsHigh) likelyToFail = true;

  const gasWarning = likelyToFail
    ? gasEstimationFailed
      ? 'Gas estimation failed. This transaction may fail or be very expensive. This is often due to insufficient allowance, parent token balance, or contract minting rules.'
      : gasIsHigh
        ? `Warning: Estimated gas is unusually high (${gasEstimate?.toString()}). This mint may be expensive or fail.`
        : null
    : null;

  // Move step warning logic to be part of blur validation
  // This prevents the effect from causing re-renders during typing
  const updateStepWarning = () => {
    // Clear any existing warning
    setStepWarning(null);
    
    // Skip validation for empty input
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    // Check for step boundary issues
    if (mintingInfo && mintingInfo.remainingAtCurrentCost > 0 && Number(amount) > mintingInfo.remainingAtCurrentCost) {
      setStepWarning(`Warning: Minting more than the remaining at current cost (${mintingInfo.remainingAtCurrentCost}). This will cross a step boundary and may increase gas and cost per token.`);
    }
  };

  // Approve parent token
  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash: undefined });

  useEffect(() => {
    if (isSuccess) setApproved(true);
  }, [isSuccess]);

  // Allowance check using useReadContract
  const { data: allowanceData } = useReadContract({
    address: parentToken.address,
    abi: parentToken.abi,
    functionName: 'allowance',
    args: address && token.address ? [address, token.address] : undefined,
    chainId: 369,
    query: { enabled: !!address && !!token.address && !!amount && !isNaN(Number(amount)) && Number(amount) > 0 },
  });
  useEffect(() => {
    if (allowanceData !== undefined && amount && !isNaN(Number(amount)) && Number(amount) > 0) {
      setAllowance(allowanceData as bigint);
      
      try {
        // Convert amount to wei (considering decimals) before comparing with allowance
        const amountInWei = ethers.parseUnits(amount, decimals);
        setApproved(amountInWei <= (allowanceData as bigint));
      } catch (error) {
        // If parsing fails (e.g., due to invalid decimals), don't approve
        setApproved(false);
      }
    } else {
      setAllowance(0n);
      setApproved(false);
    }
  }, [allowanceData, amount, decimals]);

  const handleMint = () => {
    // Simply show the input dialog and clear any existing errors
    setShowInput(true);
    setError(null);
  };
  
  const handleApprove = () => {
    setError(null);
    if (!amount || amount.trim() === '') {
      setError('Please enter an amount');
      return;
    }
    const numValue = Number(amount);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (decimals === 0) {
      if (!Number.isInteger(numValue)) {
        setError('This token only supports whole numbers');
        return;
      }
    }
    if (amount.includes('.')) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > decimals) {
        setError(`Maximum ${decimals} decimal places allowed`);
        return;
      }
    }
    // Check if user has enough balance to mint
    if (amountInWei && mintingInfo) {
      const requiredBalance = parentToken.address
        ? ethers.parseUnits(totalMintCost.totalCost.toString(), parentToken.decimals || 18)
        : ethers.parseUnits(totalMintCost.totalCost.toString(), 18);
      const requiredBalanceFormatted = ethers.formatUnits(requiredBalance, parentToken.decimals || 18);
      if (parentToken.address && parentBalanceData?.value) {
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (total cost). Your balance: ${parentBalanceData.formatted}`);
          return;
        }
        if (allowance !== undefined && allowance < requiredBalance) {
          setError(`Insufficient allowance. Please approve at least ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} for minting. Your current allowance: ${ethers.formatUnits(allowance, parentToken.decimals || 18)}`);
          return;
        }
      } else if (!parentToken.address && parentBalanceData?.value) {
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (total cost). Your balance: ${parentBalanceData.formatted}`);
          return;
        }
      } else {
        setError(`Unable to verify ${parentSymbol} balance. Please try again.`);
        return;
      }
    }
    try {
      if (!amountInWei) throw new Error('Invalid amount');
      // Only send value for A1A/B2B (PLS mint), not for EOE/BTB
      const isPlsMint = token.symbol === 'A1A' || token.symbol === 'B2B';
      writeContract({
        address: token.address,
        abi: token.abi,
        functionName: 'mint',
        args: [amountInWei],
        chainId: 369,
        ...(isPlsMint ? { value: ethers.parseUnits(totalMintCost.totalCost.toString(), 18) } : {})
      });
      setShowInput(false);
    } catch (e: any) {
      setError(e.message || 'Mint failed');
    }
  };
  
  // We've moved the input sanitization logic directly into the handleAmountChange function
  // This prevents issues with state updates causing re-renders

  // Removed unused validation function

  // Handle validation directly in the input handler instead of using effects
  // No useEffect for input sanitization - this eliminates the cause of infinite loops
  
  // Super simple implementation with no validation during typing
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Just set the raw input value without any validation
    // This is the key to preventing re-render loops!
    setAmount(e.target.value);
    
    // Clear any existing error
    if (error) {
      setError(null);
    }
  };
  
  // Only validate on blur for better UX
  const handleAmountBlur = () => {
    // Skip validation for empty input
    if (!amount || amount.trim() === '') {
      return;
    }
    
    // Validate input when user stops typing
    
    // Check for zero values
    if (amount === '0' || amount === '0.' || Number(amount) <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    
    // For tokens with no decimals, ensure it's a whole number
    if (decimals === 0 && !Number.isInteger(Number(amount))) {
      setError('This token only supports whole numbers');
      return;
    }
    
    // Check for invalid characters
    if (!/^\d*\.?\d*$/.test(amount) || isNaN(Number(amount))) {
      setError('Invalid number format');
      return;
    }
    
    // Check decimal places
    if (amount.includes('.')) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > decimals) {
        setError(`Maximum ${decimals} decimal places allowed`);
        return;
      }
    }
    
    // Everything is valid, clear any errors
    setError(null);
    
    // Check for step warnings when validation is complete
    updateStepWarning();
  };

  // This function has been commented out since it's not currently used
  // but may be useful for future functionality
  /*
  const calculateRequiredBalance = (inputAmount: string): { requiredBalance: bigint, formattedBalance: string } | null => {
    if (!inputAmount || !mintingInfo || isNaN(Number(inputAmount))) return null;
    try {
      const amountBigInt = ethers.parseUnits(inputAmount, decimals);
      const requiredBalance = amountBigInt * BigInt(mintingInfo.currentCost);
      const formattedBalance = ethers.formatUnits(requiredBalance, parentToken.decimals || 18);
      return { requiredBalance, formattedBalance };
    } catch {
      return null;
    }
  };
  */

  // Show pending transaction warning
  useEffect(() => {
    if (isPending || isTxLoading) {
      // showNotification('Transaction in progress. Please wait...', 'info');
    }
  }, [isPending, isTxLoading]);

  // In MintButton, get up-to-date totalSupply for EOE and BTB from the token itself (not parentToken)
  if (token.symbol === 'EOE' || token.symbol === 'BTB') {
    effectiveTotalSupply = Math.floor(Number(token.totalSupply || 0));
    mintingInfo = getMintingInfo(effectiveTotalSupply, mintStep, initialSupply);
  }
  let mintBoxCostPerToken = mintingInfo?.currentCost;
  // For A1A/B2B, fallback to internal logic if currentCost is not provided
  if ((token.symbol === 'A1A' || token.symbol === 'B2B') && !mintBoxCostPerToken) {
    mintBoxCostPerToken = mintingInfo?.currentCost;
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleMint}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded text-white font-semibold transition-all ${
          disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {label}
      </button>

      {showInput && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: darkMode ? 'rgba(60,70,90,0.75)' : 'rgba(220,225,235,0.92)' }}>
          <div
            className="rounded-lg p-6 max-w-md w-full shadow-lg border"
            style={{
              background: darkMode ? 'linear-gradient(135deg, #e3e8f7 0%, #c7d0e0 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e6eaf2 100%)',
              color: darkMode ? '#232946' : '#1a202c',
              borderColor: darkMode ? '#b0b8c9' : '#e2e8f0',
              boxShadow: darkMode ? '0 4px 32px #0005' : '0 4px 24px #b0b8c955',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: darkMode ? '#fff' : '#232946' }}>{label}</h3>
            <div className="space-y-4">
              {/* Always show current cost and next step for EOE/BTB above the input */}
              {(token.symbol === 'EOE' || token.symbol === 'BTB') && (
                <div className="mb-1 text-xs font-semibold" style={{ color: darkMode ? '#2d3a5a' : '#3b3b3b', background: darkMode ? '#e3e8f7' : '#e6eaf2', borderRadius: 4, padding: '6px 8px' }}>
                  Current mint cost: {mintingInfo?.currentCost} {costSymbol} (next increase at {mintingInfo?.nextMintingStep} minted, {mintingInfo?.remainingAtCurrentCost} left at this cost)
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: darkMode ? '#c7d0e0' : '#232946' }}>
                  Amount to mint
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  onBlur={handleAmountBlur}
                  className={`w-full p-2 rounded border focus:ring-2 transition-all ${darkMode ? 'bg-[#f3f6fa] border-[#b0b8c9] text-[#232946] placeholder-gray-500 focus:ring-blue-200 focus:border-blue-300' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-indigo-400 focus:border-indigo-400'}`}
                  placeholder="Enter amount"
                  autoFocus
                  style={{ fontWeight: 500, fontSize: '1.05rem' }}
                />
              </div>
              {error && (
                <div className="text-sm mt-1" style={{ color: darkMode ? '#ff6b6b' : '#b91c1c', background: darkMode ? '#2d1a1a' : '#fee2e2', borderRadius: 6, padding: '6px 10px' }}>{error}</div>
              )}
              {stepWarning && (
                <div className="text-sm mt-1" style={{ color: darkMode ? '#ffe066' : '#b45309', background: darkMode ? '#3a3500' : '#fef3c7', borderRadius: 6, padding: '6px 10px' }}>
                  {stepWarning}
                </div>
              )}
              {gasWarning && (
                <div className="text-sm mt-1" style={{ color: darkMode ? '#ffe066' : '#b45309', background: darkMode ? '#3a3500' : '#fef3c7', borderRadius: 6, padding: '6px 10px' }}>
                  {gasWarning}
                </div>
              )}
              <div
                className="rounded text-sm mt-2"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.85)' : '#f1f5fa',
                  color: darkMode ? '#232946' : '#232946',
                  border: darkMode ? '1px solid #b0b8c9' : '1px solid #e2e8f0',
                  padding: '10px 12px',
                  fontWeight: 500,
                }}
              >
                {/* Stepwise minting info always visible for EOE/BTB */}
                {(token.symbol === 'EOE' || token.symbol === 'BTB') && (
                  <div className="mb-2 text-xs font-semibold" style={{ color: darkMode ? '#2d3a5a' : '#3b3b3b', background: darkMode ? '#e3e8f7' : '#e6eaf2', borderRadius: 4, padding: '6px 8px' }}>
                    Mint cost goes up by 1 {costSymbol} every {token.symbol === 'EOE' ? '1,111 EOE' : '420 BTB'} minted.
                  </div>
                )}
                {/* Cost per token and breakdown logic for EOE/BTB */}
                {(token.symbol === 'EOE' || token.symbol === 'BTB') ? (
                  <>
                    <div>
                      {amount && !error && amountNum > 0 && totalMintCost.breakdown.length === 1 ? (
                        <>Cost per token: <span style={{ color: darkMode ? '#232946' : '#232946', fontWeight: 700 }}>{totalMintCost.breakdown[0].cost} {costSymbol}</span></>
                      ) : amount && !error && amountNum > 0 ? (
                        <>
                          Cost per token: <span style={{ color: darkMode ? '#232946' : '#232946', fontWeight: 700 }}>Stepwise (see breakdown below)</span>
                        </>
                      ) : (
                        <>Cost per token: <span style={{ color: darkMode ? '#232946' : '#232946', fontWeight: 700 }}>-</span></>
                      )}
                    </div>
                    <div>Total cost: <span style={{ color: darkMode ? '#232946' : '#232946', fontWeight: 700 }}>{amount && !error && amountNum > 0 ? totalMintCost.totalCost : 0} {costSymbol}</span></div>
                    {/* Always show breakdown if more than one tier is involved */}
                    {amount && !error && totalMintCost.breakdown.length > 1 && (
                      <div className="text-xs mt-1" style={{ color: darkMode ? '#4b5673' : '#6b7280' }}>
                        Breakdown: {totalMintCost.breakdown.map((b, i) => (
                          <span key={i} style={{ display: 'inline-block', marginRight: 8 }}>{b.count} @ {b.cost} {costSymbol}</span>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
                {/* For A1A/B2B, only show cost if amount entered */}
                {(token.symbol === 'A1A' || token.symbol === 'B2B') && amount && !error && (
                  <div>Total cost: <span style={{ color: darkMode ? '#232946' : '#232946', fontWeight: 700 }}>{amountNum * (mintingInfo?.currentCost || 1)} {costSymbol}</span></div>
                )}
                {/* Show balance and allowance for EOE/BTB */}
                {(token.symbol === 'EOE' || token.symbol === 'BTB') && (
                  <div className="text-xs mt-2" style={{ color: darkMode ? '#4b5673' : '#6b7280' }}>
                    Balance: {parentBalanceData?.formatted ? Number(parentBalanceData.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '...'} {costSymbol}<br />
                    Allowance: {(() => {
                      // Format allowance: show 'Unlimited' if max uint256, else format with commas and 6 decimals
                      if (allowance !== undefined) {
                        const maxUint = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
                        // Use strict equality for maxUint
                        if (allowance === maxUint) return 'Unlimited';
                        // Also treat any value above maxUint - 1 as unlimited (for safety)
                        if (allowance >= maxUint - 1n) return 'Unlimited';
                        const formatted = Number(ethers.formatUnits(allowance, parentToken.decimals || 18)).toLocaleString(undefined, { maximumFractionDigits: 6 });
                        return formatted;
                      }
                      return '...';
                    })()} {costSymbol}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowInput(false)}
                className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${darkMode ? 'bg-[#232946] text-white hover:bg-[#181c24]' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              {!approved ? (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${darkMode ? (!amount || !!error || isPending ? 'bg-gray-600 text-gray-300' : 'bg-blue-700 text-white hover:bg-blue-800') : (!amount || !!error || isPending ? 'bg-gray-400 text-gray-100' : 'bg-indigo-600 text-white hover:bg-indigo-700')}`}
                >
                  {isPending ? 'Approving...' : 'Approve'}
                </button>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${darkMode ? (!amount || !!error || isPending ? 'bg-gray-600 text-gray-300' : 'bg-blue-700 text-white hover:bg-blue-800') : (!amount || !!error || isPending ? 'bg-gray-400 text-gray-100' : 'bg-indigo-600 text-white hover:bg-indigo-700')}`}
                >
                  {isPending ? 'Minting...' : 'Mint'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard Content ---
function AppContent() {
  const [a1a, setA1A] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [b2b, setB2B] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [eoe, setEoe] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [btb, setBtb] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });

  // Restore darkMode state/effect
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  });
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Use DexScreener price hook for all four tokens ---
  const a1aDex = useDexScreenerTokenPrice(TOKENS.A1A.address);
  const b2bDex = useDexScreenerTokenPrice(TOKENS.B2B.address);
  const eoeDex = useDexScreenerTokenPrice(TOKENS.EHONEEH.address);
  const btbDex = useDexScreenerTokenPrice(TOKENS.BEETWOBEE.address);

  // Add lastUpdated state for each token, after DexScreener hooks
  const [a1aLastUpdated, setA1aLastUpdated] = useState<number | undefined>(undefined);
  const [b2bLastUpdated, setB2bLastUpdated] = useState<number | undefined>(undefined);
  const [eoeLastUpdated, setEoeLastUpdated] = useState<number | undefined>(undefined);
  const [btbLastUpdated, setBtbLastUpdated] = useState<number | undefined>(undefined);

  useEffect(() => { if (a1aDex.data) setA1aLastUpdated(Date.now()); }, [a1aDex.data]);
  useEffect(() => { if (b2bDex.data) setB2bLastUpdated(Date.now()); }, [b2bDex.data]);
  useEffect(() => { if (eoeDex.data) setEoeLastUpdated(Date.now()); }, [eoeDex.data]);
  useEffect(() => { if (btbDex.data) setBtbLastUpdated(Date.now()); }, [btbDex.data]);

  // Helper to extract priceUsd from DexScreener data
  function getMarketPrice(dexData: any): string | undefined {
    if (dexData && dexData.data && Array.isArray(dexData.data.pairs)) {
      const price = dexData.data.pairs.find((p: any) => p.priceUsd && !isNaN(Number(p.priceUsd)))?.priceUsd;
      if (price && !isNaN(Number(price))) return String(price);
    }
    return undefined;
  }

  // --- Loading/error state helpers ---
  function getLoadingState(dex: any) {
    if (dex.isLoading) return 'loading';
    if (dex.isError) return 'error';
    if (!dex.data) return 'nodata';
    return 'ok';
  }

  const eoeMarketPrice = getMarketPrice(eoeDex);
  const btbMarketPrice = getMarketPrice(btbDex);
  const a1aMarketPrice = getMarketPrice(a1aDex);
  const b2bMarketPrice = getMarketPrice(b2bDex);

  const { connector } = useAccount();
  // WalletConnect warning hint
  const wcHint = connector && connector.id && connector.id.toLowerCase().includes('walletconnect');

  useEffect(() => {
    async function fetchData() {
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
        
        const a1aContract = new ethers.Contract(TOKENS.A1A.address, TOKENS.A1A.abi, provider);
        const b2bContract = new ethers.Contract(TOKENS.B2B.address, TOKENS.B2B.abi, provider);
        const eoeContract = new ethers.Contract(TOKENS.EHONEEH.address, TOKENS.EHONEEH.abi, provider);
        const btbContract = new ethers.Contract(TOKENS.BEETWOBEE.address, TOKENS.BEETWOBEE.abi, provider);

        const [a1aName, a1aSymbol, a1aTotalSupply, a1aDecimals] = await Promise.all([
          a1aContract.name(),
          a1aContract.symbol(),
          a1aContract.totalSupply(),
          a1aContract.decimals(),
        ]);
        setA1A({ name: a1aName, symbol: a1aSymbol, totalSupply: ethers.formatUnits(a1aTotalSupply, a1aDecimals), decimals: a1aDecimals });

        const [b2bName, b2bSymbol, b2bTotalSupply, b2bDecimals] = await Promise.all([
          b2bContract.name(),
          b2bContract.symbol(),
          b2bContract.totalSupply(),
          b2bContract.decimals(),
        ]);
        setB2B({ name: b2bName, symbol: b2bSymbol, totalSupply: ethers.formatUnits(b2bTotalSupply, b2bDecimals), decimals: b2bDecimals });

        const [eoeName, eoeSymbol, eoeTotalSupply, eoeDecimals] = await Promise.all([
          eoeContract.name(),
          eoeContract.symbol(),
          eoeContract.totalSupply(),
          eoeContract.decimals(),
        ]);
        setEoe({ name: eoeName, symbol: eoeSymbol, totalSupply: ethers.formatUnits(eoeTotalSupply, eoeDecimals), decimals: eoeDecimals });

        const [btbName, btbSymbol, btbTotalSupply, btbDecimals] = await Promise.all([
          btbContract.name(),
          btbContract.symbol(),
          btbContract.totalSupply(),
          btbContract.decimals(),
        ]);
        setBtb({ name: btbName, symbol: btbSymbol, totalSupply: ethers.formatUnits(btbTotalSupply, btbDecimals), decimals: btbDecimals });

      } catch (e) {
        console.error("Error loading token data", e);
      }
    }
    fetchData();
  }, [TOKENS.A1A.abi, TOKENS.B2B.abi, TOKENS.EHONEEH.abi, TOKENS.BEETWOBEE.abi]);

  // Parse totalSupply as number for calculations
  const eoeSupply = Math.floor(Number(eoe.totalSupply || '0'));
  const btbSupply = Math.floor(Number(btb.totalSupply || '0'));
  const eoeMintInfo = getMintingInfo(eoeSupply, TOKENS.EHONEEH.mintStep, 1111);
  const btbMintInfo = getMintingInfo(btbSupply, TOKENS.BEETWOBEE.mintStep, 420);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-[#181c24] via-[#232946] to-[#181c24]' : 'bg-gradient-to-br from-[#c7d0e0] via-[#b0b8c9] to-[#8a99b8]'}`}
      style={{
        background: darkMode
          ? 'linear-gradient(135deg, #181c24 0%, #232946 60%, #181c24 100%)'
          : 'linear-gradient(135deg, #c7d0e0 0%, #b0b8c9 60%, #8a99b8 100%)',
      }}
    >
      <div className="flex justify-between items-center p-4">
        <h1
          className="text-3xl font-bold text-center flex-1 select-none px-4 py-2 rounded-lg shadow-md"
          style={{
            letterSpacing: 1,
            background: darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)',
            color: darkMode ? '#1a202c' : '#1a202c', // Always dark text for contrast
            textShadow: darkMode ? '0 1px 8px #0002' : 'none',
            transition: 'background 0.3s, color 0.3s',
          }}
        >
          <span role="img" aria-label="sun">☀️</span> Pub Printer <span role="img" aria-label="printer">🖨️</span>
        </h1>
        <button
          className="ml-4 px-3 py-2 rounded-full border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-xl shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle dark mode"
          onClick={() => setDarkMode(d => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
      </div>
      {wcHint && (
        <div className="max-w-xl mx-auto mb-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-xs text-center">
          WalletConnect users: If you see a warning or cannot interact, try refreshing, reconnecting, or use a supported browser wallet like MetaMask for best results.
        </div>
      )}
      <main className="max-w-5xl mx-auto mt-12 p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <TokenCard
            color="text-blue-800"
            title="A1A Token"
            tokenData={a1a}
            marketData={a1aDex.data}
            debugInfo={{ marketData: a1aDex.data, tokenData: a1a }}
            lastUpdated={a1aLastUpdated}
            loadingState={getLoadingState(a1aDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-green-800"
            title="B2B Token"
            tokenData={b2b}
            marketData={b2bDex.data}
            debugInfo={{ marketData: b2bDex.data, tokenData: btb }}
            lastUpdated={b2bLastUpdated}
            loadingState={getLoadingState(b2bDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-purple-800"
            title="EOE (EhOneEh)"
            tokenData={eoe}
            marketData={eoeDex.data}
            mintingInfo={{
              currentCost: eoeMintInfo.currentCost,
              remainingAtCurrentCost: eoeMintInfo.remainingAtCurrentCost,
              nextMintingStep: eoeMintInfo.nextMintingStep,
              profitability: (eoeSupply > 0 && eoeMarketPrice && a1aMarketPrice && isFinite(Number(eoeMarketPrice)) && isFinite(Number(a1aMarketPrice)))
                ? checkMintingProfitability(eoeMintInfo.currentCost, eoeMarketPrice, a1aMarketPrice).profitMargin
                : undefined,
              debug: eoeMintInfo.debug
            }}
            debugInfo={{ marketData: eoeDex.data, tokenData: eoe }}
            lastUpdated={eoeLastUpdated}
            loadingState={getLoadingState(eoeDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-yellow-700"
            title="BTB (BeeTwoBee)"
            tokenData={btb}
            marketData={btbDex.data}
            mintingInfo={{
              currentCost: btbMintInfo.currentCost,
              remainingAtCurrentCost: btbMintInfo.remainingAtCurrentCost,
              nextMintingStep: btbMintInfo.nextMintingStep,
              profitability: (btbSupply > 0 && btbMarketPrice && b2bMarketPrice && isFinite(Number(btbMarketPrice)) && isFinite(Number(b2bMarketPrice)))
                ? checkMintingProfitability(btbMintInfo.currentCost, btbMarketPrice, b2bMarketPrice).profitMargin
                : undefined,
              debug: btbMintInfo.debug
            }}
            debugInfo={{ marketData: btbDex.data, tokenData: btb }}
            lastUpdated={btbLastUpdated}
            loadingState={getLoadingState(btbDex)}
            darkMode={darkMode}
          />
        </div>
      </main>
      <footer className="mt-12 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col items-center gap-4">
            <TipJar />
            <ConnectButton />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span role="img" aria-label="printer">🖨️</span> PubPrinter v1.0
            </p>
          </div>
        </div>
        <div className="fixed bottom-4 left-4 text-xs text-gray-400 dark:text-gray-600">
          Made with 💖 by the community
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

// Calculates the total mint cost for a given amount, considering stepwise cost increases
function calculateTotalMintCost({
  totalSupply,
  amount,
  step,
  initialSupply = 0,
  baseCost = 2,
}: {
  totalSupply: number;
  amount: number;
  step: number;
  initialSupply?: number;
  baseCost?: number;
}): { totalCost: number; breakdown: Array<{ count: number; cost: number }> } {
  let remaining = amount;
  let supply = Math.floor(totalSupply);
  let totalCost = 0;
  let breakdown: Array<{ count: number; cost: number }> = [];
  // If supply is less than initialSupply, fill up to initialSupply at baseCost
  if (supply < initialSupply) {
    const atBase = Math.min(initialSupply - supply, remaining);
    if (atBase > 0) {
      totalCost += atBase * baseCost;
      breakdown.push({ count: atBase, cost: baseCost });
      remaining -= atBase;
      supply += atBase;
    }
  }
  // Now, for each step, increment cost by 1 per step
  while (remaining > 0) {
    const mintedAfterInitial = Math.max(0, supply - initialSupply);
    const currentStep = Math.floor(mintedAfterInitial / step);
    const currentCost = baseCost + currentStep;
    // How many tokens can be minted at this cost before next step?
    const nextStepSupply = initialSupply + (currentStep + 1) * step;
    const tokensAtThisCost = Math.min(remaining, nextStepSupply - supply);
    if (tokensAtThisCost <= 0) break;
    totalCost += tokensAtThisCost * currentCost;
    breakdown.push({ count: tokensAtThisCost, cost: currentCost });
    remaining -= tokensAtThisCost;
    supply += tokensAtThisCost;
  }
  return { totalCost, breakdown };
}

export { MintButton };
export default App;
