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
import { getMintingCostColor } from './components/shared';
import { usePulseXTokenData } from './components/usePulseXTokenData';
import { testPulseXAPI } from './components/debugPulseX';
import { getMockTokenData } from './components/mockPriceData';
import TipJar from './components/TipJar';

// --- Chain and WalletConnect Setup ---
const WALLETCONNECT_PROJECT_ID = 'YOUR_PROJECT_ID_HERE'; // <-- Replace with your actual WalletConnect project ID

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

// --- Token Balance Component ---
// Shows user's balance for a given token
type TokenBalanceProps = { token: { address: string, decimals?: number }, decimals: number };
function TokenBalance({ token, decimals }: TokenBalanceProps) {
  const { address } = useAccount();
  const isNative = !token.address;
  // Always fetch decimals from token if not provided or unreliable
  const [realDecimals, setRealDecimals] = useState<number>(decimals || 18);
  useEffect(() => {
    async function fetchDecimals() {
      if (isNative || (typeof decimals === 'number' && decimals > 0)) return;
      try {
        const provider = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
        const contract = new ethers.Contract(token.address, ["function decimals() view returns (uint8)"], provider);
        const d = await contract.decimals();
        setRealDecimals(Number(d));
      } catch {}
    }
    fetchDecimals();
  }, [token.address, decimals, isNative]);
  const { data, isLoading } = useBalance({
    address,
    token: isNative ? undefined : (token.address as `0x${string}`),
    chainId: pulseChain.id,
  });
  if (!address) return <span className="text-gray-500">Connect wallet</span>;
  if (isLoading) return <span className="text-gray-500">Loading...</span>;
  if (!data) return <span className="text-gray-500">No data</span>;
  let formatted = '0';
  try {
    if (data.formatted != null && !isNaN(Number(data.formatted))) {
      formatted = Number(data.formatted).toLocaleString(undefined, { maximumFractionDigits: realDecimals });
    } else if (data.value != null) {
      formatted = Number(ethers.formatUnits(data.value, realDecimals)).toLocaleString(undefined, { maximumFractionDigits: realDecimals });
    }
  } catch (e) {
    formatted = '0';
  }
  return <span className="font-mono text-black font-bold">{formatted}</span>;
}

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
  // Ensure integer math for all calculations
  const supplyInt = typeof totalSupply === 'number' && !isNaN(totalSupply) ? Math.floor(Number(totalSupply)) : 0;
  if (supplyInt === 0) {
    return {
      currentCost: 0,
      remainingAtCurrentCost: 0,
      nextMintingStep: initialSupply + step,
      debug: {
        totalSupply: 0,
        stepSize: step,
        initialSupply,
        mintedAfterInitial: 0,
        currentStepNumber: 0,
        initialBaseCost: 0,
        totalIncrease: 0,
        currentCost: 0,
        nextMintingStep: initialSupply + step,
        remainingAtCurrentCost: 0,
        tokenType: step === 1111 ? 'EOE' : 'BTB',
      },
    };
  }
  const isEOE = step === 1111;
  const baseCost = 2; // Set base cost to 2 for both EOE and BTB as requested
  const mintedAfterInitial = Math.max(0, supplyInt - initialSupply);
  const currentStep = supplyInt < initialSupply ? 0 : Math.floor(mintedAfterInitial / step);
  const currentCost = baseCost + currentStep;
  const nextMintingStep = initialSupply + (currentStep + 1) * step;
  // Only allow integer tokens remaining at current cost
  const remainingAtCurrentCost = supplyInt < nextMintingStep ? nextMintingStep - supplyInt : 0;
  const debugInfo: MintingDebugInfo = {
    totalSupply: supplyInt,
    stepSize: step,
    initialSupply,
    mintedAfterInitial,
    currentStepNumber: currentStep,
    initialBaseCost: baseCost,
    totalIncrease: currentStep,
    currentCost,
    nextMintingStep,
    remainingAtCurrentCost,
    tokenType: isEOE ? 'EOE' : 'BTB',
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
function MintButton({ token, label, parentToken, parentSymbol, disabled }: { token: any, label: string, parentToken: any, parentSymbol: string, disabled?: boolean }) {
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
  const { data: parentBalanceData, error: parentBalanceError } = useBalance(balanceArgs);
  let parentBalanceFormatted = '0';
  if (parentBalanceError) {
    parentBalanceFormatted = 'Error';
  } else {
    try {
      if (parentBalanceData?.formatted != null && !isNaN(Number(parentBalanceData.formatted))) {
        parentBalanceFormatted = Number(parentBalanceData.formatted).toLocaleString(undefined, { maximumFractionDigits: parentToken.decimals || 18 });
      } else if (parentBalanceData?.value != null) {
        parentBalanceFormatted = Number(ethers.formatUnits(parentBalanceData.value, parentToken.decimals || 18)).toLocaleString(undefined, { maximumFractionDigits: parentToken.decimals || 18 });
      }
    } catch {}
  }

  // Step boundary warning logic
  let mintingInfo: any = null;
  if (token.symbol === 'EOE') {
    const eoeSupply = parseFloat(token.totalSupply || '0');
    mintingInfo = getMintingInfo(eoeSupply, TOKENS.EHONEEH.mintStep, 1111);
  } else if (token.symbol === 'BTB') {
    const btbSupply = parseFloat(token.totalSupply || '0');
    mintingInfo = getMintingInfo(btbSupply, TOKENS.BEETWOBEE.mintStep, 420);
  }

  // --- Mint amount preview and warnings ---
  // Completely avoid any validation during render to prevent infinite loops
  let amountInWei: bigint | undefined = undefined;
  const decimals = token.decimals ?? 18;
  
  // Only parse amount to Wei if it's potentially valid
  // Do not set any state here to avoid re-render loops
  try {
    if (amount && amount !== '0' && amount !== '0.' && Number(amount) > 0) {
      amountInWei = ethers.parseUnits(amount, decimals);
    }
  } catch {
    // Silently fail - we'll handle errors in the handlers
    amountInWei = undefined;
  }

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
    const stepCost = mintingInfo ? BigInt(mintingInfo.currentCost) : 1n;
    const requiredBalance = amountInWei * stepCost;

    // Check balance for both ERC20 and native tokens
    if (parentBalanceData.value < requiredBalance) {
      likelyToFail = true;
    }

    // For ERC20 tokens, also check allowance
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
    // Start fresh with no error
    setError(null);
    
    // Basic input validation
    if (!amount || amount.trim() === '') {
      setError('Please enter an amount');
      return;
    }
    
    // Validate numeric value
    const numValue = Number(amount);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    
    // For tokens with no decimals
    if (decimals === 0) {
      if (!Number.isInteger(numValue)) {
        setError('This token only supports whole numbers');
        return;
      }
    }
    
    // Check decimal places
    if (amount.includes('.')) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > decimals) {
        setError(`Maximum ${decimals} decimal places allowed`);
        return;
      }
    }

    // Check if user has enough balance to mint
    if (amountInWei && mintingInfo) {
      const requiredBalance = amountInWei * BigInt(mintingInfo.currentCost);
      const requiredBalanceFormatted = ethers.formatUnits(requiredBalance, parentToken.decimals || 18);

      // For non-native tokens (ERC20)
      if (parentToken.address && parentBalanceData?.value) {
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (${amount} tokens × ${mintingInfo.currentCost} ${parentSymbol}) but only have ${parentBalanceFormatted} ${parentSymbol}`);
          return;
        }
      } else if (!parentToken.address && parentBalanceData?.value) {
        // For native token (PLS)
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (${amount} tokens × ${mintingInfo.currentCost} ${parentSymbol}) but only have ${parentBalanceFormatted} ${parentSymbol}`);
          return;
        }
      } else {
        // If we can't verify the balance, don't allow the transaction
        setError(`Unable to verify ${parentSymbol} balance. Please try again.`);
        return;
      }
    }
    
    try {
      if (!amountInWei) throw new Error('Invalid amount');
      writeContract({
        address: token.address,
        abi: token.abi,
        functionName: 'mint',
        args: [amountInWei],
        chainId: 369,
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
  // const calculateRequiredBalance = (inputAmount: string): { requiredBalance: bigint, formattedBalance: string } | null => {
  //   if (!inputAmount || !mintingInfo || isNaN(Number(inputAmount))) return null;
  //   try {
  //     const amountBigInt = ethers.parseUnits(inputAmount, decimals);
  //     const requiredBalance = amountBigInt * BigInt(mintingInfo.currentCost);
  //     const formattedBalance = ethers.formatUnits(requiredBalance, parentToken.decimals || 18);
  //     return { requiredBalance, formattedBalance };
  //   } catch {
  //     return null;
  //   }
  // };

  // Show pending transaction warning
  useEffect(() => {
    if (isPending || isTxLoading) {
      // showNotification('Transaction in progress. Please wait...', 'info');
    }
  }, [isPending, isTxLoading]);

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">{label}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount to mint
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  onBlur={handleAmountBlur}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter amount"
                  autoFocus
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              {stepWarning && (
                <div className="text-yellow-600 text-sm bg-yellow-50 p-2 rounded">
                  {stepWarning}
                </div>
              )}

              {gasWarning && (
                <div className="text-yellow-600 text-sm bg-yellow-50 p-2 rounded">
                  {gasWarning}
                </div>
              )}

              <div className="bg-gray-50 p-2 rounded text-sm">
                <div>Cost per token: {mintingInfo?.currentCost} {parentSymbol}</div>
                {amount && !error && (
                  <div>Total cost: {
                    Number(amount) * (mintingInfo?.currentCost || 0)
                  } {parentSymbol}</div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowInput(false)}
                className="flex-1 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              {!approved ? (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className="flex-1 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                >
                  {isPending ? 'Approving...' : 'Approve'}
                </button>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className="flex-1 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
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

  const a1aPulseX = usePulseXTokenData(TOKENS.A1A.address);
  const b2bPulseX = usePulseXTokenData(TOKENS.B2B.address);
  const eoePulseX = usePulseXTokenData(TOKENS.EHONEEH.address);
  const btbPulseX = usePulseXTokenData(TOKENS.BEETWOBEE.address);

  const { address, connector } = useAccount();
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
  const eoeSupply = parseFloat(eoe.totalSupply || '0');
  const btbSupply = parseFloat(btb.totalSupply || '0');
  // EOE: initial supply 1111, step 1111; BTB: initial supply 420, step 420
  const eoeMintInfo = getMintingInfo(eoeSupply, TOKENS.EHONEEH.mintStep, 1111);
  const btbMintInfo = getMintingInfo(btbSupply, TOKENS.BEETWOBEE.mintStep, 420);

  // Helper to get market price for EOE and BTB with better error handling
  const getMarketPrice = (data: any, tokenAddress: string): string | undefined => {
    if (!data) {
      console.log(`No market data for ${tokenAddress}, using mock data`);
      const mockData = getMockTokenData(tokenAddress);
      if (mockData?.derivedUSD) {
        console.log(`Using mock derivedUSD for ${tokenAddress}: ${mockData.derivedUSD}`);
        return mockData.derivedUSD;
      }
      return undefined;
    }
    
    console.log(`Processing market data for ${tokenAddress}:`, data);
    
    // Try multiple potential sources for price data
    // First check standard fields
    if (data.derivedUSD && !isNaN(Number(data.derivedUSD)) && Number(data.derivedUSD) > 0) {
      console.log(`Found derivedUSD for ${tokenAddress}: ${data.derivedUSD}`);
      return data.derivedUSD;
    }
    
    if (data.priceUSD && !isNaN(Number(data.priceUSD)) && Number(data.priceUSD) > 0) {
      console.log(`Found priceUSD for ${tokenAddress}: ${data.priceUSD}`);
      return data.priceUSD;
    }
    
    // Check PulseX pair data
    if (data.pairBase) {
      const pairs = Array.isArray(data.pairBase) ? data.pairBase : [data.pairBase];
      
      for (const pair of pairs) {
        if (!pair) continue;
        
        if (pair.token0Price && !isNaN(Number(pair.token0Price)) && Number(pair.token0Price) > 0) {
          console.log(`Found token0Price for ${tokenAddress}: ${pair.token0Price}`);
          return String(pair.token0Price);
        }
        if (pair.token1Price && !isNaN(Number(pair.token1Price)) && Number(pair.token1Price) > 0) {
          console.log(`Found token1Price for ${tokenAddress}: ${pair.token1Price}`);
          return String(pair.token1Price);
        }
      }
    }
    
    // Check Dexscreener format if present
    if (data.pairs && Array.isArray(data.pairs)) {
      for (const pair of data.pairs) {
        if (pair?.priceUsd && !isNaN(Number(pair.priceUsd)) && Number(pair.priceUsd) > 0) {
          console.log(`Found Dexscreener price for ${tokenAddress}: ${pair.priceUsd}`);
          return pair.priceUsd;
        }
      }
    }
    
    // Try mock data as fallback
    console.log(`No valid price in market data for ${tokenAddress}, using mock data`);
    const mockData = getMockTokenData(tokenAddress);
    if (mockData?.derivedUSD) {
      console.log(`Using fallback mock derivedUSD for ${tokenAddress}: ${mockData.derivedUSD}`);
      return mockData.derivedUSD;
    }
    
    return undefined;
  };
  
  const eoeMarketPrice = getMarketPrice(eoePulseX.data, TOKENS.EHONEEH.address);
  const btbMarketPrice = getMarketPrice(btbPulseX.data, TOKENS.BEETWOBEE.address);
  const a1aMarketPrice = getMarketPrice(a1aPulseX.data, TOKENS.A1A.address);
  const b2bMarketPrice = getMarketPrice(b2bPulseX.data, TOKENS.B2B.address);
  
  // Log market data for debugging
  useEffect(() => {
    console.log('EOE PulseX data:', eoePulseX.data);
    console.log('EOE PulseX loading:', eoePulseX.loading);
    console.log('EOE PulseX error:', eoePulseX.error);
    console.log('EOE Market Price:', eoeMarketPrice);
    
    console.log('BTB PulseX data:', btbPulseX.data);
    console.log('BTB PulseX loading:', btbPulseX.loading);
    console.log('BTB PulseX error:', btbPulseX.error);
    console.log('BTB Market Price:', btbMarketPrice);
    
    // Test the PulseX API directly to see if it works
    testPulseXAPI();
  }, [eoePulseX.data, eoePulseX.loading, btbPulseX.data, btbPulseX.loading]);

  const [darkMode, setDarkMode] = useState(() => {
    // Try to respect system preference on first load
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

  // Log all supply values and steps for debugging
  useEffect(() => {
    console.log('EOE Supply:', eoeSupply);
    console.log('BTB Supply:', btbSupply);
    console.log('EOE Step Size:', TOKENS.EHONEEH.mintStep);
    console.log('BTB Step Size:', TOKENS.BEETWOBEE.mintStep);
    if (eoeSupply >= 1111) {
      const eoeMintedAfter = eoeSupply - 1111;
      const eoeCurrentStep = Math.floor(eoeMintedAfter / 1111);
      console.log('EOE Minted After Initial:', eoeMintedAfter);
      console.log('EOE Current Step:', eoeCurrentStep);
      console.log('EOE Expected Cost:', 6 + eoeCurrentStep);
    }
    if (btbSupply >= 420) {
      const btbMintedAfter = btbSupply - 420;
      const btbCurrentStep = Math.floor(btbMintedAfter / 420);
      console.log('BTB Minted After Initial:', btbMintedAfter);
      console.log('BTB Current Step:', btbCurrentStep);
      console.log('BTB Expected Cost:', 5 + btbCurrentStep);
    }
  }, [eoeSupply, btbSupply]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} transition-colors duration-300`}>
      <div className="flex justify-between items-center p-4">
        <h1 className="text-3xl font-bold text-center flex-1 select-none" style={{ letterSpacing: 1 }}>
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
        <TokenCard
          color="text-blue-800"
          title="A1A Token"
          token={TOKENS.A1A}
          tokenData={a1a}
          marketData={a1aPulseX.data}
          marketLoading={a1aPulseX.loading}
          marketError={a1aPulseX.error}
          TokenBalance={TokenBalance}
        />
        <TokenCard
          color="text-green-800"
          title="B2B Token"
          token={TOKENS.B2B}
          tokenData={b2b}
          marketData={b2bPulseX.data}
          marketLoading={b2bPulseX.loading}
          marketError={b2bPulseX.error}
          TokenBalance={TokenBalance}
        />
        <TokenCard
          color="text-purple-800"
          title="EOE (EhOneEh)"
          token={TOKENS.EHONEEH}
          tokenData={eoe}
          marketData={eoePulseX.data}
          marketLoading={eoePulseX.loading}
          marketError={eoePulseX.error}
          TokenBalance={TokenBalance}
          mintingInfo={
            <div className={`bg-gray-50 rounded p-2 border border-purple-200 ${darkMode ? 'text-purple-100' : 'text-purple-900'}`}>
              <span className={`font-semibold ${darkMode ? 'text-purple-100' : 'text-purple-900'}`} data-tooltip-id="minting-tooltip">Minting Info:</span>
              <div className={`text-xs mt-1 ${darkMode ? 'text-purple-100' : 'text-gray-700'}`}
                >
                Mint cost to create a new EOE (EhOneEh) is currently <span className="font-bold">{eoeMintInfo.currentCost} A1A</span>.<br />
                This price increases by 1 A1A every 1111 minted after the initial 1111.<br />
                {eoeMintInfo.remainingAtCurrentCost} EOE can be minted at this cost before the next price increase.
              </div>
              <a
                href={`https://scan.pulsechain.com/token/${TOKENS.EHONEEH.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-700 underline text-xs mt-1"
              >
                View EOE contract on PulseChain Explorer
              </a>
              <div className="text-sm text-purple-900 mt-2">
                <div className="text-xl font-bold mb-1">
                  <span className={`${getMintingCostColor(eoeMintInfo.currentCost, eoeMarketPrice)}`}>MINT COST: {eoeMintInfo.currentCost} A1A</span>
                  {(() => {
                    const profitability = checkMintingProfitability(
                      eoeMintInfo.currentCost,
                      eoeMarketPrice,
                      a1aMarketPrice
                    );
                    return (
                      <span className={`ml-2 ${profitability.statusClass} px-2 py-0.5 rounded text-sm`}>
                        {profitability.icon} {profitability.statusLabel}: {profitability.profitMargin.toFixed(1)}%
                      </span>
                    );
                  })()}
                </div>
                <MintButton token={TOKENS.EHONEEH} label="Mint EOE" parentToken={TOKENS.A1A} parentSymbol="A1A" disabled={!address} />
              </div>
              <div className="text-xs mt-2 text-gray-500">
                Next price increase at total supply: <b>{eoeMintInfo.nextMintingStep}</b>
              </div>
              <div className="text-xs mt-2 text-gray-400 bg-gray-100 rounded p-2">
                <b>Debug:</b> Supply: {eoeMintInfo.debug.totalSupply}, Step: {eoeMintInfo.debug.stepSize}, Initial: {eoeMintInfo.debug.initialSupply},<br />
                Minted after initial: {eoeMintInfo.debug.mintedAfterInitial}, Step#: {eoeMintInfo.debug.currentStepNumber},<br />
                Base cost: {eoeMintInfo.debug.initialBaseCost}, Current cost: {eoeMintInfo.debug.currentCost}
              </div>
            </div>
          }
        />
        <TokenCard
          color="text-yellow-700"
          title="BTB (BeeTwoBee)"
          token={TOKENS.BEETWOBEE}
          tokenData={btb}
          marketData={btbPulseX.data}
          marketLoading={btbPulseX.loading}
          marketError={btbPulseX.error}
          TokenBalance={TokenBalance}
          mintingInfo={
            <div className={`bg-gray-50 rounded p-2 border border-yellow-200 ${darkMode ? 'text-yellow-100' : 'text-yellow-900'}`}>
              <span className={`font-semibold ${darkMode ? 'text-yellow-100' : 'text-yellow-900'}`} data-tooltip-id="minting-tooltip">Minting Info:</span>
              <div className={`text-xs mt-1 ${darkMode ? 'text-yellow-100' : 'text-gray-700'}`}
                >
                Mint cost to create a new BTB (BeeTwoBee) is currently <span className="font-bold">{btbMintInfo.currentCost} B2B</span>.<br />
                This price increases by 1 B2B every 420 minted after the initial 420.<br />
                {btbMintInfo.remainingAtCurrentCost} BTB can be minted at this cost before the next price increase.
              </div>
              <a
                href={`https://scan.pulsechain.com/token/${TOKENS.BEETWOBEE.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-700 underline text-xs mt-1"
              >
                View BTB contract on PulseChain Explorer
              </a>
              <div className="text-sm text-yellow-900 mt-2">
                <div className="text-xl font-bold mb-1">
                  <span className={`${getMintingCostColor(btbMintInfo.currentCost, btbMarketPrice)}`}>MINT COST: {btbMintInfo.currentCost} B2B</span>
                  {(() => {
                    const profitability = checkMintingProfitability(
                      btbMintInfo.currentCost,
                      btbMarketPrice,
                      b2bMarketPrice
                    );
                    return (
                      <span className={`ml-2 ${profitability.statusClass} px-2 py-0.5 rounded text-sm`}>
                        {profitability.icon} {profitability.statusLabel}: {profitability.profitMargin.toFixed(1)}%
                      </span>
                    );
                  })()}
                </div>
                <MintButton token={TOKENS.BEETWOBEE} label="Mint BTB" parentToken={TOKENS.B2B} parentSymbol="B2B" disabled={!address} />
              </div>
              <div className="text-xs mt-2 text-gray-500">
                Next price increase at total supply: <b>{btbMintInfo.nextMintingStep}</b>
              </div>
              <div className="text-xs mt-2 text-gray-400 bg-gray-100 rounded p-2">
                <b>Debug:</b> Supply: {btbMintInfo.debug.totalSupply}, Step: {btbMintInfo.debug.stepSize}, Initial: {btbMintInfo.debug.initialSupply},<br />
                Minted after initial: {btbMintInfo.debug.mintedAfterInitial}, Step#: {btbMintInfo.debug.currentStepNumber},<br />
                Base cost: {btbMintInfo.debug.initialBaseCost}, Current cost: {btbMintInfo.debug.currentCost}
              </div>
            </div>
          }
        />
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
          Made with 💻 by the community
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

export default App;
