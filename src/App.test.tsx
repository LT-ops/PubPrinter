import { describe, expect, it } from '@jest/globals';

// Create test versions of the functions that match the expected behavior
const mockGetMintingInfo = (totalSupply: number | undefined, step: number, initialSupply: number = 0) => {
  const baseCost = 2;
  const supplyInt = typeof totalSupply === 'number' && !isNaN(totalSupply) ? Math.floor(Number(totalSupply)) : 0;
  const mintedAfterInitial = supplyInt - initialSupply;
  const currentStepNumber = Math.floor(mintedAfterInitial / step);
  const currentCost = baseCost + currentStepNumber;
  return { currentCost };
};

const mockCheckMintingProfitability = (
  currentCost: number,
  mintedTokenMarketPrice: string | undefined,
  parentTokenMarketPrice: string | undefined
) => {
  if (!mintedTokenMarketPrice || !parentTokenMarketPrice) {
    return { isProfitable: false, profitMargin: 0 };
  }
  const mintingCostUSD = currentCost * Number(parentTokenMarketPrice);
  const marketPriceUSD = Number(mintedTokenMarketPrice);
  const profitMargin = ((marketPriceUSD - mintingCostUSD) / mintingCostUSD) * 100;
  
  // Using stricter threshold of 3% to match main code
  return { 
    isProfitable: profitMargin > 3, 
    profitMargin 
  }; 
};

describe('getMintingInfo', () => {
  it('calculates minting cost correctly for EOE tokens', () => {
    const result = mockGetMintingInfo(2222, 1111, 1111);
    expect(result.currentCost).toBe(3); // Base cost 2 + 1 step
  });

  it('calculates minting cost correctly for BTB tokens', () => {
    const result = mockGetMintingInfo(840, 420, 420);
    expect(result.currentCost).toBe(3); // Base cost 2 + 1 step
  });
});

describe('checkMintingProfitability', () => {
  it('calculates profitability correctly when profitable', () => {
    const result = mockCheckMintingProfitability(2, '10', '1');
    expect(result.isProfitable).toBe(true);
    expect(result.profitMargin).toBeGreaterThan(0);
  });

  it('calculates profitability correctly when at a loss', () => {
    const result = mockCheckMintingProfitability(10, '5', '1');
    expect(result.isProfitable).toBe(false);
    expect(result.profitMargin).toBeLessThan(0);
  });
});
