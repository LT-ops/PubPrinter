// Utility functions for minting logic shared between App, MintButton, and TokenCard

export interface MintingDebugInfo {
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

export interface MintingInfo {
  currentCost: number;
  remainingAtCurrentCost: number;
  nextMintingStep: number;
  debug: MintingDebugInfo;
}

export function getMintingInfo(totalSupply: number | undefined, step: number, initialSupply: number = 0): MintingInfo {
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

export function checkMintingProfitability(
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

export function calculateTotalMintCost({
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
  let totalCost = 0;
  let breakdown: Array<{ count: number; cost: number }> = [];
  let supply = totalSupply;
  let remaining = amount;
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
    supply += tokensAtThisCost;
    remaining -= tokensAtThisCost;
  }
  return { totalCost, breakdown };
}
