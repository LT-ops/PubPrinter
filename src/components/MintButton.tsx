import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useSimulateContract, useAccount, useBalance } from 'wagmi';
import { TOKENS } from '../constants/tokens';
import { getMintingInfo } from '../utils/minting';

// --- Mint Button & Modal ---
// Handles approval, allowance, and minting for a token
function MintButton({ token, label, parentToken, parentSymbol, disabled, darkMode: darkModeProp }: { token: any, label: string, parentToken: any, parentSymbol: string, disabled?: boolean, darkMode?: boolean }) {
  const { address } = useAccount();
  // Use separate state variables to avoid cross-dependencies that cause infinite loops
  const [amount, setAmount] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [stepWarning, setStepWarning] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);

  // --- Parent token balance for user guidance ---
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
  let amountInWei: bigint | undefined = undefined;
  const decimals = token.decimals ?? 18;
  try {
    if (amount && amount !== '0' && amount !== '0.' && Number(amount) > 0) {
      amountInWei = ethers.parseUnits(amount, decimals);
    }
  } catch {
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

  let likelyToFail = false;
  if (amountInWei && parentBalanceData?.value) {
    const stepCost = mintingInfo ? BigInt(mintingInfo.currentCost) : 1n;
    const requiredBalance = amountInWei * stepCost;
    if (parentBalanceData.value < requiredBalance) {
      likelyToFail = true;
    }
    if (parentToken.address && allowance !== undefined && allowance < requiredBalance) {
      likelyToFail = true;
    }
  }
  if (gasEstimationFailed) likelyToFail = true;
  if (gasIsHigh) likelyToFail = true;

  const gasWarning = likelyToFail
    ? gasEstimationFailed
      ? 'Gas estimation failed. This transaction may fail or be very expensive. This is often due to insufficient allowance, parent token balance, or contract minting rules.'
      : gasIsHigh
        ? `Warning: Estimated gas is unusually high (${gasEstimate?.toString()}). This mint may be expensive or fail.`
        : null
    : null;

  const updateStepWarning = () => {
    setStepWarning(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    if (mintingInfo && mintingInfo.remainingAtCurrentCost > 0 && Number(amount) > mintingInfo.remainingAtCurrentCost) {
      setStepWarning(`Warning: Minting more than the remaining at current cost (${mintingInfo.remainingAtCurrentCost}). This will cross a step boundary and may increase gas and cost per token.`);
    }
  };

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash: undefined });

  useEffect(() => {
    if (isSuccess) setApproved(true);
  }, [isSuccess]);

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
        const amountInWei = ethers.parseUnits(amount, decimals);
        setApproved(amountInWei <= (allowanceData as bigint));
      } catch (error) {
        setApproved(false);
      }
    } else {
      setAllowance(0n);
      setApproved(false);
    }
  }, [allowanceData, amount, decimals]);

  const handleMint = () => {
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
    // REMOVE: if (decimals === 0) { ... whole number check ... }
    // Only block if not a valid number or <= 0
    if (isNaN(numValue) || numValue <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (amountInWei && mintingInfo) {
      const requiredBalance = amountInWei * BigInt(mintingInfo.currentCost);
      const requiredBalanceFormatted = ethers.formatUnits(requiredBalance, parentToken.decimals || 18);
      if (parentToken.address && parentBalanceData?.value) {
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (${amount} tokens × ${mintingInfo.currentCost} ${parentSymbol}) but only have ${parentBalanceFormatted} ${parentSymbol}`);
          return;
        }
      } else if (!parentToken.address && parentBalanceData?.value) {
        if (parentBalanceData.value < requiredBalance) {
          setError(`Insufficient ${parentSymbol} balance. You need ${Number(requiredBalanceFormatted).toLocaleString()} ${parentSymbol} (${amount} tokens × ${mintingInfo.currentCost} ${parentSymbol}) but only have ${parentBalanceFormatted} ${parentSymbol}`);
          return;
        }
      } else {
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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
    if (error) {
      setError(null);
    }
  };

  const handleAmountBlur = () => {
    if (!amount || amount.trim() === '') {
      return;
    }
    if (amount === '0' || amount === '0.' || Number(amount) <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    // REMOVE: if (decimals === 0 && !Number.isInteger(Number(amount))) { ... }
    // Only block if not a valid number or <= 0
    if (!/^(\d+\.?\d*|\d*\.?\d+)$/.test(amount) || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid positive number');
      return;
    }
    if (amount.includes('.')) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > decimals) {
        setError(`Maximum ${decimals} decimal places allowed`);
        return;
      }
    }
    setError(null);
    updateStepWarning();
  };

  useEffect(() => {
    if (isPending || isTxLoading) {
      // showNotification('Transaction in progress. Please wait...', 'info');
    }
  }, [isPending, isTxLoading]);

  // Detect dark mode from prop or system
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSystemDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);
  const darkMode = darkModeProp ?? systemDark;

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
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{
          background: darkMode ? 'rgba(10,15,25,0.92)' : 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)'
        }}>
          <div
            className="rounded-lg p-6 max-w-md w-full shadow-2xl border"
            style={{
              background: darkMode ? 'rgba(30,34,44,0.98)' : '#fff',
              color: darkMode ? '#fff' : '#1a202c',
              borderColor: darkMode ? '#334155' : '#d1d5db',
              boxShadow: darkMode ? '0 4px 32px #000b' : '0 4px 24px #0002',
              transition: 'background 0.3s, color 0.3s',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{color: darkMode ? '#fff' : '#1a202c'}}>{label}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color: darkMode ? '#e0e7ef' : '#374151'}}>Amount to mint</label>
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  onBlur={handleAmountBlur}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  style={{
                    background: darkMode ? '#232946' : '#f9fafb',
                    color: darkMode ? '#fff' : '#1a202c',
                    borderColor: darkMode ? '#475569' : '#cbd5e1',
                    fontWeight: 500,
                  }}
                  placeholder="Enter amount"
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-red-500 text-sm" style={{color: darkMode ? '#fca5a5' : '#dc2626'}}>
                  {error === `Unable to verify ${parentSymbol} balance. Please try again.`
                    ? (address
                        ? `We couldn't fetch your ${parentSymbol} balance. This may be a network or RPC issue. Please refresh, reconnect, or check your wallet/network.`
                        : `Please connect your wallet to check your balance and mint.`)
                    : error}
                </div>
              )}
              {stepWarning && (
                <div className="text-yellow-600 text-sm bg-yellow-50 p-2 rounded" style={{background: darkMode ? '#3b2f13' : '#fef9c3', color: darkMode ? '#fde68a' : '#b45309'}}>
                  {stepWarning}
                </div>
              )}
              {gasWarning && (
                <div className="text-yellow-600 text-sm bg-yellow-50 p-2 rounded" style={{background: darkMode ? '#3b2f13' : '#fef9c3', color: darkMode ? '#fde68a' : '#b45309'}}>
                  {gasWarning}
                </div>
              )}
              <div className="p-2 rounded text-sm" style={{background: darkMode ? '#232946' : '#f3f4f6', color: darkMode ? '#fff' : '#1a202c'}}>
                <div>Cost per token: <span style={{color: darkMode ? '#fff' : '#1a202c', fontWeight: 600}}>{mintingInfo?.currentCost} {parentSymbol}</span></div>
                {amount && !error && (
                  <div>Total cost: <span style={{color: darkMode ? '#fff' : '#1a202c', fontWeight: 600}}>{Number(amount) * (mintingInfo?.currentCost || 0)} {parentSymbol}</span></div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowInput(false)}
                className="flex-1 px-4 py-2 rounded transition-colors"
                style={{
                  background: darkMode ? '#232946' : '#e5e7eb',
                  color: darkMode ? '#fff' : '#1a202c',
                  border: '1px solid',
                  borderColor: darkMode ? '#475569' : '#cbd5e1',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              {!approved ? (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className="flex-1 px-4 py-2 rounded text-white transition-colors disabled:bg-gray-400"
                  style={{background: darkMode ? '#6366f1' : '#4f46e5'}}
                >
                  {isPending ? 'Approving...' : 'Approve'}
                </button>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={!amount || !!error || isPending}
                  className="flex-1 px-4 py-2 rounded text-white transition-colors disabled:bg-gray-400"
                  style={{background: darkMode ? '#22c55e' : '#16a34a'}}
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

export default MintButton;
